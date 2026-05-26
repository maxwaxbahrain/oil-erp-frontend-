import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, RefreshCw, ChevronDown } from 'lucide-react';
import { getSalesOrders, hydrateSalesOrdersWithCustomers, type SalesOrder } from '../../services/salesService';

const THEME_PRIMARY = '#4F8EF7';
const PAGE_BG = '#EEF1F6';
const CARD_BG = '#FFFFFF';
const BORDER = '#E2E8F0';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#64748B';

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
            draft: { background: '#F1F5F9', color: '#475569' },
            confirmed: { background: '#DBEAFE', color: '#1D4ED8' },
            delivered: { background: '#DCFCE7', color: '#15803D' },
            invoiced: { background: '#EDE9FE', color: '#7C3AED' },
            cancelled: { background: '#FEE2E2', color: '#B91C1C' },
        };
        return (
            <span
                style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '3px 10px',
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
        height: 34,
        padding: '0 14px',
        borderRadius: 8,
        cursor: 'pointer',
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        color: TEXT_SECONDARY,
        fontSize: 11,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
    };

    const primaryBtn: CSSProperties = {
        ...ghostBtn,
        background: THEME_PRIMARY,
        border: 'none',
        color: '#fff',
    };

    const cardActionBtn = (variant: 'default' | 'warning' | 'success' | 'neutral'): CSSProperties => {
        const map = {
            default: { bg: '#EFF6FF', border: '#BFDBFE', color: '#2563EB' },
            warning: { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309' },
            success: { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D' },
            neutral: { bg: '#F8FAFC', border: BORDER, color: TEXT_SECONDARY },
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
            <div
                className="min-h-screen flex items-center justify-center"
                style={{ background: PAGE_BG }}
            >
                <div className="text-center">
                    <div
                        className="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-3"
                        style={{ borderColor: THEME_PRIMARY, borderTopColor: 'transparent' }}
                    />
                    <p style={{ fontSize: 12, fontWeight: 500, color: TEXT_SECONDARY }}>
                        Loading quotations...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-6" style={{ background: PAGE_BG }}>
            <div className="max-w-[1600px] mx-auto space-y-4">
                {/* Page header */}
                <div
                    style={{
                        background: CARD_BG,
                        border: `1px solid ${BORDER}`,
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: 12,
                        boxShadow: '0 1px 2px rgba(15,23,42,.04)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'rgba(79,142,247,.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <FileText size={20} style={{ color: THEME_PRIMARY }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1
                                style={{
                                    fontSize: 20,
                                    fontWeight: 600,
                                    color: TEXT_PRIMARY,
                                    margin: 0,
                                    lineHeight: 1.2,
                                }}
                            >
                                Sales orders
                            </h1>
                            <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: '4px 0 0' }}>
                                All orders · Draft → Confirmed → Delivered → Invoiced
                            </p>
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

                {/* KPI cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        {
                            label: 'Total Orders',
                            value: String(salesOrders.length),
                            sub: 'all time',
                            stripe: '#4F8EF7',
                            valueColor: '#4F8EF7',
                        },
                        {
                            label: 'Draft',
                            value: String(salesOrders.filter((o) => o.status === 'draft').length),
                            sub: 'awaiting confirmation',
                            stripe: '#94A3B8',
                            valueColor: TEXT_SECONDARY,
                        },
                        {
                            label: 'Confirmed',
                            value: String(salesOrders.filter((o) => o.status === 'confirmed').length),
                            sub: 'ready to dispatch',
                            stripe: '#22C55E',
                            valueColor: '#22C55E',
                        },
                        {
                            label: 'Total Value',
                            value: `$${formatMoney(confirmedTotal)}`,
                            sub: 'confirmed orders',
                            stripe: '#22C55E',
                            valueColor: '#22C55E',
                        },
                    ].map((k) => (
                        <div
                            key={k.label}
                            style={{
                                background: CARD_BG,
                                border: `1px solid ${BORDER}`,
                                borderRadius: 12,
                                padding: '14px 16px',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 1px 2px rgba(15,23,42,.04)',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 3,
                                    background: k.stripe,
                                }}
                            />
                            <div
                                style={{
                                    fontSize: 10,
                                    color: TEXT_SECONDARY,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '.5px',
                                    marginBottom: 6,
                                }}
                            >
                                {k.label}
                            </div>
                            <div
                                style={{
                                    fontSize: 26,
                                    fontWeight: 600,
                                    lineHeight: 1,
                                    marginBottom: 4,
                                    color: k.valueColor,
                                }}
                            >
                                {k.value}
                            </div>
                            <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>{k.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div
                    style={{
                        background: CARD_BG,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 1px 2px rgba(15,23,42,.04)',
                    }}
                >
                    <Search size={16} style={{ color: TEXT_SECONDARY, flexShrink: 0 }} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by order number or customer name..."
                        style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: TEXT_PRIMARY,
                            fontSize: 12,
                            width: '100%',
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
                                color: TEXT_SECONDARY,
                                fontSize: 16,
                            }}
                            aria-label="Clear search"
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* Status chips */}
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
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
                                    padding: '8px 14px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    borderRadius: 20,
                                    cursor: 'pointer',
                                    background: active ? THEME_PRIMARY : CARD_BG,
                                    color: active ? '#fff' : TEXT_SECONDARY,
                                    border: active ? 'none' : `1px solid ${BORDER}`,
                                    boxShadow: active ? 'none' : '0 1px 2px rgba(15,23,42,.04)',
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
                            background: CARD_BG,
                            border: `1px solid ${BORDER}`,
                            borderRadius: 8,
                            padding: '0 32px 0 12px',
                            fontSize: 12,
                            fontWeight: 500,
                            color: TEXT_PRIMARY,
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
                            color: TEXT_SECONDARY,
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
                        borderBottom: `1px solid ${BORDER}`,
                    }}
                >
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: TEXT_PRIMARY,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        Sales orders
                        <span
                            style={{
                                fontSize: 11,
                                background: '#F1F5F9',
                                border: `1px solid ${BORDER}`,
                                borderRadius: 20,
                                padding: '2px 10px',
                                color: TEXT_SECONDARY,
                                fontWeight: 600,
                            }}
                        >
                            {filteredOrders.length}
                            {filteredOrders.length !== salesOrders.length
                                ? ` of ${salesOrders.length}`
                                : ''}
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                        Total:{' '}
                        <strong style={{ color: '#22C55E' }}>${formatMoney(filteredTotal)}</strong>
                    </span>
                </div>

                {/* Orders list */}
                {filteredOrders.length === 0 ? (
                    <div
                        style={{
                            background: CARD_BG,
                            border: `1px solid ${BORDER}`,
                            borderRadius: 12,
                            padding: '60px 20px',
                            textAlign: 'center',
                        }}
                    >
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: '50%',
                                background: 'rgba(79,142,247,.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 14px',
                            }}
                        >
                            <FileText size={26} style={{ color: THEME_PRIMARY }} />
                        </div>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, margin: '0 0 6px' }}>
                            {salesOrders.length === 0 ? 'No orders found' : 'No orders match your filter'}
                        </h3>
                        <p style={{ fontSize: 12, color: TEXT_SECONDARY, maxWidth: 280, margin: '0 auto 16px' }}>
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
                    <div>
                        {filteredOrders.map((order) => {
                            const totalNum = Number(order.total) || 0;
                            const isZero = totalNum === 0;
                            const status = String(order.status ?? '').toLowerCase();
                            return (
                                <div
                                    key={order.id}
                                    onClick={() => navigate(`/sales/orders/${order.id}`)}
                                    style={{
                                        background: CARD_BG,
                                        border: isZero ? '1px solid #F59E0B' : `1px solid ${BORDER}`,
                                        borderRadius: 12,
                                        padding: '14px 16px',
                                        marginBottom: 10,
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 2px rgba(15,23,42,.04)',
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
                                                    color: THEME_PRIMARY,
                                                    fontFamily: 'ui-monospace, monospace',
                                                }}
                                            >
                                                {order.so_number ?? order.id ?? '—'}
                                            </span>
                                            {STATUS_BADGE(order.status)}
                                        </div>
                                        <span style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>
                                            ${formatMoney(totalNum)}
                                        </span>
                                    </div>

                                    {isZero && (
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: '#B45309',
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
                                            borderTop: `1px solid ${BORDER}`,
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
                                                        color: TEXT_SECONDARY,
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
                                                        color: TEXT_PRIMARY,
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
                                            borderTop: `1px solid ${BORDER}`,
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
