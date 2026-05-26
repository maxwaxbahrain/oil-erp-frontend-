import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Filter } from 'lucide-react';
import { getSalesOrders, hydrateSalesOrdersWithCustomers, type SalesOrder } from '../../services/salesService';

const THEME_PRIMARY = '#4F8EF7';

export default function Quotations() {
    const navigate = useNavigate();
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    // TC-36 — Filter state.  Page previously had no filtering UI at all.
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'draft' | 'confirmed' | 'delivered' | 'invoiced' | 'cancelled'>('All');

    useEffect(() => {
        loadSalesOrders();
    }, []);

    async function loadSalesOrders() {
        try {
            const orders = await getSalesOrders();
            const hydrated = await hydrateSalesOrdersWithCustomers(orders);
            const sorted = hydrated.sort((a, b) =>
                new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
            );
            setSalesOrders(sorted);
        } catch (error) {
            console.error('Failed to load sales orders:', error);
        } finally {
            setLoading(false);
        }
    }

    // Status badge — inline-style, CSS-var driven
    const STATUS_BADGE = (status: string) => {
        const s = (status ?? '').toLowerCase();
        const styles: Record<string, CSSProperties> = {
            draft:     { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' },
            confirmed: { background: 'var(--color-background-info)',      color: 'var(--color-text-info)'      },
            delivered: { background: 'var(--color-background-success)',   color: 'var(--color-text-success)'   },
            invoiced:  { background: 'rgba(124,58,237,.12)',              color: '#7C3AED'                     },
            cancelled: { background: 'var(--color-background-danger)',    color: 'var(--color-text-danger)'    },
        };
        return (
            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                           display: 'inline-block', textTransform: 'capitalize',
                           ...(styles[s] ?? styles.draft) }}>
                {status}
            </span>
        );
    };

    // TC-36 — Apply search + status filter.  Search matches order
    // number OR customer name (case-insensitive).  An empty search
    // term + statusFilter === 'All' returns everything.
    const filteredOrders = salesOrders.filter(o => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch = !q
            || (o.so_number || '').toLowerCase().includes(q)
            || (o.customer_name || o.customer?.name || '').toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                 style={{ background: 'var(--color-background-secondary)' }}>
                <div className="text-center">
                    <div className="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-3"
                         style={{ borderColor: THEME_PRIMARY, borderTopColor: 'transparent' }} />
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                        Loading quotations...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6" style={{ background: 'var(--color-background-secondary)' }}>
            <div className="max-w-[1600px] mx-auto space-y-4">
                {/* Header — Soltol dark nav */}
                <div style={{
                    background: 'var(--color-background-primary)',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    padding: '13px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: 12,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 9,
                            background: 'rgba(74,143,245,.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <FileText size={18} style={{ color: THEME_PRIMARY }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontSize: 17, fontWeight: 500, color: 'var(--color-text-primary)',
                                         margin: 0, lineHeight: 1.2 }}>
                                Sales orders
                            </h1>
                            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, margin: 0 }}>
                                All orders · Draft → Confirmed → Delivered → Invoiced
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/sales/orders/new')}
                        style={{
                            background: THEME_PRIMARY,
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '7px 14px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexShrink: 0,
                        }}
                    >
                        <Plus size={14} /> New sales order
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Orders', value: salesOrders.length, sub: 'all time',
                          stripe: '#4F8EF7', valueColor: '#4F8EF7' },
                        { label: 'Draft',
                          value: salesOrders.filter(o => o.status === 'draft').length,
                          sub: 'awaiting confirmation',
                          stripe: '#8BA3C7',
                          valueColor: 'var(--color-text-secondary)' },
                        { label: 'Confirmed',
                          value: salesOrders.filter(o => o.status === 'confirmed').length,
                          sub: 'ready to dispatch',
                          stripe: '#22C55E',
                          valueColor: '#22C55E' },
                        { label: 'Total Value',
                          value: '$' + salesOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0).toLocaleString(),
                          sub: 'confirmed orders',
                          stripe: '#22C55E',
                          valueColor: '#22C55E' },
                    ].map(k => (
                        <div key={k.label} style={{
                            background: 'var(--color-background-primary)',
                            border: '0.5px solid var(--color-border-tertiary)',
                            borderRadius: 10,
                            padding: '11px 13px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5,
                                          background: k.stripe }} />
                            <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', fontWeight: 600,
                                          textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>
                                {k.label}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 500, lineHeight: 1,
                                          marginBottom: 2, color: k.valueColor }}>
                                {k.value}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{k.sub}</div>
                        </div>
                    ))}
                </div>

                {/* TC-36 — Filter strip */}
                <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
                }}>
                    <div style={{
                        flex: 1, minWidth: 160, height: 32,
                        background: 'var(--color-background-secondary)',
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 8, display: 'flex', alignItems: 'center',
                        padding: '0 10px', gap: 6, fontSize: 11, color: 'var(--color-text-secondary)',
                    }}>
                        <Search size={14} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by order number or customer name…"
                            style={{
                                background: 'transparent', border: 'none', outline: 'none',
                                color: 'var(--color-text-primary)', fontSize: 11, width: '100%',
                            }}
                        />
                        {searchTerm && (
                            <span onClick={() => setSearchTerm('')}
                                  style={{ cursor: 'pointer', fontSize: 13, color: 'var(--color-text-secondary)' }}>×</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Filter size={14} style={{ color: 'var(--color-text-secondary)' }} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                            aria-label="Filter by status"
                            style={{
                                height: 32,
                                background: statusFilter !== 'All' ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
                                border: '0.5px solid',
                                borderColor: statusFilter !== 'All' ? 'var(--color-border-info)' : 'var(--color-border-secondary)',
                                color: statusFilter !== 'All' ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                                borderRadius: 8,
                                padding: '0 10px',
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            <option value="All">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="delivered">Delivered</option>
                            <option value="invoiced">Invoiced</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>

                {/* Section header — subtle */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 0 8px',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    marginBottom: 4,
                }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)',
                                  display: 'flex', alignItems: 'center', gap: 6 }}>
                        Sales orders
                        <span style={{
                            fontSize: 10,
                            background: 'var(--color-background-secondary)',
                            border: '0.5px solid var(--color-border-tertiary)',
                            borderRadius: 20,
                            padding: '1px 8px',
                            color: 'var(--color-text-secondary)',
                        }}>
                            {filteredOrders.length}{filteredOrders.length !== salesOrders.length ? ` of ${salesOrders.length}` : ''}
                        </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                        Total:{' '}
                        <strong style={{ color: '#22C55E' }}>
                            ${(salesOrders ?? []).reduce((s, o) => s + (Number(o.total) || 0), 0).toLocaleString()}
                        </strong>
                    </span>
                </div>

                {/* Orders list */}
                {filteredOrders.length === 0 ? (
                    <div style={{
                        background: 'var(--color-background-primary)',
                        border: '0.5px solid var(--color-border-tertiary)',
                        borderRadius: 12,
                        padding: '60px 20px',
                        textAlign: 'center',
                    }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            background: 'rgba(74,143,245,.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 14px',
                        }}>
                            <FileText size={26} style={{ color: THEME_PRIMARY }} />
                        </div>
                        <h3 style={{
                            fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
                            margin: 0, marginBottom: 6,
                        }}>
                            {salesOrders.length === 0 ? 'No orders found' : 'No orders match your filter'}
                        </h3>
                        <p style={{
                            fontSize: 11, color: 'var(--color-text-secondary)', maxWidth: 260,
                            margin: '0 auto 16px',
                        }}>
                            {salesOrders.length === 0
                                ? 'Start by creating your first sales order.'
                                : 'Try a different search term or status.'}
                        </p>
                        <button
                            onClick={() => salesOrders.length === 0
                                ? navigate('/sales/orders/new')
                                : (setSearchTerm(''), setStatusFilter('All'))}
                            style={{
                                background: THEME_PRIMARY,
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '7px 14px',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            {salesOrders.length === 0 ? <><Plus size={14} /> Create first order</> : 'Clear filters'}
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
                                        background: 'var(--color-background-primary)',
                                        border: isZero
                                            ? '0.5px solid var(--color-border-warning)'
                                            : '0.5px solid var(--color-border-tertiary)',
                                        borderRadius: 10,
                                        padding: '12px 14px',
                                        marginBottom: 8,
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-info)'; }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = isZero
                                            ? 'var(--color-border-warning)'
                                            : 'var(--color-border-tertiary)';
                                    }}
                                >
                                    {/* Top row: SO# + status + total */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                fontSize: 13, fontWeight: 500,
                                                color: 'var(--color-text-info)',
                                                fontFamily: 'var(--font-mono)',
                                            }}>
                                                {order.so_number ?? order.id ?? '—'}
                                            </span>
                                            {STATUS_BADGE(order.status)}
                                        </div>
                                        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                            ${totalNum.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* $0 warning */}
                                    {isZero && (
                                        <div style={{
                                            fontSize: 10, color: 'var(--color-text-warning)',
                                            display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6,
                                        }}>
                                            ⚠ Order total is $0.00 — no products added
                                        </div>
                                    )}

                                    {/* 4-col meta grid */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
                                        borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 8,
                                    }}>
                                        {[
                                            { label: 'Customer',
                                              value: order.customer_name ?? order.customer?.name ?? `Customer #${order.customer_id}` },
                                            { label: 'Order date',
                                              value: order.order_date
                                                  ? new Date(order.order_date).toLocaleDateString()
                                                  : '—' },
                                            { label: 'Items',
                                              value: (() => {
                                                  const n = (order.items ?? []).length;
                                                  return `${n} item${n !== 1 ? 's' : ''}`;
                                              })() },
                                            { label: 'Salesman',
                                              value: order.salesman_name ?? 'Unassigned' },
                                        ].map((f, i) => (
                                            <div key={f.label}
                                                 style={{
                                                     padding: i === 0 ? '0 10px 0 0' : '0 10px',
                                                     borderRight: i < 3 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                                                 }}>
                                                <div style={{
                                                    fontSize: 9, color: 'var(--color-text-secondary)', fontWeight: 500,
                                                    textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 3,
                                                }}>
                                                    {f.label}
                                                </div>
                                                <div style={{
                                                    fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {f.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action buttons row */}
                                    <div style={{
                                        display: 'flex', gap: 5, marginTop: 8, paddingTop: 8,
                                        borderTop: '0.5px solid var(--color-border-tertiary)',
                                    }}>
                                        <button
                                            onClick={e => { e.stopPropagation(); navigate(`/sales/orders/${order.id}`); }}
                                            style={{
                                                height: 26, padding: '0 10px', borderRadius: 6, cursor: 'pointer',
                                                background: 'var(--color-background-info)',
                                                border: '0.5px solid var(--color-border-info)',
                                                color: 'var(--color-text-info)', fontSize: 10, fontWeight: 500,
                                                display: 'flex', alignItems: 'center', gap: 4,
                                            }}
                                        >
                                            View
                                        </button>

                                        {isZero && (
                                            <button
                                                onClick={e => { e.stopPropagation(); navigate(`/sales/orders/${order.id}`); }}
                                                style={{
                                                    height: 26, padding: '0 10px', borderRadius: 6, cursor: 'pointer',
                                                    background: 'var(--color-background-warning)',
                                                    border: '0.5px solid var(--color-border-warning)',
                                                    color: 'var(--color-text-warning)', fontSize: 10, fontWeight: 500,
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                }}
                                            >
                                                Fix order
                                            </button>
                                        )}

                                        {status === 'delivered' && (
                                            <button
                                                onClick={e => { e.stopPropagation(); navigate(`/sales/orders/${order.id}`); }}
                                                style={{
                                                    height: 26, padding: '0 10px', borderRadius: 6, cursor: 'pointer',
                                                    background: 'var(--color-background-success)',
                                                    border: '0.5px solid var(--color-border-success)',
                                                    color: 'var(--color-text-success)', fontSize: 10, fontWeight: 500,
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                }}
                                            >
                                                Convert to invoice
                                            </button>
                                        )}

                                        {status === 'invoiced' && order.linked_invoice_number && (
                                            <span style={{
                                                height: 26, padding: '0 10px', borderRadius: 6,
                                                background: 'var(--color-background-secondary)',
                                                border: '0.5px solid var(--color-border-tertiary)',
                                                color: 'var(--color-text-secondary)', fontSize: 10,
                                                display: 'flex', alignItems: 'center', gap: 4,
                                            }}>
                                                View invoice →
                                            </span>
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
