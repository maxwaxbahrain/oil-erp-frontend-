import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, FileText, Check, AlertCircle, Download } from 'lucide-react';
import {
  type Customer,
  createPayment,
  getUnpaidInvoices,
  updateInvoicePayment,
  getCustomerAdvanceBalance,
  type Invoice
} from '../../services/api';
// ITEM 5E — SearchableSelect removed; replaced with multi-invoice checklist.
// TASK 4 — Real downloadable payment receipt PDF.
import { generatePaymentReceiptPDF, type PaymentReceiptPDFInput } from '../../utils/receiptPDF';
// TASK 9 — Currency selector + base-currency conversion preview.
import { WORLD_CURRENCIES } from '../../constants/currencies';
import { getSystemSettings } from '../../services/settingsService';
// ITEM 5H — Bank/Cash account dropdown sourced from Chart of Accounts.
import { getAccounts, type Account } from '../Accounts/ChartOfAccounts';

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
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  // ITEM 5E — Multi-invoice support. Was: single selectedInvoiceId.
  // Now: an array of selected ids. Single-invoice flow still works
  // (just one item in the array); multi-invoice auto-sums amounts.
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);

  // ITEM 5H — Bank/Cash accounts loaded from COA (1110 "Cash & Bank"
  // and any of its descendants). User picks which account the payment
  // lands in. Forwarded as `deposit_account_id` on the payment payload.
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [depositAccountId, setDepositAccountId] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // TASK 4 — Snapshot what was just submitted so the Receipt PDF can
  // draw it from the success screen even if form state would otherwise
  // mutate. Set in handleSubmit immediately after createPayment resolves.
  const [receiptSnapshot, setReceiptSnapshot] = useState<PaymentReceiptPDFInput | null>(null);

  useEffect(() => {
    loadInvoices();
    loadAdvanceBalance();
    // ITEM 5H — Load bank/cash accounts. Walk parent chain to find
    // anything under 1110 "Cash & Bank" (handles arbitrary nesting).
    try {
      const all = getAccounts();
      const isUnderCashBank = (a: Account): boolean => {
        if (a.id === '1110') return true;
        let pid = a.parentId;
        while (pid) {
            if (pid === '1110') return true;
            const parent = all.find(x => x.id === pid);
            pid = parent ? parent.parentId : null;
        }
        return false;
      };
      const bank = all.filter(isUnderCashBank);
      setBankAccounts(bank);
      // Auto-select: prefer first sub-account of 1110; fall back to 1110 itself.
      const firstChild = bank.find(a => a.parentId === '1110');
      const fallback = bank.find(a => a.id === '1110');
      const initial = firstChild?.id || fallback?.id || '';
      setDepositAccountId(initial);
    } catch (e) {
      console.warn('Could not load bank accounts from Chart of Accounts:', e);
    }
  }, [customer.id]);

  // ITEM 5F — Defensive client-side filter: hide any invoice that has
  // remaining_balance ≤ 0 even if the service layer somehow returns it.
  // Prevents the bug where a just-paid invoice keeps appearing on the
  // payment modal until the backend recomputes its status string.
  const openInvoices = unpaidInvoices.filter(inv => {
    const rb = Number(inv.remaining_balance ?? inv.grandTotal ?? 0);
    return rb > 0.005;
  });

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
    if (openInvoices.length === 0 && selectedInvoiceIds.length === 0 && !isAdvancePayment) {
      setIsAdvancePayment(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openInvoices.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (!isAdvancePayment && selectedInvoiceIds.length === 0) {
      alert('Please select at least one invoice or mark as advance payment');
      return;
    }

    // Single-invoice excess check (multi-invoice flow uses each
    // invoice's full remaining_balance, so excess can't happen there).
    if (!isAdvancePayment && selectedInvoices.length === 1 && selectedInvoice) {
      const invoiceBalance = Number(selectedInvoice.remaining_balance ?? selectedInvoice.grandTotal ?? 0);
      if (amount > invoiceBalance) {
        const proceed = confirm(
          `Payment amount (${amount}) exceeds invoice balance (${invoiceBalance}).\n\n` +
          `The excess amount will be recorded as advance payment.\n\nContinue?`
        );
        if (!proceed) return;
      }
    }

    try {
      setLoading(true);

      // ITEM 5E — Multi-invoice payment fan-out. Backend's
      // /ledger/payment takes ONE invoice_id per POST, so we do N
      // sequential requests when multiple invoices are selected. Each
      // invoice gets its full remaining_balance applied. Tracks
      // failures so partial success surfaces honestly.
      const succeeded: string[] = [];
      const failures: Array<{ invoiceNumber?: string; reason: string }> = [];

      if (isAdvancePayment) {
        const baseAmount = isForeignCurrency ? amountInBase : amount;
        try {
          await createPayment({
            customer_id: customer.id,
            amount: baseAmount,
            payment_method: paymentMethod,
            reference, notes, payment_date: paymentDate,
            invoice_id: undefined,
            is_advance: true,
            currency, exchange_rate: exchangeRate, amount_in_base_currency: baseAmount,
            // ITEM 5H — Bank/Cash COA account that received this payment.
            deposit_account_id: depositAccountId || undefined,
          });
          succeeded.push('(advance)');
        } catch (err) {
          failures.push({ reason: err instanceof Error ? err.message : String(err) });
        }
      } else if (selectedInvoices.length === 1 && selectedInvoice) {
        // Single-invoice path: user-entered amount goes to that invoice
        // (preserves partial-pay UX). Backward-compatible with prior flow.
        const baseAmount = isForeignCurrency ? amountInBase : amount;
        try {
          await createPayment({
            customer_id: customer.id,
            amount: baseAmount,
            payment_method: paymentMethod,
            reference, notes, payment_date: paymentDate,
            invoice_id: selectedInvoiceIds[0],
            is_advance: false,
            currency, exchange_rate: exchangeRate, amount_in_base_currency: baseAmount,
            // ITEM 5H — Bank/Cash COA account that received this payment.
            deposit_account_id: depositAccountId || undefined,
          });
          await updateInvoicePayment(selectedInvoiceIds[0], baseAmount);
          succeeded.push(selectedInvoice.invoiceNumber || `#${selectedInvoiceIds[0]}`);
        } catch (err) {
          failures.push({
            invoiceNumber: selectedInvoice.invoiceNumber,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        // Multi-invoice path: one POST per invoice with its full balance.
        for (const inv of selectedInvoices) {
          const invOriginal = Number(inv.remaining_balance ?? inv.grandTotal ?? 0);
          const invBase = isForeignCurrency
            ? Number((invOriginal * (exchangeRate || 1)).toFixed(2))
            : invOriginal;
          try {
            await createPayment({
              customer_id: customer.id,
              amount: invBase,
              payment_method: paymentMethod,
              reference, notes, payment_date: paymentDate,
              invoice_id: String(inv.id),
              is_advance: false,
              currency, exchange_rate: exchangeRate, amount_in_base_currency: invBase,
              // ITEM 5H — Same deposit account applies to every invoice in the batch.
              deposit_account_id: depositAccountId || undefined,
            });
            await updateInvoicePayment(String(inv.id), invBase);
            succeeded.push(inv.invoiceNumber || `#${inv.id}`);
          } catch (err) {
            failures.push({
              invoiceNumber: inv.invoiceNumber,
              reason: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      if (failures.length > 0) {
        const failList = failures.map(f => `• ${f.invoiceNumber || '?'}: ${f.reason}`).join('\n');
        alert(
          `Recorded ${succeeded.length} of ${succeeded.length + failures.length} payments.\n\n` +
          `Failed:\n${failList}`
        );
        if (succeeded.length === 0) {
          setLoading(false);
          return; // total failure — don't show success screen
        }
      }

      // TASK 4 — Capture a snapshot of the just-submitted payment so the
      // success screen's Download Receipt button has stable, post-submit
      // data to render. Includes the linked invoice number (if any) and
      // any customer code/currency for cleaner PDF metadata.
      // TASK 9 — Receipt shows the ORIGINAL currency + amount the
      // customer paid in (not the converted base value) so they get
      // an accurate record. The backend stores the base amount for
      // ledger correctness.
      // ITEM 5E — Receipt invoice list reflects everything that
      // actually posted (may be a comma-joined list for multi-invoice).
      const recordedInvoiceNumbers = succeeded
        .filter(s => s !== '(advance)')
        .join(', ');
      setReceiptSnapshot({
        customerName: customer.name,
        customerCode: (customer as Customer & { code?: string }).code,
        amount,
        currency,
        paymentDate,
        paymentMethod,
        reference,
        notes,
        invoiceNumber: !isAdvancePayment && recordedInvoiceNumbers
          ? recordedInvoiceNumbers
          : undefined,
        isAdvance: isAdvancePayment,
      });

      // TASK 4 — Removed the 2s auto-back. User now actively dismisses
      // the success screen via the Done button, giving them time to
      // download the receipt PDF. Resolves ISSUE-U from the W6 trace.
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
            Payment of <span className="font-black text-green-600">${amount.toLocaleString()}</span> has been successfully recorded.
          </p>

          {/* TASK 4 — Download Receipt + Done buttons. No more auto-back
              after 2s; user dismisses explicitly so they have time to grab
              the receipt PDF. */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => receiptSnapshot && generatePaymentReceiptPDF(receiptSnapshot)}
              disabled={!receiptSnapshot}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg disabled:opacity-50"
            >
              <Download size={16} /> Download Receipt
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-black uppercase tracking-widest rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - QuickBooks Style */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-[#45B854] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#45B854] rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Receive Payment</h1>
              <p className="text-sm text-gray-600 font-semibold mt-1">Record customer payment</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Customer Information</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer Name</label>
            <div className="text-lg font-black text-gray-900 mt-1">{customer.name}</div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer Code</label>
            <div className="text-lg font-mono font-black text-gray-700 mt-1">{customer.id}</div>
          </div>
          {advanceBalance > 0 && (
            <div className="col-span-2 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-700 uppercase">Available Advance Balance</span>
                <span className="text-2xl font-mono font-black text-blue-900">${advanceBalance.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-8 space-y-8">
        {/* Payment Type Toggle */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={isAdvancePayment}
              onChange={(e) => {
                setIsAdvancePayment(e.target.checked);
                if (e.target.checked) {
                  // ITEM 5E — Advance mode clears the multi-invoice selection.
                  setSelectedInvoiceIds([]);
                  setAmount(0);
                }
              }}
              className="w-5 h-5 rounded border-2 border-gray-300 text-[#45B854] focus:ring-2 focus:ring-[#45B854] focus:ring-offset-2"
            />
            <div>
              {/* ITEM 5G — Relabeled to cover opening-balance-only customers. */}
              <span className="text-sm font-black text-gray-900 group-hover:text-[#45B854] transition-colors">
                Advance / Opening Balance Payment (no invoice link)
              </span>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Record payment without linking to a specific invoice — applies directly to the customer's outstanding balance.
              </p>
              {/* ITEM 5G — Inline note when the customer has no open invoices.
                  The auto-enable above also flips the checkbox on, but this
                  explains WHY the form is in advance mode. */}
              {openInvoices.length === 0 && (
                <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
                  ℹ️ This customer has no open invoices — payment will reduce their outstanding (opening) balance directly.
                </p>
              )}
            </div>
          </label>
        </div>

        {/* ITEM 5E — Multi-invoice checklist. Replaced single SearchableSelect.
            Users tick one or many invoices; total auto-sums into the Amount
            field. Empty state when no unpaid invoices exist tells the user
            to use the Advance Payment toggle. */}
        {!isAdvancePayment && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
                Select Invoice(s) <span className="text-red-500">*</span>
              </label>
              {openInvoices.length > 0 && (
                <div className="flex items-center gap-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceIds(openInvoices.map(i => String(i.id)))}
                    className="hover:text-[#45B854]"
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
                <p className="text-xs text-gray-400 mt-1">Use "Advance Payment" above to record an unallocated payment.</p>
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
                        className="w-5 h-5 rounded border-2 border-gray-300 text-[#45B854] focus:ring-2 focus:ring-[#45B854]"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-sm text-gray-900">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                          {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}
                          {inv.dueDate ? ` · Due ${new Date(inv.dueDate).toLocaleDateString()}` : ''}
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
                <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">
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
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
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
                        : 'border-gray-300 focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10'
                }`}
              />
            </div>
            {selectedInvoiceIds.length > 1 && (
                <p className="text-[10px] text-emerald-700 font-bold mt-1 uppercase tracking-widest">
                    Auto-summed from {selectedInvoiceIds.length} selected invoices · each invoice gets its full balance
                </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none transition-all"
            />
          </div>

          {/* TASK 9 — Currency selector + (conditional) exchange-rate input.
              Defaults to the company base currency; when the user picks
              anything else, we surface the rate input and a live
              "≈ BASE 12,345.67" preview so they can sanity-check the
              conversion before posting. */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
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
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none transition-all bg-white"
            >
              {WORLD_CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>

          {isForeignCurrency && (
            <div className="space-y-3 md:col-span-2">
              <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
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
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none transition-all bg-white"
            >
              {paymentMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          {/* ITEM 5H — Deposit Account selector sourced from Chart of
              Accounts (1110 "Cash & Bank" subtree). Tells the ledger
              which account received the cash. Empty state when no
              sub-accounts are set up under 1110. */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
              Deposit To Account <span className="text-red-500">*</span>
            </label>
            {bankAccounts.length === 0 ? (
              <div className="px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-lg text-xs text-amber-800">
                No bank or cash accounts configured. Set up sub-accounts under <strong>Finance → Chart of Accounts → Cash &amp; Bank (1110)</strong>.
              </div>
            ) : (
                <select
                    value={depositAccountId}
                    onChange={(e) => setDepositAccountId(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none transition-all bg-white"
                >
                    {bankAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                </select>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
              Reference / Cheque No.
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Enter reference number..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-3">
          <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
            Notes / Memo
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any additional notes about this payment..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none resize-none transition-all"
          />
        </div>

        {/* Validation Warning */}
        {!isAdvancePayment && selectedInvoice && amount > (selectedInvoice.remaining_balance || selectedInvoice.grandTotal) && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-900">Payment exceeds invoice balance</p>
              <p className="text-xs text-amber-700 font-medium mt-1">
                The excess amount of ${(amount - (selectedInvoice.remaining_balance || selectedInvoice.grandTotal)).toLocaleString()} will be recorded as advance payment.
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
            disabled={loading}
            className="px-12 py-3 bg-[#45B854] text-white rounded-lg text-sm font-black uppercase tracking-widest hover:bg-[#3A9D47] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3"
          >
            <CreditCard size={18} />
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
