import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, FileText, Plus, Printer, X, Edit2 } from 'lucide-react';
import { getCreditNotes, getCreditNoteStats, updateCreditNote, applyCreditToInvoice, type CreditNote } from '../../services/creditNoteService';
import { getCustomerInvoices, type Invoice } from '../../services/api';

const THEME = '#800020';
type FilterTab = 'all' | 'draft' | 'issued' | 'used' | 'expired';

function badgeClass(status: string): string {
  if (status === 'draft') return 'bg-gray-100 text-gray-700';
  if (status === 'issued') return 'bg-blue-100 text-blue-700';
  if (status === 'partially_used') return 'bg-orange-100 text-orange-700';
  if (status === 'fully_used') return 'bg-green-100 text-green-700';
  if (status === 'cancelled') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

// CLEANUP-1 — Removed bumpCachedCustomerBalance. Backend is authoritative
// for customer.balance; cancelling/applying a CN flows through endpoints
// the backend already reconciles. No localStorage cache merge happens on
// getCustomers(), so the optimistic write was a dead operation.

function reasonClass(reason: string): string {
  if (reason === 'overcharge') return 'bg-red-100 text-red-700';
  if (reason === 'return') return 'bg-orange-100 text-orange-700';
  if (reason === 'price_adjustment') return 'bg-blue-100 text-blue-700';
  if (reason === 'goodwill') return 'bg-green-100 text-green-700';
  return 'bg-gray-100 text-gray-700';
}

export default function CreditNotes() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [stats, setStats] = useState<{ totalIssuedThisMonth: number; totalUsed: number; pendingUnused: number; expiringSoon: number } | null>(null);

  // FIX W5-1 — Apply credit-to-invoice modal state.
  const [applyingCN, setApplyingCN] = useState<CreditNote | null>(null);
  const [applyInvoices, setApplyInvoices] = useState<Invoice[]>([]);
  const [applyInvoiceId, setApplyInvoiceId] = useState('');
  const [applyAmount, setApplyAmount] = useState(0);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [notes, st] = await Promise.all([getCreditNotes(), getCreditNoteStats()]);
      setRows(notes);
      setStats(st);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const now = new Date();
    return rows.filter((r) => {
      const matchesQ =
        !q ||
        r.creditNoteNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.originalInvoiceNumber || '').toLowerCase().includes(q);
      const expired = !!r.expiryDate && new Date(r.expiryDate) < now && r.remainingCredit > 0;
      const used = r.status === 'partially_used' || r.status === 'fully_used';
      const matchesTab =
        tab === 'all' ||
        (tab === 'draft' && r.status === 'draft') ||
        (tab === 'issued' && r.status === 'issued') ||
        (tab === 'used' && used) ||
        (tab === 'expired' && expired);
      return matchesQ && matchesTab;
    });
  }, [rows, query, tab]);

  async function cancelNote(note: CreditNote) {
    if (!window.confirm(`Cancel ${note.creditNoteNumber}?`)) return;
    await updateCreditNote(note.id, { status: 'cancelled' });
    // CLEANUP-1 — Removed optimistic balance restore. Backend reconciles
    // customer.balance on CN status change; next list refetch reflects it.
    await load();
  }

  // FIX W5-1 — When the user opens the Apply modal for a CN, load the
  // customer's invoices and filter to those with a remaining balance.
  useEffect(() => {
    if (!applyingCN) {
      setApplyInvoices([]);
      setApplyInvoiceId('');
      setApplyAmount(0);
      setApplyError(null);
      return;
    }
    void (async () => {
      try {
        const invs = await getCustomerInvoices(applyingCN.customerId);
        const open = invs.filter(i => (Number(i.remaining_balance ?? i.grandTotal ?? 0)) > 0);
        setApplyInvoices(open);
        // Auto-pick the original linked invoice if it's open + has balance.
        const preferred = open.find(i => String(i.id) === String(applyingCN.originalInvoiceId));
        if (preferred) {
          setApplyInvoiceId(String(preferred.id));
          const max = Math.min(applyingCN.remainingCredit, Number(preferred.remaining_balance ?? preferred.grandTotal ?? 0));
          setApplyAmount(Number(max.toFixed(2)));
        }
      } catch (e) {
        setApplyError(e instanceof Error ? e.message : 'Could not load customer invoices.');
      }
    })();
  }, [applyingCN]);

  // FIX W5-1 — Pick an invoice in the modal: auto-fill amount with max allowed.
  function pickApplyInvoice(invId: string) {
    setApplyInvoiceId(invId);
    setApplyError(null);
    if (!applyingCN) return;
    const inv = applyInvoices.find(i => String(i.id) === String(invId));
    if (!inv) return;
    const max = Math.min(
      applyingCN.remainingCredit,
      Number(inv.remaining_balance ?? inv.grandTotal ?? 0)
    );
    setApplyAmount(Number(max.toFixed(2)));
  }

  async function confirmApplyCredit() {
    if (!applyingCN) return;
    const inv = applyInvoices.find(i => String(i.id) === String(applyInvoiceId));
    if (!inv) {
      setApplyError('Please select an invoice.');
      return;
    }
    setApplying(true);
    setApplyError(null);
    try {
      const { updatedCN } = await applyCreditToInvoice({
        creditNote: applyingCN,
        invoice: inv,
        amount: applyAmount,
      });
      setApplySuccess(
        `✅ Applied $${applyAmount.toFixed(2)} from ${applyingCN.creditNoteNumber} to invoice ${inv.invoiceNumber || `#${inv.id}`}. ` +
        `CN status: ${updatedCN.status.replace('_', ' ')}.`
      );
      setApplyingCN(null);
      await load();
      setTimeout(() => setApplySuccess(null), 6000);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Apply failed.');
    } finally {
      setApplying(false);
    }
  }

  function printCreditNote(note: CreditNote) {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) {
      // TC-39 — Popup was blocked.  Tell the user instead of silently
      // failing, which was the original bug ("Print not working").
      alert(
        'Please allow popups for this site to print credit notes.\n\n' +
        'Alternative: use your browser\'s File → Print or Save as PDF.'
      );
      return;
    }
    w.document.write(`
      <html><head><title>Credit Note ${note.creditNoteNumber}</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#111}
      h1{font-size:22px;font-weight:900;text-transform:uppercase;margin-bottom:4px}
      .header{display:flex;justify-content:space-between;margin-bottom:24px}
      .badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#f3f4f6;padding:10px;text-align:left;font-size:11px;text-transform:uppercase}
      td{padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px}
      .total{font-size:18px;font-weight:900;color:#800020}
      @media print{button{display:none}}</style></head>
      <body>
      <div class="header">
        <div><h1 style="color:#800020">Credit Note</h1><p style="color:#666;font-size:13px">Reference: ${note.creditNoteNumber}</p></div>
        <div style="text-align:right"><p style="font-size:13px">Issue Date: ${note.issueDate}</p>${note.expiryDate ? `<p style="font-size:13px">Expiry: ${note.expiryDate}</p>` : ''}</div>
      </div>
      <table style="margin-bottom:16px;width:100%"><tr>
        <td style="border:none"><strong>Customer:</strong> ${note.customerName}</td>
        <td style="border:none"><strong>Invoice Ref:</strong> ${note.originalInvoiceNumber || '—'}</td>
        <td style="border:none"><strong>Reason:</strong> ${note.reason.replace('_',' ')}</td>
      </tr></table>
      <table>
        <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
        <tr><td>${note.notes || 'Credit adjustment'}</td><td style="text-align:right">$${note.totalCreditAmount.toLocaleString()}</td></tr>
        ${note.usedAmount > 0 ? `<tr><td>Amount Used</td><td style="text-align:right">-$${note.usedAmount.toLocaleString()}</td></tr>` : ''}
        <tr><td><strong>Remaining Credit</strong></td><td style="text-align:right" class="total">$${note.remainingCredit.toLocaleString()}</td></tr>
      </table>
      <br/><hr/><p style="font-size:11px;color:#999;text-align:center">SOLTOL ONE · Business Platform · Generated ${new Date().toLocaleDateString()}</p>
      </body></html>`);
    w.document.close();
    // Trigger print directly — avoids the inline-<script> route that
    // stricter browser CSPs may block in document.write'd popups.
    w.focus();
    w.print();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl text-white flex items-center justify-center" style={{ backgroundColor: THEME }}>
            <FileText size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase">Credit Notes</h1>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Manage customer credits & adjustments</p>
          </div>
        </div>
        <button onClick={() => navigate('/sales/credit-notes/new')} className="px-5 py-3 rounded-xl text-white font-black text-sm flex items-center gap-2" style={{ backgroundColor: THEME }}>
          <Plus size={16} /> New Credit Note
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 font-black uppercase">Total Credits Issued</p><p className="text-2xl font-black">${stats.totalIssuedThisMonth.toLocaleString()}</p></div>
          <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 font-black uppercase">Total Credits Used</p><p className="text-2xl font-black">${stats.totalUsed.toLocaleString()}</p></div>
          <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 font-black uppercase">Pending / Unused</p><p className="text-2xl font-black">${stats.pendingUnused.toLocaleString()}</p></div>
          <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 font-black uppercase">Expiring Soon</p><p className="text-2xl font-black">{stats.expiringSoon}</p></div>
        </div>
      )}

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'issued', 'used', 'expired'] as FilterTab[]).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase ${tab === k ? 'text-white' : 'bg-gray-100 text-gray-600'}`} style={tab === k ? { backgroundColor: THEME } : undefined}>
              {k}
            </button>
          ))}
        </div>
        <div className="relative">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search CN number, customer, invoice" className="w-full border rounded-lg pr-3 py-2.5 text-sm" />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 text-xs uppercase">CN</th><th className="text-left p-3 text-xs uppercase">Customer</th><th className="text-left p-3 text-xs uppercase">Invoice</th><th className="text-left p-3 text-xs uppercase">Issue</th><th className="text-left p-3 text-xs uppercase">Reason</th><th className="text-right p-3 text-xs uppercase">Total</th><th className="text-right p-3 text-xs uppercase">Used</th><th className="text-right p-3 text-xs uppercase">Remaining</th><th className="text-center p-3 text-xs uppercase">Status</th><th className="text-center p-3 text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={10} className="p-8 text-center">Loading...</td></tr> : filtered.map((r) => {
              // TASK 6 — Expired flag: issued CN past its expiry with credit still
              // unused. We don't auto-cancel (per the brief) — just surface a red
              // "Expired" badge so the user can take action.
              const isExpired = r.status === 'issued'
                && !!r.expiryDate
                && new Date(r.expiryDate) < new Date()
                && r.remainingCredit > 0;
              return (
              <tr key={r.id} className={`border-t ${isExpired ? 'bg-red-50/40' : ''}`}>
                <td className="p-3 font-black">{r.creditNoteNumber}</td>
                <td className="p-3">{r.customerName}</td>
                <td className="p-3">{r.originalInvoiceNumber || '-'}</td>
                <td className="p-3">{r.issueDate}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${reasonClass(r.reason)}`}>{r.reason.replace('_', ' ')}</span></td>
                <td className="p-3 text-right font-mono">${r.totalCreditAmount.toLocaleString()}</td>
                <td className="p-3 text-right font-mono">${r.usedAmount.toLocaleString()}</td>
                <td className={`p-3 text-right font-mono font-black ${r.remainingCredit > 0 ? 'text-orange-600' : ''}`}>${r.remainingCredit.toLocaleString()}</td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <span className={`px-2 py-1 rounded text-xs font-black uppercase ${badgeClass(r.status)}`}>{r.status.replace('_', ' ')}</span>
                    {/* TASK 6 — Expiry warning badge. Sits next to the status
                        badge so users see both the official status AND the
                        passed-expiry signal without losing existing context. */}
                    {isExpired && (
                      <span
                        className="px-2 py-1 rounded text-xs font-black uppercase bg-red-100 text-red-700 border border-red-200"
                        title={`Expired ${new Date(r.expiryDate!).toLocaleDateString()} with $${r.remainingCredit.toLocaleString()} unused`}
                      >
                        Expired
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <button className="text-xs font-bold underline" onClick={() => navigate(`/sales/credit-notes/${r.id}`)}>View</button>
                    <button className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800" onClick={() => printCreditNote(r)}><Printer size={11}/>Print</button>
                    {/* FIX W2-6 — Edit only allowed for Draft + Issued (not used or cancelled). */}
                    {(r.status === 'draft' || r.status === 'issued') && (
                      <button
                        className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-900"
                        onClick={() => navigate(`/sales/credit-notes/edit/${r.id}`)}
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                    )}
                    {/* FIX W5-1 — Apply opens the allocation modal. Only shown
                        when there's credit left and the CN is in a usable state. */}
                    {r.remainingCredit > 0 && r.status !== 'cancelled' && r.status !== 'draft' && (
                      <button
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
                        onClick={() => setApplyingCN(r)}
                      >
                        Apply
                      </button>
                    )}
                    {r.status !== 'cancelled' && <button className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800" onClick={() => void cancelNote(r)}><X size={11}/>Cancel</button>}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-400 flex items-center gap-2"><CalendarClock size={14} /> Theme-aligned credit tracking</div>

      {/* FIX W5-1 — Success banner after applying credit. */}
      {applySuccess && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-50 border-l-4 border-emerald-500 px-5 py-3 rounded-r-lg shadow-lg max-w-md">
          <p className="text-sm font-bold text-emerald-900">{applySuccess}</p>
        </div>
      )}

      {/* FIX W5-1 — Apply Credit to Invoice modal. */}
      {applyingCN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between" style={{ background: THEME, color: 'white' }}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Apply Credit Note</p>
                <h3 className="text-xl font-black mt-1">{applyingCN.creditNoteNumber}</h3>
                <p className="text-xs opacity-90 mt-1">
                  {applyingCN.customerName} · Available credit: ${applyingCN.remainingCredit.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setApplyingCN(null)}
                className="p-2 rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                  Select Invoice
                </label>
                {applyInvoices.length === 0 ? (
                  <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    {applyError ? applyError : 'No open invoices found for this customer.'}
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {applyInvoices.map(inv => {
                      const bal = Number(inv.remaining_balance ?? inv.grandTotal ?? 0);
                      const selected = String(inv.id) === String(applyInvoiceId);
                      return (
                        <label
                          key={inv.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${selected ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                        >
                          <input
                            type="radio"
                            name="apply-invoice"
                            checked={selected}
                            onChange={() => pickApplyInvoice(String(inv.id))}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-bold text-gray-900">{inv.invoiceNumber || `#${inv.id}`}</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                              {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'} · Total ${Number(inv.grandTotal ?? 0).toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono font-black text-red-600">${bal.toFixed(2)}</div>
                            <div className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Outstanding</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {applyInvoiceId && (
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                    Amount to Apply
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={applyAmount}
                      onChange={(e) => { setApplyAmount(parseFloat(e.target.value) || 0); setApplyError(null); }}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const inv = applyInvoices.find(i => String(i.id) === String(applyInvoiceId));
                        if (!inv || !applyingCN) return;
                        const max = Math.min(
                          applyingCN.remainingCredit,
                          Number(inv.remaining_balance ?? inv.grandTotal ?? 0)
                        );
                        setApplyAmount(Number(max.toFixed(2)));
                      }}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-black uppercase tracking-widest"
                    >
                      Apply Max
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Max allowed: ${Math.min(
                      applyingCN.remainingCredit,
                      Number(applyInvoices.find(i => String(i.id) === String(applyInvoiceId))?.remaining_balance ?? applyInvoices.find(i => String(i.id) === String(applyInvoiceId))?.grandTotal ?? 0)
                    ).toFixed(2)}
                  </p>
                </div>
              )}

              {applyError && (
                <div className="text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
                  {applyError}
                </div>
              )}

              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                ℹ️ This will record a ledger entry with payment method "Credit Note" linking the CN to the invoice. The invoice's outstanding balance will reduce by the amount applied.
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setApplyingCN(null)}
                disabled={applying}
                className="flex-1 py-3 bg-white border border-gray-200 text-xs font-black uppercase tracking-widest text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmApplyCredit}
                disabled={applying || !applyInvoiceId || applyAmount <= 0}
                className="flex-[2] py-3 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-lg hover:opacity-90 disabled:opacity-40"
                style={{ background: THEME }}
              >
                {applying ? 'Applying…' : 'Apply Credit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
