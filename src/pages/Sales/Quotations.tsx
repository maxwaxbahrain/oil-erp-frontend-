import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, RefreshCw, ChevronDown } from 'lucide-react';
import { getSalesOrders, hydrateSalesOrdersWithCustomers, type SalesOrder } from '../../services/salesService';

/* ── Shared style tokens — mirror SalesDashboard / theme.css redwood tokens ── */
const panelStyle: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '14px',
    padding: '14px 16px',
};

type StatusFilter = 'All' | 'draft' | 'confirmed' | 'delivered' | 'invoiced' | 'cancelled';
type SortOrder = 'newest' | 'oldest';

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
    { key: 'All', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'invoiced', label: 'Invoiced' },
    { key: 'cancelled', label: 'Cancelled' },
];

function formatOrderDate(raw: string | undefined): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

function formatMoney(n: number): string {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Quotations() {
    const navigate = useNavigate();
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

    useEffect(() => {
        void loadSalesOrders();
    }, []);

    async function loadSalesOrders(isRefresh = false) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const orders = await getSalesOrders();
            const hydrated = await hydrateSalesOrdersWithCustomers(orders);
            const sorted = hydrated.sort(
                (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime(),
            );
            setSalesOrders(sorted);
        } catch (error) {
            console.error('Failed to load sales orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { All: salesOrders.length };
        for (const o of salesOrders) {
            const s = o.status ?? 'draft';
            counts[s] = (counts[s] ?? 0) + 1;
        }
        return counts;
    }, [salesOrders]);

    const confirmedTotal = useMemo(
        () =>
            salesOrders
                .filter((o) => o.status === 'confirmed')
                .reduce((sum, o) => sum + (Number(o.total) || 0), 0),
        [salesOrders],
    );

    const filteredOrders = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        const filtered = salesOrders.filter((o) => {
            const matchesSearch =
                !q ||
                (o.so_number || '').toLowerCase().includes(q) ||
                (o.customer_name || o.customer?.name || '').toLowerCase().includes(q);
            const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
        return [...filtered].sort((a, b) => {
            const ta = new Date(a.order_date).getTime();
            const tb = new Date(b.order_date).getTime();
            return sortOrder === 'newest' ? tb - ta : ta - tb;
        });
    }, [salesOrders, searchTerm, statusFilter, sortOrder]);

    const filteredTotal = useMemo(
        () => filteredOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
        [filteredOrders],
    );

    const STATUS_BADGE = (status: string) => {
        const s = (status ?? '').toLowerCase();
        const styles: Record<string, CSSProperties> = {
            draft: {
                background: 'var(--color-redwood-row-bg)',
                color: 'var(--color-redwood-text-muted)',
                border: '1px solid var(--color-redwood-border)',
            },
            confirmed: {
                background: 'var(--color-badge-blue-bg)',
                color: 'var(--color-brand-blue-tint)',
                border: '1px solid rgba(79,142,247,.28)',
            },
            delivered: {
                background: 'var(--color-badge-green-bg)',
                color: 'var(--color-brand-green-tint)',
                border: '1px solid rgba(34,197,94,.2)',
            },
            invoiced: {
                background: 'var(--color-badge-teal-bg)',
                color: 'var(--color-brand-teal)',
                border: '1px solid rgba(0,212,170,.28)',
            },
            cancelled: {
                background: 'var(--color-badge-red-bg)',
                color: 'var(--color-brand-red-tint)',
                border: '1px solid rgba(239,68,68,.2)',
            },
        };
        return (
            <span
                style={{
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 20,
                    display: 'inline-block',
                    textTransform: 'capitalize',
                    ...(styles[s] ?? styles.draft),
                }}
            >
                {status}
            </span>
        );
    };

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

    const cardActionBtn = (variant: 'default' | 'warning' | 'success' | 'neutral'): CSSProperties => {
        const map = {
            default: {
                bg: 'rgba(255,255,255,.04)',
                border: 'rgba(79,142,247,.28)',
                color: 'var(--color-brand-blue-tint)',
            },
            warning: {
                bg: 'rgba(255,255,255,.04)',
                border: 'rgba(245,158,11,.28)',
                color: 'var(--color-brand-amber-tint)',
            },
            success: {
                bg: 'rgba(255,255,255,.04)',
                border: 'rgba(34,197,94,.28)',
                color: 'var(--color-brand-green-tint)',
            },
            neutral: {
                bg: 'rgba(255,255,255,.04)',
                border: 'var(--color-redwood-border)',
                color: 'var(--color-redwood-text-muted)',
            },
        };
        const v = map[variant];
        return {
            height: 28,
            padding: '0 12px',
            borderRadius: 8,
            cursor: 'pointer',
            background: v.bg,
            border: `1px solid ${v.border}`,
            color: v.color,
            fontSize: 10,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
        };
    };

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
                    <p style={{ fontSize: 12, fontWeight: 500 }}>Loading quotations...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: '40px' }}>
            <div className="space-y-3">
                {/* Page header — SalesDashboard .pgh pattern (no card wrapper, inherits app bg) */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
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
                            <FileText size={20} style={{ color: '#4F8EF7' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontFamily: "'Syne',sans-serif",
                                    fontSize: '20px',
                                    fontWeight: 600,
                                    letterSpacing: '-.5px',
                                    color: 'var(--color-brand-blue)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }}
                            >
                                Sales orders
                            </div>
                            <div
                                style={{
                                    fontSize: '11px',
                                    color: 'var(--color-redwood-text-subtle)',
                                    marginTop: '2px',
                                }}
                            >
                                All orders · Draft → Confirmed → Delivered → Invoiced
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={() => void loadSalesOrders(true)}
                            style={ghostBtn}
                            disabled={refreshing}
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/sales/orders/new')}
                            style={primaryBtn}
                        >
                            <Plus size={14} /> New sales order
                        </button>
                    </div>
                </div>

                {/* KPI cards — SalesDashboard .kpi pattern */}
                <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '10px', marginBottom: '12px' }}>
                    {[
                        {
                            label: 'Total Orders',
                            value: String(salesOrders.length),
                            sub: 'all time',
                            stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                            valueColor: 'var(--color-brand-blue)',
                            subColor: 'var(--color-redwood-text-subtle)',
                        },
                        {
                            label: 'Draft',
                            value: String(salesOrders.filter((o) => o.status === 'draft').length),
                            sub: 'awaiting confirmation',
                            stripe: 'linear-gradient(90deg,#3E5678,#8BA3C7)',
                            valueColor: 'var(--color-redwood-text-main)',
                            subColor: 'var(--color-redwood-text-subtle)',
                        },
                        {
                            label: 'Confirmed',
                            value: String(salesOrders.filter((o) => o.status === 'confirmed').length),
                            sub: 'ready to dispatch',
                            stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                            valueColor: 'var(--color-brand-green)',
                            subColor: 'var(--color-brand-green-tint)',
                        },
                        {
                            label: 'Total Value',
                            value: `$${formatMoney(confirmedTotal)}`,
                            sub: 'confirmed orders',
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
                                transition: '.18s',
                                cursor: 'default',
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

                {/* Search */}
                <div style={panelStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Search size={16} style={{ color: 'var(--color-redwood-text-muted)', flexShrink: 0 }} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by order number or customer name..."
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
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
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

                {/* Status chips */}
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
                    {STATUS_CHIPS.map((chip) => {
                        const active = statusFilter === chip.key;
                        const count = statusCounts[chip.key] ?? 0;
                        return (
                            <button
                                key={chip.key}
                                type="button"
                                onClick={() => setStatusFilter(chip.key)}
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
                                {chip.label}
                                {chip.key === 'All' ? ` (${count})` : ''}
                            </button>
                        );
                    })}
                </div>

                {/* Sort */}
                <div style={{ position: 'relative', maxWidth: 220 }}>
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                        aria-label="Sort orders"
                        style={{
                            width: '100%',
                            height: 36,
                            appearance: 'none',
                            background: 'var(--color-redwood-row-bg)',
                            border: '1px solid var(--color-redwood-border)',
                            borderRadius: 8,
                            padding: '0 32px 0 12px',
                            fontSize: 12,
                            fontWeight: 500,
                            color: 'var(--color-redwood-text-main)',
                            cursor: 'pointer',
                        }}
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                    </select>
                    <ChevronDown
                        size={14}
                        style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                            color: 'var(--color-redwood-text-muted)',
                        }}
                    />
                </div>

                {/* Section header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0 10px',
                        borderBottom: '1px solid var(--color-redwood-border)',
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
                        Sales orders
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
                            {filteredOrders.length}
                            {filteredOrders.length !== salesOrders.length
                                ? ` of ${salesOrders.length}`
                                : ''}
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)' }}>
                        Total:{' '}
                        <strong style={{ color: 'var(--color-brand-green)' }}>${formatMoney(filteredTotal)}</strong>
                    </span>
                </div>

                {/* Orders list */}
                {filteredOrders.length === 0 ? (
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
                            <FileText size={26} style={{ color: '#4F8EF7' }} />
                        </div>
                        <h3
                            style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: 'var(--color-redwood-text-main)',
                                margin: '0 0 6px',
                            }}
                        >
                            {salesOrders.length === 0 ? 'No orders found' : 'No orders match your filter'}
                        </h3>
                        <p
                            style={{
                                fontSize: 12,
                                color: 'var(--color-redwood-text-muted)',
                                maxWidth: 280,
                                margin: '0 auto 16px',
                            }}
                        >
                            {salesOrders.length === 0
                                ? 'Start by creating your first sales order.'
                                : 'Try a different search term or status.'}
                        </p>
                        <button
                            type="button"
                            onClick={() =>
                                salesOrders.length === 0
                                    ? navigate('/sales/orders/new')
                                    : (setSearchTerm(''), setStatusFilter('All'))
                            }
                            style={primaryBtn}
                        >
                            {salesOrders.length === 0 ? (
                                <>
                                    <Plus size={14} /> Create first order
                                </>
                            ) : (
                                'Clear filters'
                            )}
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {filteredOrders.map((order) => {
                            const totalNum = Number(order.total) || 0;
                            const isZero = totalNum === 0;
                            const status = String(order.status ?? '').toLowerCase();
                            return (
                                <div
                                    key={order.id}
                                    onClick={() => navigate(`/sales/orders/${order.id}`)}
                                    style={{
                                        ...panelStyle,
                                        borderRadius: 12,
                                        border: isZero
                                            ? '1px solid rgba(245,158,11,.4)'
                                            : '1px solid var(--color-redwood-border)',
                                        cursor: 'pointer',
                                        transition: '.12s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--color-redwood-row-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'var(--color-redwood-bg-surface)';
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: 10,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: '#4F8EF7',
                                                    fontFamily: 'ui-monospace, monospace',
                                                }}
                                            >
                                                {order.so_number ?? order.id ?? '—'}
                                            </span>
                                            {STATUS_BADGE(order.status)}
                                        </div>
                                        <span
                                            style={{
                                                fontSize: 18,
                                                fontWeight: 600,
                                                color: 'var(--color-redwood-text-main)',
                                            }}
                                        >
                                            ${formatMoney(totalNum)}
                                        </span>
                                    </div>

                                    {isZero && (
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: 'var(--color-brand-amber-tint)',
                                                marginBottom: 8,
                                            }}
                                        >
                                            ⚠ Order total is $0.00 — no products added
                                        </div>
                                    )}

                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(2, 1fr)',
                                            gap: 12,
                                            borderTop: '1px solid var(--color-redwood-border)',
                                            paddingTop: 12,
                                        }}
                                        className="md:grid-cols-4"
                                    >
                                        {[
                                            {
                                                label: 'Customer',
                                                value:
                                                    order.customer_name ??
                                                    order.customer?.name ??
                                                    `Customer #${order.customer_id}`,
                                            },
                                            {
                                                label: 'Order date',
                                                value: formatOrderDate(order.order_date),
                                            },
                                            {
                                                label: 'Items',
                                                value: (() => {
                                                    const n = (order.items ?? []).length;
                                                    return `${n} item${n !== 1 ? 's' : ''}`;
                                                })(),
                                            },
                                            {
                                                label: 'Salesman',
                                                value: order.salesman_name ?? 'Unassigned',
                                            },
                                        ].map((f) => (
                                            <div key={f.label}>
                                                <div
                                                    style={{
                                                        fontSize: 9,
                                                        color: 'var(--color-redwood-text-muted)',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '.4px',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    {f.label}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: 'var(--color-redwood-text-main)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {f.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 6,
                                            marginTop: 12,
                                            paddingTop: 12,
                                            borderTop: '1px solid var(--color-redwood-border)',
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/sales/orders/${order.id}`);
                                            }}
                                            style={cardActionBtn('default')}
                                        >
                                            View
                                        </button>

                                        {isZero && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/sales/orders/${order.id}`);
                                                }}
                                                style={cardActionBtn('warning')}
                                            >
                                                Fix order
                                            </button>
                                        )}

                                        {status === 'confirmed' && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/sales/orders/${order.id}`);
                                                }}
                                                style={cardActionBtn('success')}
                                            >
                                                Mark delivered
                                            </button>
                                        )}

                                        {status === 'delivered' && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/sales/orders/${order.id}`);
                                                }}
                                                style={cardActionBtn('success')}
                                            >
                                                Convert to invoice
                                            </button>
                                        )}

                                        {status === 'invoiced' && order.linked_invoice_number && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/sales/orders/${order.id}`);
                                                }}
                                                style={cardActionBtn('neutral')}
                                            >
                                                {order.linked_invoice_number}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
