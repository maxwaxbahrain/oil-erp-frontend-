import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Zap, Check, RefreshCw } from 'lucide-react';
import { getProducts } from '../../services/api';
import { getSuppliers, createPurchaseOrder } from '../../services/purchasesService';
import { formatCurrency } from '../../services/settingsService';

interface LowStockProduct {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    minimumStock: number;
    unitPrice: number;
    suggestedQty: number;
    estimatedCost: number;
    urgency: 'critical' | 'warning';
    daysUntilStockout: number;
}

interface GeneratedPO {
    id: string;
    poNumber: string;
    supplierId: string;
    supplierName: string;
    date: string;
    items: Array<{ productId: string; name: string; quantity: number; rate: number; amount: number }>;
    grandTotal: number;
    status: 'Draft';
    createdByAI: boolean;
}

const AUTO_PO_LOG_KEY = 'ai_auto_po_log';

const getLog = (): GeneratedPO[] => {
    try { return JSON.parse(localStorage.getItem(AUTO_PO_LOG_KEY) || '[]'); } catch { return []; }
};

export default function AutoPOGeneration() {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [leadDays, setLeadDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [log, setLog] = useState<GeneratedPO[]>([]);
    const [success, setSuccess] = useState('');
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        Promise.all([getProducts(), getSuppliers()]).then(([prods, sups]) => {
setSuppliers(sups);
            setLog(getLog());

            // Find low stock products
            const low: LowStockProduct[] = prods
                .filter((p: any) => {
                    const stock = p.current_stock || 0;
                    const min = p.minimum_stock || 10;
                    return stock <= min * 1.2; // Within 20% of minimum
                })
                .map((p: any): LowStockProduct => {
                    const stock = p.current_stock || 0;
                    const min = p.minimum_stock || 10;
                    // Suggest 2 months supply
                    const suggestedQty = Math.max(min * 3, min - stock + min * 2);
                    return {
                        id: String(p.id),
                        name: p.name,
                        sku: p.sku,
                        currentStock: stock,
                        minimumStock: min,
                        unitPrice: p.unit_price || 0,
                        suggestedQty: Math.ceil(suggestedQty),
                        estimatedCost: Math.ceil(suggestedQty) * (p.unit_price || 0),
                        urgency: stock <= 0 ? 'critical' : stock < min ? 'critical' : 'warning',
                        daysUntilStockout: stock > 0 ? Math.floor(stock / Math.max(1, min / 30)) : 0
                    };
                })
                .sort((a: LowStockProduct, b: LowStockProduct) => a.currentStock - b.currentStock);

            setLowStock(low);

            // Auto-select all critical items
            const criticalIds = new Set(low.filter(p => p.urgency === 'critical').map(p => p.id));
            setSelected(criticalIds);

            // Auto-select first supplier
            if (sups.length > 0) setSelectedSupplier(String(sups[0].id));
            setLoading(false);
        });
    }, []);

    const selectedItems = lowStock.filter(p => selected.has(p.id));
    const totalCost = selectedItems.reduce((s, p) => s + p.estimatedCost, 0);

    const toggleProduct = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const getAIAnalysis = async () => {
        if (lowStock.length === 0) return;
        setAiLoading(true);
        const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are Marcus, an expert supply chain advisor for a NYC oil distribution company.
Be concise. Max 120 words. Use CAPS for headings. No markdown symbols.
Today: ${new Date().toISOString().slice(0, 10)}`,
                    max_tokens: 400,
                    messages: [{
                        role: 'user',
                        content: `My low stock situation:
${lowStock.map(p => `${p.name}: ${p.currentStock} units left (min: ${p.minimumStock}), ${p.daysUntilStockout} days until stockout`).join('\n')}

Lead time from supplier: ${leadDays} days.
Give me:
1. Which to order MOST URGENTLY and why
2. Any market/pricing factors I should know about now
3. One action to take today`
                    }]
                })
            });
            const data = await res.json();
            setAiAnalysis(data.reply || '');
        } catch {
            setAiAnalysis('Could not reach AI. Check your connection.');
        } finally {
            setAiLoading(false);
        }
    };

    const generatePO = async () => {
        if (selectedItems.length === 0) { alert('Select at least one product.'); return; }
        if (!selectedSupplier) { alert('Select a supplier.'); return; }
        setGenerating(true);

        const supplier = suppliers.find(s => String(s.id) === selectedSupplier);
        const poNumber = `APO-${Date.now().toString().slice(-6)}`;
        const po: GeneratedPO = {
            id: Date.now().toString(),
            poNumber,
            supplierId: selectedSupplier,
            supplierName: supplier?.name || 'Unknown Supplier',
            date: new Date().toISOString().slice(0, 10),
            items: selectedItems.map(p => ({
                productId: String(p.id),
                name: p.name,
                quantity: p.suggestedQty,
                rate: p.unitPrice,
                amount: p.estimatedCost
            })),
            grandTotal: totalCost,
            status: 'Draft',
            createdByAI: true
        };

        // Save to purchase orders via service
        try {
            await createPurchaseOrder({
                poNumber: po.poNumber,
                supplierId: po.supplierId,
                supplierName: po.supplierName,
                date: po.date,
                items: po.items.map(i => ({
                    productId: i.productId,
                    productName: i.name,
                    uom: 'units',
                    quantity: i.quantity,
                    unitPrice: i.rate,
                    taxRate: 0,
                    discount: 0,
                    total: i.amount
                })),
                subtotal: po.grandTotal,
                taxTotal: 0,
                grandTotal: po.grandTotal,
                status: 'Pending',
                notes: `Auto-generated by AI — Lead time: ${leadDays} days.`,
                expectedDate: new Date(Date.now() + leadDays * 86400000).toISOString().slice(0,10),
            });
        } catch (e) {
            console.warn('PO save to service failed, saved to local log only:', e);
        }

        const existing = getLog();
        localStorage.setItem(AUTO_PO_LOG_KEY, JSON.stringify([po, ...existing]));
        setLog([po, ...existing]);
        setGenerating(false);
        setSuccess(`✅ PO ${poNumber} created for ${formatCurrency(totalCost)} — ${selectedItems.length} products`);
        setTimeout(() => setSuccess(''), 6000);
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">

            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate('/ai')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> AI Hub
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <ShoppingCart size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Auto PO Generation</h1>
                            <p className="text-gray-400 text-xs mt-0.5">AI detects low stock → creates purchase order automatically</p>
                        </div>
                    </div>
                    <button onClick={getAIAnalysis} disabled={aiLoading || lowStock.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-black transition-all disabled:opacity-50">
                        {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                        Ask Marcus
                    </button>
                </div>
            </div>

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                    <Check size={20} className="text-emerald-600" />
                    <div>
                        <p className="text-sm font-black text-emerald-700">{success}</p>
                        <button onClick={() => navigate('/purchases')} className="text-xs text-emerald-600 underline mt-0.5">View in Purchase Orders →</button>
                    </div>
                </div>
            )}

            {/* AI Analysis */}
            {aiAnalysis && (
                <div className="bg-gray-900 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-orange-400" />
                        <p className="text-sm font-black text-orange-400 uppercase tracking-widest">Marcus — AI Analysis</p>
                    </div>
                    <div className="text-sm text-gray-300 leading-relaxed space-y-1">
                        {aiAnalysis.split('\n').map((line, i) => {
                            const t = line.trim();
                            if (!t) return <div key={i} className="h-1" />;
                            if (t === t.toUpperCase() && t.length > 4)
                                return <p key={i} className="font-black text-orange-400 text-xs uppercase tracking-widest mt-3 mb-1">{t}</p>;
                            if (/^[0-9]+\./.test(t))
                                return <p key={i} className="font-bold text-white mt-1">{t}</p>;
                            return <p key={i} className="text-gray-300">{t}</p>;
                        })}
                    </div>
                </div>
            )}

            {/* Settings */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">PO Settings</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Supplier for PO</label>
                        <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
                            <option value="">Select supplier...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Supplier Lead Time (days)</label>
                        <input type="number" value={leadDays} onChange={e => setLeadDays(parseInt(e.target.value) || 7)}
                            min={1} max={90}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                        <p className="text-xs text-gray-400 mt-1">Orders arrive in {leadDays} days — used to calculate urgency</p>
                    </div>
                </div>
            </div>

            {/* Low Stock Products */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <p className="text-sm font-black text-gray-900">Low Stock Products</p>
                        <p className="text-xs text-gray-400 mt-0.5">{lowStock.length} products need reordering · Select to include in PO</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelected(new Set(lowStock.map(p => p.id)))}
                            className="text-xs font-black text-emerald-600 hover:text-emerald-800">Select All</button>
                        <button onClick={() => setSelected(new Set())}
                            className="text-xs font-black text-gray-400 hover:text-gray-600">Clear</button>
                        {selectedItems.length > 0 && (
                            <button onClick={generatePO} disabled={generating || !selectedSupplier}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 disabled:opacity-50 transition-all">
                                {generating ? <RefreshCw size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                                Generate PO — {formatCurrency(totalCost)}
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-400 font-bold">Analyzing stock levels...</div>
                ) : lowStock.length === 0 ? (
                    <div className="p-12 text-center">
                        <Check size={48} className="mx-auto text-emerald-200 mb-3" />
                        <p className="text-gray-400 font-bold">All products are well stocked</p>
                        <p className="text-gray-300 text-sm mt-1">No reordering needed right now</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 w-10"></th>
                                    {['Product', 'Current Stock', 'Minimum', 'Days Left', 'Order Qty', 'Est. Cost', 'Status'].map(h => (
                                        <th key={h} className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {lowStock.map(p => (
                                    <tr key={p.id}
                                        onClick={() => toggleProduct(p.id)}
                                        className={`cursor-pointer transition-all ${selected.has(p.id) ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                                        <td className="px-5 py-4">
                                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleProduct(p.id)}
                                                onClick={e => e.stopPropagation()} className="rounded accent-emerald-600" />
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="text-sm font-black text-gray-900">{p.name}</p>
                                            <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-lg font-black font-mono ${p.currentStock === 0 ? 'text-red-600' : p.urgency === 'critical' ? 'text-orange-600' : 'text-amber-600'}`}>
                                                {p.currentStock}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-1">units</span>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-mono text-gray-500">{p.minimumStock}</td>
                                        <td className="px-4 py-4">
                                            {p.daysUntilStockout === 0 ? (
                                                <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-full">OUT OF STOCK</span>
                                            ) : (
                                                <span className={`text-sm font-black font-mono ${p.daysUntilStockout <= leadDays ? 'text-red-600' : 'text-amber-600'}`}>
                                                    {p.daysUntilStockout} days
                                                    {p.daysUntilStockout <= leadDays && <span className="text-[10px] ml-1 text-red-500">⚠️ Less than lead time!</span>}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-sm font-black text-emerald-700">{p.suggestedQty} units</span>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-black font-mono text-gray-900">{formatCurrency(p.estimatedCost)}</td>
                                        <td className="px-4 py-4">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${p.urgency === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {p.urgency === 'critical' ? '🔴 Critical' : '🟡 Warning'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {selectedItems.length > 0 && (
                                <tfoot>
                                    <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                                        <td colSpan={6} className="px-5 py-3 text-sm font-black text-emerald-700">
                                            {selectedItems.length} product{selectedItems.length !== 1 ? 's' : ''} selected
                                        </td>
                                        <td className="px-4 py-3 text-sm font-black font-mono text-emerald-700">{formatCurrency(totalCost)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </div>

            {/* PO History */}
            {log.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <p className="text-sm font-black text-gray-700">AI-Generated PO History</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {log.slice(0, 10).map(po => (
                            <div key={po.id} className="px-5 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                        <Zap size={14} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900">{po.poNumber}</p>
                                        <p className="text-xs text-gray-400">{po.supplierName} · {po.date} · {po.items.length} items</p>
                                    </div>
                                </div>
                                <span className="text-sm font-black font-mono text-gray-900">{formatCurrency(po.grandTotal)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <p className="text-xs text-gray-400 text-center">
                AI calculates order quantities based on minimum stock × 3 · Factor in lead time to avoid stockouts
            </p>
        </div>
    );
}
