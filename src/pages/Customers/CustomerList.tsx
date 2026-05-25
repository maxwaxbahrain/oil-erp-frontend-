import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { type Customer, getCustomers, deleteCustomer } from '../../services/customerService';

interface CustomerListProps {
  onEdit?: (customer: Customer) => void;
  onLedger?: (customer: Customer) => void;
  onReceipt?: (customer: Customer) => void;
  refreshTrigger?: number;
}

export default function CustomerList({ refreshTrigger }: CustomerListProps) {
  const navigate = useNavigate();
  // FIX 2 — re-fetch on every navigation to /customers so balances
  // stay fresh after an invoice/payment is created elsewhere.
  const location = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadRegistry() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCustomers();
        if (cancelled) return;
        // Use the server-side balance directly. The backend now maintains it
        // correctly: invoice POST increments, payment POST decrements. We reset
        // historical balances to the BETTANO 'Owes:' baseline via a one-shot script.
        setCustomers(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unable to load customers. Start the API (port 8000) and refresh.'
          );
          setLoading(false);
        }
      }
    }

    void loadRegistry();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, location.key]);

  // FIX 4 — per-row delete with confirm + optimistic state update.
  async function handleDelete(customer: Customer, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete customer "${customer.name}"?  This cannot be undone.`)) return;
    try {
      await deleteCustomer(String(customer.id));
      setCustomers(prev => prev.filter(c => c.id !== customer.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed.';
      alert(`Could not delete: ${msg}\n\nThe customer may have invoices or payments referencing them.`);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError(err instanceof Error ? err.message : 'Unable to load customers. Start the API (port 8000) and refresh.');
    } finally {
      setLoading(false);
    }
  }

  // TASK 5 — Silent refetch when the user returns to this tab. No
  // loading spinner, no error surface (we already have the previous
  // snapshot rendered). Throttled to one fetch per 5 seconds so rapid
  // tab-switching doesn't hammer the backend. Resolves ISSUE-T from
  // the W6 trace: payment recorded in another tab now reflects on
  // return without a manual refresh.
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
        // Silent: keep showing the previous snapshot if the refetch fails.
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

  const q = searchTerm.toLowerCase();
  const filteredCustomers = customers.filter((customer) => {
    const name = (customer.name ?? '').toLowerCase();
    const idStr = String(customer.id ?? '').toLowerCase();
    const addr = (customer.address ?? '').toLowerCase();
    const city = (customer.city ?? '').toLowerCase();
    return name.includes(q) || idStr.includes(q) || addr.includes(q) || city.includes(q);
  });

  // ── Display-only stats (never mutate existing state) ──────────
  const _totalCount = customers.length;
  const _outstandingTotal = customers.reduce(
    (sum, c) => sum + Math.max(0, Number(c.balance ?? 0)), 0
  );
  const _creditCount = customers.filter(c => Number(c.balance ?? 0) < 0).length;
  const _overdueCount = customers.filter(
    c => Number(c.balance ?? 0) > 0
      && c.status !== 'Inactive'
      && c.status !== 'Suspended'
  ).length;

  // Sort filtered customers: positive balance first (highest first),
  // then zero balance, then negative (credit)
  const _sorted = [...filteredCustomers].sort((a, b) => {
    const ba = Number(a.balance ?? 0);
    const bb = Number(b.balance ?? 0);
    if (ba > 0 && bb <= 0) return -1;
    if (bb > 0 && ba <= 0) return 1;
    return bb - ba;
  });

  // Helper — get initials from customer name
  const _initials = (name: string): string =>
    name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || 'CU';

  // Helper — avatar background colour cycling by id
  const _avatarColor = (id: string | number): string => {
    const colours = [
      { bg: 'rgba(74,143,245,.15)', color: '#4A8FF5' },
      { bg: 'rgba(34,197,94,.15)',  color: '#22C55E' },
      { bg: 'rgba(245,158,11,.15)', color: '#F59E0B' },
      { bg: 'rgba(239,68,68,.15)',  color: '#EF4444' },
      { bg: 'rgba(155,111,228,.15)', color: '#9B6FE4' },
    ];
    const idx = Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % colours.length;
    return JSON.stringify(colours[idx]);
  };

  // Helper — format last seen from created_at (best proxy we have)
  const _fmtDate = (d?: string): string => {
    if (!d) return '—';
    try {
      const diff = Date.now() - new Date(d).getTime();
      const days = Math.floor(diff / 86400000);
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
      return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch { return '—'; }
  };

  // Helper — status badge config
  const _statusBadge = (c: Customer): { label: string; style: React.CSSProperties } => {
    const bal = Number(c.balance ?? 0);
    if (c.status === 'Suspended')
      return { label: 'Suspended', style: { background: 'rgba(239,68,68,.12)', color: '#B91C1C' } };
    if (c.status === 'Inactive')
      return { label: 'Inactive', style: { background: 'rgba(255,255,255,.06)', color: '#8BA3C7' } };
    if (bal < 0)
      return { label: 'Credit', style: { background: 'rgba(74,143,245,.12)', color: '#4A8FF5' } };
    if (bal === 0)
      return { label: 'Clear ✓', style: { background: 'rgba(34,197,94,.12)', color: '#16A34A' } };
    return { label: 'Pending', style: { background: 'rgba(245,158,11,.12)', color: '#B45309' } };
  };

  // Helper — balance display (accounting correct)
  const _balDisplay = (bal: number): { text: string; color: string } => {
    if (bal < 0) return { text: `CR $${Math.abs(bal).toLocaleString()}`, color: '#4A8FF5' };
    if (bal === 0) return { text: '$0.00', color: 'var(--t2,#8BA3C7)' };
    return { text: `$${bal.toLocaleString()}`, color: '#F59E0B' };
  };
  // ──────────────────────────────────────────────────────────────

  return (
    <div style={{ background: 'var(--bg0,#060f1c)', minHeight: '100%', color: 'var(--t,#EEF2FF)', fontFamily: 'inherit' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'var(--bg2,#0a1726)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t,#EEF2FF)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              👥 Customers
            </h1>
            <p style={{ fontSize: 12, color: 'var(--t2,#8BA3C7)', margin: 0, marginTop: 4 }}>
              {_totalCount} customers · {_overdueCount} with outstanding balance · {_creditCount} with credit
            </p>
          </div>
          <button
            onClick={() => navigate('/customers/new')}
            style={{ background: '#4F8EF7', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
          >
            + Add customer
          </button>
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180, height: 32, background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6, fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>
            🔍
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, or city…"
              autoComplete="off"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--t,#EEF2FF)', fontSize: 11, width: '100%', fontFamily: 'inherit' }}
            />
            {searchTerm && (
              <span
                onClick={() => setSearchTerm('')}
                style={{ cursor: 'pointer', color: 'var(--t2,#8BA3C7)', fontSize: 13 }}
              >×</span>
            )}
          </div>
          <div style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '5px 11px', fontSize: 11, color: 'var(--t2,#8BA3C7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            ↓ Balance
          </div>
          <div style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '5px 11px', fontSize: 11, color: 'var(--t2,#8BA3C7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            ⚙ Filter
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: 'var(--bg2,#0a1726)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        {[
          { label: 'Total customers',  value: String(_totalCount),
            color: '#4F8EF7', sub: 'in database' },
          { label: 'Outstanding AR',
            value: `$${_outstandingTotal.toLocaleString()}`,
            color: _outstandingTotal > 0 ? '#F59E0B' : '#22C55E',
            sub: `${_overdueCount} customers owe` },
          { label: 'Credit balances',  value: String(_creditCount),
            color: '#4F8EF7', sub: 'overpaid (CR)' },
          { label: 'Active customers',
            value: String(customers.filter(c => c.status !== 'Inactive' && c.status !== 'Suspended').length),
            color: '#22C55E', sub: 'not inactive' },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '10px 14px', borderRight: i < 3 ? '1px solid rgba(255,255,255,.07)' : 'none' }}>
            <div style={{ fontSize: 9, color: 'var(--t3,#3E5678)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 3, textTransform: 'uppercase' }}>
              {s.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1, marginBottom: 2, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--t2,#8BA3C7)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── LOADING STATE ── */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--t2,#8BA3C7)', fontSize: 13 }}>
          Loading customers…
        </div>
      )}

      {/* ── ERROR STATE ── */}
      {error && !loading && (
        <div style={{ margin: 16, padding: 14, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, fontSize: 11, color: '#EF4444' }}>
          {error}
          <button
            onClick={loadData}
            style={{ marginLeft: 12, background: '#4F8EF7', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── EMPTY STATE (no customers at all) ── */}
      {!loading && !error && customers.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--t2,#8BA3C7)', fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 4 }}>
            No customers yet
          </div>
          <div style={{ marginBottom: 14 }}>Start by adding your first customer</div>
          <button
            onClick={() => navigate('/customers/new')}
            style={{ background: '#4F8EF7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + Add first customer
          </button>
        </div>
      )}

      {/* ── NO SEARCH RESULTS ── */}
      {!loading && !error && customers.length > 0 && _sorted.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--t2,#8BA3C7)', fontSize: 12 }}>
          No customers match "{searchTerm}" —{' '}
          <span
            onClick={() => setSearchTerm('')}
            style={{ color: '#4F8EF7', cursor: 'pointer', textDecoration: 'underline' }}
          >
            clear search
          </span>
        </div>
      )}

      {/* ── CUSTOMER TABLE ── */}
      {!loading && !error && _sorted.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--bg2,#0a1726)' }}>
                {['Customer', 'Phone', 'City', 'Added', 'Outstanding', 'Status', ''].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '8px 12px',
                      textAlign: i >= 5 ? 'right' : 'left',
                      fontSize: 10, color: 'var(--t3,#3E5678)', fontWeight: 700,
                      letterSpacing: '.4px', textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(255,255,255,.07)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {_sorted.map(c => {
                const avatarStyle = JSON.parse(_avatarColor(c.id));
                const bal = Number(c.balance ?? 0);
                const balInfo = _balDisplay(bal);
                const badge = _statusBadge(c);
                const city = c.city ?? (c.address?.split(',')[1]?.trim() ?? '—');

                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.04)' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,.025)';
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {/* Customer — avatar + name + id */}
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: avatarStyle.bg, color: avatarStyle.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 600, flexShrink: 0,
                        }}>
                          {_initials(c.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--t,#EEF2FF)', fontSize: 12, marginBottom: 1 }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--t2,#8BA3C7)' }}>
                            {c.code ?? `CUST-${String(c.id).slice(-3)}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td style={{ padding: '9px 12px', color: 'var(--t2,#8BA3C7)' }}>
                      {c.phone ?? '—'}
                    </td>

                    {/* City */}
                    <td style={{ padding: '9px 12px', color: 'var(--t2,#8BA3C7)' }}>
                      {city}
                    </td>

                    {/* Added date */}
                    <td style={{ padding: '9px 12px', color: 'var(--t2,#8BA3C7)' }}>
                      {_fmtDate(c.created_at)}
                    </td>

                    {/* Outstanding balance */}
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontWeight: 600, color: balInfo.color }}>
                        {balInfo.text}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 20, display: 'inline-block', whiteSpace: 'nowrap',
                        ...badge.style,
                      }}>
                        {badge.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            navigate(`/customers/edit/${c.id}`);
                          }}
                          aria-label="Edit customer"
                          title="Edit customer"
                          style={{
                            width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
                            border: '1px solid rgba(255,255,255,.07)',
                            background: 'rgba(255,255,255,.04)',
                            color: 'var(--t2,#8BA3C7)', fontSize: 13,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'inherit',
                          }}
                        >
                          ✏
                        </button>
                        <button
                          onClick={(e: React.MouseEvent) => void handleDelete(c, e)}
                          aria-label="Delete customer"
                          title="Delete customer"
                          style={{
                            width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
                            border: '1px solid rgba(239,68,68,.2)',
                            background: 'rgba(239,68,68,.06)',
                            color: '#EF4444', fontSize: 13,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'inherit',
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Row count footer */}
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid rgba(255,255,255,.07)',
            background: 'var(--bg2,#0a1726)',
            fontSize: 11, color: 'var(--t2,#8BA3C7)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>
              Showing {_sorted.length} of {customers.length} customers
              {searchTerm ? ` matching "${searchTerm}"` : ''}
            </span>
            <span style={{ color: 'var(--t3,#3E5678)' }}>
              Click any row to open customer overview
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
