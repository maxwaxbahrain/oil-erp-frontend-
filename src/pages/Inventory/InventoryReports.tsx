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
    calculateFIFOValuation,
    calculateLIFOValuation,
    calculateSupplierAccuracy,
    calculateLossLeakage,
    type SupplierAccuracy,
    type LossLeakage,
    type CostMethodValuation,
} from '../../services/inventoryService';
import {
    getInventoryValuation,
    getInventoryOnHand,
    getAllMovements,
    type InventoryValuationReport,
    type InventoryValuationRow,
    type OnHandRow,
    type MovementRow,
} from '../../services/inventoryLedgerService';
import { getDemandSummary, type DemandSummaryRow } from '../../services/demandService';
import { getGLProfitLoss } from '../../services/glService';
import {
    PERIOD_PRESET_CUSTOM,
    periodPresets,
    type PeriodPresetKey,
} from '../../utils/periodPresets';

/** Phase 2/3: enable when backend data exists for FIFO/LIFO, loss, SQL filter, AI panels. */
const SHOW_LEGACY_ESTIMATE_REPORTS = false;

const SUPPLIER_ON_TIME_DAYS = 7;

const RECEIPT_SOURCE_TYPES = new Set(['grn', 'opening']);
const ISSUE_SOURCE_TYPES = new Set(['invoice']);
const ADJUSTMENT_SOURCE_TYPES = new Set([
    'adjustment',
    'inventory_adjustment',
    'cost_revaluation',
    'sales_return',
    'purchase_return',
    'purchase_return_cancel',
    'bin_transfer',
    'van_closing',
    'invoice_void',
    'purge',
]);

type VelocityLabel = 'Fast' | 'Medium' | 'Slow' | 'Dead';
type OverstockRisk = 'High' | 'Medium' | 'Low';

export type LedgerMovementProductRow = {
    productId: number;
    productName: string;
    sku: string;
    opening: number;
    purchases: number;
    sales: number;
    adjustments: number;
    closing: number;
    openingValue: number;
    closingValue: number;
    velocity: VelocityLabel;
    daysOfCover: number;
    overstockRisk: OverstockRisk;
    turnoverRate: number | null;
    ledgerGap: boolean;
};

type DemandForecastModalRow = DemandSummaryRow & {
    reorderLabel: string;
    confidenceLabel: string;
};

type ProductTableMetrics = {
    velocity: VelocityLabel;
    overstockRisk: OverstockRisk;
    marginPct: number | null;
    daysLeft: number | null;
    onHand: number;
};

type ReportType = 'valuation' | 'fifo' | 'lifo' | 'avgcost' | 'movement' | 'deadstock' | 'supplier' | 'loss' | 'forecast' | null;
type PageTab = 'overview' | 'material-audit' | 'stock-adjustment' | 'forecasting' | 'supplier-accuracy';
type PeriodKey = PeriodPresetKey | typeof PERIOD_PRESET_CUSTOM;
type ValuationMethod = 'Average' | 'FIFO' | 'LIFO';
type QueryMode = 'nl' | 'sql';

type LedgerDeadStockRow = OnHandRow & { daysIdle: number; action: string };

const pageRootStyle: CSSProperties = {
    padding: 12,
    maxWidth: 1280,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingBottom: 40,
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    fontSize: 12,
    color: 'var(--color-redwood-text-main)',
};

const panel: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: 10,
    padding: '10px 12px',
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
    border: '1px solid var(--color-redwood-border)',
    background: 'rgba(255,255,255,.04)',
    color: 'var(--color-redwood-text-muted)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
};

const thStyle: CSSProperties = {
    padding: '8px 10px',
    fontSize: 8.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: 'var(--color-redwood-text-muted)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--color-redwood-border)',
    textAlign: 'left',
};

const thRight: CSSProperties = {
    ...thStyle,
    textAlign: 'right',
};

const tdStyle: CSSProperties = {
    padding: '8px 10px',
    fontSize: 11,
    color: 'var(--color-redwood-text-main)',
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

const tdMonoRight: CSSProperties = {
    ...tdStyle,
    textAlign: 'right',
    fontFamily: 'ui-monospace,monospace',
    fontWeight: 600,
};

const searchInputStyle: CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--color-redwood-border)',
    background: 'var(--color-redwood-row-bg)',
    color: 'var(--color-redwood-text-main)',
    fontSize: 10,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
};

const kpiLabelStyle: CSSProperties = {
    fontSize: 8.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: 'var(--color-redwood-text-muted)',
    marginBottom: 8,
};

const kpiValueStyle: CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    fontFamily: 'ui-monospace,monospace',
};

function velocityBadgeStyle(velocity: VelocityLabel): CSSProperties {
    const base: CSSProperties = {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.3px',
    };
    switch (velocity) {
        case 'Fast':
            return { ...base, background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)' };
        case 'Medium':
            return { ...base, background: 'var(--color-badge-blue-bg)', color: 'var(--color-brand-blue-tint)' };
        case 'Slow':
            return { ...base, background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)' };
        case 'Dead':
            return { ...base, background: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red-tint)' };
    }
}

function overstockBadgeStyle(risk: OverstockRisk): CSSProperties {
    const base: CSSProperties = {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.3px',
    };
    switch (risk) {
        case 'High':
            return { ...base, background: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red-tint)' };
        case 'Medium':
            return { ...base, background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)' };
        case 'Low':
            return { ...base, background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)' };
    }
}

function periodPillStyle(active: boolean): CSSProperties {
    return {
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 600,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: active ? 'rgba(124,58,237,.45)' : 'var(--color-redwood-border)',
        background: active ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.04)',
        color: active ? 'var(--color-redwood-text-main)' : 'var(--color-redwood-text-muted)',
        fontFamily: 'inherit',
    };
}

function chipGhostStyle(selected: boolean): CSSProperties {
    return {
        ...ghostBtn,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 600,
        borderColor: selected ? 'rgba(124,58,237,.45)' : 'var(--color-redwood-border)',
        background: selected ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.04)',
        color: selected ? 'var(--color-redwood-text-main)' : 'var(--color-redwood-text-muted)',
    };
}

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

function getTotalStock(p: Product): number {
    return p.locations?.reduce((a, b) => a + (b.currentStock ?? 0), 0) ?? 0;
}

function periodDayCount(from: string, to: string): number {
    const start = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (86400000)) + 1);
}

function formatRangeDate(iso: string): string {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function deadStockAction(days: number): string {
    if (days >= 180) return 'Write down';
    if (days >= 90) return 'Clear';
    return 'Monitor';
}

function buildCategoryRollup(
    rows: InventoryValuationRow[],
    categoryByProductId: Map<number, string>,
    totalValue: number,
) {
    const map = new Map<string, { value: number; units: number }>();
    for (const row of rows) {
        const cat = categoryByProductId.get(row.product_id) || 'Uncategorised';
        const cur = map.get(cat) || { value: 0, units: 0 };
        cur.value += row.value;
        cur.units += row.on_hand;
        map.set(cat, cur);
    }
    return Array.from(map.entries()).map(([category, data]) => ({
        category,
        value: data.value,
        units: data.units,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
    }));
}

function glDifferenceLabel(difference: number | null): { text: string; ok: boolean } {
    if (difference == null) return { text: 'Ties to GL', ok: true };
    const ok = Math.abs(difference) < 0.005;
    return ok
        ? { text: 'Ties to GL', ok: true }
        : { text: `Difference ${globalFormatCurrency(difference)}`, ok: false };
}

function velocityFromAvgDailySales(avgDailySales: number, salesUnitsInWindow: number): VelocityLabel {
    if (salesUnitsInWindow <= 0) return 'Dead';
    if (avgDailySales >= 5) return 'Fast';
    if (avgDailySales >= 1) return 'Medium';
    return 'Slow';
}

function overstockRiskFromDaysOfCover(daysOfCover: number): OverstockRisk {
    if (!Number.isFinite(daysOfCover) || daysOfCover > 365) return 'High';
    if (daysOfCover >= 180) return 'Medium';
    return 'Low';
}

function formatDaysOfCoverDisplay(daysOfCover: number): string {
    if (!Number.isFinite(daysOfCover)) return '—';
    if (daysOfCover > 9999) return '∞';
    return Math.round(daysOfCover).toLocaleString();
}

function formatForecastUnits(units: number | null | undefined): string {
    if (units == null) return '—';
    return String(Math.round(units));
}

function formatAvgDailySales(avg: number): string {
    if (!(avg > 0)) return '—';
    return (Math.round(avg * 10) / 10).toFixed(1);
}

function productUnitCost(product: Product | undefined, fallback: number): number {
    if (!product) return fallback;
    const cost = product.pricing?.landedCost ?? product.pricing?.purchasePriceExWorks ?? 0;
    return cost > 0 ? cost : fallback;
}

function productMarginPercent(product: Product): number | null {
    const price = product.pricing?.sellingPrice ?? 0;
    const cost = product.pricing?.landedCost ?? product.pricing?.purchasePriceExWorks ?? 0;
    if (price <= 0) return null;
    return ((price - cost) / price) * 100;
}

function wapeConfidence(wape: number | null | undefined): string {
    if (wape == null || Number.isNaN(Number(wape))) return '—';
    const pct = Number(wape) * 100;
    if (pct < 20) return 'High';
    if (pct < 40) return 'Medium';
    return 'Low';
}

function buildLedgerMovementRows(params: {
    movements: MovementRow[];
    onHandRows: OnHandRow[];
    products: Product[];
    dateFrom: string;
    dateTo: string;
    demandByProduct: Map<number, DemandSummaryRow>;
}): LedgerMovementProductRow[] {
    const { movements, onHandRows, products, dateFrom, dateTo, demandByProduct } = params;
    const days = periodDayCount(dateFrom, dateTo);
    const productById = new Map<number, Product>();
    for (const p of products) {
        const pid = Number(p.id);
        if (Number.isFinite(pid)) productById.set(pid, p);
    }
    const onHandByProduct = new Map<number, OnHandRow>();
    for (const row of onHandRows) onHandByProduct.set(row.product_id, row);

    const deltasByProduct = new Map<number, { purchases: number; sales: number; adjustments: number; purchaseValue: number; salesValue: number; adjValue: number }>();
    const ensure = (pid: number) => {
        if (!deltasByProduct.has(pid)) {
            deltasByProduct.set(pid, { purchases: 0, sales: 0, adjustments: 0, purchaseValue: 0, salesValue: 0, adjValue: 0 });
        }
        return deltasByProduct.get(pid)!;
    };

    for (const m of movements) {
        const pid = m.product_id;
        const bucket = ensure(pid);
        const delta = Number(m.quantity_delta) || 0;
        const unitCost = Number(m.unit_cost) || productUnitCost(productById.get(pid), 0);
        const st = m.source_type || '';
        if (delta > 0 && RECEIPT_SOURCE_TYPES.has(st)) {
            bucket.purchases += delta;
            bucket.purchaseValue += delta * unitCost;
        } else if (delta < 0 && ISSUE_SOURCE_TYPES.has(st)) {
            bucket.sales += Math.abs(delta);
            bucket.salesValue += Math.abs(delta) * unitCost;
        } else if (ADJUSTMENT_SOURCE_TYPES.has(st)) {
            bucket.adjustments += delta;
            bucket.adjValue += delta * unitCost;
        }
    }

    const productIds = new Set<number>([
        ...onHandByProduct.keys(),
        ...deltasByProduct.keys(),
    ]);

    const rows: LedgerMovementProductRow[] = [];
    for (const pid of productIds) {
        const onHand = onHandByProduct.get(pid);
        const closing = onHand ? Number(onHand.on_hand) || 0 : 0;
        const cost = onHand ? Number(onHand.cost) || productUnitCost(productById.get(pid), 0) : productUnitCost(productById.get(pid), 0);
        const d = deltasByProduct.get(pid) ?? { purchases: 0, sales: 0, adjustments: 0, purchaseValue: 0, salesValue: 0, adjValue: 0 };
        const net = d.purchases - d.sales + d.adjustments;
        let opening = closing - net;
        let ledgerGap = false;
        if (opening < 0) {
            opening = 0;
            ledgerGap = true;
        }
        const avgStock = (opening + closing) / 2;
        let turnoverRate: number | null = avgStock > 0 ? d.sales / avgStock : null;
        if (turnoverRate != null && days > 0 && days < 365) turnoverRate *= 365 / days;

        const avgDailyFromSales = days > 0 ? d.sales / days : 0;
        let daysOfCover = avgDailyFromSales > 0 ? closing / avgDailyFromSales : Infinity;
        if (d.sales <= 0) {
            const demand = demandByProduct.get(pid);
            const avgDaily = demand?.avg_daily ?? 0;
            daysOfCover = avgDaily > 0 ? closing / avgDaily : Infinity;
        }
        const velocity = velocityFromAvgDailySales(avgDailyFromSales, d.sales);
        const overstockRisk = overstockRiskFromDaysOfCover(daysOfCover);

        const product = productById.get(pid);
        rows.push({
            productId: pid,
            productName: product?.name ?? onHand?.name ?? `Product ${pid}`,
            sku: product?.sku ?? onHand?.sku ?? '',
            opening,
            purchases: d.purchases,
            sales: d.sales,
            adjustments: d.adjustments,
            closing,
            openingValue: opening * cost,
            closingValue: closing * cost,
            velocity,
            daysOfCover,
            overstockRisk,
            turnoverRate,
            ledgerGap,
        });
    }

    return rows.sort((a, b) => b.sales - a.sales);
}

function CostMethodReport({ data }: { data: CostMethodValuation }) {
    const formatCurr = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const accent = data.method === 'FIFO' ? 'var(--color-brand-blue-tint)' : data.method === 'LIFO' ? 'var(--color-brand-blue-tint)' : 'var(--color-brand-amber-tint)';
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Method', value: data.method },
                    { label: 'Total Inventory Value', value: formatCurr(data.totalValue) },
                    { label: 'Total Units', value: data.totalUnits.toLocaleString() },
                ].map((s, i) => (
                    <div key={i} style={{ ...panel, padding: '16px 18px', borderColor: `${accent}33` }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</p>
                        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-redwood-text-main)' }}>{s.value}</p>
                    </div>
                ))}
            </div>
            <div style={{ ...panel, padding: 14, background: 'rgba(255,255,255,.03)' }}>
                <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5 }}>
                    {data.method === 'FIFO' && 'FIFO — First In, First Out: Oldest purchased stock is valued first. Higher profits during inflation.'}
                    {data.method === 'LIFO' && 'LIFO — Last In, First Out: Newest purchased stock is valued first. Lower profits during inflation (tax benefit).'}
                    {data.method === 'Average' && 'Average Cost: Stock is valued at the weighted average purchase price. Simple and most common.'}
                </p>
            </div>
            <div style={{ ...panel, overflow: 'hidden', padding: 0 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Product-wise {data.method} Valuation</p>
                </div>
                <table className="w-full">
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                            {['Product', 'SKU', 'Units', `Unit Cost (${data.method})`, 'Total Value'].map(h => (
                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.filter(it => it.units > 0).map((item, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                                <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{item.name}</td>
                                <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: 'monospace', color: 'var(--color-redwood-text-muted)' }}>{item.sku || '—'}</td>
                                <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'monospace', color: 'var(--color-redwood-text-main)' }}>{item.units}</td>
                                <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'monospace', color: accent }}>{formatCurr(item.unitCost)}</td>
                                <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'monospace', color: 'var(--color-redwood-text-main)' }}>{formatCurr(item.totalValue)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: 'var(--color-redwood-bg-surface)', borderTop: '2px solid rgba(255,255,255,.12)' }}>
                            <td colSpan={2} style={{ padding: '10px 16px', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase' }}>Total</td>
                            <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: 'monospace' }}>{data.totalUnits}</td>
                            <td style={{ padding: '10px 16px', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Avg: {formatCurr(data.unitCost)}</td>
                            <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--color-brand-amber-tint)', fontFamily: 'monospace' }}>{formatCurr(data.totalValue)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

export default function InventoryReports() {
    const navigate = useNavigate();
    const defaultYtd = periodPresets().find(p => p.key === 'ytd') ?? periodPresets()[1];
    const [loading, setLoading] = useState(true);
    const [activeReport, setActiveReport] = useState<ReportType>(null);
    const [reportData, setReportData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<PageTab>('material-audit');
    const [period, setPeriod] = useState<PeriodKey>('ytd');
    const [dateFrom, setDateFrom] = useState(defaultYtd.from);
    const [dateTo, setDateTo] = useState(defaultYtd.to);
    const [ledgerValuation, setLedgerValuation] = useState<InventoryValuationReport | null>(null);
    const [valuationError, setValuationError] = useState<string | null>(null);
    const [onHandRows, setOnHandRows] = useState<OnHandRow[]>([]);
    const [ledgerMovements, setLedgerMovements] = useState<MovementRow[]>([]);
    const [demandSummary, setDemandSummary] = useState<DemandSummaryRow[]>([]);
    const [demandHorizonDays, setDemandHorizonDays] = useState(30);
    const [turnoverRatio, setTurnoverRatio] = useState<number | null>(null);
    const [turnoverSubline, setTurnoverSubline] = useState('No movement history');
    const [categoryByProductId, setCategoryByProductId] = useState<Map<number, string>>(new Map());
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

    const applyPeriod = (key: PeriodKey) => {
        setPeriod(key);
        if (key === PERIOD_PRESET_CUSTOM) return;
        const preset = periodPresets().find(p => p.key === key);
        if (preset) {
            setDateFrom(preset.from);
            setDateTo(preset.to);
        }
    };

    const loadLedgerMetrics = async () => {
        setLoading(true);
        setValuationError(null);
        try {
            const windowDays = Math.min(365, Math.max(7, periodDayCount(dateFrom, dateTo)));
            const horizon = 30;
            const [valuation, onHand, pl, valuationStart, movements, demand] = await Promise.all([
                getInventoryValuation({ as_of: dateTo }),
                getInventoryOnHand({ limit: 1000 }),
                getGLProfitLoss(dateFrom, dateTo),
                dateFrom !== dateTo
                    ? getInventoryValuation({ as_of: dateFrom })
                    : Promise.resolve(null as InventoryValuationReport | null),
                getAllMovements({ date_from: dateFrom, date_to: dateTo }),
                getDemandSummary({ windowDays, horizon, asOf: dateTo }),
            ]);
            setLedgerValuation(valuation);
            setOnHandRows(onHand.rows ?? []);
            setLedgerMovements(movements);
            setDemandSummary(demand);
            setDemandHorizonDays(horizon);

            const cogs = Number(pl.cogs) || 0;
            const endStock = valuation.totals.value;
            const startStock = valuationStart?.totals.value ?? endStock;
            const avgStock = (startStock + endStock) / 2;
            let ratio = avgStock > 0 ? cogs / avgStock : null;
            const days = periodDayCount(dateFrom, dateTo);
            let annualNote = '';
            if (ratio != null && days > 0 && days < 365) {
                ratio *= 365 / days;
                annualNote = ` (annualised × ${(365 / days).toFixed(2)})`;
            }
            setTurnoverRatio(ratio);
            setTurnoverSubline(
                ratio == null
                    ? 'No movement history'
                    : `COGS ${globalFormatCurrency(cogs)} ÷ avg stock ${globalFormatCurrency(avgStock)}${annualNote}`,
            );
        } catch (error) {
            console.error('Failed to load ledger metrics:', error);
            setLedgerValuation(null);
            setOnHandRows([]);
            setLedgerMovements([]);
            setDemandSummary([]);
            setTurnoverRatio(null);
            setTurnoverSubline('No movement history');
            setValuationError(error instanceof Error ? error.message : 'Failed to load inventory valuation');
        } finally {
            setLoading(false);
        }
    };

    const loadQueryProducts = async () => {
        try {
            const products = await getProducts();
            setQueryProducts(products);
            const catMap = new Map<number, string>();
            for (const p of products) {
                const pid = Number(p.id);
                if (Number.isFinite(pid)) {
                    catMap.set(pid, p.category || p.categoryName || 'Uncategorised');
                }
            }
            setCategoryByProductId(catMap);
        } catch (error) {
            console.error('Failed to load products for query engine:', error);
        }
    };

    useEffect(() => {
        void loadQueryProducts();
    }, []);

    useEffect(() => {
        void loadLedgerMetrics();
    }, [dateFrom, dateTo]);

    const runReport = async (type: ReportType) => {
        setActiveReport(type);
        setLoading(true);

        try {
            let data;
            switch (type) {
                case 'valuation':
                case 'avgcost':
                    data = await getInventoryValuation({ as_of: dateTo });
                    break;
                case 'movement': {
                    const demandMap = new Map(demandSummary.map(d => [d.product_id, d]));
                    data = {
                        rows: buildLedgerMovementRows({
                            movements: ledgerMovements,
                            onHandRows,
                            products: queryProducts,
                            dateFrom,
                            dateTo,
                            demandByProduct: demandMap,
                        }),
                        dateFrom,
                        dateTo,
                    };
                    break;
                }
                case 'deadstock': {
                    const onHand = await getInventoryOnHand({ limit: 1000 });
                    data = (onHand.rows ?? [])
                        .filter(r => (r.days_since_movement ?? 0) >= 90)
                        .map((r): LedgerDeadStockRow => ({
                            ...r,
                            daysIdle: r.days_since_movement ?? 0,
                            action: deadStockAction(r.days_since_movement ?? 0),
                        }));
                    break;
                }
                case 'supplier':
                    data = await calculateSupplierAccuracy();
                    break;
                case 'loss':
                    data = await calculateLossLeakage();
                    break;
                case 'forecast': {
                    const windowDays = Math.min(365, Math.max(7, periodDayCount(dateFrom, dateTo)));
                    const demand = await getDemandSummary({ windowDays, horizon: demandHorizonDays, asOf: dateTo });
                    const productById = new Map<number, Product>();
                    for (const p of queryProducts) {
                        const pid = Number(p.id);
                        if (Number.isFinite(pid)) productById.set(pid, p);
                    }
                    data = {
                        horizon: demandHorizonDays,
                        rows: demand.map((row): DemandForecastModalRow => {
                            const product = productById.get(row.product_id);
                            const reorderLevel = product?.reorderLevel ?? 0;
                            const projected = (row.on_hand_units ?? 0) - (row.forecast_units ?? 0);
                            const reorderLabel = reorderLevel > 0 && projected < reorderLevel ? 'Reorder now' : 'OK';
                            return {
                                ...row,
                                reorderLabel,
                                confidenceLabel: wapeConfidence(row.accuracy_wape),
                            };
                        }),
                    };
                    break;
                }
                case 'fifo':
                    data = await calculateFIFOValuation();
                    break;
                case 'lifo':
                    data = await calculateLIFOValuation();
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
            navigate('/inventory/adjustments');
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
        void loadLedgerMetrics();
        void runReport('valuation');
    };

    const lockedCapitalDead = useMemo(
        () => onHandRows
            .filter(r => (r.days_since_movement ?? 0) >= 90)
            .reduce((sum, r) => sum + (r.value_at_cost || 0), 0),
        [onHandRows],
    );

    const rangeLabel = `${formatRangeDate(dateFrom)} → ${formatRangeDate(dateTo)}`;
    const valuationGlSub = ledgerValuation
        ? glDifferenceLabel(ledgerValuation.difference)
        : { text: '', ok: true };

    const demandByProductId = useMemo(
        () => new Map(demandSummary.map(d => [d.product_id, d])),
        [demandSummary],
    );

    const movementAnalysisRows = useMemo(
        () => buildLedgerMovementRows({
            movements: ledgerMovements,
            onHandRows,
            products: queryProducts,
            dateFrom,
            dateTo,
            demandByProduct: demandByProductId,
        }),
        [ledgerMovements, onHandRows, queryProducts, dateFrom, dateTo, demandByProductId],
    );

    const productMetricsMap = useMemo(() => {
        const map = new Map<string, ProductTableMetrics>();
        const movementById = new Map(movementAnalysisRows.map(r => [r.productId, r]));
        const onHandMap = new Map(onHandRows.map(r => [r.product_id, r]));
        for (const p of queryProducts) {
            const pid = Number(p.id);
            const oh = onHandMap.get(pid);
            const onHand = oh?.on_hand ?? getTotalStock(p);
            const movement = movementById.get(pid);
            const demand = demandByProductId.get(pid);
            const windowSales = movement?.sales ?? 0;
            const days = periodDayCount(dateFrom, dateTo);
            const avgDailyFromSales = days > 0 ? windowSales / days : 0;
            let daysOfCover = avgDailyFromSales > 0 ? onHand / avgDailyFromSales : Infinity;
            if (windowSales <= 0) {
                const avgDailyDemand = demand?.avg_daily ?? 0;
                daysOfCover = avgDailyDemand > 0 ? onHand / avgDailyDemand : Infinity;
            }
            const velocity: VelocityLabel = movement?.velocity
                ?? velocityFromAvgDailySales(avgDailyFromSales, windowSales);
            const overstockRisk: OverstockRisk = movement?.overstockRisk
                ?? overstockRiskFromDaysOfCover(daysOfCover);
            const avgDaily = demand?.avg_daily ?? 0;
            map.set(p.id, {
                velocity,
                overstockRisk,
                marginPct: productMarginPercent(p),
                daysLeft: avgDaily > 0 ? Math.round(onHand / avgDaily) : null,
                onHand,
            });
        }
        return map;
    }, [queryProducts, movementAnalysisRows, onHandRows, demandByProductId, dateFrom, dateTo]);

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
        if (activeChip === 'Fast movers') rows = rows.filter(p => productMetricsMap.get(p.id)?.velocity === 'Fast');
        else if (activeChip === 'Dead stock') rows = rows.filter(p => productMetricsMap.get(p.id)?.velocity === 'Dead');
        else if (activeChip === 'High margin') rows = rows.filter(p => (productMetricsMap.get(p.id)?.marginPct ?? 0) >= 30);
        else if (activeChip === 'Low turnover') rows = rows.filter(p => {
            const v = productMetricsMap.get(p.id)?.velocity;
            return v === 'Slow' || v === 'Dead';
        });
        else if (activeChip === 'Overstock risk') rows = rows.filter(p => {
            const risk = productMetricsMap.get(p.id)?.overstockRisk;
            return risk === 'High' || risk === 'Medium';
        });
        else if (activeChip === 'Reorder needed') rows = rows.filter(p => {
            const m = productMetricsMap.get(p.id);
            return p.reorderLevel > 0 && (m?.onHand ?? 0) <= p.reorderLevel;
        });
        return rows.slice(0, 12);
    }, [queryProducts, queryText, activeChip, productMetricsMap]);

    const reports = [
        { id: 'valuation' as ReportType, title: 'Inventory valuation', description: 'Financial audit using weighted average cost method.', icon: DollarSign, iconColor: 'var(--color-brand-green-tint)', iconBg: 'rgba(34,197,94,.12)' },
        { id: 'fifo' as ReportType, title: 'FIFO valuation', description: 'First In First Out — oldest purchase costs used first.', icon: Layers, iconColor: 'var(--color-brand-blue-tint)', iconBg: 'rgba(79,142,247,.12)' },
        { id: 'lifo' as ReportType, title: 'LIFO valuation', description: 'Last In First Out — newest purchase costs used first.', icon: Layers, iconColor: 'var(--color-brand-blue-tint)', iconBg: 'rgba(124,58,237,.12)' },
        { id: 'movement' as ReportType, title: 'Stock movement', description: 'Current stock with received and sold quantities where available.', icon: Activity, iconColor: 'var(--color-brand-blue-tint)', iconBg: 'rgba(79,142,247,.12)' },
        { id: 'deadstock' as ReportType, title: 'Dead stock audit', description: 'Identifying capital locked in non-moving SKUs.', icon: Package, iconColor: 'var(--color-brand-red-tint)', iconBg: 'rgba(239,68,68,.12)' },
        { id: 'supplier' as ReportType, title: 'Supplier accuracy', description: 'Lead time and quality performance audit.', icon: TrendingUp, iconColor: 'var(--color-brand-amber-tint)', iconBg: 'rgba(245,158,11,.12)' },
        { id: 'loss' as ReportType, title: 'Loss & leakage', description: 'Tracking field sales discrepancies and damages.', icon: BarChart3, iconColor: 'var(--color-brand-red-tint)', iconBg: 'rgba(239,68,68,.12)' },
        { id: 'avgcost' as ReportType, title: 'Average cost detail', description: 'Weighted average cost valuation per product.', icon: DollarSign, iconColor: 'var(--color-brand-amber-tint)', iconBg: 'rgba(245,158,11,.12)' },
        { id: 'forecast' as ReportType, title: 'Demand forecasting', description: 'Demand engine forecast per product — same engine as Reports › Demand Forecast.', icon: PieChart, iconColor: 'var(--color-brand-blue-tint)', iconBg: 'rgba(124,58,237,.12)' },
    ];

    const visibleReports = reports.filter(r => {
        if (!SHOW_LEGACY_ESTIMATE_REPORTS && (r.id === 'fifo' || r.id === 'lifo' || r.id === 'loss')) {
            return false;
        }
        return true;
    });

    const pillBtn = (active: boolean, activeStyle?: { border: string; bg: string; color: string }) => ({
        padding: '4px 11px',
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 600,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: active ? (activeStyle?.border ?? 'rgba(79,142,247,.45)') : 'rgba(255,255,255,.08)',
        background: active ? (activeStyle?.bg ?? 'rgba(79,142,247,.15)') : 'rgba(255,255,255,.04)',
        color: active ? (activeStyle?.color ?? 'var(--color-brand-blue-tint)') : 'var(--color-redwood-text-muted)',
        fontFamily: 'inherit',
    } as CSSProperties);

    const showMaterialAudit = activeTab === 'material-audit';

    return (
        <div style={pageRootStyle}>
            {/* Header */}
            <div style={{ ...panel, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(79,142,247,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BarChart3 size={20} style={{ color: 'var(--color-brand-blue-tint)' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>
                                Material audit & reporting
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', marginTop: 3, lineHeight: 1.45 }}>
                                Inventory valuation · movement · dead stock · supplier accuracy · forecasting · USD ($)
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={exportAllPdfs} style={ghostBtn}>
                            <Download size={13} /> Export all PDFs
                        </button>
                        <button type="button" onClick={generateGlobalAudit} style={ghostBtn}>
                            <Sparkles size={13} /> Generate global audit
                        </button>
                    </div>
                </div>
            </div>

            {/* Period pills + Tabs */}
            <div style={{ ...panel, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {periodPresets().map(p => (
                            <button
                                key={p.key}
                                type="button"
                                onClick={() => applyPeriod(p.key)}
                                style={periodPillStyle(period === p.key)}
                            >
                                {p.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => applyPeriod(PERIOD_PRESET_CUSTOM)}
                            style={periodPillStyle(period === PERIOD_PRESET_CUSTOM)}
                        >
                            Custom
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {period === PERIOD_PRESET_CUSTOM && (
                            <>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'var(--color-redwood-text-main)', fontSize: 9, fontFamily: 'inherit' }}
                                />
                                <span style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)' }}>→</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'var(--color-redwood-text-main)', fontSize: 9, fontFamily: 'inherit' }}
                                />
                            </>
                        )}
                        <span style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)' }}>{rangeLabel}</span>
                    </div>
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
                                color: activeTab === tab.id ? 'var(--color-redwood-text-main)' : 'var(--color-redwood-text-muted)',
                                fontFamily: 'inherit',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 10 }}>
                {[
                    {
                        label: 'Total Asset Valuation',
                        value: loading ? '…' : valuationError ? '—' : ledgerValuation ? globalFormatCurrency(ledgerValuation.totals.value) : '—',
                        sub: valuationError
                            ? valuationError
                            : ledgerValuation
                                ? `${ledgerValuation.totals.units.toLocaleString()} units · GL 1200 ${globalFormatCurrency(ledgerValuation.gl_inventory)} · ${valuationGlSub.text}`
                                : '—',
                        subColor: valuationError ? 'var(--color-brand-red-tint)' : valuationGlSub.ok ? 'var(--color-redwood-text-muted)' : 'var(--color-brand-red-tint)',
                        valueColor: valuationError ? 'var(--color-redwood-text-muted)' : 'var(--color-brand-green-tint)',
                    },
                    {
                        label: 'Avg Inventory Turnover',
                        value: loading ? '…' : (turnoverRatio == null ? '—' : `${turnoverRatio.toFixed(2)}x`),
                        sub: turnoverSubline,
                        subColor: 'var(--color-redwood-text-muted)',
                        valueColor: 'var(--color-brand-blue-tint)',
                    },
                    {
                        label: 'Stock Record Accuracy',
                        value: loading ? '…' : '—',
                        sub: 'Needs cycle counts',
                        subColor: 'var(--color-redwood-text-muted)',
                        valueColor: 'var(--color-redwood-text-main)',
                    },
                    {
                        label: 'Locked Capital',
                        value: loading ? '…' : valuationError ? '—' : globalFormatCurrency(lockedCapitalDead),
                        sub: 'In slow / dead stocks',
                        subColor: 'var(--color-brand-red-tint)',
                        valueColor: 'var(--color-brand-red-tint)',
                    },
                ].map(kpi => (
                    <div key={kpi.label} style={{ ...panel, padding: '14px 16px' }}>
                        <div style={kpiLabelStyle}>{kpi.label}</div>
                        <div style={{ ...kpiValueStyle, color: kpi.valueColor }}>{kpi.value}</div>
                        <div style={{ fontSize: 8.5, fontWeight: 600, color: kpi.subColor, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {showMaterialAudit && (
                <>
                    {SHOW_LEGACY_ESTIMATE_REPORTS && (
                    <div style={{ ...panel, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Valuation method</div>
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
                                        color: valuationMethod === method ? 'var(--color-brand-amber-tint)' : 'var(--color-redwood-text-muted)',
                                    })}
                                >
                                    {method === 'Average' ? 'Average cost' : method}
                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Inventory Audit Reports */}
                    <div style={{ ...panel, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Sparkles size={15} style={{ color: 'var(--color-redwood-text-main)' }} />
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>Inventory Audit Reports</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                            {visibleReports.map(report => (
                                <div
                                    key={report.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => void runReport(report.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            void runReport(report.id);
                                        }
                                    }}
                                    style={{
                                        ...panel,
                                        padding: '14px 14px 12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        minHeight: 180,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 8, background: report.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <report.icon size={17} style={{ color: report.iconColor }} />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 4 }}>{report.title}</div>
                                        <div style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', lineHeight: 1.45 }}>{report.description}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 10 }}>
                                        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Run on demand</span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void runReport(report.id);
                                            }}
                                            style={{ ...ghostBtn, padding: '5px 10px', fontSize: 9 }}
                                        >
                                            Run report <ArrowRight size={11} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Universal Material Filter */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Search size={16} style={{ color: 'var(--color-brand-blue-tint)' }} />
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>Material Filter</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                            <input
                                type="text"
                                value={queryText}
                                onChange={e => setQueryText(e.target.value)}
                                placeholder={queryMode === 'nl' ? 'Filter products… e.g. fast movers with margin above 30%' : "SQL-style filter text… e.g. velocity='Fast' AND margin > 30"}
                                style={{ ...searchInputStyle, flex: 1, minWidth: 220, fontFamily: queryMode === 'sql' ? 'monospace' : 'inherit' }}
                            />
                            {SHOW_LEGACY_ESTIMATE_REPORTS && (
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button type="button" onClick={() => setQueryMode('nl')} style={pillBtn(queryMode === 'nl')}>Text filter</button>
                                <button type="button" onClick={() => setQueryMode('sql')} style={pillBtn(queryMode === 'sql')}>SQL</button>
                            </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                            {QUERY_CHIPS.map(chip => (
                                <button
                                    key={chip}
                                    type="button"
                                    onClick={() => setActiveChip(activeChip === chip ? null : chip)}
                                    style={chipGhostStyle(activeChip === chip)}
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.07)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                        {['Product', 'Stock', 'Velocity', 'Overstock', 'Margin', 'Days Left'].map(h => (
                                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredQueryRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: 24, textAlign: 'center', fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>No products match your query.</td>
                                        </tr>
                                    ) : (
                                        filteredQueryRows.map(p => {
                                            const m = productMetricsMap.get(p.id);
                                            const velocity = m?.velocity ?? 'Dead';
                                            const overstock = m?.overstockRisk ?? 'Low';
                                            return (
                                            <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                                                <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{p.name}</td>
                                                <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', color: 'var(--color-redwood-text-muted)' }}>{m?.onHand ?? getTotalStock(p)}</td>
                                                <td style={{ padding: '8px 12px' }}>
                                                    <span style={velocityBadgeStyle(velocity)}>{velocity}</span>
                                                </td>
                                                <td style={{ padding: '8px 12px' }}>
                                                    <span style={overstockBadgeStyle(overstock)}>{overstock}</span>
                                                </td>
                                                <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', color: (m?.marginPct ?? 0) > 0 ? 'var(--color-brand-green-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {m?.marginPct != null ? `${m.marginPct.toFixed(1)}%` : '—'}
                                                </td>
                                                <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', color: (m?.daysLeft ?? 0) > 0 ? 'var(--color-redwood-text-main)' : 'var(--color-redwood-text-muted)' }}>
                                                    {m?.daysLeft != null && m.daysLeft > 0 ? m.daysLeft : '—'}
                                                </td>
                                            </tr>
                                        ); })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {SHOW_LEGACY_ESTIMATE_REPORTS && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                        <div style={{ ...panel, padding: '14px 16px', background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.12)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Brain size={15} style={{ color: 'var(--color-brand-red-tint)' }} />
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Material Audit Insights</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {AI_INSIGHTS.length === 0 ? (
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>No insights</div>
                                ) : AI_INSIGHTS.map((insight, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: insight.color, marginTop: 4, flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 2 }}>{insight.title}</div>
                                            <div style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', lineHeight: 1.45 }}>{insight.body}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ ...panel, padding: '14px 16px', background: 'rgba(155,111,228,.05)', border: '1px solid rgba(155,111,228,.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Bot size={15} style={{ color: 'var(--color-redwood-text-main)' }} />
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Suggested Actions</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {AI_ACTIONS.length === 0 ? (
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>No actions</div>
                                ) : AI_ACTIONS.map((action, i) => (
                                    <div key={i} style={{ ...panel, padding: '10px 12px', background: 'rgba(11,17,32,.5)' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: action.color, marginTop: 5, flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{action.title}</div>
                                                <div style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', marginTop: 2, lineHeight: 1.4 }}>{action.detail}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                type="button"
                                                onClick={() => void runReport(action.report)}
                                                style={{ ...ghostBtn, fontSize: 9, color: 'var(--color-redwood-text-main)', borderColor: 'rgba(155,111,228,.35)', background: 'rgba(155,111,228,.12)' }}
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
                    )}

                    <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', fontSize: 9, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5 }}>
                        Valuation and dead-stock figures use the warehouse ledger (GL 1200 tie-out). Verify before filing or sharing externally. USD ($).
                    </div>
                </>
            )}

            {activeTab === 'overview' && (
                <div style={{ ...panel, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>Inventory overview</div>
                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                        High-level KPIs for {periodPresets().find(p => p.key === period)?.label ?? 'Custom'} ({rangeLabel}). Switch to Material audit for the report grid and query engine.
                    </div>
                    <button type="button" onClick={() => setActiveTab('material-audit')} style={{ ...ghostBtn, color: 'var(--color-redwood-text-main)', borderColor: 'rgba(155,111,228,.35)', background: 'rgba(155,111,228,.12)' }}>
                        Open material audit <ChevronRight size={12} />
                    </button>
                </div>
            )}

            {activeTab === 'forecasting' && (
                <div style={{ ...panel, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <PieChart size={16} style={{ color: 'var(--color-brand-blue-tint)' }} />
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Demand forecasting</div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                        30/60/90-day demand projections and reorder recommendations from live inventory calculations. Opens in the report viewer when you run it.
                    </div>
                    <button
                        type="button"
                        onClick={() => void runReport('forecast')}
                        style={{ ...ghostBtn, color: 'var(--color-redwood-text-main)', borderColor: 'rgba(155,111,228,.35)', background: 'rgba(155,111,228,.12)' }}
                    >
                        Run forecasting report <ArrowRight size={12} />
                    </button>
                </div>
            )}

            {activeTab === 'supplier-accuracy' && (
                <div style={{ ...panel, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <TrendingUp size={16} style={{ color: 'var(--color-brand-amber-tint)' }} />
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Supplier accuracy</div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                        Lead-time, on-time delivery, and quality performance audit across suppliers. Opens in the report viewer when you run it.
                    </div>
                    <button
                        type="button"
                        onClick={() => void runReport('supplier')}
                        style={{ ...ghostBtn, color: 'var(--color-redwood-text-main)', borderColor: 'rgba(155,111,228,.35)', background: 'rgba(155,111,228,.12)' }}
                    >
                        Run supplier accuracy report <ArrowRight size={12} />
                    </button>
                </div>
            )}

            {activeReport && (
                <ReportModal
                    type={activeReport}
                    data={reportData}
                    onClose={closeReport}
                    loading={loading}
                    categoryByProductId={categoryByProductId}
                />
            )}
        </div>
    );
}

function ReportModal({
    type,
    data,
    onClose,
    loading,
    categoryByProductId,
}: {
    type: ReportType;
    data: any;
    onClose: () => void;
    loading: boolean;
    categoryByProductId: Map<number, string>;
}) {
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
        <div
            className="z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)' }}
        >
            <div style={{ background: 'var(--color-redwood-bg-surface)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.35)', maxWidth: 960, width: '100%', maxHeight: '90vh', overflow: 'hidden', border: '1px solid var(--color-redwood-border)' }}>
                <div style={{ background: 'var(--color-redwood-bg-surface)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-redwood-border)', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <FileText style={{ color: 'var(--color-brand-blue-tint)' }} size={28} />
                        <div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-redwood-text-main)' }}>{getReportTitle()}</h2>
                            <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                                Generated: {new Date().toLocaleString()} · USD ($)
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X style={{ color: 'var(--color-redwood-text-main)' }} size={18} />
                    </button>
                </div>

                <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(90vh - 130px)', background: 'var(--color-redwood-bg-surface)' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: 'var(--color-brand-blue-tint)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : (
                        <>
                            {type === 'valuation' && data && (
                                <LedgerValuationReport data={data as InventoryValuationReport} categoryByProductId={categoryByProductId} />
                            )}
                            {(type === 'fifo' || type === 'lifo') && data && (
                                <CostMethodReport data={data as CostMethodValuation} />
                            )}
                            {type === 'avgcost' && data && (
                                <LedgerAvgCostReport data={data as InventoryValuationReport} />
                            )}
                            {type === 'movement' && data && (
                                <LedgerMovementReport
                                    rows={(data as { rows: LedgerMovementProductRow[] }).rows}
                                    dateFrom={(data as { dateFrom: string }).dateFrom}
                                    dateTo={(data as { dateTo: string }).dateTo}
                                />
                            )}
                            {type === 'deadstock' && <LedgerDeadStockReport data={data as LedgerDeadStockRow[]} />}
                            {type === 'supplier' && <SupplierReport data={data as SupplierAccuracy[]} />}
                            {type === 'loss' && <LossReport data={data as LossLeakage[]} />}
                            {type === 'forecast' && data && (
                                <DemandEngineReport
                                    horizon={(data as { horizon: number }).horizon}
                                    rows={(data as { rows: DemandForecastModalRow[] }).rows}
                                />
                            )}
                        </>
                    )}
                </div>

                <div style={{ background: 'var(--color-redwood-bg-surface)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.07)' }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        SOLTOL ONE · Inventory Intelligence
                    </p>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{ ...ghostBtn, marginLeft: 'auto' }}
                    >
                        <Download size={14} /> Export PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

function LedgerValuationReport({
    data,
    categoryByProductId,
}: {
    data: InventoryValuationReport;
    categoryByProductId: Map<number, string>;
}) {
    const formatCurrency = globalFormatCurrency;
    const avgUnitCost = data.totals.units > 0 ? data.totals.value / data.totals.units : 0;
    const byCategory = buildCategoryRollup(data.rows, categoryByProductId, data.totals.value);
    const glLine = glDifferenceLabel(data.difference);

    const card = (label: string, value: string, color: string) => (
        <div style={{ ...panel, padding: '16px 18px', borderColor: `${color}33` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color }}>{value}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                {card('Total Asset Value', formatCurrency(data.totals.value), 'var(--color-brand-green-tint)')}
                {card('Total Units', data.totals.units.toLocaleString(), 'var(--color-brand-blue-tint)')}
                {card('Avg Unit Cost', formatCurrency(avgUnitCost), 'var(--color-brand-blue-tint)')}
            </div>
            <div style={{ ...panel, padding: 12, fontSize: 11, color: glLine.ok ? 'var(--color-brand-green-tint)' : 'var(--color-brand-red-tint)' }}>
                GL 1200 {formatCurrency(data.gl_inventory)} · {glLine.text}
            </div>
            <ReportTable
                title="Product valuation"
                headers={['Product', 'SKU', 'Units', 'Unit cost', 'Value']}
                rows={data.rows.map(row => [
                    row.name,
                    row.sku || '—',
                    row.on_hand.toLocaleString(),
                    formatCurrency(row.cost),
                    formatCurrency(row.value),
                ])}
            />
            <ReportTable
                title="Valuation by Category"
                headers={['Category', 'Value', 'Units', '% of Total']}
                rows={byCategory.map(cat => [cat.category, formatCurrency(cat.value), cat.units.toLocaleString(), `${cat.percentage.toFixed(1)}%`])}
            />
        </div>
    );
}

function LedgerAvgCostReport({ data }: { data: InventoryValuationReport }) {
    const formatCurrency = globalFormatCurrency;
    return (
        <div className="space-y-6">
            <div style={{ ...panel, padding: 14, background: 'rgba(255,255,255,.03)' }}>
                <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5 }}>
                    Ledger on-hand × product cost (as of {data.as_of || 'today'}). Cost method per SKU from the catalog.
                </p>
            </div>
            <ReportTable
                title="Average cost detail"
                headers={['Product', 'SKU', 'On hand', 'Cost', 'Value', 'Method']}
                rows={data.rows.map(row => [
                    row.name,
                    row.sku || '—',
                    row.on_hand.toLocaleString(),
                    formatCurrency(row.cost),
                    formatCurrency(row.value),
                    row.cost_method || 'average',
                ])}
            />
        </div>
    );
}

function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
    return (
        <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-redwood-text-main)', marginBottom: 10 }}>{title}</h3>
            <div style={{ ...panel, overflow: 'hidden', padding: 0 }}>
                <table className="w-full">
                    <thead>
                        <tr>
                            {headers.map((h, idx) => (
                                <th key={h} style={idx === 0 ? thStyle : thRight}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i}>
                                {row.map((cell, j) => (
                                    <td key={j} style={j === 0 ? { ...tdStyle, fontWeight: 600 } : tdMonoRight}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function LedgerMovementReport({ rows, dateFrom, dateTo }: { rows: LedgerMovementProductRow[]; dateFrom: string; dateTo: string }) {
    const totals = rows.reduce(
        (acc, r) => ({
            openingValue: acc.openingValue + r.openingValue,
            closingValue: acc.closingValue + r.closingValue,
        }),
        { openingValue: 0, closingValue: 0 },
    );
    const valueDelta = totals.closingValue - totals.openingValue;
    const deltaPct = totals.openingValue > 0 ? (valueDelta / totals.openingValue) * 100 : null;
    const windowLabel = `${formatRangeDate(dateFrom)} → ${formatRangeDate(dateTo)}`;

    return (
        <div className="space-y-6">
            <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Window: {windowLabel}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div style={{ ...panel, padding: 16, borderColor: 'rgba(79,142,247,.25)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-brand-blue-tint)', textTransform: 'uppercase', marginBottom: 4 }}>Opening Value</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: 'monospace' }}>{globalFormatCurrency(totals.openingValue)}</p>
                </div>
                <div style={{ ...panel, padding: 16, borderColor: 'rgba(34,197,94,.25)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-brand-green-tint)', textTransform: 'uppercase', marginBottom: 4 }}>Closing Value</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: 'monospace' }}>{globalFormatCurrency(totals.closingValue)}</p>
                </div>
                <div style={{ ...panel, padding: 16, borderColor: valueDelta >= 0 ? 'rgba(245,158,11,.25)' : 'rgba(239,68,68,.25)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: valueDelta >= 0 ? 'var(--color-brand-amber-tint)' : 'var(--color-brand-red-tint)', textTransform: 'uppercase', marginBottom: 4 }}>Net Movement</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: 'monospace' }}>
                        {`${valueDelta >= 0 ? '+' : ''}${globalFormatCurrency(valueDelta)}${deltaPct == null ? ' (n/a %)' : ` (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}`}
                    </p>
                </div>
            </div>
            <div style={{ ...panel, overflow: 'hidden', padding: 0 }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                            {['Product', 'SKU', 'Opening', 'Purchases', 'Sales', 'Adjustments', 'Closing', 'Velocity', 'Days of cover', 'Turnover'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Product' || h === 'SKU' ? 'left' : 'right', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: 'var(--color-redwood-text-muted)' }}>No ledger movement in this window.</td></tr>
                        ) : rows.map((item, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                                    {item.productName}
                                    {item.ledgerGap && <span style={{ marginLeft: 6, fontSize: 8, color: 'var(--color-brand-amber-tint)' }}>ledger gap</span>}
                                </td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--color-redwood-text-muted)', fontSize: 11 }}>{item.sku}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-redwood-text-muted)' }}>{item.opening}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-brand-green-tint)' }}>+{item.purchases}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-brand-red-tint)' }}>-{item.sales}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-redwood-text-muted)' }}>{item.adjustments >= 0 ? `+${item.adjustments}` : item.adjustments}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-redwood-text-main)' }}>{item.closing}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                    <span style={velocityBadgeStyle(item.velocity)}>{item.velocity}</span>
                                </td>
                                <td style={{ ...tdMonoRight, padding: '8px 12px' }}>{formatDaysOfCoverDisplay(item.daysOfCover)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-redwood-text-main)' }}>{item.turnoverRate == null ? '—' : `${item.turnoverRate.toFixed(1)}x`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function LedgerDeadStockReport({ data }: { data: LedgerDeadStockRow[] }) {
    const formatCurrency = globalFormatCurrency;
    const locked = data.reduce((sum, d) => sum + (d.value_at_cost || 0), 0);
    return (
        <div className="space-y-6">
            <div style={{ ...panel, padding: 16, background: 'rgba(239,68,68,.08)', borderColor: 'rgba(239,68,68,.2)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <AlertTriangle style={{ color: 'var(--color-brand-red-tint)', flexShrink: 0 }} size={22} />
                    <div>
                        <h3 style={{ fontWeight: 700, color: 'var(--color-brand-red-tint)', fontSize: 12, marginBottom: 4 }}>Critical Alert</h3>
                        <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5 }}>
                            {data.length} products with no ledger movement in 90+ days. Total locked capital: {formatCurrency(locked)}
                        </p>
                    </div>
                </div>
            </div>
            <ReportTable
                title="Dead Stock Detail"
                headers={['Product', 'SKU', 'Stock', 'Days idle', 'Locked capital', 'Action']}
                rows={data.map(item => [
                    item.name,
                    item.sku || '—',
                    String(item.on_hand),
                    String(item.daysIdle),
                    formatCurrency(item.value_at_cost),
                    item.action,
                ])}
            />
        </div>
    );
}

function SupplierReport({ data }: { data: SupplierAccuracy[] }) {
    return (
        <div className="space-y-4">
            <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }} title="Based on PO expected date, not GRN receipt date">
                On time = received within {SUPPLIER_ON_TIME_DAYS} days (PO order date → expected date). Expected lead time column uses PO expected date.
            </p>
            <ReportTable
                title="Supplier Accuracy"
                headers={['Supplier', 'Orders', 'On Time', 'Late', 'Accuracy', 'Expected lead time']}
                rows={data.map(s => [s.supplierName, String(s.totalOrders), String(s.onTimeDeliveries), String(s.lateDeliveries), `${s.accuracyScore.toFixed(1)}%`, `${s.averageLeadTime.toFixed(1)} days`])}
            />
        </div>
    );
}

function LossReport({ data }: { data: LossLeakage[] }) {
    const formatCurrency = globalFormatCurrency;
    const totalLoss = data.reduce((sum, item) => sum + Math.abs(item.estimatedLoss), 0);
    return (
        <div className="space-y-6">
            <div style={{ ...panel, padding: 16, background: 'rgba(245,158,11,.08)', borderColor: 'rgba(245,158,11,.2)' }}>
                <h3 style={{ fontWeight: 700, color: 'var(--color-brand-amber-tint)', fontSize: 12, marginBottom: 4 }}>Total Estimated Loss</h3>
                <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-brand-amber-tint)' }}>{formatCurrency(totalLoss)}</p>
            </div>
            <ReportTable
                title="Loss & Leakage Detail"
                headers={['Product', 'SKU', 'Expected', 'Actual', 'Variance', 'Loss Value', 'Leakage %']}
                rows={data.map(item => [item.productName, item.sku, String(item.expectedStock), String(item.actualStock), String(item.variance), formatCurrency(Math.abs(item.estimatedLoss)), `${item.leakageRate.toFixed(1)}%`])}
            />
        </div>
    );
}

function DemandEngineReport({ rows, horizon }: { rows: DemandForecastModalRow[]; horizon: number }) {
    return (
        <ReportTable
            title="Demand Forecast"
            headers={['Product', 'SKU', 'Current stock', 'Avg daily sales', `Forecast (${horizon} days)`, 'Method', 'Accuracy', 'Reorder', 'Confidence']}
            rows={rows.map(item => [
                item.name,
                item.sku || '—',
                String(item.on_hand_units ?? '—'),
                formatAvgDailySales(item.avg_daily),
                formatForecastUnits(item.forecast_units),
                String(item.method || '—'),
                item.accuracy_wape == null ? '—' : `${Math.round(Number(item.accuracy_wape) * 100)}%`,
                item.reorderLabel,
                item.confidenceLabel,
            ])}
        />
    );
}
