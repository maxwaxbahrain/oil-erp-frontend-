import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import {
  getSalesReturns,
  getReturnStats,
  patchSalesReturn,
  reasonLabel,
  type ReturnStats,
  type SalesReturn,
  type ReturnStatus,
} from '../../services/salesReturnService';
import { getCreditNotes, type CreditNote } from '../../services/creditNoteService';

/* ── Shared style tokens — mirror Quotations.tsx / SalesDashboard ── */
const panelStyle: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '14px',
  padding: '14px 16px',
};

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatReturnDate(raw: string): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return raw;
  }
}

function reasonBadgeStyle(code: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    damaged: {
      background: 'var(--color-badge-red-bg)',
      color: 'var(--color-brand-red-tint)',
      border: '1px solid rgba(239,68,68,.2)',
    },
    wrong_product: {
      background: 'var(--color-badge-amber-bg)',
      color: 'var(--color-brand-amber-tint)',
      border: '1px solid rgba(245,158,11,.28)',
    },
    short_delivery: {
      background: 'var(--color-badge-amber-bg)',
      color: 'var(--color-brand-amber-tint)',
      border: '1px solid rgba(245,158,11,.28)',
    },
    price_dispute: {
      background: 'var(--color-badge-blue-bg)',
      color: 'var(--color-brand-blue-tint)',
      border: '1px solid rgba(79,142,247,.28)',
    },
    customer_changed_mind: {
      background: 'rgba(124,58,237,.12)',
      color: '#C4B5FD',
      border: '1px solid rgba(124,58,237,.28)',
    },
    other: {
      background: 'rgba(124,58,237,.12)',
      color: '#C4B5FD',
      border: '1px solid rgba(124,58,237,.28)',
    },
  };
  return map[code] ?? map.other;
}

function ReasonBadge({ code }: { code: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 20,
        display: 'inline-block',
        whiteSpace: 'nowrap',
        ...reasonBadgeStyle(code),
      }}
    >
      {reasonLabel(code)}
    </span>
  );
}

type Tab = 'all' | ReturnStatus;

export default function SalesReturns() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [stats, setStats] = useState<ReturnStats | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [list, s, notes] = await Promise.all([
        getSalesReturns(),
        getReturnStats(),
        getCreditNotes(),
      ]);
      setReturns(list);
      setStats(s);
      setCreditNotes(notes);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Failed to load returns');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const creditNoteByReturnId = useMemo(() => {
    const map = new Map<string, CreditNote>();
    for (const cn of creditNotes) {
      if (cn.originalReturnId) map.set(cn.originalReturnId, cn);
    }
    return map;
  }, [creditNotes]);

  const allTimeValue = useMemo(
    () => returns.reduce((sum, r) => sum + r.refundAmount, 0),
    [returns],
  );

  const statusCounts = useMemo(() => {
    const counts = { all: returns.length, pending: 0, approved: 0, completed: 0 };
    for (const r of returns) {
      if (r.status === 'pending') counts.pending += 1;
      else if (r.status === 'approved') counts.approved += 1;
      else if (r.status === 'completed') counts.completed += 1;
    }
    return counts;
  }, [returns]);

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

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, r) => sum + r.refundAmount, 0),
    [filtered],
  );

  async function handleApprove(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (
      !confirm(
        'Approve this return? Customer ledger will be credited and the invoice balance updated.',
      )
    )
      return;
    setBusyId(id);
    try {
      await patchSalesReturn(id, { status: 'approved' });
      await load(true);
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
      await load(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Complete failed');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Tab; label: string; showCount?: boolean }[] = [
    { key: 'all', label: 'All', showCount: true },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'completed', label: 'Completed' },
  ];

  const ghostBtn: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 11px',
    borderRadius: '6px',
    fontSize: '10.5px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--color-redwood-border)',
    background: 'rgba(255,255,255,.04)',
    color: 'var(--color-redwood-text-muted)',
    fontFamily: "'DM Sans',sans-serif",
    transition: '.12s',
  };

  const primaryBtn: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 11px',
    borderRadius: '6px',
    fontSize: '10.5px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    background: '#4F8EF7',
    color: '#fff',
    fontFamily: "'DM Sans',sans-serif",
    transition: '.12s',
  };

  const thStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: 'var(--color-redwood-text-muted)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: CSSProperties = {
    padding: '11px 12px',
    fontSize: 12,
    color: 'var(--color-redwood-text-main)',
    verticalAlign: 'middle',
  };

  function CreditNoteCell({ r }: { r: SalesReturn }) {
    const cn = creditNoteByReturnId.get(r.id);
    if (cn) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/sales/credit-notes/${cn.id}`);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-brand-green-tint)',
          }}
        >
          {cn.creditNoteNumber}
        </button>
      );
    }
    if (r.status === 'pending') {
      return (
        <button
          type="button"
          disabled={busyId === r.id}
          onClick={(e) => handleApprove(e, r.id)}
          style={{
            ...primaryBtn,
            fontSize: 10,
            padding: '4px 10px',
            opacity: busyId === r.id ? 0.6 : 1,
          }}
        >
          {busyId === r.id ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <CheckCircle size={12} />
          )}
          Approve
        </button>
      );
    }
    if (r.status === 'approved') {
      return (
        <button
          type="button"
          disabled={busyId === r.id}
          onClick={(e) => handleComplete(e, r.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            border: '1px solid rgba(34,197,94,.28)',
            background: 'var(--color-badge-green-bg)',
            color: 'var(--color-brand-green-tint)',
            opacity: busyId === r.id ? 0.6 : 1,
          }}
        >
          {busyId === r.id ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <CheckCircle size={12} />
          )}
          Complete
        </button>
      );
    }
    return <span style={{ color: 'var(--color-redwood-text-subtle)' }}>—</span>;
  }

  if (loading) {
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 16px',
            color: 'var(--color-redwood-text-muted)',
          }}
        >
          <div
            className="w-12 h-12 border-2 rounded-full animate-spin mb-3"
            style={{ borderColor: '#4F8EF7', borderTopColor: 'transparent' }}
          />
          <p style={{ fontSize: 12, fontWeight: 500 }}>Loading returns…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="space-y-3">
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--color-badge-blue-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <RotateCcw size={20} style={{ color: '#4F8EF7' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: '20px',
                  fontWeight: 600,
                  letterSpacing: '-.5px',
                  color: 'var(--color-brand-blue)',
                }}
              >
                Sales returns
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--color-redwood-text-subtle)',
                  marginTop: '2px',
                }}
              >
                Manage customer returns and credits · pending approvals · credit notes
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => void load(true)}
              style={ghostBtn}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/sales/returns/new')}
              style={primaryBtn}
            >
              <Plus size={14} /> New return
            </button>
          </div>
        </div>

        {/* KPI cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '10px', marginBottom: '12px' }}>
            {[
              {
                label: 'Total Returns Today',
                value: String(stats.totalReturnsToday),
                sub:
                  stats.totalReturnsToday === 0
                    ? 'no returns today'
                    : `${stats.totalReturnsToday} return${stats.totalReturnsToday !== 1 ? 's' : ''} today`,
                stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                valueColor: 'var(--color-brand-blue)',
                subColor: 'var(--color-redwood-text-subtle)',
              },
              {
                label: 'Total Return Value',
                value: `$${formatMoney(allTimeValue)}`,
                sub: `${returns.length} return${returns.length !== 1 ? 's' : ''} all time`,
                stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                valueColor: 'var(--color-brand-green)',
                subColor: 'var(--color-brand-green-tint)',
              },
              {
                label: 'Pending Approvals',
                value: String(stats.pendingApprovals),
                sub:
                  stats.pendingApprovals === 0
                    ? 'nothing awaiting review'
                    : `${stats.pendingApprovals} awaiting review`,
                stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
                valueColor: 'var(--color-brand-amber)',
                subColor: 'var(--color-brand-amber-tint)',
              },
              {
                label: 'Completed Returns',
                value: String(stats.completedReturns),
                sub: 'credit notes issued',
                stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                valueColor: 'var(--color-brand-green)',
                subColor: 'var(--color-brand-green-tint)',
              },
            ].map((k) => (
              <div
                key={k.label}
                style={{
                  background: 'var(--color-redwood-bg-surface)',
                  border: '1px solid var(--color-redwood-border)',
                  borderRadius: '14px',
                  padding: '13px 14px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    borderRadius: '14px 14px 0 0',
                    background: k.stripe,
                  }}
                />
                <div
                  style={{
                    fontSize: '10.5px',
                    color: 'var(--color-redwood-text-muted)',
                    fontWeight: 500,
                    marginBottom: '6px',
                  }}
                >
                  {k.label}
                </div>
                <div
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontSize: '22px',
                    fontWeight: 600,
                    letterSpacing: '-.5px',
                    marginBottom: '3px',
                    lineHeight: '1.1',
                    color: k.valueColor,
                  }}
                >
                  {k.value}
                </div>
                <div style={{ fontSize: '10px', color: k.subColor }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} style={{ color: 'var(--color-redwood-text-muted)', flexShrink: 0 }} />
            <input
              type="search"
              placeholder="Search return #, customer, invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'var(--color-redwood-row-bg)',
                border: '1px solid var(--color-redwood-border)',
                borderRadius: 8,
                outline: 'none',
                color: 'var(--color-redwood-text-main)',
                fontSize: 12,
                width: '100%',
                padding: '8px 12px',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-redwood-text-muted)',
                  fontSize: 16,
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Filter pills */}
        <div
          style={{
            ...panelStyle,
            padding: 6,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            const count =
              t.key === 'all'
                ? statusCounts.all
                : (statusCounts[t.key as 'pending' | 'approved' | 'completed'] ?? 0);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  padding: '7px 14px',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: active ? 'var(--color-badge-blue-bg)' : 'transparent',
                  color: active ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)',
                  border: active
                    ? '1px solid rgba(79,142,247,.28)'
                    : '1px solid transparent',
                  transition: 'all .15s ease',
                }}
              >
                {t.label}
                {t.showCount ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {/* Section header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0 10px',
            borderBottom: '1px solid var(--color-redwood-border)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-redwood-text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Sales returns
            <span
              style={{
                fontSize: 11,
                background: 'var(--color-redwood-row-bg)',
                border: '1px solid var(--color-redwood-border)',
                borderRadius: 20,
                padding: '2px 10px',
                color: 'var(--color-redwood-text-muted)',
                fontWeight: 600,
              }}
            >
              {filtered.length}
              {filtered.length !== returns.length ? ` of ${returns.length}` : ''}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)' }}>
            Total:{' '}
            <strong style={{ color: 'var(--color-brand-green)' }}>
              ${formatMoney(filteredTotal)}
            </strong>
          </span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ ...panelStyle, padding: '60px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--color-badge-blue-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <RotateCcw size={26} style={{ color: '#4F8EF7' }} />
            </div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-redwood-text-main)',
                margin: '0 0 6px',
              }}
            >
              {returns.length === 0 ? 'No returns yet' : 'No returns match your filter'}
            </h3>
            <p
              style={{
                fontSize: 12,
                color: 'var(--color-redwood-text-muted)',
                maxWidth: 280,
                margin: '0 auto 16px',
              }}
            >
              {returns.length === 0
                ? 'Create a return to process customer credits.'
                : 'Try a different search term or status filter.'}
            </p>
            <button
              type="button"
              onClick={() =>
                returns.length === 0
                  ? navigate('/sales/returns/new')
                  : (setSearch(''), setTab('all'))
              }
              style={primaryBtn}
            >
              {returns.length === 0 ? (
                <>
                  <Plus size={14} /> New return
                </>
              ) : (
                'Clear filters'
              )}
            </button>
          </div>
        ) : (
          <div
            style={{
              ...panelStyle,
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr
                    style={{
                      background: 'var(--color-redwood-row-bg)',
                      borderBottom: '1px solid var(--color-redwood-border)',
                    }}
                  >
                    {[
                      'Return #',
                      'Invoice',
                      'Customer',
                      'Salesman',
                      'Date',
                      'Reason',
                      'Amount',
                      'Credit note',
                    ].map((col) => (
                      <th
                        key={col}
                        style={{
                          ...thStyle,
                          textAlign: col === 'Amount' ? 'right' : 'left',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/sales/returns/${r.id}`)}
                      style={{
                        borderBottom: '1px solid var(--color-redwood-border)',
                        cursor: 'pointer',
                        transition: '.12s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-redwood-row-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--color-brand-red-tint)',
                          }}
                        >
                          {r.returnNumber}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--color-brand-blue-tint)',
                          }}
                        >
                          {r.invoiceNumber || '—'}
                        </span>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.customerName || `Customer #${r.customerId}`}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--color-redwood-text-muted)' }}>
                        Unassigned
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {formatReturnDate(r.returnDate)}
                      </td>
                      <td style={tdStyle}>
                        <ReasonBadge code={r.returnReason} />
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'right',
                          fontFamily: 'ui-monospace, monospace',
                          fontWeight: 600,
                        }}
                      >
                        ${formatMoney(r.refundAmount)}
                      </td>
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        <CreditNoteCell r={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: '1px solid var(--color-redwood-border)',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: 11,
                color: 'var(--color-redwood-text-muted)',
              }}
            >
              <span>
                Showing {filtered.length} of {returns.length} returns · {statusCounts.completed}{' '}
                completed · {statusCounts.pending} pending
              </span>
              <span>
                Total:{' '}
                <strong style={{ color: 'var(--color-brand-green)' }}>
                  ${formatMoney(filteredTotal)}
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* How pending returns look — example section */}
        <div style={{ ...panelStyle, marginTop: 4 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-redwood-text-main)',
              }}
            >
              How pending returns look
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.4px',
                padding: '2px 8px',
                borderRadius: 20,
                background: 'var(--color-badge-amber-bg)',
                color: 'var(--color-brand-amber-tint)',
                border: '1px solid rgba(245,158,11,.28)',
              }}
            >
              Example
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--color-redwood-row-bg)',
                    borderBottom: '1px solid var(--color-redwood-border)',
                  }}
                >
                  {[
                    'Return #',
                    'Invoice',
                    'Customer',
                    'Salesman',
                    'Date',
                    'Reason',
                    'Amount',
                    'Actions',
                  ].map((col) => (
                    <th
                      key={col}
                      style={{
                        ...thStyle,
                        textAlign: col === 'Amount' ? 'right' : 'left',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--color-redwood-border)' }}>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-brand-red-tint)',
                      }}
                    >
                      RTN-000002
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-brand-blue-tint)',
                      }}
                    >
                      INV-2024-0142
                    </span>
                  </td>
                  <td style={tdStyle}>Al-Rashid Trading Co.</td>
                  <td style={{ ...tdStyle, color: 'var(--color-redwood-text-muted)' }}>Unassigned</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>18 May 2026</td>
                  <td style={tdStyle}>
                    <ReasonBadge code="damaged" />
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontFamily: 'ui-monospace, monospace',
                      fontWeight: 600,
                    }}
                  >
                    $1,250.00
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        style={{
                          ...primaryBtn,
                          fontSize: 10,
                          padding: '4px 10px',
                          cursor: 'default',
                        }}
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button
                        type="button"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: 6,
                          cursor: 'default',
                          border: '1px solid rgba(239,68,68,.28)',
                          background: 'var(--color-badge-red-bg)',
                          color: 'var(--color-brand-red-tint)',
                        }}
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p
            style={{
              fontSize: 11,
              color: 'var(--color-redwood-text-muted)',
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            Pending returns show <strong style={{ color: 'var(--color-redwood-text-main)' }}>Approve</strong>{' '}
            and <strong style={{ color: 'var(--color-redwood-text-main)' }}>Reject</strong> buttons.
            Approving credits the customer ledger and updates the invoice balance.
          </p>
        </div>
      </div>
    </div>
  );
}
