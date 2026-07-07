import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, FileText, Check, AlertCircle, Download } from 'lucide-react';
import {
  type Customer,
  createPayment,
  getUnpaidInvoices,
  getCustomerAdvanceBalance,
  type Invoice
} from '../../services/api';
// ITEM 5E — SearchableSelect removed; replaced with multi-invoice checklist.
// TASK 4 — Real downloadable payment receipt PDF.
import { generatePaymentReceiptPDF, type PaymentReceiptPDFInput } from '../../utils/receiptPDF';
// TASK 9 — Currency selector + base-currency conversion preview.
import { WORLD_CURRENCIES } from '../../constants/currencies';
import { getSystemSettings } from '../../services/settingsService';
import { formatDateOnly } from '../../utils/formatters';
// ITEM 5H — Bank/Cash account dropdown from backend COA (cash_on_hand + bank).
import { getGLAccounts, type GLAccount } from '../../services/glService';

/** Backend payment lookup matches accounts.id; only cash_on_hand / bank system_keys pass validation. */
const DEPOSIT_SYSTEM_KEYS = new Set(['cash_on_hand', 'bank']);

function filterDepositAccounts(rows: GLAccount[]): GLAccount[] {
  return rows.filter((a) => a.system_key != null && DEPOSIT_SYSTEM_KEYS.has(a.system_key));
}

function defaultDepositAccountId(accounts: GLAccount[]): string {
  const bank = accounts.find((a) => a.system_key === 'bank');
  const cash = accounts.find((a) => a.system_key === 'cash_on_hand');
  const pick = bank ?? cash ?? accounts[0];
  return pick ? String(pick.id) : '';
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
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Invoice linking
  // FIX #2B — opening balance is now an allocable LINE that coexists with
  // invoice selections (was: an "advance mode" toggle that wiped the invoice
  // selection). When checked, `openingBalanceAmount` is sent as an allocation
  // line with invoice_id=null (backend applies_to='opening_balance').
  const [includeOpeningBalance, setIncludeOpeningBalance] = useState(false);
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState<number>(0);
  // ITEM 5E — Multi-invoice support. Was: single selectedInvoiceId.
  // Now: an array of selected ids. Single-invoice flow still works
  // (just one item in the array); multi-invoice auto-sums amounts.
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);

  // ITEM 5H — Cash/bank GL accounts from GET /api/accounts/ (real DB ids).
  const [bankAccounts, setBankAccounts] = useState<GLAccount[]>([]);
  const [depositAccountId, setDepositAccountId] = useState<string>('');
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsLoadError, setAccountsLoadError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // TASK 4 — Snapshot what was just submitted so the Receipt PDF can
  // draw it from the success screen even if form state would otherwise
  // mutate. Set in handleSubmit immediately after createPayment resolves.
  const [receiptSnapshot, setReceiptSnapshot] = useState<PaymentReceiptPDFInput | null>(null);

  useEffect(() => {
    loadInvoices();
    loadAdvanceBalance();
  }, [customer.id]);

  useEffect(() => {
    let cancelled = false;
    setAccountsLoading(true);
    setAccountsLoadError(null);
    getGLAccounts()
      .then((rows) => {
        if (cancelled) return;
        const depositTargets = filterDepositAccounts(rows);
        setBankAccounts(depositTargets);
        setDepositAccountId(defaultDepositAccountId(depositTargets));
        if (depositTargets.length === 0) {
          setAccountsLoadError('No cash or bank accounts are configured in the chart of accounts.');
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setBankAccounts([]);
        setDepositAccountId('');
        const msg = e instanceof Error ? e.message : 'Could not load chart of accounts.';
        setAccountsLoadError(msg);
        console.warn('Could not load deposit accounts from API:', e);
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  // FIX #2B — the outstanding set is EXACTLY what the API returns via
  // getUnpaidInvoices, which is derived from PaymentAllocation rows by the 2A
  // backend. No client-side balance re-filter (the old `rb > 0.005` over a
  // locally-held balance is exactly how a settled invoice used to "look"
  // cleared while the ledger was wrong). Display each invoice's API balance.
  const openInvoices = unpaidInvoices;

  // ITEM 5E — Auto-sum amount when invoices are selected. With 1 invoice,
  // amount stays editable so the user can partial-pay. With N>1, amount
  // becomes the sum of all selected invoices' remaining balances and the
  // input goes read-only (each invoice gets its full remaining_balance).
  const selectedInvoices = openInvoices.filter(inv => selectedInvoiceIds.includes(String(inv.id)));
  const selectedInvoicesTotal = selectedInvoices.reduce(
    (s, inv) => s + Number(inv.remaining_balance ?? inv.grandTotal ?? 0),
    0,
  );
  // For backward-compat with the existing details panel, expose the first selected.
  const selectedInvoice = selectedInvoices.length === 1 ? selectedInvoices[0] : null;

  // FIX #2B — the invoice portion (single invoice = editable `amount` so partial
  // pay still works; multiple = auto-sum of each invoice's API remaining) plus
  // the optional opening-balance line. Used for the preview + submitted total.
  const invoicesPortion = selectedInvoices.length === 1 ? amount : selectedInvoicesTotal;
  const previewTotal = invoicesPortion + (includeOpeningBalance ? openingBalanceAmount : 0);

  useEffect(() => {
    if (selectedInvoiceIds.length === 0) return;
    if (selectedInvoiceIds.length === 1) {
      // Single-invoice mode: pre-fill amount but leave it editable.
      const inv = openInvoices.find(i => String(i.id) === selectedInvoiceIds[0]);
      if (inv) setAmount(Number(inv.remaining_balance ?? inv.grandTotal ?? 0));
    } else {
      // Multi-invoice mode: amount is the auto-sum (input goes read-only).
      setAmount(Number(selectedInvoicesTotal.toFixed(2)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInvoiceIds, unpaidInvoices.length]);

  async function loadInvoices() {
    try {
      const invoices = await getUnpaidInvoices(customer.id);
      setUnpaidInvoices(invoices);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    }
  }

  async function loadAdvanceBalance() {
    try {
      const balance = await getCustomerAdvanceBalance(customer.id);
      setAdvanceBalance(balance);
    } catch (error) {
      console.error('Failed to load advance balance:', error);
    }
  }

  // ITEM 5G — Customers whose balance comes from an opening entry (no
  // invoices) can't link a payment to any invoice. Auto-enable Advance
  // mode in that case so the user lands on a working form immediately.
  // Guard: only auto-enable AFTER the first load completes (we know
  // openInvoices is genuinely empty, not just loading). The flag won't
  // re-fire on subsequent loads because we check whether user already
  // made a selection.
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  useEffect(() => {
    if (!initialLoadDone) {
      setInitialLoadDone(true);
      return;
    }
    if (openInvoices.length === 0 && selectedInvoiceIds.length === 0 && !includeOpeningBalance) {
      // No open invoices → default to the opening-balance line so the form is usable.
      setIncludeOpeningBalance(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openInvoices.length]);

  const depositReady =
    !accountsLoading && !accountsLoadError && bankAccounts.length > 0 && depositAccountId !== '';
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

    // FIX #2B — validate against the combined total (invoices + opening line).
    const hasInvoices = selectedInvoiceIds.length > 0;
    const hasOpening = includeOpeningBalance && openingBalanceAmount > 0.005;
    if (!hasInvoices && !hasOpening) {
      alert('Select at least one invoice, or enter an opening-balance amount.');
      return;
    }
    if (previewTotal <= 0.005) {
      alert('Please enter a valid payment amount');
      return;
    }

    // Single-invoice overpay (with no explicit opening line): the excess is
    // posted as an opening-balance advance instead of over-allocating the invoice.
    if (selectedInvoices.length === 1 && selectedInvoice && !includeOpeningBalance) {
      const remaining = Number(selectedInvoice.remaining_balance ?? 0);
      if (amount - remaining > 0.005) {
        const proceed = confirm(
          `Payment amount (${amount.toFixed(2)}) exceeds the invoice balance (${remaining.toFixed(2)}).\n\n` +
          `The excess ${(amount - remaining).toFixed(2)} will be recorded as an opening-balance (advance) line.\n\nContinue?`
        );
        if (!proceed) return;
      }
    }

    // Convert a display amount to base currency for the ledger (backend has no
    // currency column — same approach the rest of the form uses).
    const toBase = (v: number) =>
      isForeignCurrency ? Number((v * (exchangeRate || 1)).toFixed(2)) : Number(v);

    // Build the allocation lines the 2A backend settles from. invoice_id=null is
    // the opening-balance line. Settlement + derived status come back from the
    // API afterwards — we never compute them here.
    const allocations: Array<{ invoice_id: number | null; amount: number }> = [];
    if (selectedInvoices.length === 1 && selectedInvoice) {
      // Single invoice: honor the editable amount (partial pay), capped at the
      // API remaining. Any excess becomes an explicit opening-balance line.
      const remaining = Number(selectedInvoice.remaining_balance ?? 0);
      const toInvoice = Math.min(amount, remaining);
      if (toInvoice > 0.005) {
        allocations.push({ invoice_id: Number(selectedInvoice.id), amount: toBase(toInvoice) });
      }
      const excess = amount - toInvoice;
      if (!includeOpeningBalance && excess > 0.005) {
        allocations.push({ invoice_id: null, amount: toBase(excess) });
      }
    } else {
      // Multiple invoices: each gets its full API remaining balance.
      for (const inv of selectedInvoices) {
        const remaining = Number(inv.remaining_balance ?? 0);
        if (remaining > 0.005) {
          allocations.push({ invoice_id: Number(inv.id), amount: toBase(remaining) });
        }
      }
    }
    // Opening balance is one more line ALONGSIDE the invoices (never a wipe).
    if (hasOpening) {
      allocations.push({ invoice_id: null, amount: toBase(openingBalanceAmount) });
    }
    if (allocations.length === 0) {
      alert('Nothing to allocate — check the amounts.');
      return;
    }

    const totalBase = Number(allocations.reduce((s, a) => s + a.amount, 0).toFixed(2));

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
        isAdvance: hasOpening && !hasInvoices,
      });

      setSuccess(true);
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
      {advanceBalance > 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-blue-700 uppercase">Available Advance Balance</span>
            <span className="text-2xl font-mono font-black text-blue-900">${advanceBalance.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Payment Form */}
      <form id="payment-form" onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-8 space-y-8">
        {/* FIX #2B — Opening-balance line toggle. Does NOT wipe the invoice
            selection: when on, an amount input appears and an opening-balance
            allocation (invoice_id=null) is sent ALONGSIDE any selected invoices
            in the same receipt. */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={includeOpeningBalance}
              onChange={(e) => setIncludeOpeningBalance(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-gray-300 text-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7] focus:ring-offset-2"
            />
            <div>
              <span className="text-sm font-black text-gray-900 group-hover:text-[#4F8EF7] transition-colors">
                Also allocate to Opening Balance / Advance
              </span>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Applies part of this payment to the customer's opening balance (no invoice link). Can be combined with the invoices selected below in the same receipt.
              </p>
              {openInvoices.length === 0 && (
                <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
                  ℹ️ This customer has no open invoices — record the payment against their opening balance below.
                </p>
              )}
            </div>
          </label>

          {includeOpeningBalance && (
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-600">
                Opening Balance Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={openingBalanceAmount || ''}
                onChange={(e) => setOpeningBalanceAmount(parseFloat(e.target.value) || 0)}
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className="w-full pl-4 pr-4 py-3 border-2 border-gray-300 rounded-lg text-base font-mono font-black outline-none focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10 transition-all"
              />
            </div>
          )}
        </div>

        {/* FIX #2B — Multi-invoice checklist, always visible (opening balance no
            longer hides it). Tick one or many invoices; each posts an allocation
            line. The outstanding set is the API's allocation-derived list. */}
        {(
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-gray-600 ">
                Select Invoice(s) <span className="text-red-500">*</span>
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
                <p className="text-xs text-gray-400 mt-1">Tick "Also allocate to Opening Balance / Advance" above to record an unallocated payment.</p>
              </div>
            ) : (
              <div className="border-2 border-gray-200 rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100">
                {openInvoices.map(inv => {
                  const idStr = String(inv.id);
                  const isChecked = selectedInvoiceIds.includes(idStr);
                  const bal = Number(inv.remaining_balance ?? inv.grandTotal ?? 0);
                  return (
                    <label
                      key={idStr}
                      className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${isChecked ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInvoiceIds(prev => [...prev, idStr]);
                          } else {
                            setSelectedInvoiceIds(prev => prev.filter(x => x !== idStr));
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
              {/* ITEM 5E — Amount goes read-only when multiple invoices
                  are selected (auto-sum is authoritative). Single-invoice
                  and advance flows keep the amount editable. */}
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                min="0.01"
                step="0.01"
                required
                readOnly={selectedInvoiceIds.length > 1}
                placeholder="0.00"
                className={`w-full pl-4 pr-4 py-3 border-2 rounded-lg text-lg font-mono font-black outline-none transition-all ${
                    selectedInvoiceIds.length > 1
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 cursor-not-allowed'
                        : 'border-gray-300 focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10'
                }`}
              />
            </div>
            {selectedInvoiceIds.length > 1 && (
                <p className="text-[10px] text-emerald-700 font-bold mt-1 ">
                    Auto-summed from {selectedInvoiceIds.length} selected invoices · each invoice gets its full balance
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
            ) : accountsLoadError || bankAccounts.length === 0 ? (
              <div className="px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-lg text-xs text-amber-800">
                {accountsLoadError ||
                  'No cash or bank accounts found. Add accounts with system keys cash_on_hand or bank in Finance → Chart of Accounts.'}
              </div>
            ) : (
                <select
                    value={depositAccountId}
                    onChange={(e) => setDepositAccountId(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#4F8EF7] focus:ring-4 focus:ring-[#4F8EF7]/10 outline-none transition-all bg-white"
                >
                    {bankAccounts.map(a => (
                        <option key={a.id} value={String(a.id)}>{a.code} — {a.name}</option>
                    ))}
                </select>
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
        {!includeOpeningBalance && selectedInvoice && amount > Number(selectedInvoice.remaining_balance ?? 0) && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-900">Payment exceeds invoice balance</p>
              <p className="text-xs text-amber-700 font-medium mt-1">
                The excess amount of ${(amount - Number(selectedInvoice.remaining_balance ?? 0)).toLocaleString()} will be recorded as an opening-balance (advance) line.
              </p>
            </div>
          </div>
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

          {includeOpeningBalance && openingBalanceAmount > 0.005 && (
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 11,
            }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Opening balance (advance)</span>
              <span style={{ color: 'var(--color-text-danger)', fontWeight: 500 }}>
                ${Number(openingBalanceAmount).toFixed(2)}
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
