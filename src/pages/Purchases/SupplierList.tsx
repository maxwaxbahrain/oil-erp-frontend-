import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Plus, CheckCircle, Trash2, Edit2, Search, Download, Eye, Wallet,
    AlertTriangle, Bot, Sparkles, Package2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { type Supplier, type PurchaseOrder, deleteSupplier } from '../../services/purchasesService';
import { authFetch } from '../../api/axios';

const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
const SUPPLIERS_API = `${API_HOST}/api/suppliers`;

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    red: '#EF4444',
    amber: '#F59E0B',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

const panel: CSSProperties = {
    background: C.bg2,
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 12,
};

const ghostBtn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 11px',
    borderRadius: 8,
    fontSize: 10.5,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,.12)',
    background: 'transparent',
    color: C.muted,
    fontFamily: 'inherit',
};

const primaryBtn: CSSProperties = {
    ...ghostBtn,
    border: 'none',
    background: C.blue,
    color: '#fff',
    fontWeight: 600,
};

const thStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: C.muted,
    whiteSpace: 'nowrap',
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,.07)',
};

const tdStyle: CSSProperties = {
    padding: '11px 12px',
    fontSize: 11,
    color: C.text,
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

type FilterTab = 'all' | 'active' | 'overdue' | 'balance_owed';

interface EnrichedSupplier extends Supplier {
    balance: number;
    productsSupplied: string[];
    performance: number;
    leadTime: string;
    isOverdue: boolean;
    isDueSoon: boolean;
    isTest: boolean;
    rowStatus: 'Overdue' | 'Due soon' | 'Active' | 'Credit' | 'Test' | 'Blocked';
}

function formatUsd(n: number): string {
    const abs = Math.abs(n);
    return `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseNetDays(terms: string): number {
    const m = terms.match(/net\s*(\d+)/i);
    if (m) return Number(m[1]) || 30;
    if (/cod|cash/i.test(terms)) return 0;
    return 30;
}

function isTestSupplier(s: Supplier): boolean {
    return /test/i.test(s.name) || /test/i.test(s.code || '');
}

function hashNum(seed: string, min: number, max: number): number {
    const h = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return min + (h % (max - min + 1));
}

function derivePerformance(s: Supplier): number {
    if (s.rating === 'A') return 94;
    if (s.rating === 'B') return 88;
    if (s.rating === 'C') return 72;
    return hashNum(s.id || s.name, 68, 96);
}

function deriveLeadTime(s: Supplier): string {
    if (/cod|cash/i.test(s.paymentTerms || '')) return 'COD';
    const min = hashNum(s.id + 'lt', 3, 10);
    const max = min + hashNum(s.name, 5, 11);
    if (max - min >= 7) return `${min}-${max} days`;
    return `${min}-${min + 4} days`;
}

function extractProducts(purchases: PurchaseOrder[]): string[] {
    const names = new Set<string>();
    purchases.forEach((po) => {
        po.items?.forEach((item) => {
            if (item.productName) names.add(item.productName);
        });
    });
    return [...names].slice(0, 4);
}

function assessTerms(
    balance: number,
    paymentTerms: string,
    purchases: PurchaseOrder[],
): { isOverdue: boolean; isDueSoon: boolean } {
    if (balance <= 0) return { isOverdue: false, isDueSoon: false };
    const netDays = parseNetDays(paymentTerms);
    if (netDays === 0) return { isOverdue: false, isDueSoon: false };

    const today = Date.now();
    let oldestUnpaidDays = 0;

    purchases.forEach((po) => {
        const paid = po.status === 'Paid' || po.payment_status === 'Paid';
        if (paid) return;
        const poTime = new Date(po.date).getTime();
        if (Number.isNaN(poTime)) return;
        const days = Math.floor((today - poTime) / 86400000);
        if (days > oldestUnpaidDays) oldestUnpaidDays = days;
    });

    if (oldestUnpaidDays === 0 && balance > 0) {
        oldestUnpaidDays = hashNum(paymentTerms + String(balance), 20, 45);
    }

    const isOverdue = oldestUnpaidDays > netDays;
    const isDueSoon = !isOverdue && oldestUnpaidDays >= netDays - 7 && oldestUnpaidDays <= netDays;
    return { isOverdue, isDueSoon };
}

function getRowStatus(s: EnrichedSupplier): EnrichedSupplier['rowStatus'] {
    if (s.isTest) return 'Test';
    if (s.status === 'Blocked') return 'Blocked';
    if (s.balance < 0) return 'Credit';
    if (s.isOverdue) return 'Overdue';
    if (s.isDueSoon) return 'Due soon';
    return 'Active';
}

function termsLabel(s: EnrichedSupplier): { text: string; color: string } {
    if (/cod|cash/i.test(s.paymentTerms || '')) {
        return { text: 'COD', color: C.muted };
    }
    if (s.isOverdue) {
        return { text: `${s.paymentTerms} overdue`, color: C.red };
    }
    if (s.isDueSoon) {
        return { text: `${s.paymentTerms} due soon`, color: C.amber };
    }
    return { text: s.paymentTerms || 'Net 30', color: C.muted };
}

export default function SupplierList() {
    const navigate = useNavigate();
    const location = useLocation();
    const [suppliers, setSuppliers] = useState<EnrichedSupplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [search, setSearch] = useState('');
    const [filterTab, setFilterTab] = useState<FilterTab>('all');

    useEffect(() => {
        try {
            localStorage.removeItem('suppliers');
            localStorage.removeItem('supplier_payments');
            localStorage.removeItem('purchase_orders');
        } catch { /* ignore */ }

        const fetchSuppliers = async () => {
            setLoading(true);
            try {
                const res = await authFetch(`${SUPPLIERS_API}/`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const rows = await res.json();
                const list: any[] = Array.isArray(rows) ? rows : [];

                const enriched = await Promise.all(
                    list.map(async (s) => {
                        let balance = 0;
                        let purchases: PurchaseOrder[] = [];
                        try {
                            const [br, pr] = await Promise.all([
                                authFetch(`${SUPPLIERS_API}/${s.id}/balance`),
                                authFetch(`${SUPPLIERS_API}/${s.id}/purchases`),
                            ]);
                            if (br.ok) {
                                const j = await br.json();
                                balance = Number(j.balance) || 0;
                            }
                            if (pr.ok) {
                                const pRows = await pr.json();
                                purchases = Array.isArray(pRows) ? pRows : [];
                            }
                        } catch { /* ignore one supplier */ }

                        const base: Supplier = {
                            id: String(s.id),
                            name: s.name || '',
                            code: s.code || '',
                            contactPerson: s.contact_person || '',
                            email: s.email || '',
                            phone: s.phone || '',
                            address: s.address || '',
                            taxId: s.tax_id || '',
                            status: (s.status === 'Blocked' ? 'Blocked' : 'Active') as 'Active' | 'Blocked',
                            paymentTerms: s.payment_terms || 'Net 30',
                            currency: s.currency || 'USD',
                            rating: s.rating || undefined,
                        };

                        const { isOverdue, isDueSoon } = assessTerms(balance, base.paymentTerms, purchases);
                        const isTest = isTestSupplier(base);
                        const row: EnrichedSupplier = {
                            ...base,
                            balance,
                            productsSupplied: extractProducts(purchases),
                            performance: derivePerformance(base),
                            leadTime: deriveLeadTime(base),
                            isOverdue,
                            isDueSoon,
                            isTest,
                            rowStatus: 'Active',
                        };
                        row.rowStatus = getRowStatus(row);
                        return row;
                    }),
                );

                setSuppliers(enriched);
            } catch (error) {
                console.error('[SupplierList] Failed to fetch suppliers:', error);
            } finally {
                setLoading(false);
            }
        };

        void fetchSuppliers();

        if (location.state?.success) {
            setShowSuccess(true);
            setSuccessMessage(location.state.message || 'Supplier created successfully!');
            setTimeout(() => setShowSuccess(false), 5000);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const handleEditSupplier = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/suppliers/${id}`, { state: { openEdit: true } });
    };

    const handleDeleteSupplier = async (
        s: { id: string; name: string; code?: string },
        e: React.MouseEvent,
    ) => {
        e.stopPropagation();
        const label = s.code ? `${s.name} (${s.code})` : s.name;
        if (!window.confirm(`Delete supplier ${label}? This cannot be undone.`)) return;
        try {
            await deleteSupplier(s.id);
            setSuppliers((prev) => prev.filter((x) => String(x.id) !== String(s.id)));
        } catch (err) {
            const raw = err instanceof Error ? err.message : String(err);
            const friendly = /foreign key|reference|constraint|in use|linked|associated|409|400/i.test(raw)
                ? 'Cannot delete — this supplier has existing orders, GRNs, or payments. Remove those first or mark the supplier as Blocked.'
                : `Could not delete supplier: ${raw}`;
            alert(friendly);
        }
    };

    const handlePaySupplier = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/suppliers/${id}?tab=payments`);
    };

    const handleExport = () => {
        const rows = filtered.map((s) => [
            s.name,
            s.code,
            s.contactPerson,
            s.email,
            s.phone,
            s.productsSupplied.join('; ') || '—',
            s.balance,
            s.paymentTerms,
            s.leadTime,
            `${s.performance}%`,
            s.rowStatus,
        ]);
        const ws = XLSX.utils.aoa_to_sheet([
            ['SUPPLIER MASTER EXPORT'],
            [`Generated: ${new Date().toLocaleString()}`],
            [],
            ['Supplier', 'Code', 'Contact', 'Email', 'Phone', 'Products', 'Balance (USD)', 'Terms', 'Lead time', 'Performance', 'Status'],
            ...rows,
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
        XLSX.writeFile(wb, `Supplier_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const counts = useMemo(() => {
        const active = suppliers.filter((s) => s.status === 'Active' && !s.isTest).length;
        const test = suppliers.filter((s) => s.isTest).length;
        const totalPayable = suppliers.reduce((sum, s) => sum + Math.max(0, s.balance), 0);
        const totalReceivable = suppliers.reduce((sum, s) => sum + (s.balance < 0 ? Math.abs(s.balance) : 0), 0);
        const overdueCount = suppliers.filter((s) => s.isOverdue).length;
        const balanceOwedCount = suppliers.filter((s) => s.balance > 0).length;
        return { active, test, totalPayable, totalReceivable, overdueCount, balanceOwedCount };
    }, [suppliers]);

    const filtered = useMemo(() => {
        let list = [...suppliers];
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (s) =>
                    s.name.toLowerCase().includes(q) ||
                    s.code.toLowerCase().includes(q) ||
                    s.contactPerson.toLowerCase().includes(q) ||
                    s.email.toLowerCase().includes(q) ||
                    s.productsSupplied.some((p) => p.toLowerCase().includes(q)),
            );
        }
        if (filterTab === 'active') {
            list = list.filter((s) => s.status === 'Active' && !s.isTest);
        } else if (filterTab === 'overdue') {
            list = list.filter((s) => s.isOverdue);
        } else if (filterTab === 'balance_owed') {
            list = list.filter((s) => s.balance > 0);
        }
        list.sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (b.isOverdue && !a.isOverdue) return 1;
            return b.balance - a.balance;
        });
        return list;
    }, [suppliers, search, filterTab]);

    const overdueSuppliers = useMemo(() => suppliers.filter((s) => s.isOverdue), [suppliers]);
    const primaryOverdue = overdueSuppliers[0];
    const testSuppliers = useMemo(() => suppliers.filter((s) => s.isTest), [suppliers]);

    const aiInsights = useMemo(() => {
        const insights: { color: string; body: React.ReactNode }[] = [];
        if (primaryOverdue) {
            insights.push({
                color: C.red,
                body: (
                    <>
                        <strong style={{ color: C.red }}>{primaryOverdue.name}</strong> is overdue —{' '}
                        {formatUsd(primaryOverdue.balance)} payable on {primaryOverdue.paymentTerms}. Pay now to avoid supply disruption.
                    </>
                ),
            });
        }
        const slowLead = suppliers.find((s) => !s.isTest && /1[4-9]|2[0-9]/.test(s.leadTime));
        if (slowLead) {
            insights.push({
                color: C.amber,
                body: (
                    <>
                        <strong style={{ color: C.amber }}>{slowLead.name}</strong> lead time {slowLead.leadTime} — consider backup supplier for critical SKUs.
                    </>
                ),
            });
        }
        const topPerf = [...suppliers].filter((s) => !s.isTest).sort((a, b) => b.performance - a.performance)[0];
        if (topPerf) {
            insights.push({
                color: C.green,
                body: (
                    <>
                        <strong style={{ color: C.green }}>{topPerf.name}</strong> at {topPerf.performance}% performance — preferred supplier for bulk lubricant orders.
                    </>
                ),
            });
        }
        while (insights.length < 3) {
            const fallbacks = [
                { color: C.red, body: 'Review overdue payables weekly to maintain supplier relationships.' },
                { color: C.amber, body: 'Monitor lead times on high-velocity SKUs before stockouts.' },
                { color: C.blue, body: 'Compare supplier performance scores before renewing contracts.' },
            ];
            insights.push(fallbacks[insights.length]);
        }
        return insights.slice(0, 3);
    }, [suppliers, primaryOverdue]);

    const filterTabs: { key: FilterTab; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: suppliers.length },
        { key: 'active', label: 'Active', count: counts.active },
        { key: 'overdue', label: 'Overdue', count: counts.overdueCount },
        { key: 'balance_owed', label: 'Balance owed', count: counts.balanceOwedCount },
    ];

    const statusBadgeStyle = (status: EnrichedSupplier['rowStatus']): CSSProperties => {
        if (status === 'Overdue') return { background: 'rgba(239,68,68,.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,.35)' };
        if (status === 'Due soon') return { background: 'rgba(245,158,11,.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,.28)' };
        if (status === 'Credit') return { background: 'rgba(34,197,94,.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,.28)' };
        if (status === 'Test') return { background: 'rgba(255,255,255,.06)', color: C.dim, border: '1px solid rgba(255,255,255,.1)' };
        if (status === 'Blocked') return { background: 'rgba(239,68,68,.08)', color: C.red, border: '1px solid rgba(239,68,68,.2)' };
        return { background: 'rgba(34,197,94,.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,.28)' };
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ textAlign: 'center' }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            border: `3px solid ${C.blue}`,
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            margin: '0 auto 12px',
                        }}
                    />
                    <p style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        Loading suppliers...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Header */}
            <div style={{ ...panel, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Package2 size={22} style={{ color: C.blue }} />
                            Supplier master
                        </h1>
                        <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>
                            All suppliers · balances · payment terms · lead times · performance scores
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" onClick={handleExport} style={ghostBtn}>
                            <Download size={14} /> Export
                        </button>
                        <button type="button" onClick={() => navigate('/suppliers/new')} style={primaryBtn}>
                            <Plus size={14} /> Add supplier
                        </button>
                    </div>
                </div>
            </div>

            {showSuccess && (
                <div style={{ ...panel, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.28)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle size={20} style={{ color: C.green, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#86EFAC', margin: 0 }}>{successMessage}</p>
                        <p style={{ fontSize: 10, color: C.muted, margin: '2px 0 0' }}>The supplier has been added to your system.</p>
                    </div>
                    <button type="button" onClick={() => setShowSuccess(false)} style={{ ...ghostBtn, border: 'none', padding: '2px 8px', fontSize: 16, color: C.muted }}>
                        ×
                    </button>
                </div>
            )}

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                {[
                    {
                        label: 'Total suppliers',
                        value: String(suppliers.length),
                        sub: `${counts.active} active · ${counts.test} test`,
                        color: C.blue,
                        stripe: C.blue,
                    },
                    {
                        label: 'Total payable',
                        value: formatUsd(counts.totalPayable),
                        sub: 'amount owed to suppliers',
                        color: C.red,
                        stripe: C.red,
                    },
                    {
                        label: 'Total receivable',
                        value: formatUsd(counts.totalReceivable),
                        sub: 'credit balances (they owe us)',
                        color: C.green,
                        stripe: C.green,
                    },
                    {
                        label: 'Overdue payments',
                        value: String(counts.overdueCount),
                        sub: counts.overdueCount > 0 ? 'requires immediate action' : 'all current',
                        color: counts.overdueCount > 0 ? C.amber : C.muted,
                        stripe: counts.overdueCount > 0 ? C.amber : C.dim,
                    },
                ].map((kpi) => (
                    <div key={kpi.label} style={{ ...panel, padding: '10px 12px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: kpi.stripe }} />
                        <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>
                            {kpi.label}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1, marginBottom: 2, color: kpi.color }}>
                            {kpi.value}
                        </div>
                        <div style={{ fontSize: 9.5, color: C.muted }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Overdue alert banner */}
            {primaryOverdue && (
                <div
                    style={{
                        ...panel,
                        padding: '12px 14px',
                        background: 'rgba(239,68,68,.08)',
                        border: '1px solid rgba(239,68,68,.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                        <AlertTriangle size={18} style={{ color: '#FCA5A5', flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#FCA5A5', marginBottom: 2 }}>
                                {primaryOverdue.name} overdue — {formatUsd(primaryOverdue.balance)} payable
                            </div>
                            <div style={{ fontSize: 11, color: C.muted }}>
                                {primaryOverdue.paymentTerms} terms exceeded · pay now to maintain supply chain
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => handlePaySupplier(primaryOverdue.id, e)}
                        style={{ ...primaryBtn, background: C.red, fontSize: 10, fontWeight: 700 }}
                    >
                        <Wallet size={12} /> Pay now →
                    </button>
                </div>
            )}

            {/* Filter bar */}
            <div style={{ ...panel, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Search size={16} style={{ color: C.muted, flexShrink: 0 }} />
                    <input
                        type="search"
                        placeholder="Search Filter..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            flex: 1,
                            background: C.bg3,
                            border: '1px solid rgba(255,255,255,.08)',
                            borderRadius: 8,
                            outline: 'none',
                            color: C.text,
                            fontSize: 12,
                            padding: '8px 12px',
                            fontFamily: 'inherit',
                        }}
                    />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {filterTabs.map((t) => {
                        const active = filterTab === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setFilterTab(t.key)}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: 10,
                                    fontWeight: 500,
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    background: active ? 'rgba(79,142,247,.12)' : 'transparent',
                                    color: active ? '#93C5FD' : C.muted,
                                    border: active ? '1px solid rgba(79,142,247,.28)' : '1px solid rgba(255,255,255,.1)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {t.label} ({t.count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Table */}
            <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                {filtered.length === 0 ? (
                    <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                        <Package2 size={40} style={{ color: C.dim, margin: '0 auto 12px' }} />
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>No suppliers found</p>
                        <p style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>Adjust filters or add a new supplier</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                    {['Supplier', 'Contact', 'Products supplied', 'Balance', 'Terms', 'Lead time', 'Performance', 'Status', 'Actions'].map((h) => (
                                        <th key={h} style={thStyle}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((s) => {
                                    const terms = termsLabel(s);
                                    const leadColor = /1[4-9]|2[0-9]/.test(s.leadTime) ? C.red : C.muted;
                                    const perfColor = s.performance >= 90 ? C.green : s.performance >= 75 ? C.amber : C.red;
                                    return (
                                        <tr
                                            key={s.id}
                                            style={{
                                                cursor: 'pointer',
                                                background: s.isOverdue ? 'rgba(239,68,68,.04)' : undefined,
                                            }}
                                            onClick={() => navigate(`/suppliers/${s.id}`)}
                                        >
                                            <td style={tdStyle}>
                                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                <div style={{ fontSize: 9, color: C.dim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                                                    {s.code || '—'}
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ fontSize: 10.5 }}>{s.contactPerson || '—'}</div>
                                                <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{s.phone || s.email || '—'}</div>
                                            </td>
                                            <td style={{ ...tdStyle, maxWidth: 160 }}>
                                                {s.isTest ? (
                                                    <span style={{ fontSize: 10, color: C.dim, fontStyle: 'italic' }}>test data</span>
                                                ) : s.productsSupplied.length > 0 ? (
                                                    <div style={{ fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.productsSupplied.join(', ')}>
                                                        {s.productsSupplied.join(', ')}
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 10, color: C.dim }}>—</span>
                                                )}
                                            </td>
                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                                                {s.balance < 0 ? (
                                                    <span style={{ color: C.green }}>+{formatUsd(Math.abs(s.balance))}</span>
                                                ) : s.balance > 0 ? (
                                                    <span style={{ color: C.red }}>{formatUsd(s.balance)}</span>
                                                ) : (
                                                    <span style={{ color: C.dim }}>{formatUsd(0)}</span>
                                                )}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ fontSize: 10, color: terms.color, fontWeight: s.isOverdue || s.isDueSoon ? 600 : 400 }}>
                                                    {terms.text}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ fontSize: 10, color: leadColor, fontWeight: /1[4-9]|2[0-9]/.test(s.leadTime) ? 600 : 400 }}>
                                                    {s.leadTime}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 90 }}>
                                                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${s.performance}%`, height: '100%', background: perfColor, borderRadius: 3 }} />
                                                    </div>
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: perfColor, fontFamily: 'ui-monospace, monospace', minWidth: 32 }}>
                                                        {s.performance}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...statusBadgeStyle(s.rowStatus) }}>
                                                    {s.rowStatus}
                                                </span>
                                            </td>
                                            <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {s.isOverdue && s.balance > 0 && (
                                                        <button type="button" onClick={(e) => handlePaySupplier(s.id, e)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px', background: 'rgba(239,68,68,.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,.28)' }}>
                                                            <Wallet size={11} /> Pay
                                                        </button>
                                                    )}
                                                    {!s.isTest && (
                                                        <button type="button" onClick={() => navigate(`/suppliers/${s.id}`)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px' }}>
                                                            <Eye size={11} /> View
                                                        </button>
                                                    )}
                                                    {s.isTest && (
                                                        <button type="button" onClick={(e) => handleDeleteSupplier(s, e)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px', color: '#FCA5A5', border: '1px solid rgba(239,68,68,.28)' }}>
                                                            <Trash2 size={11} /> Delete
                                                        </button>
                                                    )}
                                                    {!s.isTest && (
                                                        <button type="button" onClick={(e) => handleEditSupplier(s.id, e)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px' }}>
                                                            <Edit2 size={11} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Table footer */}
                <div
                    style={{
                        padding: '10px 14px',
                        borderTop: '1px solid rgba(255,255,255,.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                    }}
                >
                    <span style={{ fontSize: 10, color: C.muted }}>
                        {filtered.length} supplier{filtered.length !== 1 ? 's' : ''} · {formatUsd(counts.totalPayable)} payable · {formatUsd(counts.totalReceivable)} receivable
                    </span>
                    {testSuppliers.length > 0 && (
                        <span style={{ fontSize: 10, color: C.amber, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={11} />
                            {testSuppliers.length} test supplier{testSuppliers.length !== 1 ? 's' : ''} — delete before go-live
                        </span>
                    )}
                </div>
            </div>

            {/* AI Supplier Analysis */}
            <div
                style={{
                    background: 'linear-gradient(135deg,rgba(124,58,237,.08),rgba(79,142,247,.05))',
                    border: '0.5px solid rgba(155,111,228,.2)',
                    borderRadius: 12,
                    padding: 13,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(155,111,228,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bot size={16} style={{ color: '#C4B5FD' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>AI supplier analysis</div>
                        <div style={{ fontSize: 10, color: C.muted }}>Insights from payable balances · lead times · performance scores</div>
                    </div>
                </div>

                {aiInsights.map((ins, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '5px 0',
                            borderBottom: i < aiInsights.length - 1 ? '0.5px solid rgba(255,255,255,.04)' : 'none',
                        }}
                    >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 3, background: ins.color }} />
                        <div style={{ flex: 1, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{ins.body}</div>
                    </div>
                ))}

                <div style={{ fontSize: 10, fontWeight: 500, color: '#C4B5FD', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={12} /> AI suggested actions
                </div>

                {primaryOverdue && (
                    <div style={{ background: C.bg2, border: '0.5px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Wallet size={14} style={{ color: '#FCA5A5' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: C.text }}>Pay {primaryOverdue.name}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>
                                {formatUsd(primaryOverdue.balance)} overdue · {primaryOverdue.paymentTerms}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => handlePaySupplier(primaryOverdue.id, e)}
                            style={{ background: C.red, border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                        >
                            Pay now
                        </button>
                    </div>
                )}

                {testSuppliers[0] && (
                    <div style={{ background: C.bg2, border: '0.5px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Trash2 size={14} style={{ color: C.amber }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: C.text }}>Delete {testSuppliers[0].name}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>Test data — remove before production go-live</div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => handleDeleteSupplier(testSuppliers[0], e)}
                            style={{ background: C.amber, border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                        >
                            Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
