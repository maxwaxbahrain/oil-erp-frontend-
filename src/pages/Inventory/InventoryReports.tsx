import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency as globalFormatCurrency, getSystemSettings } from '../../services/settingsService';
import {
    BarChart3,
    Download,
    ArrowRight,
    TrendingUp,
    PieChart,
    Activity,
    DollarSign,
    Package,
    Search,
    X,
    FileText,
    AlertTriangle,
    Sparkles,
    Bot,
    Brain,
    Layers,
    ChevronRight,
    Eye,
    Play,
} from 'lucide-react';
import { getProducts, type Product } from '../../services/productService';
import {
    getInventoryMetrics,
    calculateInventoryValuation,
    calculateFIFOValuation,
    calculateLIFOValuation,
    calculateAvgCostValuation,
    calculateStockMovement,
    identifyDeadStock,
    calculateSupplierAccuracy,
    calculateLossLeakage,
    generateForecastingData,
    type InventoryValuation,
    type StockMovement,
    type DeadStock,
    type SupplierAccuracy,
    type LossLeakage,
    type ForecastingData,
    type InventoryMetrics,
    type CostMethodValuation,
} from '../../services/inventoryService';

type ReportType = 'valuation' | 'fifo' | 'lifo' | 'avgcost' | 'movement' | 'deadstock' | 'supplier' | 'loss' | 'forecast' | null;
type PageTab = 'overview' | 'material-audit' | 'stock-adjustment' | 'forecasting' | 'supplier-accuracy';
type PeriodKey = 'may' | 'q2' | 'ytd' | 'fy' | 'custom';
type ValuationMethod = 'Average' | 'FIFO' | 'LIFO';
type QueryMode = 'nl' | 'sql';

const C = {
    bg: '#0b1120',
    surface: '#161e2d',
    blue: '#4F8EF7',
    green: '#22C55E',
    red: '#EF4444',
    amber: '#F59E0B',
    purple: '#9B6FE4',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

const panel: CSSProperties = {
    background: C.surface,
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 10,
};

const ghostBtn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,.12)',
    background: 'rgba(255,255,255,.04)',
    color: C.muted,
    fontFamily: 'inherit',
};

const PERIOD_PILLS: { key: PeriodKey; label: string }[] = [
    { key: 'may', label: 'May 2026' },
    { key: 'q2', label: 'Q2 2026' },
    { key: 'ytd', label: 'YTD 2026' },
    { key: 'fy', label: 'FY 2025' },
    { key: 'custom', label: 'Custom' },
];

const PAGE_TABS: { id: PageTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'material-audit', label: 'Material audit' },
    { id: 'stock-adjustment', label: 'Stock adjustment' },
    { id: 'forecasting', label: 'Forecasting' },
    { id: 'supplier-accuracy', label: 'Supplier accuracy' },
];

const QUERY_CHIPS = ['Fast movers', 'Dead stock', 'High margin', 'Low turnover', 'Overstock risk', 'Reorder needed'];

const AI_INSIGHTS: Array<{ color: string; title: string; body: string }> = [];
const AI_ACTIONS: Array<{ color: string; title: string; detail: string; report: ReportType }> = [];

function fmtCompactUsd(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1000) return `$${Math.round(value / 1000)}K`;
    return `$${value.toFixed(0)}`;
}

function fmtOptionalPct(value: number | null | undefined, decimals = 1): string {
    return value == null ? '—' : `${value.toFixed(decimals)}%`;
}

function fmtOptionalNumber(value: number | null | undefined, suffix = ''): string {
    return value == null ? '—' : `${value}${suffix}`;
}

function getTotalStock(p: Product): number {
    return p.locations?.reduce((a, b) => a + (b.currentStock ?? 0), 0) ?? 0;
}

function CostMethodReport({ data }: { data: CostMethodValuation }) {
    const formatCurr = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const accent = data.method === 'FIFO' ? C.blue : data.method === 'LIFO' ? C.purple : C.amber;
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Method', value: data.method },
                    { label: 'Total Inventory Value', value: formatCurr(data.totalValue) },
                    { label: 'Total Units', value: data.totalUnits.toLocaleString() },
                ].map((s, i) => (
                    <div key={i} style={{ ...panel, padding: '16px 18px', borderColor: `${accent}33` }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</p>
                        <p style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{s.value}</p>
                    </div>
                ))}
            </div>
            <div style={{ ...panel, padding: 14, background: 'rgba(255,255,255,.03)' }}>
                <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                    {data.method === 'FIFO' && 'FIFO — First In, First Out: Oldest purchased stock is valued first. Higher profits during inflation.'}
                    {data.method === 'LIFO' && 'LIFO — Last In, First Out: Newest purchased stock is valued first. Lower profits during inflation (tax benefit).'}
                    {data.method === 'Average' && 'Average Cost: Stock is valued at the weighted average purchase price. Simple and most common.'}
                </p>
            </div>
            <div style={{ ...panel, overflow: 'hidden', padding: 0 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Product-wise {data.method} Valuation</p>
                </div>
                <table className="w-full">
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                            {['Product', 'SKU', 'Units', `Unit Cost (${data.method})`, 'Total Value'].map(h => (
                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.filter(it => it.units > 0).map((item, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                                <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: C.text }}>{item.name}</td>
                                <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{item.sku || '—'}</td>
                                <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'monospace', color: C.text }}>{item.units}</td>
                                <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'monospace', color: accent }}>{formatCurr(item.unitCost)}</td>
                                <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'monospace', color: C.text }}>{formatCurr(item.totalValue)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: C.bg, borderTop: '2px solid rgba(255,255,255,.12)' }}>
                            <td colSpan={2} style={{ padding: '10px 16px', fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>Total</td>
                            <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{data.totalUnits}</td>
                            <td style={{ padding: '10px 16px', fontSize: 10, color: C.dim }}>Avg: {formatCurr(data.unitCost)}</td>
                            <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: C.amber, fontFamily: 'monospace' }}>{formatCurr(data.totalValue)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

export default function InventoryReports() {
    const navigate = useNavigate();
    const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeReport, setActiveReport] = useState<ReportType>(null);
    const [reportData, setReportData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<PageTab>('material-audit');
    const [activePeriod, setActivePeriod] = useState<PeriodKey>('may');
    const [valuationMethod, setValuationMethod] = useState<ValuationMethod>(() => {
        const m = getSystemSettings().valuationMethod || 'Average Cost';
        if (m === 'FIFO') return 'FIFO';
        if (m === 'LIFO') return 'LIFO';
        return 'Average';
    });
    const [queryMode, setQueryMode] = useState<QueryMode>('nl');
    const [queryText, setQueryText] = useState('');
    const [activeChip, setActiveChip] = useState<string | null>(null);
    const [queryProducts, setQueryProducts] = useState<Product[]>([]);

    useEffect(() => {
        void loadMetrics();
        void loadQueryProducts();
    }, []);

    const loadMetrics = async () => {
        setLoading(true);
        try {
            const data = await getInventoryMetrics();
            setMetrics(data);
        } catch (error) {
            console.error('Failed to load metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadQueryProducts = async () => {
        try {
            const products = await getProducts();
            setQueryProducts(products);
        } catch (error) {
            console.error('Failed to load products for query engine:', error);
        }
    };

    const runReport = async (type: ReportType) => {
        setActiveReport(type);
        setLoading(true);

        try {
            let data;
            switch (type) {
                case 'valuation':
                    data = await calculateInventoryValuation();
                    break;
                case 'movement':
                    data = await calculateStockMovement();
                    break;
                case 'deadstock':
                    data = await identifyDeadStock();
                    break;
                case 'supplier':
                    data = await calculateSupplierAccuracy();
                    break;
                case 'loss':
                    data = await calculateLossLeakage();
                    break;
                case 'forecast':
                    data = await generateForecastingData();
                    break;
                case 'fifo':
                    data = await calculateFIFOValuation();
                    break;
                case 'lifo':
                    data = await calculateLIFOValuation();
                    break;
                case 'avgcost':
                    data = await calculateAvgCostValuation();
                    break;
            }
            setReportData(data);
        } catch (error) {
            console.error('Failed to run report:', error);
        } finally {
            setLoading(false);
        }
    };

    const closeReport = () => {
        setActiveReport(null);
        setReportData(null);
    };

    const handleTabClick = (tab: PageTab) => {
        if (tab === 'stock-adjustment') {
            navigate('/products');
            return;
        }
        setActiveTab(tab);
        if (tab === 'forecasting') void runReport('forecast');
        if (tab === 'supplier-accuracy') void runReport('supplier');
    };

    const exportAllPdfs = () => {
        window.print();
    };

    const generateGlobalAudit = () => {
        void loadMetrics();
        void runReport('valuation');
    };

    const filteredQueryRows = useMemo(() => {
        let rows = queryProducts.filter(p => getTotalStock(p) >= 0);
        const q = queryText.trim().toLowerCase();
        if (q) {
            rows = rows.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q),
            );
        }
        if (activeChip === 'Fast movers') rows = rows.filter(p => p.velocityStatus === 'Fast');
        else if (activeChip === 'Dead stock') rows = rows.filter(p => p.velocityStatus === 'Dead' || p.velocityStatus === 'Slow');
        else if (activeChip === 'High margin') rows = rows.filter(p => (p.grossMarginPercent ?? 0) >= 30);
        else if (activeChip === 'Low turnover') rows = rows.filter(p => p.velocityStatus === 'Slow' || p.velocityStatus === 'Dead');
        else if (activeChip === 'Overstock risk') rows = rows.filter(p => p.overstockRisk === 'High' || p.overstockRisk === 'Medium');
        else if (activeChip === 'Reorder needed') rows = rows.filter(p => p.reorderLevel > 0 && getTotalStock(p) <= p.reorderLevel);
        return rows.slice(0, 12);
    }, [queryProducts, queryText, activeChip]);

    const reports = [
        { id: 'valuation' as ReportType, title: 'Inventory valuation', description: 'Financial audit using weighted average cost method.', icon: DollarSign, iconColor: C.green, iconBg: 'rgba(34,197,94,.12)' },
        { id: 'fifo' as ReportType, title: 'FIFO valuation', description: 'First In First Out — oldest purchase costs used first.', icon: Layers, iconColor: C.blue, iconBg: 'rgba(79,142,247,.12)' },
        { id: 'lifo' as ReportType, title: 'LIFO valuation', description: 'Last In First Out — newest purchase costs used first.', icon: Layers, iconColor: C.purple, iconBg: 'rgba(155,111,228,.12)' },
        { id: 'movement' as ReportType, title: 'Stock movement', description: 'Current stock with received and sold quantities where available.', icon: Activity, iconColor: C.blue, iconBg: 'rgba(79,142,247,.12)' },
        { id: 'deadstock' as ReportType, title: 'Dead stock audit', description: 'Identifying capital locked in non-moving SKUs.', icon: Package, iconColor: C.red, iconBg: 'rgba(239,68,68,.12)' },
        { id: 'supplier' as ReportType, title: 'Supplier accuracy', description: 'Lead time and quality performance audit.', icon: TrendingUp, iconColor: C.amber, iconBg: 'rgba(245,158,11,.12)' },
        { id: 'loss' as ReportType, title: 'Loss & leakage', description: 'Tracking field sales discrepancies and damages.', icon: BarChart3, iconColor: C.red, iconBg: 'rgba(239,68,68,.12)' },
        { id: 'avgcost' as ReportType, title: 'Average cost detail', description: 'Weighted average cost valuation per product.', icon: DollarSign, iconColor: C.amber, iconBg: 'rgba(245,158,11,.12)' },
        { id: 'forecast' as ReportType, title: 'Demand forecasting', description: 'No forecast source connected; projected demand is blank.', icon: PieChart, iconColor: C.purple, iconBg: 'rgba(155,111,228,.12)' },
    ];

    const pillBtn = (active: boolean, activeStyle?: { border: string; bg: string; color: string }) => ({
        padding: '4px 11px',
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 600,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: active ? (activeStyle?.border ?? 'rgba(79,142,247,.45)') : 'rgba(255,255,255,.08)',
        background: active ? (activeStyle?.bg ?? 'rgba(79,142,247,.15)') : 'rgba(255,255,255,.04)',
        color: active ? (activeStyle?.color ?? C.blue) : C.muted,
        fontFamily: 'inherit',
    } as CSSProperties);

    const showMaterialAudit = activeTab === 'material-audit';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingBottom: 40,
                fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                fontSize: 12,
                color: C.text,
            }}
        >
            {/* Header */}
            <div style={{ ...panel, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(79,142,247,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BarChart3 size={20} style={{ color: '#93C5FD' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: C.text, fontFamily: "'Syne',sans-serif" }}>
                                Enterprise material audit & reporting
                            </div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>
                                Inventory valuation · movement · dead stock · supplier accuracy · forecasting · USD ($)
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={exportAllPdfs} style={ghostBtn}>
                            <Download size={13} /> Export all PDFs
                        </button>
                        <button
                            type="button"
                            onClick={generateGlobalAudit}
                            style={{
                                ...ghostBtn,
                                border: 'none',
                                background: `linear-gradient(135deg, ${C.purple} 0%, #7C3AED 100%)`,
                                color: '#fff',
                                fontWeight: 600,
                                boxShadow: '0 4px 14px rgba(155,111,228,.35)',
                            }}
                        >
                            <Sparkles size={13} /> Generate global audit
                        </button>
                    </div>
                </div>
            </div>

            {/* Period pills + Tabs */}
            <div style={{ ...panel, padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                    {PERIOD_PILLS.map(p => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => { setActivePeriod(p.key); void loadMetrics(); }}
                            style={pillBtn(
                                activePeriod === p.key,
                                p.key === 'ytd'
                                    ? { border: 'rgba(34,197,94,.45)', bg: 'rgba(34,197,94,.15)', color: C.green }
                                    : p.key === 'may'
                                        ? { border: 'rgba(155,111,228,.45)', bg: 'rgba(155,111,228,.18)', color: '#C4B5FD' }
                                        : undefined,
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 10 }}>
                    {PAGE_TABS.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabClick(tab.id)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: '1px solid',
                                borderColor: activeTab === tab.id ? 'rgba(155,111,228,.45)' : 'transparent',
                                background: activeTab === tab.id ? 'rgba(155,111,228,.15)' : 'transparent',
                                color: activeTab === tab.id ? '#C4B5FD' : C.muted,
                                fontFamily: 'inherit',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {[
                    {
                        label: 'Total Asset Valuation',
                        value: loading ? '…' : fmtCompactUsd(metrics?.totalAssetValuation || 0),
                        sub: metrics?.growthRate == null ? '—' : `+${metrics.growthRate.toFixed(1)}%`,
                        subColor: C.muted,
                        valueColor: C.green,
                        stripe: C.green,
                    },
                    {
                        label: 'Avg Inventory Turnover',
                        value: loading ? '…' : (metrics?.avgTurnover == null ? '—' : `${metrics.avgTurnover.toFixed(2)}x`),
                        sub: 'No movement history',
                        subColor: C.muted,
                        valueColor: C.text,
                        stripe: C.blue,
                    },
                    {
                        label: 'Stock Record Accuracy',
                        value: loading ? '…' : fmtOptionalPct(metrics?.stockAccuracy),
                        sub: 'Needs cycle counts',
                        subColor: C.muted,
                        valueColor: C.text,
                        stripe: C.green,
                    },
                    {
                        label: 'Locked Capital',
                        value: loading ? '…' : fmtCompactUsd(metrics?.lockedCapital || 0),
                        sub: 'In slow / dead stocks',
                        subColor: C.red,
                        valueColor: C.red,
                        stripe: C.red,
                    },
                ].map(kpi => (
                    <div key={kpi.label} style={{ ...panel, padding: '14px 16px', borderLeft: `3px solid ${kpi.stripe}` }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{kpi.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: kpi.valueColor, fontFamily: "'Syne',sans-serif" }}>{kpi.value}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: kpi.subColor, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {showMaterialAudit && (
                <>
                    {/* Valuation method toggle */}
                    <div style={{ ...panel, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Valuation method</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {(['Average', 'FIFO', 'LIFO'] as ValuationMethod[]).map(method => (
                                <button
                                    key={method}
                                    type="button"
                                    onClick={() => {
                                        setValuationMethod(method);
                                        const reportMap: Record<ValuationMethod, ReportType> = { Average: 'avgcost', FIFO: 'fifo', LIFO: 'lifo' };
                                        void runReport(reportMap[method]);
                                    }}
                                    style={pillBtn(valuationMethod === method, {
                                        border: valuationMethod === method ? 'rgba(245,158,11,.45)' : 'rgba(255,255,255,.08)',
                                        bg: valuationMethod === method ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.04)',
                                        color: valuationMethod === method ? C.amber : C.muted,
                                    })}
                                >
                                    {method === 'Average' ? 'Average cost' : method}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Inventory Audit Reports */}
                    <div style={{ ...panel, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Sparkles size={15} style={{ color: '#C4B5FD' }} />
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "'Syne',sans-serif" }}>Inventory Audit Reports</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                            {reports.map(report => (
                                <div
                                    key={report.id}
                                    style={{
                                        background: 'rgba(11,17,32,.65)',
                                        border: '1px solid rgba(255,255,255,.07)',
                                        borderRadius: 10,
                                        padding: '14px 14px 12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        minHeight: 180,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 8, background: report.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <report.icon size={17} style={{ color: report.iconColor }} />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 4 }}>{report.title}</div>
                                        <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.45 }}>{report.description}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 10 }}>
                                        <span style={{ fontSize: 8, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Run on demand</span>
                                        <button
                                            type="button"
                                            onClick={() => void runReport(report.id)}
                                            style={{
                                                ...ghostBtn,
                                                padding: '5px 10px',
                                                fontSize: 9,
                                                color: '#C4B5FD',
                                                borderColor: 'rgba(155,111,228,.35)',
                                                background: 'rgba(155,111,228,.12)',
                                            }}
                                        >
                                            Run report <ArrowRight size={11} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Universal Material Query Engine */}
                    <div style={{ ...panel, padding: '14px 16px', background: C.bg, border: '1px solid rgba(79,142,247,.15)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Search size={16} style={{ color: C.blue }} />
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'Syne',sans-serif" }}>Universal Material Query Engine</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                            <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: C.surface, border: '1px solid rgba(255,255,255,.08)' }}>
                                <Search size={14} style={{ color: C.dim, flexShrink: 0 }} />
                                <input
                                    type="text"
                                    value={queryText}
                                    onChange={e => setQueryText(e.target.value)}
                                    placeholder={queryMode === 'nl' ? 'Ask in natural language… e.g. show fast movers with margin above 30%' : "SQL-style filter… e.g. velocity='Fast' AND margin > 30"}
                                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 10, color: C.text, fontFamily: queryMode === 'sql' ? 'monospace' : 'inherit' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button type="button" onClick={() => setQueryMode('nl')} style={pillBtn(queryMode === 'nl')}>Natural language</button>
                                <button type="button" onClick={() => setQueryMode('sql')} style={pillBtn(queryMode === 'sql')}>SQL</button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                            {QUERY_CHIPS.map(chip => (
                                <button
                                    key={chip}
                                    type="button"
                                    onClick={() => setActiveChip(activeChip === chip ? null : chip)}
                                    style={pillBtn(activeChip === chip, { border: 'rgba(79,142,247,.45)', bg: 'rgba(79,142,247,.15)', color: '#93C5FD' })}
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.07)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                        {['Product', 'Stock', 'Velocity', 'Margin', 'Days Left'].map(h => (
                                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredQueryRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: 24, textAlign: 'center', fontSize: 11, color: C.dim }}>No products match your query.</td>
                                        </tr>
                                    ) : (
                                        filteredQueryRows.map(p => (
                                            <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                                                <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: C.text }}>{p.name}</td>
                                                <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{getTotalStock(p)}</td>
                                                <td style={{ padding: '8px 12px' }}>
                                                    <span style={{
                                                        fontSize: 8,
                                                        fontWeight: 700,
                                                        padding: '2px 7px',
                                                        borderRadius: 999,
                                                        background: p.velocityStatus === 'Fast' ? 'rgba(34,197,94,.15)' : p.velocityStatus === 'Dead' ? 'rgba(239,68,68,.15)' : 'rgba(79,142,247,.12)',
                                                        color: p.velocityStatus === 'Fast' ? C.green : p.velocityStatus === 'Dead' ? C.red : C.blue,
                                                    }}>
                                                        {p.velocityStatus}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', color: p.grossMarginPercent > 0 ? C.green : C.muted }}>
                                                    {p.grossMarginPercent > 0 ? `${p.grossMarginPercent.toFixed(1)}%` : '—'}
                                                </td>
                                                <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', color: p.daysStockRemaining > 0 ? C.text : C.muted }}>
                                                    {p.daysStockRemaining > 0 ? Math.round(p.daysStockRemaining) : '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* AI Insights + Suggested Actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                        <div style={{ ...panel, padding: '14px 16px', background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.12)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Brain size={15} style={{ color: C.red }} />
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>AI Material Audit Insights</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {AI_INSIGHTS.length === 0 ? (
                                    <div style={{ fontSize: 10, color: C.muted }}>No insights</div>
                                ) : AI_INSIGHTS.map((insight, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: insight.color, marginTop: 4, flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 600, color: C.text, marginBottom: 2 }}>{insight.title}</div>
                                            <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.45 }}>{insight.body}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ ...panel, padding: '14px 16px', background: 'rgba(155,111,228,.05)', border: '1px solid rgba(155,111,228,.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Bot size={15} style={{ color: '#C4B5FD' }} />
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>AI Suggested Actions</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {AI_ACTIONS.length === 0 ? (
                                    <div style={{ fontSize: 10, color: C.muted }}>No actions</div>
                                ) : AI_ACTIONS.map((action, i) => (
                                    <div key={i} style={{ ...panel, padding: '10px 12px', background: 'rgba(11,17,32,.5)' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: action.color, marginTop: 5, flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 10, fontWeight: 600, color: C.text }}>{action.title}</div>
                                                <div style={{ fontSize: 9, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{action.detail}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                type="button"
                                                onClick={() => void runReport(action.report)}
                                                style={{ ...ghostBtn, fontSize: 9, color: '#C4B5FD', borderColor: 'rgba(155,111,228,.35)', background: 'rgba(155,111,228,.12)' }}
                                            >
                                                <Play size={10} /> Run
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void runReport(action.report)}
                                                style={{ ...ghostBtn, fontSize: 9 }}
                                            >
                                                <Eye size={10} /> Preview
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', fontSize: 9, color: C.dim, lineHeight: 1.5 }}>
                        AI-generated insights are for guidance only. Verify figures against source systems before filing or sharing externally. All monetary values are shown in USD ($).
                    </div>
                </>
            )}

            {activeTab === 'overview' && (
                <div style={{ ...panel, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>Inventory overview</div>
                    <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
                        High-level KPIs for {PERIOD_PILLS.find(p => p.key === activePeriod)?.label}. Switch to Material audit for the full 9-report grid and query engine.
                    </div>
                    <button type="button" onClick={() => setActiveTab('material-audit')} style={{ ...ghostBtn, color: '#C4B5FD', borderColor: 'rgba(155,111,228,.35)', background: 'rgba(155,111,228,.12)' }}>
                        Open material audit <ChevronRight size={12} />
                    </button>
                </div>
            )}

            {activeReport && (
                <ReportModal
                    type={activeReport}
                    data={reportData}
                    onClose={closeReport}
                    loading={loading}
                />
            )}
        </div>
    );
}

function ReportModal({ type, data, onClose, loading }: { type: ReportType; data: any; onClose: () => void; loading: boolean }) {
    const getReportTitle = () => {
        switch (type) {
            case 'valuation': return 'Inventory Valuation Report';
            case 'fifo': return 'FIFO Valuation Report';
            case 'lifo': return 'LIFO Valuation Report';
            case 'avgcost': return 'Average Cost Detail Report';
            case 'movement': return 'Stock Movement Analysis';
            case 'deadstock': return 'Dead Stock Audit';
            case 'supplier': return 'Supplier Accuracy Report';
            case 'loss': return 'Loss & Leakage Analysis';
            case 'forecast': return 'Demand Forecasting Report';
            default: return 'Report';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div style={{ background: C.surface, borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.5)', maxWidth: 960, width: '100%', maxHeight: '90vh', overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ background: `linear-gradient(135deg, ${C.bg} 0%, ${C.surface} 100%)`, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <FileText style={{ color: C.purple }} size={28} />
                        <div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{getReportTitle()}</h2>
                            <p style={{ fontSize: 9, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                                Generated: {new Date().toLocaleString()} · USD ($)
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X style={{ color: C.text }} size={18} />
                    </button>
                </div>

                <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(90vh - 130px)', background: C.bg }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: C.purple, borderTopColor: 'transparent' }} />
                        </div>
                    ) : (
                        <>
                            {type === 'valuation' && <ValuationReport data={data as InventoryValuation} />}
                            {(type === 'fifo' || type === 'lifo' || type === 'avgcost') && data && (
                                <CostMethodReport data={data as CostMethodValuation} />
                            )}
                            {type === 'movement' && <MovementReport data={data as StockMovement[]} />}
                            {type === 'deadstock' && <DeadStockReport data={data as DeadStock[]} />}
                            {type === 'supplier' && <SupplierReport data={data as SupplierAccuracy[]} />}
                            {type === 'loss' && <LossReport data={data as LossLeakage[]} />}
                            {type === 'forecast' && <ForecastReport data={data as ForecastingData[]} />}
                        </>
                    )}
                </div>

                <div style={{ background: C.surface, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.07)' }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        SOLTOL ONE · Inventory Intelligence
                    </p>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{ ...ghostBtn, border: 'none', background: C.purple, color: '#fff', fontWeight: 600 }}
                    >
                        <Download size={14} /> Export PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

function ValuationReport({ data }: { data: InventoryValuation }) {
    const formatCurrency = globalFormatCurrency;
    const card = (label: string, value: string, color: string) => (
        <div style={{ ...panel, padding: '16px 18px', borderColor: `${color}33` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color }}>{value}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                {card('Total Asset Value', formatCurrency(data.totalAssetValue), C.green)}
                {card('Total Units', data.totalUnits.toLocaleString(), C.blue)}
                {card('Avg Unit Cost', formatCurrency(data.averageUnitCost), C.purple)}
            </div>
            {data.isPartial && (
                <div style={{ ...panel, padding: 12, color: C.amber, fontSize: 11 }}>
                    Partial valuation: {data.excludedUnits?.toLocaleString() ?? 'some'} units excluded because no real product cost is set.
                </div>
            )}
            <ReportTable title="Valuation by Category" headers={['Category', 'Value', 'Units', '% of Total']} rows={data.byCategory.map(cat => [cat.category, formatCurrency(cat.value), cat.units.toLocaleString(), `${cat.percentage.toFixed(1)}%`])} />
            <ReportTable title="Valuation by Location" headers={['Location', 'Value', 'Units']} rows={data.byLocation.map(loc => [loc.location, formatCurrency(loc.value), loc.units.toLocaleString()])} />
        </div>
    );
}

function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
    return (
        <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>{title}</h3>
            <div style={{ ...panel, overflow: 'hidden', padding: 0 }}>
                <table className="w-full">
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)' }}>
                            {headers.map(h => (
                                <th key={h} style={{ padding: '10px 14px', textAlign: h === headers[0] ? 'left' : 'right', fontSize: 9, fontWeight: 700, color: C.dim, textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                                {row.map((cell, j) => (
                                    <td key={j} style={{ padding: '10px 14px', textAlign: j === 0 ? 'left' : 'right', fontSize: 12, fontWeight: j === 0 ? 600 : 500, color: C.text }}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MovementReport({ data }: { data: StockMovement[] }) {
    const totals = data.reduce((acc: { openingStock: number; closingStock: number; purchases: number; sales: number; openingValue: number; closingValue: number; partial: boolean }, r) => ({
        openingStock: acc.openingStock + (r.openingStock || 0),
        closingStock: acc.closingStock + (r.closingStock || 0),
        purchases: acc.purchases + (r.purchases || 0),
        sales: acc.sales + (r.sales || 0),
        openingValue: r.openingValue == null ? acc.openingValue : acc.openingValue + r.openingValue,
        closingValue: r.closingValue == null ? acc.closingValue : acc.closingValue + r.closingValue,
        partial: acc.partial || r.openingValue == null || r.closingValue == null,
    }), { openingStock: 0, closingStock: 0, purchases: 0, sales: 0, openingValue: 0, closingValue: 0, partial: false });
    const valueDelta = totals.closingValue - totals.openingValue;
    const deltaPct = totals.openingValue > 0 && !totals.partial ? (valueDelta / totals.openingValue) * 100 : null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div style={{ ...panel, padding: 16, borderColor: 'rgba(79,142,247,.25)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.blue, textTransform: 'uppercase', marginBottom: 4 }}>Opening Value</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{totals.partial ? '—' : globalFormatCurrency(totals.openingValue)}</p>
                </div>
                <div style={{ ...panel, padding: 16, borderColor: 'rgba(34,197,94,.25)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: 'uppercase', marginBottom: 4 }}>Closing Value</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{totals.partial ? '—' : globalFormatCurrency(totals.closingValue)}</p>
                </div>
                <div style={{ ...panel, padding: 16, borderColor: valueDelta >= 0 ? 'rgba(245,158,11,.25)' : 'rgba(239,68,68,.25)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: valueDelta >= 0 ? C.amber : C.red, textTransform: 'uppercase', marginBottom: 4 }}>Net Movement</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>
                        {totals.partial || deltaPct === null ? '—' : `${valueDelta >= 0 ? '+' : ''}${globalFormatCurrency(valueDelta)} (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
                    </p>
                </div>
            </div>
            <div style={{ ...panel, overflow: 'hidden', padding: 0 }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                            {['Product', 'SKU', 'Opening', 'Purchases', 'Sales', 'Closing', 'Velocity', 'Turnover'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Product' || h === 'SKU' ? 'left' : 'right', fontSize: 9, fontWeight: 700, color: C.dim, textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: C.dim }}>No products in inventory yet.</td></tr>
                        ) : data.map((item, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: C.text }}>{item.productName}</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: C.muted, fontSize: 11 }}>{item.sku}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: C.muted }}>{item.openingStock}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: C.green }}>+{item.purchases}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: C.red }}>-{item.sales}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: C.text }}>{item.closingStock}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                    <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(79,142,247,.12)', color: C.blue }}>{item.velocity}</span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: C.text }}>{item.turnoverRate == null ? '—' : `${item.turnoverRate.toFixed(1)}x`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DeadStockReport({ data }: { data: DeadStock[] }) {
    const formatCurrency = globalFormatCurrency;
    return (
        <div className="space-y-6">
            <div style={{ ...panel, padding: 16, background: 'rgba(239,68,68,.08)', borderColor: 'rgba(239,68,68,.2)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <AlertTriangle style={{ color: C.red, flexShrink: 0 }} size={22} />
                    <div>
                        <h3 style={{ fontWeight: 700, color: C.red, fontSize: 12, marginBottom: 4 }}>Critical Alert</h3>
                        <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                            {data.length} products identified as slow-moving or dead stock. Total locked capital: {formatCurrency(data.reduce((sum, d) => sum + d.lockedCapital, 0))}
                        </p>
                    </div>
                </div>
            </div>
            <ReportTable
                title="Dead Stock Detail"
                headers={['Product', 'SKU', 'Stock', 'Days Idle', 'Locked Capital', 'Action']}
                rows={data.map(item => [item.productName, item.sku, String(item.currentStock), String(item.daysSinceLastSale), formatCurrency(item.lockedCapital), item.recommendedAction])}
            />
        </div>
    );
}

function SupplierReport({ data }: { data: SupplierAccuracy[] }) {
    return (
        <ReportTable
            title="Supplier Accuracy"
            headers={['Supplier', 'Orders', 'On Time', 'Late', 'Accuracy', 'Avg Lead Time']}
            rows={data.map(s => [s.supplierName, String(s.totalOrders), String(s.onTimeDeliveries), String(s.lateDeliveries), `${s.accuracyScore.toFixed(1)}%`, `${s.averageLeadTime.toFixed(1)} days`])}
        />
    );
}

function LossReport({ data }: { data: LossLeakage[] }) {
    const formatCurrency = globalFormatCurrency;
    const totalLoss = data.reduce((sum, item) => sum + Math.abs(item.estimatedLoss), 0);
    return (
        <div className="space-y-6">
            <div style={{ ...panel, padding: 16, background: 'rgba(245,158,11,.08)', borderColor: 'rgba(245,158,11,.2)' }}>
                <h3 style={{ fontWeight: 700, color: C.amber, fontSize: 12, marginBottom: 4 }}>Total Estimated Loss</h3>
                <p style={{ fontSize: 24, fontWeight: 700, color: C.amber }}>{formatCurrency(totalLoss)}</p>
            </div>
            <ReportTable
                title="Loss & Leakage Detail"
                headers={['Product', 'SKU', 'Expected', 'Actual', 'Variance', 'Loss Value', 'Leakage %']}
                rows={data.map(item => [item.productName, item.sku, String(item.expectedStock), String(item.actualStock), String(item.variance), formatCurrency(Math.abs(item.estimatedLoss)), `${item.leakageRate.toFixed(1)}%`])}
            />
        </div>
    );
}

function ForecastReport({ data }: { data: ForecastingData[] }) {
    return (
        <ReportTable
            title="Demand Forecast"
            headers={['Product', 'SKU', 'Current Stock', 'Avg Daily Sales', '30-Day', '60-Day', '90-Day', 'Reorder', 'Confidence']}
            rows={data.map(item => [item.productName, item.sku, String(item.currentStock), item.avgDailySales > 0 ? item.avgDailySales.toFixed(1) : '—', fmtOptionalNumber(item.forecast30Days), fmtOptionalNumber(item.forecast60Days), fmtOptionalNumber(item.forecast90Days), fmtOptionalNumber(item.recommendedReorder), item.confidenceLevel == null ? '—' : `${item.confidenceLevel}%`])}
        />
    );
}
