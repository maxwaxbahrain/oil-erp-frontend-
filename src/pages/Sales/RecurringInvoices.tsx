import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import {
    RefreshCw, Plus, Trash2, Play, Pause, Edit2, Search, Bot, Sparkles,
    AlertTriangle, Calendar, Clock, CheckCircle2,
} from 'lucide-react';
import { getCustomers, getProducts, type Customer, type Product } from '../../services/api';
import {
    getRecurringInvoices, saveRecurringInvoice, deleteRecurringInvoice,
    runDueRecurringInvoices, createInvoice, type RecurringInvoice,
} from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

/* ── UI tokens (dark redwood) ─────────────────────────────────────────────── */
const panelStyle: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '14px',
    padding: '14px 16px',
};

const ghostBtn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 11px',
    borderRadius: 6,
    fontSize: 10.5,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--color-redwood-border)',
    background: 'rgba(255,255,255,.04)',
    color: 'var(--color-redwood-text-muted)',
    fontFamily: 'inherit',
};

const primaryBtn: CSSProperties = {
    ...ghostBtn,
    border: 'none',
    background: '#4F8EF7',
    color: '#fff',
};

const thStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: 'var(--color-redwood-text-muted)',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    borderBottom: '1px solid var(--color-redwood-border)',
};

const tdStyle: CSSProperties = {
    padding: '11px 12px',
    fontSize: 11,
    color: 'var(--color-redwood-text-main)',
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

type PageTab = 'all' | 'due' | 'paused' | 'history';
type FilterChip = 'all' | 'active' | 'due' | 'paused';

const AI_PROMPTS = [
    'Which recurring invoices are due this week?',
    'Recommend customers for monthly billing',
    'Show paused schedules needing follow-up',
    'Forecast next month recurring revenue',
];

const EMPTY_ITEM = () => ({ product: '', description: '', quantity: 1, rate: 0, amount: 0 });

function formatDate(raw: string | undefined): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

function formatCompactUsd(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
        const v = (abs / 1_000_000).toFixed(2).replace(/\.0+$/, '').replace(/(\.\d)0+$/, '$1');
        return `$${v}M`;
    }
    if (abs >= 1000) return `$${Math.round(abs / 1000)}K`;
    return formatCurrency(n);
}

function freqBadgeStyle(f: string): CSSProperties {
    if (f === 'weekly') return { background: 'rgba(155,111,228,.12)', color: '#C4B5FD', border: '1px solid rgba(155,111,228,.28)' };
    if (f === 'monthly') return { background: 'var(--color-badge-blue-bg)', color: 'var(--color-brand-blue-tint)', border: '1px solid rgba(79,142,247,.28)' };
    return { background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)', border: '1px solid rgba(245,158,11,.28)' };
}

function statusBadgeStyle(rec: RecurringInvoice, today: string): CSSProperties {
    const isDue = rec.active && rec.nextRunDate <= today;
    if (isDue) return { background: 'rgba(239,68,68,.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,.35)' };
    if (rec.active) return { background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)', border: '1px solid rgba(34,197,94,.28)' };
    return { background: 'rgba(255,255,255,.06)', color: 'var(--color-redwood-text-muted)', border: '1px solid var(--color-redwood-border)' };
}

function statusLabel(rec: RecurringInvoice, today: string): string {
    const isDue = rec.active && rec.nextRunDate <= today;
    if (isDue) return 'Due today';
    if (rec.active) return 'Active';
    return 'Paused';
}

function advanceNextRunDate(rec: RecurringInvoice): string {
    const next = new Date(rec.nextRunDate);
    if (rec.frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (rec.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else next.setMonth(next.getMonth() + 3);
    return next.toISOString().slice(0, 10);
}

export default function RecurringInvoices() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [recurring, setRecurring] = useState<RecurringInvoice[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [activeTab, setActiveTab] = useState<PageTab>('all');
    const [filterChip, setFilterChip] = useState<FilterChip>('all');
    const [freqFilter, setFreqFilter] = useState<'all' | 'weekly' | 'monthly' | 'quarterly'>('all');
    const [search, setSearch] = useState('');
    const [aiQuestion, setAiQuestion] = useState('');
    const [form, setForm] = useState({
        customerId: '', frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly',
        nextRunDate: new Date().toISOString().slice(0, 10),
        notes: '', items: [EMPTY_ITEM()],
    });

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);

    useEffect(() => {
        Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
            setCustomers(c);
            setProducts(p);
            setRecurring(getRecurringInvoices());
        });
    }, []);

    const reload = () => setRecurring(getRecurringInvoices());

    const dueItems = useMemo(
        () => recurring.filter(r => r.active && r.nextRunDate <= today),
        [recurring, today],
    );
    const activeItems = useMemo(() => recurring.filter(r => r.active), [recurring]);
    const pausedItems = useMemo(() => recurring.filter(r => !r.active), [recurring]);
    const pendingItems = useMemo(
        () => recurring.filter(r => r.active && r.nextRunDate > today),
        [recurring, today],
    );
    const monthlyValue = useMemo(
        () => recurring.filter(r => r.active).reduce((s, r) => {
            if (r.frequency === 'monthly') return s + r.grandTotal;
            if (r.frequency === 'weekly') return s + r.grandTotal * 4.33;
            if (r.frequency === 'quarterly') return s + r.grandTotal / 3;
            return s;
        }, 0),
        [recurring],
    );
    const generatedThisMonth = useMemo(
        () => recurring.filter(r => r.lastRunDate?.startsWith(currentMonth)).length,
        [recurring, currentMonth],
    );

    const historyRows = useMemo(
        () => recurring
            .filter(r => r.lastRunDate)
            .sort((a, b) => (b.lastRunDate || '').localeCompare(a.lastRunDate || '')),
        [recurring],
    );

    const aiSuggestions = useMemo(() => {
        const recurringCustomerIds = new Set(recurring.map(r => r.customerId));
        return customers
            .filter(c => !recurringCustomerIds.has(c.id))
            .slice(0, 3)
            .map(c => ({
                id: c.id,
                name: c.name,
                reason: 'Regular orders · no recurring schedule yet',
                amount: products.length > 0 ? products[0].unit_price * 12 : 2400,
            }));
    }, [customers, recurring, products]);

    const filtered = useMemo(() => {
        let rows = recurring;
        if (activeTab === 'due') rows = dueItems;
        else if (activeTab === 'paused') rows = pausedItems;
        else if (activeTab === 'history') return [];

        const q = search.trim().toLowerCase();
        if (q) rows = rows.filter(r =>
            r.customerName.toLowerCase().includes(q) ||
            r.lineItems.some(i => i.product.toLowerCase().includes(q)),
        );
        if (freqFilter !== 'all') rows = rows.filter(r => r.frequency === freqFilter);
        if (filterChip === 'active') rows = rows.filter(r => r.active && r.nextRunDate > today);
        else if (filterChip === 'due') rows = rows.filter(r => r.active && r.nextRunDate <= today);
        else if (filterChip === 'paused') rows = rows.filter(r => !r.active);
        return rows;
    }, [recurring, dueItems, pausedItems, activeTab, search, freqFilter, filterChip, today]);

    const grandTotal = form.items.reduce((s, i) => s + i.amount, 0);

    const resetForm = () => {
        setForm({
            customerId: '', frequency: 'monthly',
            nextRunDate: new Date().toISOString().slice(0, 10),
            notes: '', items: [EMPTY_ITEM()],
        });
        setEditingId(null);
    };

    const updateItem = (idx: number, field: string, value: string | number) => {
        const items = [...form.items];
        items[idx] = { ...items[idx], [field]: value };
        if (field === 'product') {
            const p = products.find(pr => pr.name === value);
            if (p) { items[idx].rate = p.unit_price; items[idx].description = p.name; }
        }
        if (field === 'quantity' || field === 'rate') {
            items[idx].amount = items[idx].quantity * items[idx].rate;
        }
        setForm({ ...form, items });
    };

    const saveForm = () => {
        const customer = customers.find(c => c.id === form.customerId);
        if (!customer || form.items.every(i => !i.product)) {
            alert('Select a customer and at least one product.');
            return;
        }
        const existing = editingId ? recurring.find(r => r.id === editingId) : undefined;
        const rec: RecurringInvoice = {
            id: existing?.id || `REC-${Date.now()}`,
            customerId: customer.id,
            customerName: customer.name,
            frequency: form.frequency,
            nextRunDate: form.nextRunDate,
            lineItems: form.items.filter(i => i.product),
            subtotal: grandTotal,
            taxRate: existing?.taxRate ?? 0,
            discount: existing?.discount ?? 0,
            grandTotal,
            notes: form.notes,
            active: existing?.active ?? true,
            lastRunDate: existing?.lastRunDate,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        saveRecurringInvoice(rec);
        reload();
        setShowForm(false);
        resetForm();
        setSuccessMsg(editingId ? 'Recurring invoice updated!' : 'Recurring invoice created!');
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const startEdit = (rec: RecurringInvoice) => {
        setEditingId(rec.id);
        setForm({
            customerId: rec.customerId,
            frequency: rec.frequency,
            nextRunDate: rec.nextRunDate,
            notes: rec.notes,
            items: rec.lineItems.length > 0
                ? rec.lineItems.map(i => ({ ...i }))
                : [EMPTY_ITEM()],
        });
        setShowForm(true);
    };

    const toggleActive = (id: string) => {
        const rec = recurring.find(r => r.id === id);
        if (!rec) return;
        saveRecurringInvoice({ ...rec, active: !rec.active });
        reload();
        setSuccessMsg(rec.active ? 'Schedule paused.' : 'Schedule resumed.');
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const deleteRec = (id: string) => {
        if (!confirm('Delete this recurring invoice?')) return;
        deleteRecurringInvoice(id);
        reload();
    };

    const runNow = async () => {
        setRunning(true);
        const count = await runDueRecurringInvoices();
        reload();
        setRunning(false);
        setSuccessMsg(count > 0 ? `${count} invoice${count !== 1 ? 's' : ''} generated!` : 'No invoices due today.');
        setTimeout(() => setSuccessMsg(''), 4000);
    };

    const checkDueNow = () => {
        reload();
        setSuccessMsg(dueItems.length > 0
            ? `${dueItems.length} recurring invoice${dueItems.length !== 1 ? 's' : ''} due today.`
            : 'No recurring invoices due today.');
        setTimeout(() => setSuccessMsg(''), 4000);
    };

    const runSingle = async (rec: RecurringInvoice) => {
        if (!rec.active || rec.nextRunDate > today) return;
        setRunning(true);
        try {
            await createInvoice({
                invoiceNumber: '',
                customerId: rec.customerId,
                customerName: rec.customerName,
                invoiceDate: today,
                dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                lineItems: rec.lineItems,
                subtotal: rec.subtotal,
                taxRate: rec.taxRate,
                taxAmount: rec.subtotal * rec.taxRate / 100,
                discount: rec.discount,
                grandTotal: rec.grandTotal,
                notes: rec.notes || `Recurring invoice — ${rec.frequency}`,
                status: 'Unpaid',
            });
            saveRecurringInvoice({
                ...rec,
                nextRunDate: advanceNextRunDate(rec),
                lastRunDate: today,
            });
            reload();
            setSuccessMsg(`Invoice generated for ${rec.customerName}.`);
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch {
            alert('Failed to generate invoice.');
        } finally {
            setRunning(false);
        }
    };

    const setupSuggestion = (customerId: string) => {
        setShowForm(true);
        resetForm();
        setForm(f => ({ ...f, customerId, frequency: 'monthly' }));
    };

    const pageTabs: { key: PageTab; label: string; count?: number }[] = [
        { key: 'all', label: 'All recurring' },
        { key: 'due', label: 'Due today', count: dueItems.length },
        { key: 'paused', label: 'Paused', count: pausedItems.length },
        { key: 'history', label: 'History' },
    ];

    const filterChips: { key: FilterChip; label: string; count?: number }[] = [
        { key: 'all', label: 'All', count: recurring.length },
        { key: 'active', label: 'Active', count: activeItems.length },
        { key: 'due', label: 'Due today', count: dueItems.length },
        { key: 'paused', label: 'Paused', count: pausedItems.length },
    ];

    const dueNames = dueItems.map(d => `${d.customerName} (${formatCurrency(d.grandTotal)})`).join(' · ');
    const firstPaused = pausedItems[0];

    return (
        <div style={{ paddingBottom: 40 }}>
            <div className="space-y-3 max-w-[1200px]">
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(79,142,247,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <RefreshCw size={20} style={{ color: '#4F8EF7' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: '-.5px', color: 'var(--color-brand-blue)', margin: 0 }}>
                                Recurring invoices
                            </h1>
                            <p style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', margin: '2px 0 0' }}>
                                Auto-generate invoices on schedule — weekly, monthly, quarterly — pause/resume anytime
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        <button type="button" onClick={checkDueNow} disabled={running} style={ghostBtn}>
                            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> Check due now
                        </button>
                        <button type="button" onClick={runNow} disabled={running || dueItems.length === 0}
                            style={{ ...primaryBtn, background: dueItems.length > 0 ? '#22C55E' : undefined, opacity: dueItems.length > 0 ? 1 : 0.5 }}>
                            <Play size={14} /> Run all due
                        </button>
                        <button type="button" onClick={() => { resetForm(); setShowForm(true); }} style={primaryBtn}>
                            <Plus size={14} /> New recurring
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ ...panelStyle, padding: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {pageTabs.map(t => {
                        const active = activeTab === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setActiveTab(t.key)}
                                style={{
                                    padding: '7px 14px',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    background: active ? 'var(--color-badge-blue-bg)' : 'transparent',
                                    color: active ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)',
                                    border: active ? '1px solid rgba(79,142,247,.28)' : '1px solid transparent',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {t.label}
                                {t.count != null && t.count > 0 ? ` (${t.count})` : ''}
                            </button>
                        );
                    })}
                </div>

                {successMsg && (
                    <div style={{ ...panelStyle, background: 'var(--color-badge-green-bg)', border: '1px solid rgba(34,197,94,.28)', color: 'var(--color-brand-green-tint)', fontSize: 12, fontWeight: 600 }}>
                        ✓ {successMsg}
                    </div>
                )}

                {(activeTab === 'all' || activeTab === 'due' || activeTab === 'paused') && (
                    <>
                        {/* KPI cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 10 }}>
                            {[
                                {
                                    label: 'Total recurring',
                                    value: String(recurring.length),
                                    sub: `${activeItems.length} active · ${pausedItems.length} paused · ${pendingItems.length} pending`,
                                    stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                                    valueColor: 'var(--color-brand-blue)',
                                },
                                {
                                    label: 'Monthly value',
                                    value: formatCompactUsd(monthlyValue),
                                    sub: 'estimated recurring revenue / month',
                                    stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                                    valueColor: 'var(--color-brand-green)',
                                },
                                {
                                    label: 'Due today',
                                    value: String(dueItems.length),
                                    sub: dueItems.length > 0 ? 'invoices ready to generate' : 'none due right now',
                                    stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)',
                                    valueColor: '#EF4444',
                                },
                                {
                                    label: 'Generated this month',
                                    value: String(generatedThisMonth),
                                    sub: 'invoices created from schedules',
                                    stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                                    valueColor: 'var(--color-brand-green)',
                                },
                            ].map(k => (
                                <div key={k.label} style={{ background: 'var(--color-redwood-bg-surface)', border: '1px solid var(--color-redwood-border)', borderRadius: 14, padding: '13px 14px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: k.stripe, borderRadius: '14px 14px 0 0' }} />
                                    <div style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.3px' }}>{k.label}</div>
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: '-.5px', color: k.valueColor, marginBottom: 3 }}>{k.value}</div>
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)' }}>{k.sub}</div>
                                </div>
                            ))}
                        </div>

                        {/* Due alert banner */}
                        {dueItems.length > 0 && (
                            <div style={{ ...panelStyle, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.35)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                                    <AlertTriangle size={18} style={{ color: '#FCA5A5', flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#FCA5A5', marginBottom: 2 }}>
                                            {dueItems.length} due today
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>
                                            {dueNames || 'Recurring invoices ready to generate'}
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={runNow} disabled={running} style={{ ...primaryBtn, background: '#EF4444', fontSize: 10, fontWeight: 700 }}>
                                    <Play size={12} /> Run {dueItems.length} due now
                                </button>
                            </div>
                        )}

                        {/* AI Suggestions */}
                        {aiSuggestions.length > 0 && (
                            <div style={panelStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Bot size={16} style={{ color: '#22C55E' }} />
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>AI suggestions</span>
                                    </div>
                                    <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'rgba(34,197,94,.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,.28)' }}>
                                        AI detected {aiSuggestions.length} more customer{aiSuggestions.length !== 1 ? 's' : ''}…
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 10 }}>
                                    {aiSuggestions.map(s => (
                                        <div key={s.id} style={{ background: '#0a1726', border: '0.5px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '12px 14px' }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 4 }}>{s.name}</div>
                                            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginBottom: 6 }}>{s.reason}</div>
                                            <div style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: '#86EFAC', marginBottom: 10 }}>
                                                ~{formatCurrency(s.amount)}/mo
                                            </div>
                                            <button type="button" onClick={() => setupSuggestion(s.id)} style={{ ...ghostBtn, fontSize: 9, padding: '4px 10px', color: '#4F8EF7', border: '1px solid rgba(79,142,247,.28)', background: 'rgba(79,142,247,.08)' }}>
                                                Set up
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Search + filters */}
                        <div style={panelStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <Search size={16} style={{ color: 'var(--color-redwood-text-muted)', flexShrink: 0 }} />
                                <input
                                    type="search"
                                    placeholder="Search customer, product, frequency..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ flex: 1, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 8, outline: 'none', color: 'var(--color-redwood-text-main)', fontSize: 12, padding: '8px 12px', fontFamily: 'inherit' }}
                                />
                                <select
                                    value={freqFilter}
                                    onChange={e => setFreqFilter(e.target.value as typeof freqFilter)}
                                    style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 10, fontFamily: 'inherit' }}
                                >
                                    <option value="all">All frequencies</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {filterChips.map(c => {
                                    const active = filterChip === c.key;
                                    return (
                                        <button
                                            key={c.key}
                                            type="button"
                                            onClick={() => setFilterChip(c.key)}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: 10,
                                                fontWeight: 500,
                                                borderRadius: 8,
                                                cursor: 'pointer',
                                                background: active ? 'var(--color-badge-blue-bg)' : 'transparent',
                                                color: active ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)',
                                                border: active ? '1px solid rgba(79,142,247,.28)' : '1px solid var(--color-redwood-border)',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            {c.label}{c.count != null ? ` (${c.count})` : ''}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                            {filtered.length === 0 ? (
                                <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                                    <RefreshCw size={40} style={{ color: 'var(--color-redwood-text-subtle)', margin: '0 auto 12px' }} />
                                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-muted)' }}>No recurring schedules found</p>
                                    <p style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>Create a recurring invoice or adjust filters</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                                {['Customer', 'Products', 'Amount', 'Frequency', 'Next due', 'Last run', 'Status', 'Actions'].map(h => (
                                                    <th key={h} style={thStyle}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(rec => {
                                                const isDue = rec.active && rec.nextRunDate <= today;
                                                const productNames = rec.lineItems.map(i => i.product).filter(Boolean).join(', ') || '—';
                                                return (
                                                    <tr key={rec.id} style={{ background: isDue ? 'rgba(239,68,68,.04)' : undefined }}>
                                                        <td style={tdStyle}>
                                                            <div style={{ fontWeight: 600 }}>{rec.customerName}</div>
                                                        </td>
                                                        <td style={{ ...tdStyle, maxWidth: 180 }}>
                                                            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={productNames}>
                                                                {productNames}
                                                            </div>
                                                            <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>{rec.lineItems.length} item{rec.lineItems.length !== 1 ? 's' : ''}</div>
                                                        </td>
                                                        <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontWeight: 600 }}>
                                                            {formatCurrency(rec.grandTotal)}
                                                        </td>
                                                        <td style={tdStyle}>
                                                            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 3, ...freqBadgeStyle(rec.frequency) }}>
                                                                <Calendar size={9} /> {rec.frequency}
                                                            </span>
                                                        </td>
                                                        <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', color: isDue ? '#FCA5A5' : 'var(--color-redwood-text-muted)' }}>
                                                            {formatDate(rec.nextRunDate)}
                                                        </td>
                                                        <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', color: 'var(--color-redwood-text-muted)' }}>
                                                            {formatDate(rec.lastRunDate)}
                                                        </td>
                                                        <td style={tdStyle}>
                                                            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...statusBadgeStyle(rec, today) }}>
                                                                {statusLabel(rec, today)}
                                                            </span>
                                                        </td>
                                                        <td style={tdStyle}>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                                {isDue && (
                                                                    <button type="button" onClick={() => runSingle(rec)} disabled={running} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px', background: 'rgba(34,197,94,.1)', color: '#86EFAC', border: '1px solid rgba(34,197,94,.28)' }}>
                                                                        <Play size={11} /> Run
                                                                    </button>
                                                                )}
                                                                {rec.active ? (
                                                                    <button type="button" onClick={() => toggleActive(rec.id)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px' }}>
                                                                        <Pause size={11} /> Pause
                                                                    </button>
                                                                ) : (
                                                                    <button type="button" onClick={() => toggleActive(rec.id)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px', background: 'rgba(34,197,94,.1)', color: '#86EFAC', border: '1px solid rgba(34,197,94,.28)' }}>
                                                                        <CheckCircle2 size={11} /> Resume
                                                                    </button>
                                                                )}
                                                                <button type="button" onClick={() => startEdit(rec)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px' }}>
                                                                    <Edit2 size={11} /> Edit
                                                                </button>
                                                                <button type="button" onClick={() => deleteRec(rec.id)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px', color: '#FCA5A5', border: '1px solid rgba(239,68,68,.28)' }}>
                                                                    <Trash2 size={11} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* AI Analysis footer */}
                        <div style={{ ...panelStyle, background: '#0f1f33', border: '1px solid rgba(155,111,228,.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(155,111,228,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bot size={16} style={{ color: '#C4B5FD' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>AI recurring invoice analysis</div>
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Insights from your schedule data · human approval required</div>
                                </div>
                            </div>

                            {[
                                {
                                    dot: '#EF4444',
                                    body: dueItems.length > 0
                                        ? <><strong style={{ color: '#EF4444' }}>{dueItems.length} schedule{dueItems.length !== 1 ? 's' : ''}</strong> due today — generate invoices to avoid billing gaps.</>
                                        : <>No recurring invoices due today. All schedules are current.</>,
                                },
                                {
                                    dot: '#22C55E',
                                    body: <><strong style={{ color: '#22C55E' }}>{formatCompactUsd(monthlyValue)}</strong> estimated monthly recurring revenue from {activeItems.length} active schedule{activeItems.length !== 1 ? 's' : ''}.</>,
                                },
                                {
                                    dot: '#4F8EF7',
                                    body: pausedItems.length > 0
                                        ? <><strong style={{ color: '#4F8EF7' }}>{pausedItems.length} paused</strong> schedule{pausedItems.length !== 1 ? 's' : ''} — follow up with customers to resume billing.</>
                                        : <>All recurring schedules are active. No paused customers.</>,
                                },
                            ].map((ins, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: i < 2 ? '0.5px solid rgba(255,255,255,.04)' : 'none' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ins.dot, flexShrink: 0, marginTop: 4 }} />
                                    <div style={{ flex: 1, fontSize: 10, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5 }}>{ins.body}</div>
                                </div>
                            ))}

                            <div style={{ fontSize: 10, fontWeight: 500, color: '#C4B5FD', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Sparkles size={12} /> AI suggested actions
                                {dueItems.length > 0 && (
                                    <span style={{ fontSize: 9, background: 'rgba(239,68,68,.12)', color: '#FCA5A5', borderRadius: 20, padding: '1px 6px' }}>{dueItems.length} due today</span>
                                )}
                            </div>

                            {dueItems.length > 0 && (
                                <div style={{ background: '#0a1726', border: '0.5px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Play size={14} style={{ color: '#FCA5A5' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-redwood-text-main)' }}>Run both due</div>
                                        <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                            {dueItems.map(d => d.customerName).join(' · ')} — {formatCurrency(dueItems.reduce((s, d) => s + d.grandTotal, 0))} total
                                        </div>
                                    </div>
                                    <button type="button" onClick={runNow} disabled={running} style={{ background: '#22C55E', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                                        Run now
                                    </button>
                                </div>
                            )}

                            {firstPaused && (
                                <div style={{ background: '#0a1726', border: '0.5px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(79,142,247,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Clock size={14} style={{ color: '#93C5FD' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-redwood-text-main)' }}>Follow up paused customer</div>
                                        <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                            {firstPaused.customerName} — paused since {formatDate(firstPaused.lastRunDate || firstPaused.createdAt.slice(0, 10))}
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => toggleActive(firstPaused.id)} style={{ background: '#4F8EF7', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                                        Resume
                                    </button>
                                </div>
                            )}

                            <div style={{ background: '#0f1f33', border: '0.5px solid rgba(155,111,228,.3)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                                <span style={{ fontSize: 14, flexShrink: 0 }}>🤖</span>
                                <input
                                    type="text"
                                    value={aiQuestion}
                                    onChange={e => setAiQuestion(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const q = aiQuestion.trim() || AI_PROMPTS[0];
                                            alert(`AI Recurring Invoices (preview)\n\n"${q}"\n\nConnect the AI endpoint for live recurring invoice analysis.`);
                                        }
                                    }}
                                    placeholder={`Ask AI: '${AI_PROMPTS[0]}' · '${AI_PROMPTS[1]}'`}
                                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: 'var(--color-redwood-text-main)', fontFamily: 'inherit' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const q = aiQuestion.trim() || AI_PROMPTS[0];
                                        alert(`AI Recurring Invoices (preview)\n\n"${q}"\n\nConnect the AI endpoint for live recurring invoice analysis.`);
                                    }}
                                    style={{ background: '#9B6FE4', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 10, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                                >
                                    Ask →
                                </button>
                            </div>
                            <div style={{ marginTop: 7, fontSize: 9, color: 'var(--color-redwood-text-subtle)', textAlign: 'right' }}>
                                🔒 Data processed on-device · never leaves your account · educational use only
                            </div>
                        </div>
                    </>
                )}

                {/* History tab */}
                {activeTab === 'history' && (
                    <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                        {historyRows.length === 0 ? (
                            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                                <Clock size={40} style={{ color: 'var(--color-redwood-text-subtle)', margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-muted)' }}>No generation history yet</p>
                                <p style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>Run due invoices to see history here</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                            {['Customer', 'Amount', 'Frequency', 'Last run', 'Next due', 'Status'].map(h => (
                                                <th key={h} style={thStyle}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyRows.map(rec => (
                                            <tr key={rec.id}>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>{rec.customerName}</td>
                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace' }}>{formatCurrency(rec.grandTotal)}</td>
                                                <td style={tdStyle}>
                                                    <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...freqBadgeStyle(rec.frequency) }}>
                                                        {rec.frequency}
                                                    </span>
                                                </td>
                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace' }}>{formatDate(rec.lastRunDate)}</td>
                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace' }}>{formatDate(rec.nextRunDate)}</td>
                                                <td style={tdStyle}>
                                                    <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...statusBadgeStyle(rec, today) }}>
                                                        {statusLabel(rec, today)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Create / Edit form */}
                {showForm && (
                    <div style={{ ...panelStyle, border: '1px solid rgba(79,142,247,.35)' }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-redwood-text-main)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 12 }}>
                            {editingId ? 'Edit recurring invoice' : 'New recurring invoice'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12, marginBottom: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Customer</label>
                                <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 11, fontFamily: 'inherit' }}>
                                    <option value="">Select customer...</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Frequency</label>
                                <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as 'weekly' | 'monthly' | 'quarterly' })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 11, fontFamily: 'inherit' }}>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>First run date</label>
                                <input type="date" value={form.nextRunDate} onChange={e => setForm({ ...form, nextRunDate: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 11, fontFamily: 'inherit' }} />
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Line items</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {form.items.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-12" style={{ gap: 8, alignItems: 'center' }}>
                                        <div className="col-span-4">
                                            <select value={item.product} onChange={e => updateItem(idx, 'product', e.target.value)}
                                                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 11, fontFamily: 'inherit' }}>
                                                <option value="">Select product...</option>
                                                {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 11, fontFamily: 'inherit' }} />
                                        </div>
                                        <div className="col-span-3">
                                            <input type="number" placeholder="Rate" value={item.rate} onChange={e => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                                                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 11, fontFamily: 'ui-monospace,monospace' }} />
                                        </div>
                                        <div className="col-span-2" style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, fontFamily: 'ui-monospace,monospace' }}>
                                            {formatCurrency(item.amount)}
                                        </div>
                                        <div className="col-span-1" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            {form.items.length > 1 && (
                                                <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                                                    style={{ ...ghostBtn, padding: 4, color: '#FCA5A5', border: 'none' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={() => setForm({ ...form, items: [...form.items, EMPTY_ITEM()] })}
                                style={{ ...ghostBtn, marginTop: 8, fontSize: 10, color: '#4F8EF7', border: 'none', background: 'transparent', padding: 0 }}>
                                <Plus size={12} /> Add line
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid var(--color-redwood-border)' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>Total: {formatCurrency(grandTotal)}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={ghostBtn}>Cancel</button>
                                <button type="button" onClick={saveForm} style={primaryBtn}>
                                    {editingId ? 'Update recurring invoice' : 'Save recurring invoice'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
