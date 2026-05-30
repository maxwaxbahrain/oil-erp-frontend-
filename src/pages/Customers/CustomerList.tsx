import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Plus, Loader2, Users } from 'lucide-react';
import { type Customer, getCustomers, deleteCustomer } from '../../services/customerService';

/* Visual tokens only (layout/CSS) */
const ROW_GRID =
  'grid grid-cols-[minmax(160px,1.5fr)_minmax(80px,0.9fr)_minmax(88px,0.8fr)_minmax(100px,0.85fr)_minmax(88px,0.75fr)_minmax(108px,0.9fr)] items-center gap-3';
const STAT_CARD = 'rounded-xl bg-[#111827] border border-sky-500/40 p-5';
const ROW_CARD =
  'rounded-lg border border-sky-500/40 bg-[#111827] hover:bg-redwood-bg-surface/60 transition-colors';
const TOOL_BTN =
  'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#111827] border border-sky-500/20 text-sm font-medium text-redwood-text-muted hover:text-redwood-text-main transition-colors shrink-0';
const ICON_BTN =
  'w-8 h-8 rounded-md border border-sky-500/25 bg-redwood-bg-light text-redwood-text-muted hover:text-redwood-text-main flex items-center justify-center';

interface CustomerListProps {
  onEdit?: (customer: Customer) => void;
  onLedger?: (customer: Customer) => void;
  onReceipt?: (customer: Customer) => void;
  refreshTrigger?: number;
}

type StatusFilter = 'all' | 'pending' | 'clear' | 'credit' | 'inactive';

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() || 'CU'
  );
}

function avatarColors(id: string | number): { bg: string; color: string } {
  const palette = [
    { bg: 'rgba(59,130,246,0.2)', color: '#60A5FA' },
    { bg: 'rgba(16,185,129,0.2)', color: '#34D399' },
    { bg: 'rgba(245,158,11,0.2)', color: '#FBBF24' },
    { bg: 'rgba(239,68,68,0.2)', color: '#F87171' },
    { bg: 'rgba(139,92,246,0.2)', color: '#A78BFA' },
  ];
  const idx =
    Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % palette.length;
  return palette[idx];
}

function formatRelativeDate(d?: string): string {
  if (!d) return '—';
  try {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function statusBadge(c: Customer): { label: string; className: string } {
  const bal = Number(c.balance ?? 0);
  if (c.status === 'Suspended')
    return { label: 'Suspended', className: 'bg-red-500/15 text-red-400 border border-red-500/25' };
  if (c.status === 'Inactive')
    return { label: 'Inactive', className: 'bg-white/5 text-slate-400 border border-white/10' };
  if (bal < 0)
    return { label: 'Credit', className: 'bg-blue-500/15 text-blue-400 border border-blue-500/25' };
  if (bal === 0)
    return { label: 'Clear ✓', className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' };
  return { label: 'Pending', className: 'bg-amber-500/15 text-amber-400 border border-amber-500/25' };
}

function formatMoney2(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatOutstanding(bal: number): { text: string; className: string } {
  if (bal < 0)
    return {
      text: `CR $${formatMoney2(Math.abs(bal))}`,
      className: 'text-blue-400',
    };
  if (bal === 0) return { text: '$0.00', className: 'text-[#8892B0]' };
  return {
    text: `$${formatMoney2(bal)}`,
    className: 'text-amber-400 font-semibold',
  };
}

function exportCustomersCsv(rows: Customer[]) {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ['Name', 'ID', 'Phone', 'Outstanding', 'Status'].join(','),
    ...rows.map((c) => {
      const bal = Number(c.balance ?? 0);
      const badge = statusBadge(c);
      return [
        escape(c.name),
        escape(c.code ?? `CUST-${c.id}`),
        escape(c.phone ?? ''),
        bal,
        escape(badge.label),
      ].join(',');
    }),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CustomerList({ refreshTrigger }: CustomerListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortByBalance, setSortByBalance] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError(
        err instanceof Error ? err.message : 'Unable to load customers. Start the API and refresh.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCustomers();
        if (!cancelled) {
          setCustomers(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unable to load customers. Start the API and refresh.'
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, location.key]);

  const lastSilentLoadAtRef = useRef<number>(Date.now());
  useEffect(() => {
    async function silentRefresh() {
      const now = Date.now();
      if (now - lastSilentLoadAtRef.current < 5000) return;
      lastSilentLoadAtRef.current = now;
      try {
        const data = await getCustomers();
        setCustomers(data);
      } catch {
        /* keep previous snapshot */
      }
    }
    function onVisibilityChange() {
      if (!document.hidden) void silentRefresh();
    }
    function onFocus() {
      void silentRefresh();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  async function handleDelete(customer: Customer, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete customer "${customer.name}"? This cannot be undone.`)) return;
    try {
      await deleteCustomer(String(customer.id));
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed.';
      alert(`Could not delete: ${msg}`);
    }
  }

  const stats = useMemo(() => {
    const total = customers.length;
    const outstandingTotal = customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance ?? 0)), 0);
    const owingCount = customers.filter((c) => Number(c.balance ?? 0) > 0).length;
    const creditCount = customers.filter((c) => Number(c.balance ?? 0) < 0).length;
    const activeCount = customers.filter(
      (c) => c.status !== 'Inactive' && c.status !== 'Suspended'
    ).length;
    return { total, outstandingTotal, owingCount, creditCount, activeCount };
  }, [customers]);

  const q = searchTerm.toLowerCase().trim();
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const name = (customer.name ?? '').toLowerCase();
      const idStr = String(customer.id ?? '').toLowerCase();
      const code = (customer.code ?? '').toLowerCase();
      const addr = (customer.address ?? '').toLowerCase();
      const city = (customer.city ?? '').toLowerCase();
      const matchesSearch =
        !q || name.includes(q) || idStr.includes(q) || code.includes(q) || addr.includes(q) || city.includes(q);
      if (!matchesSearch) return false;

      const bal = Number(customer.balance ?? 0);
      if (statusFilter === 'pending') return bal > 0;
      if (statusFilter === 'clear') return bal === 0;
      if (statusFilter === 'credit') return bal < 0;
      if (statusFilter === 'inactive')
        return customer.status === 'Inactive' || customer.status === 'Suspended';
      return true;
    });
  }, [customers, q, statusFilter]);

  const sortedCustomers = useMemo(() => {
    const list = [...filteredCustomers];
    if (sortByBalance) {
      list.sort((a, b) => {
        const ba = Number(a.balance ?? 0);
        const bb = Number(b.balance ?? 0);
        if (ba > 0 && bb <= 0) return -1;
        if (bb > 0 && ba <= 0) return 1;
        return bb - ba;
      });
    } else {
      list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    }
    return list;
  }, [filteredCustomers, sortByBalance]);

  const filterLabel =
    statusFilter === 'all'
      ? 'Filter'
      : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);

  return (
    <div className="min-h-full bg-redwood-bg-light text-redwood-text-main pb-10">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-redwood-text-main flex items-center gap-2.5">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#60A5FA"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
                aria-hidden
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Customers
            </h1>
            <p className="text-sm text-redwood-text-muted mt-1">
              {stats.total} customers · {stats.owingCount} with outstanding balance · {stats.creditCount}{' '}
              with credit
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/customers/new')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4F8EF7] text-white border-none hover:bg-[#3b7edd] text-sm font-semibold transition-colors shrink-0"
          >
            <Plus size={16} />
            Add customer
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className={STAT_CARD}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-redwood-text-muted">Total Customers</p>
            <p className="text-3xl font-bold text-blue-400 mt-2 tabular-nums">{stats.total}</p>
            <p className="text-xs text-redwood-text-muted mt-1">in database</p>
          </div>
          <div className={STAT_CARD}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-redwood-text-muted">Outstanding AR</p>
            <p
              className={`text-3xl font-bold mt-2 tabular-nums ${
                stats.outstandingTotal > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              ${stats.outstandingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-redwood-text-muted mt-1">
              {stats.owingCount} customer{stats.owingCount === 1 ? '' : 's'} owe
            </p>
          </div>
          <div className={STAT_CARD}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-redwood-text-muted">Credit Balances</p>
            <p className="text-3xl font-bold text-redwood-text-muted mt-2 tabular-nums">{stats.creditCount}</p>
            <p className="text-xs text-redwood-text-muted mt-1">overpaid (CR)</p>
          </div>
          <div className={STAT_CARD}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-redwood-text-muted">Active Customers</p>
            <p className="text-3xl font-bold text-emerald-400 mt-2 tabular-nums">{stats.activeCount}</p>
            <p className="text-xs text-redwood-text-muted mt-1">not inactive</p>
          </div>
        </div>

        {/* Toolbar — single row */}
        <div className="flex flex-row flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-lg bg-[#111827] border border-sky-500/20 px-3 py-2.5">
            <Search size={16} className="text-redwood-text-muted shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, or city..."
              autoComplete="off"
              className="flex-1 bg-transparent border-none outline-none text-sm text-redwood-text-main placeholder:text-redwood-text-muted"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-redwood-text-muted hover:text-redwood-text-main text-lg leading-none"
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2 relative shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilterMenu((v) => !v)}
                className={TOOL_BTN}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                </svg>
                {filterLabel}
              </button>
              {showFilterMenu ? (
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-lg bg-[#111827] border border-sky-500/20 shadow-xl py-1">
                  {(
                    [
                      ['all', 'All customers'],
                      ['pending', 'Outstanding'],
                      ['clear', 'Clear balance'],
                      ['credit', 'Credit (CR)'],
                      ['inactive', 'Inactive / suspended'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setStatusFilter(key);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${
                        statusFilter === key ? 'text-blue-400' : 'text-redwood-text-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={() => setSortByBalance((v) => !v)} className={TOOL_BTN}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m21 16-4 4-4-4" />
                <path d="M17 20V4" />
                <path d="m3 8 4-4 4 4" />
                <path d="M7 4v16" />
              </svg>
              Balance
            </button>
            <button
              type="button"
              onClick={() => exportCustomersCsv(sortedCustomers)}
              disabled={sortedCustomers.length === 0}
              className={`${TOOL_BTN} disabled:opacity-40`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Error */}
        {error && !loading ? (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300 flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadData()}
              className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Customer list */}
        <div className="rounded-xl bg-[#111827] border border-sky-500/25 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-redwood-text-muted gap-3">
              <Loader2 className="animate-spin text-blue-400" size={32} />
              <span className="text-sm font-medium">Loading customers…</span>
            </div>
          ) : !error && customers.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="mx-auto text-redwood-text-muted mb-3" size={40} />
              <p className="text-redwood-text-main font-semibold">No customers yet</p>
              <p className="text-sm text-redwood-text-muted mt-1 mb-4">Start by adding your first customer</p>
              <button
                type="button"
                onClick={() => navigate('/customers/new')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold"
              >
                <Plus size={16} />
                Add first customer
              </button>
            </div>
          ) : !error && sortedCustomers.length === 0 ? (
            <div className="text-center py-12 text-sm text-redwood-text-muted">
              No customers match your search or filters.{' '}
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="text-blue-400 underline"
              >
                Clear filters
              </button>
            </div>
          ) : !error ? (
            <>
              <div className="overflow-x-auto min-w-0">
                <div className="min-w-[720px] px-4 pt-4 pb-2">
                  <div
                    className={`${ROW_GRID} px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-redwood-text-muted border-b border-sky-500/15`}
                  >
                    <span>Customer</span>
                    <span>Phone</span>
                    <span>Added</span>
                    <span className="text-right">Outstanding</span>
                    <span>Status</span>
                    <span className="text-right">Actions</span>
                  </div>
                  <div className="space-y-3 pt-3">
                    {sortedCustomers.map((c) => {
                      const colors = avatarColors(c.id);
                      const bal = Number(c.balance ?? 0);
                      const out = formatOutstanding(bal);
                      const badge = statusBadge(c);
                      return (
                        <div
                          key={c.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/customers/${c.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/customers/${c.id}`);
                            }
                          }}
                          className={`${ROW_GRID} px-4 py-3.5 cursor-pointer ${ROW_CARD}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: colors.bg, color: colors.color }}
                            >
                              {initials(c.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-redwood-text-main text-sm truncate">{c.name}</div>
                              <div className="text-xs text-redwood-text-muted">{c.code ?? `CUST-${c.id}`}</div>
                            </div>
                          </div>
                          <span className="text-sm text-redwood-text-muted">{c.phone ?? '—'}</span>
                          <span className="text-sm text-redwood-text-muted">{formatRelativeDate(c.created_at)}</span>
                          <span className={`text-sm text-right tabular-nums ${out.className}`}>
                            {out.text}
                          </span>
                          <span>
                            <span
                              className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </span>
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => navigate(`/customers/edit/${c.id}`)}
                              className={ICON_BTN}
                              aria-label="Edit"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                <path d="m15 5 4 4" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/customers/${c.id}`)}
                              className={ICON_BTN}
                              aria-label="View"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => void handleDelete(c, e)}
                              className="w-8 h-8 rounded-md border border-red-500/35 bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center"
                              aria-label="Delete"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-redwood-text-muted border-t border-sky-500/15">
                <span>
                  Showing {sortedCustomers.length} of {customers.length} customers
                  {searchTerm ? ` matching "${searchTerm}"` : ''}
                </span>
                <span>Click any row to open customer overview →</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
