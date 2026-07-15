import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';
import { type Customer, type ArSummary, getCustomers, getArSummary, deleteCustomer } from '../../services/customerService';

/* Visual tokens only (layout/CSS) — mockup exact */
const ROW_GRID =
  'grid grid-cols-[minmax(160px,1.5fr)_minmax(80px,0.9fr)_minmax(88px,0.8fr)_minmax(100px,0.85fr)_minmax(88px,0.75fr)_minmax(108px,0.9fr)] items-center gap-3';

const STAT_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  color: '#64748b',
  margin: 0,
};
const STAT_SUB: React.CSSProperties = { fontSize: 11, color: '#64748b', margin: '4px 0 0' };
const STAT_CARD_STYLE: React.CSSProperties = {
  background: '#111827',
  border: '0.5px solid rgba(79,142,247,0.4)',
  borderRadius: 10,
  padding: '14px 16px',
};
const TOOL_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: '#111827',
  border: '0.5px solid #1e2d42',
  borderRadius: 8,
  padding: '8px 14px',
  color: '#94a3b8',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

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
    { bg: 'rgba(59,130,246,0.2)', color: '#60a5fa' },
    { bg: 'rgba(16,185,129,0.2)', color: '#34d399' },
    { bg: 'rgba(245,158,11,0.2)', color: '#fbbf24' },
    { bg: 'rgba(239,68,68,0.2)', color: '#f87171' },
    { bg: 'rgba(139,92,246,0.2)', color: '#a78bfa' },
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

function statusBadge(c: Customer, bal: number): { label: string; style: React.CSSProperties } {
  const base: React.CSSProperties = {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 10px',
    borderRadius: 9999,
  };
  if (c.status === 'Suspended')
    return {
      label: 'Suspended',
      style: {
        ...base,
        background: 'rgba(239,68,68,0.15)',
        color: '#f87171',
        border: '1px solid rgba(239,68,68,0.25)',
      },
    };
  if (c.status === 'Inactive')
    return {
      label: 'Inactive',
      style: {
        ...base,
        background: 'rgba(255,255,255,0.05)',
        color: '#94a3b8',
        border: '1px solid rgba(255,255,255,0.1)',
      },
    };
  if (bal < 0)
    return {
      label: 'Credit',
      style: {
        ...base,
        background: 'rgba(59,130,246,0.15)',
        color: '#60a5fa',
        border: '1px solid rgba(59,130,246,0.25)',
      },
    };
  if (bal === 0)
    return {
      label: 'Clear ✓',
      style: {
        ...base,
        background: 'rgba(16,185,129,0.15)',
        color: '#34d399',
        border: '1px solid rgba(16,185,129,0.25)',
      },
    };
  return {
    label: 'Pending',
    style: {
      ...base,
      background: 'rgba(245,158,11,0.15)',
      color: '#f59e0b',
      border: '1px solid rgba(245,158,11,0.25)',
    },
  };
}

function formatMoney2(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatOutstanding(bal: number): { text: string; style: React.CSSProperties } {
  const base: React.CSSProperties = { fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  if (bal < 0)
    return {
      text: `CR $${formatMoney2(Math.abs(bal))}`,
      style: { ...base, color: '#60a5fa' },
    };
  if (bal === 0) return { text: '$0.00', style: { ...base, color: '#64748b' } };
  return {
    text: `$${formatMoney2(bal)}`,
    style: { ...base, color: '#f59e0b', fontWeight: 500 },
  };
}

function exportCustomersCsv(rows: Customer[], balanceOf: (c: Customer) => number) {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ['Name', 'ID', 'Phone', 'Outstanding', 'Status'].join(','),
    ...rows.map((c) => {
      const bal = balanceOf(c);
      const badge = statusBadge(c, bal);
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

function IconUsersHeader() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#60A5FA"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconPlus16() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconSearch16() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconFilter16() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function IconBalance16() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </svg>
  );
}

function IconExport16() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function IconPencil14() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function IconEye14() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconTrash14() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export default function CustomerList({ refreshTrigger }: CustomerListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  // DASH-3 — authoritative AR from GET /customers/ar-summary (ledger-consistent).
  const [arSummary, setArSummary] = useState<ArSummary | null>(null);
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
      const [data, ar] = await Promise.all([
        getCustomers(),
        getArSummary().catch(() => null), // non-fatal: fall back to per-customer c.balance
      ]);
      setCustomers(data);
      setArSummary(ar);
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
        const [data, ar] = await Promise.all([
          getCustomers(),
          getArSummary().catch(() => null), // non-fatal: fall back to per-customer c.balance
        ]);
        if (!cancelled) {
          setCustomers(data);
          setArSummary(ar);
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

  // DASH-3 — authoritative per-customer balance keyed by id (ledger closing
  // balance from /customers/ar-summary), with fallback to the row's own
  // c.balance when a customer isn't in the summary (or the summary failed).
  const arBalanceById = useMemo(() => {
    const m = new Map<string, number>();
    arSummary?.per_customer.forEach((p) => m.set(String(p.id), p.balance));
    return m;
  }, [arSummary]);
  const balanceOf = useCallback(
    (c: Customer) => {
      const key = String(c.id);
      return arBalanceById.has(key) ? arBalanceById.get(key)! : Number(c.balance ?? 0);
    },
    [arBalanceById]
  );

  const stats = useMemo(() => {
    const total = customers.length;
    // Header total is the authoritative endpoint value when available.
    const outstandingTotal = arSummary
      ? arSummary.total_outstanding
      : customers.reduce((sum, c) => sum + Math.max(0, balanceOf(c)), 0);
    const owingCount = customers.filter((c) => balanceOf(c) > 0).length;
    const creditCount = customers.filter((c) => balanceOf(c) < 0).length;
    const activeCount = customers.filter(
      (c) => c.status !== 'Inactive' && c.status !== 'Suspended'
    ).length;
    return { total, outstandingTotal, owingCount, creditCount, activeCount };
  }, [customers, arSummary, balanceOf]);

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

      const bal = balanceOf(customer);
      if (statusFilter === 'pending') return bal > 0;
      if (statusFilter === 'clear') return bal === 0;
      if (statusFilter === 'credit') return bal < 0;
      if (statusFilter === 'inactive')
        return customer.status === 'Inactive' || customer.status === 'Suspended';
      return true;
    });
  }, [customers, q, statusFilter, balanceOf]);

  const sortedCustomers = useMemo(() => {
    const list = [...filteredCustomers];
    if (sortByBalance) {
      list.sort((a, b) => {
        const ba = balanceOf(a);
        const bb = balanceOf(b);
        if (ba > 0 && bb <= 0) return -1;
        if (bb > 0 && ba <= 0) return 1;
        return bb - ba;
      });
    } else {
      list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    }
    return list;
  }, [filteredCustomers, sortByBalance, balanceOf]);

  const filterLabel =
    statusFilter === 'all'
      ? 'Filter'
      : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);

  return (
    <div style={{ minHeight: '100%', background: '#0d1420', paddingBottom: 40 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 20 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconUsersHeader />
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#f0f4ff' }}>Customers</h1>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
              {stats.total} customers · {stats.owingCount} with outstanding · {stats.creditCount} with credit
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/customers/new')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#3b7eff',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            <IconPlus16 />
            Add customer
          </button>
        </div>

        {/* Summary cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={STAT_CARD_STYLE}>
            <p style={STAT_LABEL}>Total Customers</p>
            <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 600, color: '#60a5fa', fontVariantNumeric: 'tabular-nums' }}>
              {stats.total}
            </p>
            <p style={STAT_SUB}>in database</p>
          </div>
          <div style={STAT_CARD_STYLE}>
            <p style={STAT_LABEL}>Outstanding AR</p>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 22,
                fontWeight: 600,
                color: stats.outstandingTotal > 0 ? '#f59e0b' : '#34d399',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ${stats.outstandingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p style={STAT_SUB}>
              {stats.owingCount} customer{stats.owingCount === 1 ? '' : 's'} owe
            </p>
          </div>
          <div style={STAT_CARD_STYLE}>
            <p style={STAT_LABEL}>Credit Balances</p>
            <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 600, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
              {stats.creditCount}
            </p>
            <p style={STAT_SUB}>overpaid (CR)</p>
          </div>
          <div style={STAT_CARD_STYLE}>
            <p style={STAT_LABEL}>Active Customers</p>
            <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 600, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
              {stats.activeCount}
            </p>
            <p style={STAT_SUB}>not inactive</p>
          </div>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <IconSearch16 />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, or city…"
              autoComplete="off"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#111827',
                border: '0.5px solid #1e2d42',
                borderRadius: 8,
                padding: '8px 12px 8px 34px',
                fontSize: 13,
                color: '#e2e8f0',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setShowFilterMenu((v) => !v)} style={TOOL_BTN_STYLE}>
                <IconFilter16 />
                {filterLabel}
              </button>
              {showFilterMenu ? (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    zIndex: 20,
                    minWidth: 160,
                    borderRadius: 8,
                    background: '#111827',
                    border: '0.5px solid #1e2d42',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                    padding: '4px 0',
                  }}
                >
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
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        fontSize: 13,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: statusFilter === key ? '#60a5fa' : '#94a3b8',
                        fontFamily: 'inherit',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={() => setSortByBalance((v) => !v)} style={TOOL_BTN_STYLE}>
              <IconBalance16 />
              Balance
            </button>
            <button
              type="button"
              onClick={() => exportCustomersCsv(sortedCustomers, balanceOf)}
              disabled={sortedCustomers.length === 0}
              style={{ ...TOOL_BTN_STYLE, opacity: sortedCustomers.length === 0 ? 0.4 : 1 }}
            >
              <IconExport16 />
              Export
            </button>
          </div>
        </div>

        {/* Error */}
        {error && !loading ? (
          <div
            style={{
              borderRadius: 10,
              background: 'rgba(239,68,68,0.1)',
              border: '0.5px solid rgba(239,68,68,0.3)',
              padding: '12px 16px',
              fontSize: 13,
              color: '#fca5a5',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadData()}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                background: '#3b7eff',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Customer list */}
        <div
          style={{
            background: '#111827',
            border: '0.5px solid #1e2d42',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 12, color: '#64748b' }}>
              <Loader2 className="animate-spin" size={32} style={{ color: '#60a5fa' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Loading customers…</span>
            </div>
          ) : !error && customers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 16px' }}>
              <Users size={40} style={{ margin: '0 auto 12px', color: '#64748b' }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0' }}>No customers yet</p>
              <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#64748b' }}>Start by adding your first customer</p>
              <button
                type="button"
                onClick={() => navigate('/customers/new')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#3b7eff',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <IconPlus16 />
                Add first customer
              </button>
            </div>
          ) : !error && sortedCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', fontSize: 13, color: '#64748b' }}>
              No customers match your search or filters.{' '}
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                style={{ background: 'none', border: 'none', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}
              >
                Clear filters
              </button>
            </div>
          ) : !error ? (
            <>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 720, padding: '12px 16px 16px' }}>
                  <div
                    className={ROW_GRID}
                    style={{
                      padding: '10px 16px',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: '#64748b',
                      borderBottom: '0.5px solid #1e2d42',
                    }}
                  >
                    <span>Customer</span>
                    <span>Phone</span>
                    <span>Added</span>
                    <span style={{ textAlign: 'right' }}>Outstanding</span>
                    <span>Status</span>
                    <span style={{ textAlign: 'right' }}>Actions</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {sortedCustomers.map((c) => {
                      const colors = avatarColors(c.id);
                      const bal = balanceOf(c);
                      const out = formatOutstanding(bal);
                      const badge = statusBadge(c, bal);
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
                          className={ROW_GRID}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            background: '#111827',
                            border: '1px solid rgba(79,142,247,0.42)',
                            borderRadius: 8,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#161e2a';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#111827';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 500,
                                flexShrink: 0,
                                background: colors.bg,
                                color: colors.color,
                              }}
                            >
                              {initials(c.name)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.name}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{c.code ?? `CUST-${c.id}`}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{c.phone ?? '—'}</span>
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{formatRelativeDate(c.created_at)}</span>
                          <span style={out.style}>{out.text}</span>
                          <span>
                            <span style={badge.style}>{badge.label}</span>
                          </span>
                          <div
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => navigate(`/customers/edit/${c.id}`)}
                              aria-label="Edit"
                              className="customer-list-icon-btn"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: '0.5px solid #1e2d42',
                                background: 'transparent',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <IconPencil14 />
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/customers/${c.id}`)}
                              aria-label="View"
                              className="customer-list-icon-btn"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: '0.5px solid #1e2d42',
                                background: 'transparent',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <IconEye14 />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => void handleDelete(c, e)}
                              aria-label="Delete"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: '0.5px solid rgba(239,68,68,0.35)',
                                background: 'rgba(239,68,68,0.1)',
                                color: '#f87171',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <IconTrash14 />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginTop: 14,
                  padding: '0 16px 14px',
                  fontSize: 12,
                  color: '#64748b',
                }}
              >
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
      <style>{`
        .customer-list-icon-btn:hover {
          background: #1e2d42 !important;
          color: #e2e8f0 !important;
        }
        input::placeholder {
          color: #64748b;
        }
      `}</style>
    </div>
  );
}
