import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import {
  getSalesReturns,
  getReturnStats,
  patchSalesReturn,
  reasonLabel,
  type ReturnStats,
  type SalesReturn,
  type ReturnStatus,
} from '../../services/salesReturnService';

const THEME = '#800020';

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status: ReturnStatus) {
  const u = status.toUpperCase();
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 border border-gray-200',
    pending: 'bg-orange-50 text-orange-900 border border-orange-200',
    approved: 'bg-blue-50 text-blue-900 border border-blue-200',
    completed: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
  };
  return (
    <span
      className={clsx(
        'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide',
        styles[status] || 'bg-gray-100 text-gray-800'
      )}
    >
      {u}
    </span>
  );
}

function reasonBadge(code: string) {
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#800020]/10 text-[#800020] border border-[#800020]/20">
      {reasonLabel(code)}
    </span>
  );
}

type Tab = 'all' | ReturnStatus;

export default function SalesReturns() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [stats, setStats] = useState<ReturnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([getSalesReturns(), getReturnStats()]);
      setReturns(list);
      setStats(s);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return returns.filter((r) => {
      if (tab !== 'all' && r.status !== tab) return false;
      if (!q) return true;
      return (
        r.returnNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q)
      );
    });
  }, [returns, search, tab]);

  async function handleApprove(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Approve this return? Customer ledger will be credited and the invoice balance updated.')) return;
    setBusyId(id);
    try {
      await patchSalesReturn(id, { status: 'approved' });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Mark this return as completed?')) return;
    setBusyId(id);
    try {
      await patchSalesReturn(id, { status: 'completed' });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Complete failed');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-[0.06] pointer-events-none">
            <RotateCcw size={140} className="text-gray-900" />
          </div>
          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                style={{ backgroundColor: THEME }}
              >
                <RotateCcw size={30} strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">Sales Returns</h1>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">
                  Manage customer returns and credits
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => load()}
                className="p-3 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                aria-label="Refresh"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/sales/returns/new')}
                className="px-5 py-3 rounded-xl text-white text-sm font-black uppercase tracking-wide shadow-lg flex items-center gap-2"
                style={{ backgroundColor: THEME }}
              >
                <Plus size={18} />
                New Return
              </button>
            </div>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Returns Today</p>
              <p className="text-3xl font-black text-gray-900 mt-2 tabular-nums">{stats.totalReturnsToday}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Return Value</p>
              <p className="text-3xl font-black tabular-nums mt-2" style={{ color: THEME }}>
                ${formatMoney(stats.totalReturnValue)}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-semibold">Returns dated today</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Approvals</p>
              <p className="text-3xl font-black text-orange-600 mt-2 tabular-nums">{stats.pendingApprovals}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Completed Returns</p>
              <p className="text-3xl font-black text-emerald-700 mt-2 tabular-nums">{stats.completedReturns}</p>
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <input
            type="search"
            placeholder="Search return #, customer, invoice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#800020]/25 focus:border-[#800020]"
          />
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={clsx(
                  'px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                  tab === t.key ? 'text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'
                )}
                style={tab === t.key ? { backgroundColor: THEME } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-2">
              <Loader2 className="animate-spin" style={{ color: THEME }} size={32} />
              <span className="text-sm font-bold">Loading returns…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <RotateCcw size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="font-black text-gray-800 uppercase text-sm">No returns in this view</p>
              <button
                type="button"
                onClick={() => navigate('/sales/returns/new')}
                className="mt-4 px-6 py-2.5 rounded-xl text-white text-sm font-black uppercase"
                style={{ backgroundColor: THEME }}
              >
                New Return
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase">Return</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase">Reason</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase text-right">Amount</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase text-center">Status</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50/80 cursor-pointer"
                      onClick={() => navigate(`/sales/returns/${r.id}`)}
                    >
                      <td className="px-4 py-3 font-mono font-black text-sm" style={{ color: THEME }}>
                        {r.returnNumber}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-700">{r.invoiceNumber}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 max-w-[160px] truncate">
                        {r.customerName || `Customer #${r.customerId}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={14} className="text-gray-400" />
                          {r.returnDate}
                        </span>
                      </td>
                      <td className="px-4 py-3">{reasonBadge(r.returnReason)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-sm">${formatMoney(r.refundAmount)}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="View"
                            onClick={() => navigate(`/sales/returns/${r.id}`)}
                            className="p-2 rounded-lg text-blue-700 hover:bg-blue-50"
                          >
                            <Eye size={17} />
                          </button>
                          {r.status === 'pending' && (
                            <button
                              type="button"
                              title="Approve"
                              disabled={busyId === r.id}
                              onClick={(e) => handleApprove(e, r.id)}
                              className="p-2 rounded-lg text-white disabled:opacity-50"
                              style={{ backgroundColor: THEME }}
                            >
                              {busyId === r.id ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle size={17} />}
                            </button>
                          )}
                          {r.status === 'approved' && (
                            <button
                              type="button"
                              title="Complete"
                              disabled={busyId === r.id}
                              onClick={(e) => handleComplete(e, r.id)}
                              className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busyId === r.id ? <Loader2 size={17} className="animate-spin" /> : <Clock size={17} />}
                            </button>
                          )}
                          {r.status === 'draft' && (
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => navigate(`/sales/returns/edit/${r.id}`)}
                              className="px-2 py-1.5 rounded-lg text-xs font-black uppercase text-gray-700 border border-gray-200 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
