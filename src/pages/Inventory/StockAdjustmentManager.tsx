import { useState, useEffect } from 'react';
import {
    Brain,
    Zap,
    AlertTriangle,
    CheckCircle2,
    TrendingUp,
    RefreshCw,
    ShieldAlert,
    Clock,
    ArrowRight,
    X,
    Check,
    BarChart3,
    Package,
    Filter,
    ClipboardList
} from 'lucide-react';
import { aiStockService, type AIStockAdjustment, type AIInsight } from '../../services/aiStockService';
import { getProducts, type Product } from '../../services/productService';

type DecisionLogItem = {
    id: string;
    adjustmentId: string;
    action: 'approved' | 'rejected' | 'manual';
    productName: string;
    quantityChange: number;
    timestamp: string;
    note: string;
};

const DECISION_LOG_KEY = 'zavi_stock_adjustment_decision_log';

export default function StockAdjustmentManager() {
    const [adjustments, setAdjustments] = useState<AIStockAdjustment[]>([]);
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'auto' | 'approval_required' | 'investigation_required'>('all');
    const [decisionLog, setDecisionLog] = useState<DecisionLogItem[]>([]);
    const [manualProductId, setManualProductId] = useState('');
    const [manualDelta, setManualDelta] = useState<number>(0);
    const [manualNote, setManualNote] = useState('');
    const [manualFeedback, setManualFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        loadData();
        try {
            const stored = localStorage.getItem(DECISION_LOG_KEY);
            if (stored) setDecisionLog(JSON.parse(stored));
        } catch {
            setDecisionLog([]);
        }
    }, []);

    useEffect(() => {
        // Keep auto-log and approvals live while tab is open.
        const timer = setInterval(() => {
            void loadData();
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [adjs, ins, prods] = await Promise.all([
                aiStockService.scanForAnomalies(),
                aiStockService.getInsights(),
                getProducts()
            ]);
            setAdjustments(adjs);
            setInsights(ins);
            setProducts(prods);
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const saveDecision = (entry: DecisionLogItem) => {
        const next = [entry, ...decisionLog].slice(0, 40);
        setDecisionLog(next);
        localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(next));
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setProcessingId(id);
        try {
            if (action === 'approve') {
                await aiStockService.approveAdjustment(id);
                const adjustment = adjustments.find(a => a.id === id);
                if (adjustment) {
                    saveDecision({
                        id: `dec-${Date.now()}`,
                        adjustmentId: adjustment.id,
                        action: 'approved',
                        productName: adjustment.productName,
                        quantityChange: adjustment.suggestedAdjustment,
                        timestamp: new Date().toISOString(),
                        note: 'Approved from Pending Management Approval and applied to stock.'
                    });
                }
            } else {
                await aiStockService.rejectAdjustment(id);
                const adjustment = adjustments.find(a => a.id === id);
                if (adjustment) {
                    saveDecision({
                        id: `dec-${Date.now()}`,
                        adjustmentId: adjustment.id,
                        action: 'rejected',
                        productName: adjustment.productName,
                        quantityChange: adjustment.suggestedAdjustment,
                        timestamp: new Date().toISOString(),
                        note: 'Rejected from Pending Management Approval.'
                    });
                }
            }

            // Remove from list locally for instant feedback
            setAdjustments(prev => prev.filter(a => a.id !== id));
            await loadData();
        } catch (err) {
            alert('Action failed');
        } finally {
            setProcessingId(null);
        }
    };

    const applyManualAdjustment = () => {
        setManualFeedback(null);
        if (!manualProductId) {
            setManualFeedback({ type: 'error', message: 'Select a product for manual adjustment.' });
            return;
        }
        if (!Number.isFinite(manualDelta) || manualDelta === 0) {
            setManualFeedback({ type: 'error', message: 'Enter a valid non-zero quantity change.' });
            return;
        }
        const product = products.find(p => p.id === manualProductId);
        if (!product) {
            setManualFeedback({ type: 'error', message: 'Selected product not found.' });
            return;
        }

        const updatedProducts = products.map((p) => {
            if (p.id !== manualProductId) return p;
            const safeLocations = p.locations && p.locations.length > 0
                ? p.locations
                : [{ id: `LOC-MAIN-${p.id}`, name: 'Main Warehouse', type: 'Warehouse' as const, currentStock: 0 }];
            const updatedLocations = safeLocations.map((loc, index) =>
                index === 0
                    ? { ...loc, currentStock: (Number(loc.currentStock) || 0) + manualDelta }
                    : loc
            );
            return { ...p, locations: updatedLocations };
        });

        localStorage.setItem('zavi_products', JSON.stringify(updatedProducts));
        setProducts(updatedProducts);
        saveDecision({
            id: `dec-${Date.now()}`,
            adjustmentId: `manual-${manualProductId}-${Date.now()}`,
            action: 'manual',
            productName: product.name,
            quantityChange: manualDelta,
            timestamp: new Date().toISOString(),
            note: manualNote.trim() || 'Manual adjustment from Stock Adjustment Manager.'
        });
        setManualDelta(0);
        setManualNote('');
        setManualFeedback({
            type: 'success',
            message: `Manual adjustment applied to ${product.name} (${manualDelta > 0 ? '+' : ''}${manualDelta}).`
        });
    };

    // Calculate statistics
    const autoAdjustedCount = adjustments.filter(a => a.type === 'auto').length;
    const pendingCount = adjustments.filter(a => a.type === 'approval_required').length;
    const criticalCount = adjustments.filter(a => a.type === 'investigation_required').length;
    const avgConfidence = adjustments.length > 0
        ? Math.round(adjustments.reduce((sum, a) => sum + a.confidence, 0) / adjustments.length)
        : 0;

    // Filter adjustments
    const filteredAdjustments = adjustments.filter(adj => {
        const matchesSearch = adj.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            adj.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || adj.type === filterType;
        return matchesSearch && matchesFilter;
    });

    const getReasonIcon = (reason: string) => {
        switch (reason) {
            case 'shrinkage': return <TrendingUp className="text-orange-500" size={18} />;
            case 'damage': return <AlertTriangle className="text-red-500" size={18} />;
            case 'sales_reconciliation': return <RefreshCw className="text-blue-500" size={18} />;
            case 'expiry': return <Clock className="text-amber-500" size={18} />;
            case 'demand_reorder': return <Package className="text-purple-500" size={18} />;
            default: return <Brain className="text-purple-500" size={18} />;
        }
    };

    const getReasonBadgeColor = (reason: string) => {
        switch (reason) {
            case 'shrinkage': return 'bg-orange-100 text-orange-700';
            case 'damage': return 'bg-red-100 text-red-700';
            case 'sales_reconciliation': return 'bg-blue-100 text-blue-700';
            case 'expiry': return 'bg-amber-100 text-amber-700';
            case 'demand_reorder': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 font-bold">Loading AI Stock Control...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1800px] mx-auto space-y-6 pb-20 px-6">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 -mx-6 px-6 py-6 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-purple-600 rounded-lg text-white shadow-md">
                                <Brain size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                                    STOCK ADJUSTMENT MANAGER
                                </h1>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5">
                                    System Controls: Active • Auto-Adjusted (24h)
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={loadData}
                            className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 rounded-lg text-xs font-black uppercase tracking-wider hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Refresh
                        </button>
                        <button
                            onClick={() => {
                                setFilterType('all');
                                setSearchTerm('');
                                void loadData();
                            }}
                            className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-purple-700 transition-all shadow-md flex items-center gap-2"
                        >
                            <Brain size={16} />
                            Stock Control AI
                        </button>
                        <button
                            onClick={applyManualAdjustment}
                            disabled={!manualProductId || manualDelta === 0}
                            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-gray-800 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Manual Adjustment
                        </button>
                    </div>
                </div>

                {/* Search and Filter Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Search products, adjustments, or reasons..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-medium focus:border-purple-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border-2 border-gray-200">
                        <Filter size={16} className="text-gray-500" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none cursor-pointer"
                        >
                            <option value="all">All Types</option>
                            <option value="auto">Auto-Adjusted</option>
                            <option value="approval_required">Pending Approval</option>
                            <option value="investigation_required">Critical Flags</option>
                        </select>
                    </div>
                    <select
                        value={manualProductId}
                        onChange={(e) => setManualProductId(e.target.value)}
                        className="bg-white px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-semibold"
                    >
                        <option value="">Manual Product</option>
                        {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        value={manualDelta}
                        onChange={(e) => {
                            const raw = e.target.value;
                            setManualDelta(raw === '' ? 0 : Number(raw));
                        }}
                        placeholder="Qty +/-"
                        className="bg-white px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-semibold"
                    />
                    <input
                        type="text"
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') applyManualAdjustment();
                        }}
                        placeholder="Manual note"
                        className="bg-white px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-medium"
                    />
                </div>
                {manualFeedback && (
                    <div
                        className={`mt-3 rounded-lg px-4 py-2 text-xs font-bold ${
                            manualFeedback.type === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                    >
                        {manualFeedback.message}
                    </div>
                )}
            </div>

            {/* KPI Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Auto-Adjusted Card */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl border-2 border-emerald-200 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                        <CheckCircle2 size={80} className="text-emerald-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">
                            Auto-Adjusted (24h)
                        </p>
                        <p className="text-5xl font-black text-emerald-700 tracking-tighter mb-2">
                            {autoAdjustedCount}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                            <Zap size={12} fill="currentColor" />
                            <span>Saved 1.5 hours</span>
                        </div>
                    </div>
                </div>

                {/* Pending Approval Card */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border-2 border-amber-200 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                        <Clock size={80} className="text-amber-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-xs font-black text-amber-600 uppercase tracking-widest mb-2">
                            Pending Approval
                        </p>
                        <p className="text-5xl font-black text-amber-700 tracking-tighter mb-2">
                            {pendingCount}
                        </p>
                        <div className="text-xs font-bold text-amber-600">
                            Avg Confidence: {avgConfidence}%
                        </div>
                    </div>
                </div>

                {/* Critical Flags Card */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-2xl border-2 border-red-200 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                        <ShieldAlert size={80} className="text-red-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-2">
                            Critical Flags
                        </p>
                        <p className="text-5xl font-black text-red-700 tracking-tighter mb-2">
                            {criticalCount}
                        </p>
                        <div className="text-xs font-bold text-red-600">
                            Investigation Required
                        </div>
                    </div>
                </div>

                {/* AI Confidence Score Card */}
                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-20">
                        <Brain size={80} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-xs font-black text-purple-200 uppercase tracking-widest mb-2">
                            Confidence Score
                        </p>
                        <p className="text-5xl font-black tracking-tighter mb-2">
                            {avgConfidence}%
                        </p>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-200">
                            <TrendingUp size={12} />
                            <span>+2.4% this week</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Insight Banner */}
            <div className="bg-gray-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-white/10 rounded-lg">
                        <BarChart3 size={22} className="text-blue-400" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
                            AI Insight
                        </h4>
                        <p className="text-sm font-bold">
                            {insights[0]?.message || 'Shrinkage rate decreased 0.3% this month'}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-black text-blue-400">
                        {insights[0]?.metric || '-0.3%'}
                    </span>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Impact</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Auto-Log */}
                <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b-2 border-gray-200 bg-gray-50">
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <Zap size={16} className="text-emerald-500" />
                            Live Auto-Log
                        </h3>
                        <p className="text-xs font-bold text-gray-500 mt-1">Last 24 Hours</p>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                        {filteredAdjustments.filter(a => a.type === 'auto').length === 0 ? (
                            <div className="p-8 text-center">
                                <CheckCircle2 size={40} className="text-gray-300 mx-auto mb-3" />
                                <p className="text-sm font-bold text-gray-400">No auto-adjustments yet</p>
                            </div>
                        ) : (
                            filteredAdjustments.filter(a => a.type === 'auto').map((adj) => (
                                <div key={adj.id} className="p-5 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-900 mb-1">
                                                {adj.productName}
                                            </p>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${getReasonBadgeColor(adj.reason)}`}>
                                                {adj.reason.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                        </div>
                                        <span className={`text-sm font-black px-3 py-1.5 rounded-lg ${adj.suggestedAdjustment < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {adj.suggestedAdjustment > 0 ? '+' : ''}{adj.suggestedAdjustment}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-600 mb-3">{adj.description}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                                            <CheckCircle2 size={12} />
                                            AI Conf: {adj.confidence}%
                                        </span>
                                        <span className="text-xs text-gray-400 font-medium">
                                            {new Date(adj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pending Approvals & Critical Investigations */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Pending Approvals */}
                    {filteredAdjustments.filter(a => a.type === 'approval_required').length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={16} className="text-amber-500" />
                                Pending Management Approval ({filteredAdjustments.filter(a => a.type === 'approval_required').length})
                            </h3>

                            {filteredAdjustments.filter(a => a.type === 'approval_required').map(adj => (
                                <div key={adj.id} className="bg-white p-6 rounded-2xl border-2 border-amber-200 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                                    <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                {getReasonIcon(adj.reason)}
                                                <span className="text-xs font-black text-amber-600 uppercase tracking-wider bg-amber-100 px-3 py-1 rounded-lg">
                                                    Suggestion
                                                </span>
                                            </div>
                                            <h4 className="text-xl font-black text-gray-900 mb-2">
                                                {adj.productName}
                                            </h4>
                                            <p className="text-sm text-gray-700 mb-4 bg-gray-50 p-4 rounded-xl border border-gray-200 font-medium">
                                                "{adj.description}"
                                            </p>
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    Current: <span className="text-gray-900 text-sm">{adj.currentStock}</span>
                                                </div>
                                                <ArrowRight size={16} className="text-gray-300" />
                                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    New: <span className="text-gray-900 text-sm">{adj.currentStock + adj.suggestedAdjustment}</span>
                                                </div>
                                                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full border border-amber-200">
                                                    Adjustment: {adj.suggestedAdjustment > 0 ? '+' : ''}{adj.suggestedAdjustment}
                                                </span>
                                                <span className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1.5 rounded-full border border-purple-200">
                                                    Confidence: {adj.confidence}%
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 w-full lg:w-auto">
                                            <button
                                                onClick={() => handleAction(adj.id, 'reject')}
                                                disabled={processingId === adj.id}
                                                className="flex-1 lg:flex-none px-6 py-3 border-2 border-gray-200 rounded-xl text-xs font-black uppercase text-gray-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                <X size={18} />
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => { if (window.confirm('Delete this adjustment record?')) { setAdjustments(prev => prev.filter(a => a.id !== adj.id)); const stored = JSON.parse(localStorage.getItem('zavi_stock_adjustment_decision_log') || '[]'); localStorage.setItem('zavi_stock_adjustment_decision_log', JSON.stringify(stored.filter((a:any) => a.id !== adj.id))); } }}
                                                className="px-4 py-3 border-2 border-red-200 rounded-xl text-xs font-black uppercase text-red-500 hover:bg-red-50 transition-all flex items-center gap-1"
                                                title="Delete this adjustment"
                                            >
                                                🗑️
                                            </button>
                                            <button
                                                onClick={() => handleAction(adj.id, 'approve')}
                                                disabled={processingId === adj.id}
                                                className="flex-1 lg:flex-none px-8 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-gray-800 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {processingId === adj.id ? (
                                                    <RefreshCw size={18} className="animate-spin" />
                                                ) : (
                                                    <Check size={18} />
                                                )}
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Critical Investigations */}
                    {filteredAdjustments.filter(a => a.type === 'investigation_required').length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
                                <AlertTriangle size={16} />
                                Critical Investigations Required ({filteredAdjustments.filter(a => a.type === 'investigation_required').length})
                            </h3>

                            {filteredAdjustments.filter(a => a.type === 'investigation_required').map(adj => (
                                <div key={adj.id} className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-2xl border-2 border-red-200 relative shadow-md">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <ShieldAlert size={20} className="text-red-600" />
                                                <span className="text-xs font-black text-red-700 uppercase tracking-wider bg-red-200 px-3 py-1 rounded-lg">
                                                    Risk Score: {adj.aiAnalysis?.riskScore || 90}/100
                                                </span>
                                            </div>
                                            <h4 className="text-xl font-black text-red-900 mb-2">
                                                {adj.productName}
                                            </h4>
                                            <p className="text-sm font-medium text-red-800 mb-5 max-w-2xl bg-white/50 p-4 rounded-lg">
                                                {adj.description}
                                            </p>

                                            <div className="flex gap-3 flex-wrap">
                                                <button className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 transition-all shadow-md">
                                                    Trigger Physical Count
                                                </button>
                                                <button className="px-5 py-2.5 bg-white text-red-700 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-red-200 hover:bg-red-50 transition-all">
                                                    Review Security Footage
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-4xl font-black text-red-900 mb-1">
                                                {adj.suggestedAdjustment}
                                            </p>
                                            <p className="text-xs font-bold text-red-600 uppercase tracking-widest">
                                                Discrepancy
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* No Results */}
                    {filteredAdjustments.length === 0 && (
                        <div className="bg-white p-12 rounded-2xl border-2 border-gray-200 text-center">
                            <Brain size={60} className="text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-black text-gray-400 uppercase tracking-wider mb-2">
                                No Adjustments Found
                            </h3>
                            <p className="text-sm text-gray-500">
                                Try adjusting your search or filter criteria
                            </p>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm">
                        <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <ClipboardList size={16} className="text-gray-500" />
                            Recent Decisions (Where Approved/Rejected Go)
                        </h3>
                        {decisionLog.length === 0 ? (
                            <p className="text-sm text-gray-500">No approval/rejection/manual action recorded yet.</p>
                        ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto">
                                {decisionLog.slice(0, 10).map((d) => (
                                    <div key={d.id} className="flex items-start justify-between gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{d.productName}</p>
                                            <p className="text-xs text-gray-600">{d.note}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black uppercase text-gray-700">{d.action}</p>
                                            <p className="text-xs font-bold text-gray-500">
                                                {d.quantityChange > 0 ? '+' : ''}{d.quantityChange}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
