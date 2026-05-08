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
    BarChart3
} from 'lucide-react';
import { aiStockService, type AIStockAdjustment, type AIInsight } from '../../services/aiStockService';

export default function AIStockControl() {
    const [adjustments, setAdjustments] = useState<AIStockAdjustment[]>([]);
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [adjs, ins] = await Promise.all([
                aiStockService.scanForAnomalies(),
                aiStockService.getInsights()
            ]);
            setAdjustments(adjs);
            setInsights(ins);
        } catch (error) {
            console.error('Failed to load AI data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setProcessingId(id);
        try {
            if (action === 'approve') await aiStockService.approveAdjustment(id);
            else await aiStockService.rejectAdjustment(id);

            // Remove from list locally for instant feedback
            setAdjustments(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            alert('Action failed');
        } finally {
            setProcessingId(null);
        }
    };

    const pendingCount = adjustments.filter(a => a.type === 'approval_required').length;
    const criticalCount = adjustments.filter(a => a.type === 'investigation_required').length;
    const autoCount = 23; // Mocked from "Today's Activity" in prompt

    const getReasonIcon = (reason: string) => {
        switch (reason) {
            case 'shrinkage': return <TrendingUp className="text-orange-500" />;
            case 'damage': return <AlertTriangle className="text-red-500" />;
            case 'sales_reconciliation': return <RefreshCw className="text-blue-500" />;
            case 'expiry': return <Clock className="text-amber-500" />;
            default: return <Brain className="text-purple-500" />;
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-purple-600 rounded-xl text-white shadow-lg shadow-purple-200">
                            <Brain size={24} />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">AI Stock Control Center</h1>
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full inline-block">
                        System Status: Active • Learning Mode: On
                    </p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={loadData}
                        className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-widest hover:border-gray-400 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button className="px-6 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200">
                        Configure Rules
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={80} />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Auto-Adjusted (24h)</p>
                    <p className="text-4xl font-black text-emerald-600 tracking-tighter">{autoCount}</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-2 flex items-center gap-1">
                        <Zap size={10} fill="currentColor" /> Saved 1.5 hours
                    </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Clock size={80} />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Pending Approval</p>
                    <p className="text-4xl font-black text-amber-500 tracking-tighter">{pendingCount}</p>
                    <p className="text-[10px] font-bold text-amber-600 mt-2">
                        Avg Confidence: 89%
                    </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <ShieldAlert size={80} />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Critical Flags</p>
                    <p className="text-4xl font-black text-red-500 tracking-tighter">{criticalCount}</p>
                    <p className="text-[10px] font-bold text-red-600 mt-2">
                        Investigation Required
                    </p>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl shadow-purple-200 relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-20">
                        <Brain size={80} />
                    </div>
                    <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest mb-2">AI Confidence Score</p>
                    <p className="text-4xl font-black tracking-tighter">94%</p>
                    <p className="text-[10px] font-bold text-purple-200 mt-2 flex items-center gap-1">
                        <TrendingUp size={10} /> +2.4% this week
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT: Auto-Adjustment Feed */}
                <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden h-fit">
                    <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <Zap size={14} className="text-emerald-500" /> Live Auto-Log
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400">Last 24 Hours</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {adjustments.filter(a => a.type === 'auto').map((adj) => (
                            <div key={adj.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{adj.productName}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{adj.reason.replace('_', ' ')}</p>
                                    </div>
                                    <span className={`text-xs font-black px-2 py-1 rounded-md ${adj.suggestedAdjustment < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {adj.suggestedAdjustment > 0 ? '+' : ''}{adj.suggestedAdjustment}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                                        <CheckCircle2 size={10} /> AI Conf: {adj.confidence}%
                                    </span>
                                    <span className="text-[9px] text-gray-400 ml-auto">
                                        {new Date(adj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CENTRE & RIGHT: Action Center */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Insights Ticker */}
                    <div className="bg-gray-900 text-white p-6 rounded-3xl flex items-center justify-between shadow-xl">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <BarChart3 size={20} className="text-blue-400" />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">AI Insight</h4>
                                <p className="text-sm font-bold">{insights[0]?.message || 'Analyzing patterns...'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-black text-blue-400">{insights[0]?.metric || '-'}</span>
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Impact</p>
                        </div>
                    </div>

                    {/* Pending Approvals */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Pending Management Approval ({pendingCount})</h3>

                        {adjustments.filter(a => a.type === 'approval_required').map(adj => (
                            <div key={adj.id} className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            {getReasonIcon(adj.reason)}
                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-md">
                                                Suggestion
                                            </span>
                                        </div>
                                        <h4 className="text-xl font-black text-gray-900 mb-2">{adj.productName}</h4>
                                        <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100 inline-block font-medium">
                                            "{adj.description}"
                                        </p>
                                        <div className="flex items-center gap-4">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                Current: <span className="text-gray-900">{adj.currentStock}</span>
                                            </div>
                                            <ArrowRight size={14} className="text-gray-300" />
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                New: <span className="text-gray-900">{adj.currentStock + adj.suggestedAdjustment}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                                                Adjustment: {adj.suggestedAdjustment}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 w-full md:w-auto">
                                        <button
                                            onClick={() => handleAction(adj.id, 'reject')}
                                            disabled={processingId === adj.id}
                                            className="flex-1 md:flex-none px-6 py-4 border-2 border-gray-100 rounded-2xl text-[11px] font-black uppercase text-gray-400 hover:border-red-100 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                                        >
                                            <X size={16} /> Reject
                                        </button>
                                        <button
                                            onClick={() => handleAction(adj.id, 'approve')}
                                            disabled={processingId === adj.id}
                                            className="flex-1 md:flex-none px-8 py-4 bg-gray-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2"
                                        >
                                            {processingId === adj.id ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Critical Investigations */}
                    {criticalCount > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-red-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <AlertTriangle size={14} /> Critical Investigations Required
                            </h3>
                            {adjustments.filter(a => a.type === 'investigation_required').map(adj => (
                                <div key={adj.id} className="bg-red-50 p-8 rounded-[32px] border border-red-100 relative">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-lg font-black text-red-900 mb-1">{adj.productName}</h4>
                                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4">Risk Score: {adj.aiAnalysis?.riskScore || 99}/100</p>
                                            <p className="text-sm font-medium text-red-800 mb-6 max-w-xl">
                                                {adj.description}
                                            </p>

                                            <div className="flex gap-3">
                                                <button className="px-5 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200">
                                                    Trigger Physical Count
                                                </button>
                                                <button className="px-5 py-3 bg-white text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-50 transition-all">
                                                    Review Security Footage
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-black text-red-900">{adj.suggestedAdjustment}</p>
                                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Discrepancy</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
