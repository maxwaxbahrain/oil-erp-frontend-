import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, FileText, Plus, Printer, X } from 'lucide-react';
import { getCreditNotes, getCreditNoteStats, updateCreditNote, type CreditNote } from '../../services/creditNoteService';

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
    await load();
  }

  function printCreditNote(note: CreditNote) {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
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
      <script>setTimeout(()=>window.print(),300)</script>
      </body></html>`);
    w.document.close();
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
            {loading ? <tr><td colSpan={10} className="p-8 text-center">Loading...</td></tr> : filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-black">{r.creditNoteNumber}</td>
                <td className="p-3">{r.customerName}</td>
                <td className="p-3">{r.originalInvoiceNumber || '-'}</td>
                <td className="p-3">{r.issueDate}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${reasonClass(r.reason)}`}>{r.reason.replace('_', ' ')}</span></td>
                <td className="p-3 text-right font-mono">${r.totalCreditAmount.toLocaleString()}</td>
                <td className="p-3 text-right font-mono">${r.usedAmount.toLocaleString()}</td>
                <td className={`p-3 text-right font-mono font-black ${r.remainingCredit > 0 ? 'text-orange-600' : ''}`}>${r.remainingCredit.toLocaleString()}</td>
                <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-xs font-black uppercase ${badgeClass(r.status)}`}>{r.status.replace('_', ' ')}</span></td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <button className="text-xs font-bold underline" onClick={() => navigate(`/sales/credit-notes/${r.id}`)}>View</button>
                    <button className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800" onClick={() => printCreditNote(r)}><Printer size={11}/>Print</button>
                    <button className="text-xs font-bold underline" onClick={() => navigate('/sales/invoices')}>Apply</button>
                    {r.status !== 'cancelled' && <button className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800" onClick={() => void cancelNote(r)}><X size={11}/>Cancel</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-400 flex items-center gap-2"><CalendarClock size={14} /> Theme-aligned credit tracking</div>
    </div>
  );
}
