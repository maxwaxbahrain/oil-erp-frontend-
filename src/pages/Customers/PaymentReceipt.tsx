import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, FileText, Check, AlertCircle, Download } from 'lucide-react';
import {
  type Customer,
  createPayment,
  getUnpaidInvoices,
  getCustomerUnappliedAdvances,
  applyAdvanceToInvoice,
  type Invoice,
  type UnappliedAdvance,
} from '../../services/api';
// ITEM 5E — SearchableSelect removed; replaced with multi-invoice checklist.
// TASK 4 — Real downloadable payment receipt PDF.
import { generatePaymentReceiptPDF, type PaymentReceiptPDFInput } from '../../utils/receiptPDF';
// TASK 9 — Currency selector + base-currency conversion preview.
import { WORLD_CURRENCIES } from '../../constants/currencies';
import { getSystemSettings } from '../../services/settingsService';
import { formatDateOnly } from '../../utils/formatters';
import { localIsoDate } from '../../utils/localDate';
import { useBankingAccounts } from '../../hooks/useBankingAccounts';
import type { BankingAccount } from '../../services/glService';
import { depositPickerForMethod, methodIsCashReceipt } from '../../utils/bankingAccounts';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function DepositAccountField({
  method,
  cash,
  banks,
  value,
  onChange,
  errored,
}: {
  method: string;
  cash: BankingAccount[];
  banks: BankingAccount[];
  value: string;
  onChange: (id: string) => void;
  errored: boolean;
}) {
  if (errored) return null;
  const picker = depositPickerForMethod(method, cash, banks);
  if (picker.options.length === 0) return null;
  return (
    <>
      <select
        aria-label="Deposit To Account"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={picker.disabled}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10 outline-none transition-all bg-white disabled:bg-gray-100"
      >
        {picker.options.map((account) => (
          <option key={account.id} value={String(account.id)}>
            {account.code} — {account.name}
          </option>
        ))}
      </select>
      {picker.helper && (
        <p className="text-xs font-bold text-gray-600">{picker.helper}</p>
      )}
    </>
  );
}

interface PaymentReceiptProps {
  customer: Customer;
  onBack: () => void;
}

export default function PaymentReceipt({ customer, onBack }: PaymentReceiptProps) {
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  // TASK 9 — Currency selector. Default = company base currency from
  // system settings. When the user picks a non-base currency, an
  // Exchange Rate input + converted-amount preview appears, and we
  // convert client-side before sending the base amount to the backend
  // (which currently has no currency column — same approach the
  // Expenses module uses for its currency / exchange_rate fields).
  const baseCurrencyCode = (() => {
    try { return getSystemSettings().defaultCurrencyCode || 'USD'; }
    catch { return 'USD'; }
  })();
  const [currency, setCurrency] = useState<string>(baseCurrencyCode);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const isForeignCurrency = currency !== baseCurrencyCode;
  const amountInBase = Number((amount * (exchangeRate || 1)).toFixed(2));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => localIsoDate());

  // ITEM 5E — Multi-invoice support. Was: single selectedInvoiceId.
  // Now: an array of selected ids. Single-invoice flow still works
  // (just one item in the array); multi-invoice auto-sums amounts.
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [allocationAmounts, setAllocationAmounts] = useState<Record<string, number>>({});
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [advances, setAdvances] = useState<UnappliedAdvance[]>([]);
  const [applyPaymentId, setApplyPaymentId] = useState<number | ''>('');
  const [applyInvoiceId, setApplyInvoiceId] = useState('');
  const [applyAmount, setApplyAmount] = useState<number>(0);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [amountFollowsAllocations, setAmountFollowsAllocations] = useState(true);

  const { cash, banks, defaultBank, loading: accountsLoading, error: accountsLoadError } = useBankingAccounts();
  const [depositAccountId, setDepositAccountId] = useState<string>('');
  const depositOptions = accountsLoadError
    ? []
    : depositPickerForMethod(paymentMethod, cash, banks).options;

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // TASK 4 — Snapshot what was just submitted so the Receipt PDF can
  // draw it from the success screen even if form state would otherwise
  // mutate. Set in handleSubmit immediately after createPayment resolves.
  const [receiptSnapshot, setReceiptSnapshot] = useState<PaymentReceiptPDFInput | null>(null);

  useEffect(() => {
    loadInvoices();
    loadAdvances();
  }, [customer.id]);

  useEffect(() => {
    if (accountsLoading) return;
    if (accountsLoadError) {
      setDepositAccountId('');
      return;
    }
    if (methodIsCashReceipt(paymentMethod)) {
      setDepositAccountId(cash[0] ? String(cash[0].id) : '');
      return;
    }
    setDepositAccountId((prev) => {
      if (banks.some((account) => String(account.id) === prev)) return prev;
      return defaultBank ? String(defaultBank.id) : '';
    });
  }, [accountsLoading, accountsLoadError, paymentMethod, cash, banks, defaultBank]);

  // FIX #2B — the outstanding set is EXACTLY what the API returns via
  // getUnpaidInvoices, which is derived from PaymentAllocation rows by the 2A
  // backend. No client-side balance re-filter (the old `rb > 0.005` over a
  // locally-held balance is exactly how a settled invoice used to "look"
  // cleared while the ledger was wrong). Display each invoice's API balance.
  const openInvoices = unpaidInvoices;

  // ITEM 5E — With 1 invoice, amount stays editable so the user can partial-pay.
  // With N>1, amount is the sum of the per-invoice Apply boxes and the input
  // goes read-only. selectedInvoicesTotal stays the outstanding sum for the banner.
  const selectedInvoices = openInvoices.filter(inv => selectedInvoiceIds.includes(String(inv.id)));
  const selectedInvoicesTotal = selectedInvoices.reduce(
    (s, inv) => s + Number(inv.remaining_balance ?? inv.grandTotal ?? 0),
    0,
  );
  // For backward-compat with the existing details panel, expose the first selected.
  const selectedInvoice = selectedInvoices.length === 1 ? selectedInvoices[0] : null;

  // FIX #2B — the invoice portion (single invoice = editable `amount` so partial
  // pay still works; multiple = sum of per-invoice Apply amounts) plus
  // the optional opening-balance line. Used for the preview + submitted total.
  const allocatedTotal = round2(
    selectedInvoiceIds.reduce((sum, id) => sum + Number(allocationAmounts[id] ?? 0), 0),
  );
  const invoicePortion = selectedInvoices.length === 1
    ? Math.min(amount, Math.max(Number(selectedInvoice?.remaining_balance ?? 0), 0))
    : selectedInvoices.length > 1
      ? allocatedTotal
      : 0;
  const advanceRemainder = round2(Math.max(0, amount - invoicePortion));
  const previewTotal = amount;
  const advanceTotal = round2(advances.reduce((sum, row) => sum + Number(row.amount || 0), 0));

  useEffect(() => {
    if (!amountFollowsAllocations || selectedInvoiceIds.length === 0) return;
    if (selectedInvoiceIds.length === 1) {
      const inv = openInvoices.find(i => String(i.id) === selectedInvoiceIds[0]);
      if (inv) setAmount(Number(inv.remaining_balance ?? inv.grandTotal ?? 0));
    } else {
      setAmount(Number(allocatedTotal.toFixed(2)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInvoiceIds, unpaidInvoices.length, allocationAmounts, amountFollowsAllocations]);

  async function loadInvoices() {
    try {
      const invoices = await getUnpaidInvoices(customer.id);
      setUnpaidInvoices(invoices);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    }
  }

  async function loadAdvances() {
    const rows = await getCustomerUnappliedAdvances(customer.id);
    setAdvances(rows);
  }

  async function applyExistingAdvance() {
    const paymentId = Number(applyPaymentId);
    const invoiceId = Number(applyInvoiceId);
    if (!paymentId || !invoiceId || applyAmount <= 0.005) {
      setApplyError('Choose the advance, the invoice, and an amount.');
      return;
    }
    try {
      setLoading(true);
      setApplyError(null);
      await applyAdvanceToInvoice(paymentId, invoiceId, applyAmount);
      await loadInvoices();
      await loadAdvances();
      setApplyPaymentId('');
      setApplyInvoiceId('');
      setApplyAmount(0);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : 'Could not apply the advance.');
    } finally {
      setLoading(false);
    }
  }

  const depositReady =
    !accountsLoading && !accountsLoadError && depositOptions.length > 0 && depositAccountId !== '';
  const submitDisabled = loading || !depositReady;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!depositReady) {
      alert(
        accountsLoadError ||
          'Deposit account is not available. Configure cash/bank accounts in Finance → Chart of Accounts, then reload.'
      );
      return;
    }

    if (amount <= 0.005) {
      alert('Please enter a valid payment amount');
      return;
    }

    const toBase = (v: number) =>
      isForeignCurrency ? Number((v * (exchangeRate || 1)).toFixed(2)) : Number(v);

    const allocations: Array<{ invoice_id: number | null; amount: number }> = [];
    let displayOnInvoices = 0;
    if (selectedInvoices.length === 1 && selectedInvoice) {
      const remaining = Number(selectedInvoice.remaining_balance ?? 0);
      const toInvoice = Math.min(amount, Math.max(remaining, 0));
      if (toInvoice > 0.005) {
        allocations.push({ invoice_id: Number(selectedInvoice.id), amount: toBase(toInvoice) });
        displayOnInvoices = toInvoice;
      }
    } else if (selectedInvoices.length > 1) {
      for (const id of selectedInvoiceIds) {
        const amt = round2(allocationAmounts[id] ?? 0);
        const inv = selectedInvoices.find((row) => String(row.id) === id);
        const remaining = Number(inv?.remaining_balance ?? 0);
        if (amt < 0 || amt > remaining + 0.005) {
          setAllocationError('One or more Apply amounts exceed the invoice balance or are negative. Fix them before saving.');
          return;
        }
      }
      for (const inv of selectedInvoices) {
        const amt = round2(allocationAmounts[String(inv.id)] ?? 0);
        if (amt > 0.005) {
          allocations.push({ invoice_id: Number(inv.id), amount: toBase(amt) });
          displayOnInvoices = round2(displayOnInvoices + amt);
        }
      }
      if (displayOnInvoices - amount > 0.005) {
        setAllocationError('Apply amounts are higher than the payment amount.');
        return;
      }
    }
    const unapplied = round2(amount - displayOnInvoices);
    if (unapplied > 0.005) {
      allocations.push({ invoice_id: null, amount: toBase(unapplied) });
    }
    if (allocations.length === 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const totalBase = Number(allocations.reduce((s, a) => s + a.amount, 0).toFixed(2));
    const hasInvoices = allocations.some((line) => line.invoice_id != null);
    const hasAdvance = unapplied > 0.005;

    try {
      setLoading(true);

      // FIX #2B — ONE payment with an allocations array (was: N fan-out POSTs +
      // a no-op updateInvoicePayment). The backend writes PaymentAllocation rows
      // and derives invoice status/outstanding; the outstanding list refetches
      // from the API when the screen reopens.
      await createPayment({
        customer_id: customer.id,
        amount: totalBase,
        allocations,
        payment_method: paymentMethod,
        reference, notes, payment_date: paymentDate,
        currency, exchange_rate: exchangeRate, amount_in_base_currency: totalBase,
        // ITEM 5H — Bank/Cash COA account that received this payment.
        deposit_account_id: depositAccountId || undefined,
        explicit_advance: hasAdvance,
      });

      // TASK 4/9 — Receipt snapshot. Shows the ORIGINAL currency + total the
      // customer paid; the backend stored the base amount for ledger correctness.
      const recordedInvoiceNumbers = selectedInvoices
        .map(i => i.invoiceNumber || `#${i.id}`)
        .join(', ');
      setReceiptSnapshot({
        customerName: customer.name,
        customerCode: (customer as Customer & { code?: string }).code,
        amount: previewTotal,
        currency,
        paymentDate,
        paymentMethod,
        reference,
        notes,
        invoiceNumber: recordedInvoiceNumbers || undefined,
        isAdvance: hasAdvance && !hasInvoices,
      });

      setSuccess(true);
      setAllocationAmounts({});
      setAllocationError(null);
    } catch (error) {
      console.error('Failed to record payment:', error);
      alert('Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const paymentMethods = ['Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'Debit Card', 'Mobile Payment'];

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={48} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Recorded!</h2>
          <p className="text-gray-600 font-medium mb-8">
            Payment of <span className="font-black text-green-600">${(receiptSnapshot?.amount ?? amount).toLocaleString()}</span> has been successfully recorded.
          </p>

          {/* TASK 4 — Download Receipt + Done buttons. No more auto-back
              after 2s; user dismisses explicitly so they have time to grab
              the receipt PDF. */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => receiptSnapshot && generatePaymentReceiptPDF(receiptSnapshot)}
              disabled={!receiptSnapshot}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 hover:bg-black text-white text-xs font-black  rounded-xl shadow-lg disabled:opacity-50"
            >
              <Download size={16} /> Download Receipt
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-black  rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        gap: 0,
        minHeight: 400,
    }}>
      {/* ── LEFT — form content ── */}
      <div style={{
          padding: '16px 18px',
          borderRight: '0.5px solid var(--color-border-tertiary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
      }}>
      {/* Header — Soltol dark nav style */}
      <div style={{
          background: 'var(--color-background-primary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          padding: '13px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
      }}>
        <div className="flex items-center gap-3">
          <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'rgba(74,143,245,.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
          }}>
            <DollarSign size={18} style={{ color: '#4F8EF7' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
              Receive Payment
            </h1>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Record customer payment
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
              background: 'transparent',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 11,
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              fontFamily: 'inherit',
          }}
        >
          Back
        </button>
      </div>

      {/* Customer Info Card — Soltol pill style */}
      <div style={{
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
      }}>
        {/* Initials avatar — visual only */}
        <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--color-background-warning)',
            color: 'var(--color-text-warning)',
            fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
        }}>
          {(customer.name ?? 'CU').trim().split(/\s+/).slice(0, 2).map((w: string) => w[0] ?? '').join('').toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>
            {customer.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
            {(customer as any).code ?? `CUST-${customer.id}`}
            {(customer as any).payment_terms ? ` · ${(customer as any).payment_terms}` : ''}
          </div>
        </div>

        {/* Outstanding balance */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3 }}>
            Outstanding balance
          </div>
          <div style={{
              fontSize: 16, fontWeight: 500,
              color: Number((customer as any).balance ?? 0) > 0
                ? 'var(--color-text-warning)'
                : 'var(--color-text-success)',
          }}>
            ${Number((customer as any).balance ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Available advance balance — kept as separate row when present */}
      {advanceTotal > 0.005 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-blue-700 uppercase">Available advance</span>
            <span className="text-2xl font-mono font-black text-blue-900">${advanceTotal.toLocaleString()}</span>
          </div>
          <p className="text-xs text-blue-800">This is money already received and not yet applied to an invoice. Applying it does not record cash again.</p>
          {advances.map((row) => (
            <div key={row.payment_id} className="text-sm font-medium text-blue-900">
              {row.reference || `Payment ${row.payment_id}`} · ${Number(row.amount).toFixed(2)}
            </div>
          ))}
          {openInvoices.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                aria-label="Advance to apply"
                value={applyPaymentId}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : '';
                  setApplyPaymentId(id);
                  const row = advances.find((item) => item.payment_id === Number(id));
                  setApplyAmount(row ? Number(row.amount) : 0);
                }}
                className="px-3 py-2 border-2 border-blue-200 rounded-lg text-sm bg-white"
              >
                <option value="">Advance</option>
                {advances.map((row) => (
                  <option key={row.payment_id} value={row.payment_id}>
                    {(row.reference || `Payment ${row.payment_id}`)} · {Number(row.amount).toFixed(2)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Invoice to apply"
                value={applyInvoiceId}
                onChange={(e) => setApplyInvoiceId(e.target.value)}
                className="px-3 py-2 border-2 border-blue-200 rounded-lg text-sm bg-white"
              >
                <option value="">Invoice</option>
                {openInvoices.map((inv) => (
                  <option key={inv.id} value={String(inv.id)}>
                    {inv.invoiceNumber} · {Number(inv.remaining_balance ?? 0).toFixed(2)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyExistingAdvance}
                className="px-3 py-2 bg-blue-700 text-white text-sm font-bold rounded-lg"
              >
                Apply to invoice
              </button>
            </div>
          )}
          {applyError && <p className="text-sm font-bold text-red-600">{applyError}</p>}
        </div>
      )}

      {/* Payment Form */}
      <form id="payment-form" onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-8 space-y-8">
        {/* Invoices are optional. Anything in Payment Amount that is not applied here is an unapplied advance. */}
        {(
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-gray-600 ">
                Select Invoice(s)
              </label>
              {openInvoices.length > 0 && (
                <div className="flex items-center gap-3 text-[10px] font-black text-gray-500 ">
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceIds(openInvoices.map(i => String(i.id)))}
                    className="hover:text-[#4F8EF7]"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceIds([])}
                    className="hover:text-rose-600"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {openInvoices.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <FileText size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-bold text-gray-500">No unpaid invoices for this customer</p>
                <p className="text-xs text-gray-400 mt-1">Enter a payment amount. The whole receipt is saved as an unapplied advance.</p>
              </div>
            ) : (
              <div className="border-2 border-gray-200 rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100">
                {openInvoices.map(inv => {
                  const idStr = String(inv.id);
                  const isChecked = selectedInvoiceIds.includes(idStr);
                  const bal = Number(inv.remaining_balance ?? inv.grandTotal ?? 0);
                  const applyTooHigh = (allocationAmounts[idStr] ?? 0) > bal + 0.005;
                  return (
                    <div
                      key={idStr}
                      className={`flex items-center gap-4 px-4 py-3 transition-colors ${isChecked ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                    >
                      <label
                        htmlFor={`pay-inv-${idStr}`}
                        className="flex flex-1 items-center gap-4 cursor-pointer min-w-0"
                      >
                        <input
                          id={`pay-inv-${idStr}`}
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setAllocationError(null);
                            if (e.target.checked) {
                              const nextIds = selectedInvoiceIds.includes(idStr)
                                ? selectedInvoiceIds
                                : [...selectedInvoiceIds, idStr];
                              setSelectedInvoiceIds(nextIds);
                              setAllocationAmounts((prev) => ({
                                ...prev,
                                [idStr]: round2(Number(inv.remaining_balance ?? inv.grandTotal ?? 0)),
                              }));
                              if (methodIsCashReceipt(paymentMethod)) return;
                              if (inv.deposit_account_id == null) return;
                              const depositKey = String(inv.deposit_account_id);
                              const disagree = openInvoices.some((row) =>
                                selectedInvoiceIds.includes(String(row.id))
                                && row.deposit_account_id != null
                                && String(row.deposit_account_id) !== depositKey,
                              );
                              if (disagree) return;
                              if (!banks.some((account) => String(account.id) === depositKey)) return;
                              setDepositAccountId(depositKey);
                            } else {
                              setSelectedInvoiceIds(prev => prev.filter(x => x !== idStr));
                              setAllocationAmounts((prev) => {
                                const next = { ...prev };
                                delete next[idStr];
                                return next;
                              });
                            }
                          }}
                          className="w-5 h-5 rounded border-2 border-gray-300 text-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-sm text-gray-900">{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-gray-400 font-bold  mt-0.5">
                            {inv.invoiceDate ? formatDateOnly(inv.invoiceDate) : '—'}
                            {inv.dueDate ? ` · Due ${formatDateOnly(inv.dueDate)}` : ''}
                            {' · Total ' + Number(inv.grandTotal ?? 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono font-black text-red-600">{bal.toFixed(2)}</div>
                          <div className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Outstanding</div>
                        </div>
                      </label>
                      {isChecked && selectedInvoiceIds.length > 1 && (
                        <div className="text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={allocationAmounts[idStr] ?? ''}
                            aria-label={`Apply to ${inv.invoiceNumber}`}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setAllocationAmounts(prev => ({ ...prev, [idStr]: Number.isFinite(v) ? v : 0 }));
                              setAllocationError(null);
                            }}
                            className="w-28 px-2 py-1 border-2 border-gray-300 rounded-md text-sm font-mono text-right focus:border-[#4F8EF7] outline-none"
                          />
                          <div className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Apply</div>
                          {applyTooHigh && (
                            <div className="text-[10px] font-bold text-red-600">exceeds outstanding</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedInvoiceIds.length > 0 && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs font-black text-emerald-800 ">
                  {selectedInvoiceIds.length} invoice{selectedInvoiceIds.length === 1 ? '' : 's'} selected
                </span>
                <span className="font-mono font-black text-emerald-900">
                  Total: {selectedInvoicesTotal.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Payment Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 ">
              Payment Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => {
                  setAmountFollowsAllocations(false);
                  setAmount(parseFloat(e.target.value) || 0);
                }}
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                className="w-full pl-4 pr-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-mono font-black outline-none focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10 transition-all"
              />
            </div>
            {advanceRemainder > 0.005 && (
                <p className="text-[10px] text-blue-700 font-bold mt-1">
                    ${advanceRemainder.toFixed(2)} is not applied to an invoice and will be saved as an unapplied advance.
                </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 ">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10 outline-none transition-all"
            />
          </div>

          {/* TASK 9 — Currency selector + (conditional) exchange-rate input.
              Defaults to the company base currency; when the user picks
              anything else, we surface the rate input and a live
              "≈ BASE 12,345.67" preview so they can sanity-check the
              conversion before posting. */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 ">
              Currency <span className="text-red-500">*</span>
            </label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                // Reset rate to 1 when switching back to base.
                if (e.target.value === baseCurrencyCode) setExchangeRate(1);
              }}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10 outline-none transition-all bg-white"
            >
              {WORLD_CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>

          {isForeignCurrency && (
            <div className="space-y-3 md:col-span-2">
              <label className="block text-xs font-black text-gray-600 ">
                Exchange Rate ({currency} → {baseCurrencyCode}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={exchangeRate || ''}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.0001"
                placeholder="e.g. 0.92"
                className="w-full px-4 py-3 border-2 border-amber-300 rounded-lg text-sm font-mono font-bold bg-amber-50 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
              />
              <p className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                ≈ <span className="font-mono">{baseCurrencyCode} {amountInBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="opacity-70 font-normal ml-2">— the customer ledger will be credited in {baseCurrencyCode}.</span>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 ">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10 outline-none transition-all bg-white"
            >
              {paymentMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          {/* ITEM 5H — Deposit account from backend COA (cash_on_hand / bank). */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 ">
              Deposit To Account <span className="text-red-500">*</span>
            </label>
            {accountsLoading ? (
              <div className="px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg text-xs text-gray-600">
                Loading cash and bank accounts…
              </div>
            ) : accountsLoadError || depositOptions.length === 0 ? (
              <div className="px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-lg text-xs text-amber-800">
                {accountsLoadError ||
                  'No cash or bank accounts found. Add accounts with system keys cash_on_hand or bank in Finance → Chart of Accounts.'}
              </div>
            ) : (
              <DepositAccountField
                method={paymentMethod}
                cash={cash}
                banks={banks}
                value={depositAccountId}
                onChange={setDepositAccountId}
                errored={false}
              />
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 ">
              Reference / Cheque No.
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Enter reference number..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-3">
          <label className="block text-xs font-black text-gray-600 ">
            Notes / Memo
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any additional notes about this payment..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10 outline-none resize-none transition-all"
          />
        </div>

        {/* Validation Warning — single-invoice overpay without an explicit
            opening line (the excess posts as an opening-balance advance). */}
        {selectedInvoice && amount > Number(selectedInvoice.remaining_balance ?? 0) + 0.005 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-900">Payment exceeds invoice balance</p>
              <p className="text-xs text-amber-700 font-medium mt-1">
                The excess ${(amount - Number(selectedInvoice.remaining_balance ?? 0)).toFixed(2)} will be saved as an unapplied advance.
              </p>
            </div>
          </div>
        )}

        {allocationError && (
          <p className="text-sm font-bold text-red-600">{allocationError}</p>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-6 border-t-2 border-gray-200">
          <button
            type="button"
            onClick={onBack}
            className="px-8 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            style={{
                background: '#4F8EF7',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: 12,
                fontWeight: 600,
                cursor: submitDisabled ? 'not-allowed' : 'pointer',
                opacity: submitDisabled ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'inherit',
            }}
          >
            <CreditCard size={14} />
            {loading ? 'Recording...' : accountsLoading ? 'Loading accounts…' : 'Record Payment'}
          </button>
        </div>
      </form>
      </div>
      {/* ── /LEFT ── */}

      {/* ── RIGHT — sticky balance preview panel ── */}
      <div style={{
          padding: 16,
          background: 'var(--color-background-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
      }}>
        {/* Payment summary */}
        <div style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 12,
            padding: 12,
        }}>
          <div style={{
              fontSize: 10, fontWeight: 500, color: 'var(--color-text-secondary)',
              textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10,
          }}>
            Payment summary
          </div>

          {selectedInvoiceIds.length > 0 && unpaidInvoices
            .filter(inv => selectedInvoiceIds.includes(String(inv.id)))
            .map(inv => (
              <div
                key={inv.id}
                style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '5px 0',
                    borderBottom: '1px solid rgba(255,255,255,.04)',
                    fontSize: 11,
                }}
              >
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {inv.invoiceNumber ?? inv.id}
                </span>
                <span style={{ color: 'var(--color-text-danger)', fontWeight: 500 }}>
                  ${Number(inv.remaining_balance ?? inv.grandTotal ?? 0).toFixed(2)}
                </span>
              </div>
            ))}

          {advanceRemainder > 0.005 && (
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 11,
            }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Unapplied advance</span>
              <span style={{ color: 'var(--color-text-danger)', fontWeight: 500 }}>
                ${advanceRemainder.toFixed(2)}
              </span>
            </div>
          )}

          <div style={{ height: 1, background: 'var(--color-border-tertiary)', margin: '8px 0' }} />

          <div style={{
              fontSize: 10, fontWeight: 500, color: 'var(--color-text-secondary)',
              textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8,
          }}>
            Balance preview
          </div>

          {[
            {
              label: 'Before payment',
              value: `$${Number((customer as any).balance ?? 0).toFixed(2)}`,
              color: Number((customer as any).balance ?? 0) > 0
                ? 'var(--color-text-warning)'
                : 'var(--color-text-success)',
            },
            {
              label: 'This payment',
              value: `− $${Number(previewTotal).toFixed(2)}`,
              color: 'var(--color-text-success)',
            },
          ].map(row => (
            <div
              key={row.label}
              style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,.04)',
                  fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--color-text-secondary)' }}>{row.label}</span>
              <span style={{ color: row.color, fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}

          {/* After-payment box — a pre-submit ESTIMATE only (labelled below).
              The authoritative outstanding state comes from the API refetch. */}
          {(() => {
            const after = Number((customer as any).balance ?? 0) - Number(previewTotal ?? 0);
            const isCleared = after <= 0;
            const display = Math.max(0, after);
            return (
              <div style={{
                  marginTop: 8, padding: 10, textAlign: 'center',
                  background: isCleared ? 'var(--color-background-success)' : 'var(--color-background-warning)',
                  border: `0.5px solid ${isCleared ? 'var(--color-border-success)' : 'var(--color-border-warning)'}`,
                  borderRadius: 8,
              }}>
                <div style={{
                    fontSize: 10,
                    color: isCleared ? 'var(--color-text-success)' : 'var(--color-text-warning)',
                    marginBottom: 4,
                }}>
                  Balance after payment
                </div>
                <div style={{
                    fontSize: 20, fontWeight: 500,
                    color: isCleared ? 'var(--color-text-success)' : 'var(--color-text-warning)',
                }}>
                  ${display.toFixed(2)}
                </div>
                {isCleared && (
                  <div style={{ fontSize: 9, color: 'var(--color-text-success)', marginTop: 3 }}>
                    Account fully cleared ✓
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Customer mini card */}
        <div style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 10,
            padding: 12,
        }}>
          <div style={{
              fontSize: 10, fontWeight: 500, color: 'var(--color-text-secondary)',
              textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8,
          }}>
            Customer
          </div>
          {[
            { label: 'Name',     value: customer.name ?? '—',                                                          color: 'var(--color-text-primary)' },
            { label: 'Code',     value: (customer as any).code ?? `CUST-${customer.id}`,                               color: 'var(--color-text-info)' },
            { label: 'Terms',    value: (customer as any).payment_terms ?? (customer as any).paymentTerms ?? 'COD',    color: 'var(--color-text-primary)' },
            { label: 'Currency', value: currency,                                                                       color: 'var(--color-text-primary)' },
          ].map(r => (
            <div
              key={r.label}
              style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,.04)',
                  fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--color-text-secondary)' }}>{r.label}</span>
              <span style={{ color: r.color, fontWeight: 500 }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Repeated action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="submit"
            form="payment-form"
            disabled={submitDisabled}
            style={{
                width: '100%', background: '#4F8EF7', color: '#fff', border: 'none',
                borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600,
                cursor: submitDisabled ? 'not-allowed' : 'pointer',
                opacity: submitDisabled ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontFamily: 'inherit',
            }}
          >
            {loading ? 'Recording...' : '✓ Record payment'}
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{
                width: '100%', background: 'transparent',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 8, padding: '8px 14px', fontSize: 11,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
      {/* ── /RIGHT ── */}
    </div>
  );
}
