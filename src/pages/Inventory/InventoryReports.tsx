import { useState, useEffect } from 'react';
import { formatCurrency as globalFormatCurrency } from '../../services/settingsService';
import {
    BarChart3,
    Download,
    Filter,
    Calendar,
    ArrowRight,
    TrendingUp,
    PieChart,
    Activity,
    DollarSign,
    Package,
    ArrowUpRight,
    Search,
    ChevronDown,
    X,
    FileText,
    AlertTriangle
} from 'lucide-react';
import clsx from 'clsx';
import {
    getInventoryMetrics,
    calculateInventoryValuation,
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
    type InventoryMetrics
} from '../../services/inventoryService';

type ReportType = 'valuation' | 'movement' | 'deadstock' | 'supplier' | 'loss' | 'forecast' | null;

export default function InventoryReports() {
    const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeReport, setActiveReport] = useState<ReportType>(null);
    const [reportData, setReportData] = useState<any>(null);

    useEffect(() => {
        loadMetrics();
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

    const formatCurrency = (value: number) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}k`;
        }
        return `$${value.toFixed(2)}`;
    };

    const reports = [
        {
            id: 'valuation',
            title: 'Inventory Valuation',
            description: 'Financial audit of all material assets globally.',
            icon: DollarSign,
            color: 'text-emerald-500'
        },
        {
            id: 'movement',
            title: 'Stock Movement',
            description: 'Real-time velocity and node transfer analysis.',
            icon: Activity,
            color: 'text-blue-500'
        },
        {
            id: 'deadstock',
            title: 'Dead Stock Audit',
            description: 'Identifying capital locked in non-moving SKUs.',
            icon: Package,
            color: 'text-red-500'
        },
        {
            id: 'supplier',
            title: 'Supplier Accuracy',
            description: 'Lead time and quality performance audit.',
            icon: TrendingUp,
            color: 'text-amber-500'
        },
        {
            id: 'loss',
            title: 'Loss & Leakage',
            description: 'Tracking field sales discrepancies and damages.',
            icon: BarChart3,
            color: 'text-redwood-brand'
        },
        {
            id: 'forecast',
            title: 'Forecasting Run',
            description: '30/60/90 day demand predicted by AI.',
            icon: PieChart,
            color: 'text-pink-500'
        },
    ];

    return (
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase flex items-center gap-3">
                        <BarChart3 className="text-redwood-brand" size={32} />
                        Inventory Intelligence Hub
                    </h1>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Enterprise Material Audit & Reporting</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-5 py-3 bg-gray-50 border border-gray-100 text-gray-600 text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 hover:bg-gray-100 transition-all">
                        <Calendar size={18} /> Jan 2024 <ChevronDown size={14} />
                    </button>
                    <button
                        onClick={loadMetrics}
                        className="px-8 py-4 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-200"
                    >
                        <Download size={20} /> Generate Global Audit
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm group">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Total Asset Valuation</span>
                    <p className="text-3xl font-black text-gray-900 tracking-tighter">
                        {loading ? '...' : formatCurrency(metrics?.totalAssetValuation || 0)}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-2 uppercase flex items-center gap-1">
                        <ArrowUpRight size={12} /> +{metrics?.growthRate.toFixed(1)}% Growth
                    </p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Avg Turnover</span>
                    <p className="text-3xl font-black text-gray-900 tracking-tighter">
                        {loading ? '...' : (metrics?.avgTurnover || 0).toFixed(1)}x
                    </p>
                    <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-widest">Global Weighted Average</p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Stock Accuracy</span>
                    <p className="text-3xl font-black text-gray-900 tracking-tighter">
                        {loading ? '...' : (metrics?.stockAccuracy || 0).toFixed(1)}%
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-2 uppercase tracking-widest">Post-Audit Resilience</p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-redwood-brand">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Locked Capital</span>
                    <p className="text-3xl font-black text-redwood-brand tracking-tighter">
                        {loading ? '...' : formatCurrency(metrics?.lockedCapital || 0)}
                    </p>
                    <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-widest">In Slow/Dead Stocks</p>
                </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {reports.map((report, i) => (
                    <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl hover:border-redwood-brand/20 transition-all group cursor-pointer relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 translate-x-8 -translate-y-8 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-700">
                            <report.icon size={120} />
                        </div>

                        <div className="flex items-center gap-5 mb-8 relative">
                            <div className={clsx("w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 group-hover:bg-redwood-brand group-hover:text-white transition-all duration-500 shadow-inner", report.color)}>
                                <report.icon size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">{report.title}</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Automated Intelligence</p>
                            </div>
                        </div>

                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.05em] leading-relaxed mb-10 relative">
                            {report.description}
                        </p>

                        <div className="flex items-center justify-between pt-6 border-t border-gray-50 relative">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Last Run: 2h ago</span>
                            <button
                                onClick={() => runReport(report.id as ReportType)}
                                className="flex items-center gap-2 text-[10px] font-black text-redwood-brand uppercase tracking-widest hover:translate-x-1 transition-transform"
                            >
                                Run Report <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Custom Query Builder (Oracle Style) */}
            <div className="bg-gray-900 p-12 rounded-3xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 transform translate-x-12 -translate-y-12 opacity-5">
                    <Filter size={280} className="text-redwood-brand" />
                </div>
                <div className="relative">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
                        <Search size={28} className="text-redwood-brand shadow-2xl shadow-redwood-brand/20" />
                        Universal Material Query Engine
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Global Filter String</label>
                            <input type="text" placeholder="e.g. status='active' AND velocity='fast' AND margin > 30%" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-sm outline-none focus:border-redwood-brand transition-all" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Sort Metric</label>
                            <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white font-black uppercase text-[10px] tracking-widest outline-none appearance-none">
                                <option>Revenue Contribution</option>
                                <option>Stock Age</option>
                                <option>Margin Efficiency</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button className="w-full py-4 bg-redwood-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 shadow-lg shadow-redwood-brand/20 transition-all">Execute Query</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Modal */}
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

// Report Modal Component
function ReportModal({ type, data, onClose, loading }: { type: ReportType; data: any; onClose: () => void; loading: boolean }) {
    const getReportTitle = () => {
        switch (type) {
            case 'valuation': return 'Inventory Valuation Report';
            case 'movement': return 'Stock Movement Analysis';
            case 'deadstock': return 'Dead Stock Audit';
            case 'supplier': return 'Supplier Accuracy Report';
            case 'loss': return 'Loss & Leakage Analysis';
            case 'forecast': return 'Demand Forecasting Report';
            default: return 'Report';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <FileText className="text-redwood-brand" size={32} />
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">{getReportTitle()}</h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                Generated: {new Date().toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
                    >
                        <X className="text-white" size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-redwood-brand border-t-transparent"></div>
                        </div>
                    ) : (
                        <>
                            {type === 'valuation' && <ValuationReport data={data as InventoryValuation} />}
                            {type === 'movement' && <MovementReport data={data as StockMovement[]} />}
                            {type === 'deadstock' && <DeadStockReport data={data as DeadStock[]} />}
                            {type === 'supplier' && <SupplierReport data={data as SupplierAccuracy[]} />}
                            {type === 'loss' && <LossReport data={data as LossLeakage[]} />}
                            {type === 'forecast' && <ForecastReport data={data as ForecastingData[]} />}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-6 flex items-center justify-between border-t border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        SOLTOL ONE • Inventory Intelligence
                    </p>
                    <button className="px-6 py-3 bg-redwood-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 transition-all flex items-center gap-2">
                        <Download size={16} /> Export PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

// Individual Report Components
function ValuationReport({ data }: { data: InventoryValuation }) {
    const formatCurrency = globalFormatCurrency;

    return (
        <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-6">
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Total Asset Value</p>
                    <p className="text-2xl font-black text-emerald-900">{formatCurrency(data.totalAssetValue)}</p>
                </div>
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Total Units</p>
                    <p className="text-2xl font-black text-blue-900">{data.totalUnits.toLocaleString()}</p>
                </div>
                <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">Avg Unit Cost</p>
                    <p className="text-2xl font-black text-purple-900">{formatCurrency(data.averageUnitCost)}</p>
                </div>
            </div>

            {/* By Category */}
            <div>
                <h3 className="text-lg font-black text-gray-900 uppercase mb-4">Valuation by Category</h3>
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Category</th>
                                <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Value</th>
                                <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Units</th>
                                <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">% of Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.byCategory.map((cat, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                    <td className="p-4 font-bold text-gray-900">{cat.category}</td>
                                    <td className="p-4 text-right font-bold text-gray-900">{formatCurrency(cat.value)}</td>
                                    <td className="p-4 text-right font-bold text-gray-600">{cat.units.toLocaleString()}</td>
                                    <td className="p-4 text-right font-bold text-emerald-600">{cat.percentage.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* By Location */}
            <div>
                <h3 className="text-lg font-black text-gray-900 uppercase mb-4">Valuation by Location</h3>
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Location</th>
                                <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Value</th>
                                <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Units</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.byLocation.map((loc, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                    <td className="p-4 font-bold text-gray-900">{loc.location}</td>
                                    <td className="p-4 text-right font-bold text-gray-900">{formatCurrency(loc.value)}</td>
                                    <td className="p-4 text-right font-bold text-gray-600">{loc.units.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function MovementReport({ data }: { data: StockMovement[] }) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Product</th>
                        <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">SKU</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Opening</th>
                                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Inward</th>
                                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Outward</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Purchases</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Sales</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Closing</th>
                        <th className="text-center p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Velocity</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Turnover</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="p-4 font-bold text-gray-900">{item.productName}</td>
                            <td className="p-4 font-mono text-sm text-gray-600">{item.sku}</td>
                            <td className="p-4 text-right font-bold text-gray-600">{item.openingStock}</td>
                                            <td className="p-4 text-right font-bold text-emerald-600">{(item as any).inwardQty || (item as any).received || 0}</td>
                                            <td className="p-4 text-right font-bold text-red-500">{(item as any).outwardQty || (item as any).sold || 0}</td>
                            <td className="p-4 text-right font-bold text-emerald-600">+{item.purchases}</td>
                            <td className="p-4 text-right font-bold text-red-600">-{item.sales}</td>
                            <td className="p-4 text-right font-bold text-gray-900">{item.closingStock}</td>
                            <td className="p-4 text-center">
                                <span className={clsx(
                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                    item.velocity === 'Fast' && "bg-emerald-100 text-emerald-700",
                                    item.velocity === 'Medium' && "bg-blue-100 text-blue-700",
                                    item.velocity === 'Slow' && "bg-amber-100 text-amber-700",
                                    item.velocity === 'Dead' && "bg-red-100 text-red-700"
                                )}>
                                    {item.velocity}
                                </span>
                            </td>
                            <td className="p-4 text-right font-bold text-gray-900">{item.turnoverRate.toFixed(1)}x</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DeadStockReport({ data }: { data: DeadStock[] }) {
    const formatCurrency = globalFormatCurrency;

    return (
        <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
                <AlertTriangle className="text-red-600 flex-shrink-0" size={24} />
                <div>
                    <h3 className="font-black text-red-900 uppercase text-sm mb-2">Critical Alert</h3>
                    <p className="text-sm text-red-700">
                        {data.length} products identified as slow-moving or dead stock.
                        Total locked capital: {formatCurrency(data.reduce((sum, d) => sum + d.lockedCapital, 0))}
                    </p>
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Product</th>
                            <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">SKU</th>
                            <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Stock</th>
                            <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Days Idle</th>
                            <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Locked Capital</th>
                            <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, i) => (
                            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="p-4 font-bold text-gray-900">{item.productName}</td>
                                <td className="p-4 font-mono text-sm text-gray-600">{item.sku}</td>
                                <td className="p-4 text-right font-bold text-gray-900">{item.currentStock}</td>
                                <td className="p-4 text-right font-bold text-red-600">{item.daysSinceLastSale}</td>
                                <td className="p-4 text-right font-bold text-red-700">{formatCurrency(item.lockedCapital)}</td>
                                <td className="p-4 text-[10px] font-black text-amber-600 uppercase">{item.recommendedAction}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SupplierReport({ data }: { data: SupplierAccuracy[] }) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Supplier</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Total Orders</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">On Time</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Late</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Accuracy</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Avg Lead Time</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((supplier, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="p-4 font-bold text-gray-900">{supplier.supplierName}</td>
                            <td className="p-4 text-right font-bold text-gray-900">{supplier.totalOrders}</td>
                            <td className="p-4 text-right font-bold text-emerald-600">{supplier.onTimeDeliveries}</td>
                            <td className="p-4 text-right font-bold text-red-600">{supplier.lateDeliveries}</td>
                            <td className="p-4 text-right">
                                <span className={clsx(
                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                    supplier.accuracyScore >= 90 && "bg-emerald-100 text-emerald-700",
                                    supplier.accuracyScore >= 70 && supplier.accuracyScore < 90 && "bg-amber-100 text-amber-700",
                                    supplier.accuracyScore < 70 && "bg-red-100 text-red-700"
                                )}>
                                    {supplier.accuracyScore.toFixed(1)}%
                                </span>
                            </td>
                            <td className="p-4 text-right font-bold text-gray-900">{supplier.averageLeadTime.toFixed(1)} days</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function LossReport({ data }: { data: LossLeakage[] }) {
    const formatCurrency = globalFormatCurrency;
    const totalLoss = data.reduce((sum, item) => sum + Math.abs(item.estimatedLoss), 0);

    return (
        <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <h3 className="font-black text-amber-900 uppercase text-sm mb-2">Total Estimated Loss</h3>
                <p className="text-3xl font-black text-amber-700">{formatCurrency(totalLoss)}</p>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Product</th>
                            <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">SKU</th>
                            <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Expected</th>
                            <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Actual</th>
                            <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Variance</th>
                            <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Loss Value</th>
                            <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Leakage %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, i) => (
                            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="p-4 font-bold text-gray-900">{item.productName}</td>
                                <td className="p-4 font-mono text-sm text-gray-600">{item.sku}</td>
                                <td className="p-4 text-right font-bold text-gray-600">{item.expectedStock}</td>
                                <td className="p-4 text-right font-bold text-gray-900">{item.actualStock}</td>
                                <td className="p-4 text-right font-bold text-red-600">{item.variance}</td>
                                <td className="p-4 text-right font-bold text-red-700">{formatCurrency(Math.abs(item.estimatedLoss))}</td>
                                <td className="p-4 text-right font-bold text-amber-600">{item.leakageRate.toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ForecastReport({ data }: { data: ForecastingData[] }) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Product</th>
                        <th className="text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">SKU</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Current Stock</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Avg Daily Sales</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">30-Day Forecast</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">60-Day Forecast</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">90-Day Forecast</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Reorder Point</th>
                        <th className="text-right p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="p-4 font-bold text-gray-900">{item.productName}</td>
                            <td className="p-4 font-mono text-sm text-gray-600">{item.sku}</td>
                            <td className="p-4 text-right font-bold text-gray-900">{item.currentStock}</td>
                            <td className="p-4 text-right font-bold text-gray-600">{item.avgDailySales.toFixed(1)}</td>
                            <td className="p-4 text-right font-bold text-blue-600">{item.forecast30Days}</td>
                            <td className="p-4 text-right font-bold text-purple-600">{item.forecast60Days}</td>
                            <td className="p-4 text-right font-bold text-pink-600">{item.forecast90Days}</td>
                            <td className="p-4 text-right font-bold text-emerald-600">{item.recommendedReorder}</td>
                            <td className="p-4 text-right">
                                <span className={clsx(
                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                    item.confidenceLevel >= 80 && "bg-emerald-100 text-emerald-700",
                                    item.confidenceLevel >= 60 && item.confidenceLevel < 80 && "bg-amber-100 text-amber-700",
                                    item.confidenceLevel < 60 && "bg-red-100 text-red-700"
                                )}>
                                    {item.confidenceLevel}%
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
