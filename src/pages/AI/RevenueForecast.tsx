import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, RefreshCw, DollarSign } from 'lucide-react';
import { getInvoices, getProducts, getCustomers } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

interface MonthData { month: string; revenue: number; orders: number; }
interface Forecast {
    nextMonth: { low: number; mid: number; high: number; };
    next3Months: { low: number; mid: number; high: number; };
    next6Months: { low: number; mid: number; high: number; };
    byProduct: Array<{ name: string; forecast: number; trend: string; }>;
    seasonalFactor: number;
    confidence: number;
}

export default function RevenueForecast() {
    const navigate = useNavigate();
    const [history, setHistory] = useState<MonthData[]>([]);
    const [forecast, setForecast] = useState<Forecast | null>(null);
    const [aiReport, setAiReport] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getInvoices(), getProducts(), getCustomers()]).then(([invoices]) => {
            // Build 12-month history
            const monthMap: Record<string, { revenue: number; orders: number }> = {};
            invoices.forEach(inv => {
                const mk = (inv.invoiceDate || inv.createdAt || '').slice(0, 7);
                if (!mk) return;
                if (!monthMap[mk]) monthMap[mk] = { revenue: 0, orders: 0 };
                monthMap[mk].revenue += inv.grandTotal || 0;
                monthMap[mk].orders += 1;
            });

            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const hist: MonthData[] = Object.entries(monthMap)
                .sort(([a],[b]) => a.localeCompare(b))
                .slice(-12)
                .map(([mk, d]) => {
                    const [y, m] = mk.split('-');
                    return { month: `${months[parseInt(m)-1]} ${y.slice(2)}`, revenue: d.revenue, orders: d.orders };
                });

            setHistory(hist);

            // Statistical forecast with confidence ranges
            if (hist.length >= 3) {
                const revenues = hist.map(h => h.revenue);
                const avg = revenues.reduce((s,r) => s+r, 0) / revenues.length;
                const recentAvg = revenues.slice(-3).reduce((s,r) => s+r, 0) / 3;
                const stdDev = Math.sqrt(revenues.reduce((s,r) => s + Math.pow(r-avg,2), 0) / revenues.length);
                const trendFactor = revenues.length > 1 ? (revenues[revenues.length-1] - revenues[0]) / Math.max(revenues[0], 1) / revenues.length : 0;
                const base = recentAvg * (1 + trendFactor);
                const cv = stdDev / Math.max(avg, 1); // coefficient of variation

                setForecast({
                    nextMonth: { low: Math.max(0, base * 0.75), mid: base, high: base * 1.35 },
                    next3Months: { low: Math.max(0, base * 3 * 0.70), mid: base * 3, high: base * 3 * 1.40 },
                    next6Months: { low: Math.max(0, base * 6 * 0.65), mid: base * 6, high: base * 6 * 1.45 },
                    byProduct: [],
                    seasonalFactor: 1.0,
                    confidence: Math.max(40, Math.min(90, 90 - cv * 100))
                });
            }
            setLoading(false);
        });
    }, []);

    const getAIForecast = async () => {
        setAiLoading(true);
        const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        try {
            const historyText = history.map(h => `${h.month}: $${h.revenue.toFixed(0)} (${h.orders} orders)`).join('\n');
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are Marcus, expert financial forecaster for a NYC oil distribution company.
Analyze revenue history and give realistic forecasts with reasoning.
Today: ${new Date().toISOString().slice(0, 10)}
No markdown symbols. CAPS for headings. Max 250 words.`,
                    max_tokens: 600,
                    messages: [{ role: 'user', content: `My monthly revenue history:
${historyText}

Statistical forecast: Next month mid-point: ${forecast ? formatCurrency(forecast.nextMonth.mid) : 'N/A'}

Give me:
1. YOUR revenue forecast for next month (with low, mid, high range)
2. Key factors that could push it higher or lower (NYC market, seasonality, oil prices, economy)
3. ONE specific action to increase revenue this month
4. MARKET ALERT: Any global events affecting oil distribution right now` }]
                })
            });
            const data = await res.json();
            setAiReport(data.reply || '');
        } catch { setAiReport('Could not reach AI. Please try again.'); }
        finally { setAiLoading(false); }
    };

    const maxRev = Math.max(...history.map(h => h.revenue), 1);

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate('/ai')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> AI Hub
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <DollarSign size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Revenue Forecast</h1>
                            <p className="text-gray-400 text-xs mt-0.5">AI-powered with confidence ranges — low / mid / high scenarios</p>
                        </div>
                    </div>
                    <button onClick={getAIForecast} disabled={aiLoading || history.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-black transition-all disabled:opacity-50">
                        {aiLoading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                        Get AI Forecast
                    </button>
                </div>
            </div>

            {/* Confidence Forecast Cards */}
            {forecast && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Next Month', data: forecast.nextMonth, color: 'blue' },
                        { label: 'Next 3 Months', data: forecast.next3Months, color: 'purple' },
                        { label: 'Next 6 Months', data: forecast.next6Months, color: 'indigo' },
                    ].map(({ label, data, color }) => (
                        <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">{label}</p>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">Low</span>
                                    <span className="text-sm font-black font-mono text-red-600">{formatCurrency(data.low)}</span>
                                </div>
                                <div className={`flex items-center justify-between bg-${color}-50 px-3 py-2 rounded-xl border-2 border-${color}-200`}>
                                    <span className={`text-xs font-black text-${color}-700`}>Mid (Most Likely)</span>
                                    <span className={`text-lg font-black font-mono text-${color}-700`}>{formatCurrency(data.mid)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">High</span>
                                    <span className="text-sm font-black font-mono text-emerald-600">{formatCurrency(data.high)}</span>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>Confidence</span>
                                    <span className="font-black">{Math.round(forecast.confidence)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${forecast.confidence}%` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* AI Report */}
            {aiReport && (
                <div className="bg-gray-900 rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap size={18} className="text-orange-400" />
                        <p className="text-sm font-black text-orange-400 uppercase tracking-widest">Marcus — AI Revenue Intelligence</p>
                    </div>
                    <div className="space-y-1.5">
                        {aiReport.split('\n').map((line, i) => {
                            const t = line.trim();
                            if (!t) return <div key={i} className="h-2" />;
                            if (t === t.toUpperCase() && t.length > 4 && /[A-Z]{3}/.test(t))
                                return <p key={i} className="font-black text-orange-400 text-xs uppercase tracking-widest mt-4 mb-1 border-b border-white/10 pb-1">{t}</p>;
                            if (/^[0-9]+\./.test(t))
                                return <p key={i} className="font-bold text-white mt-2">{t}</p>;
                            if (t.startsWith('•') || t.startsWith('-'))
                                return <p key={i} className="text-gray-300 pl-3">• {t.slice(1).trim()}</p>;
                            return <p key={i} className="text-gray-300 text-sm leading-relaxed">{t}</p>;
                        })}
                    </div>
                </div>
            )}

            {/* Revenue History Chart */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-5">Revenue History — Last {history.length} Months</p>
                {loading ? (
                    <div className="h-32 flex items-center justify-center text-gray-400">Loading...</div>
                ) : history.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-gray-400">No invoice data yet</div>
                ) : (
                    <div>
                        <div className="flex items-end gap-2 h-40">
                            {history.map((h, i) => {
                                const heightPct = (h.revenue / maxRev) * 100;
                                const isLast = i === history.length - 1;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-10">
                                            {formatCurrency(h.revenue)}<br/>{h.orders} orders
                                        </div>
                                        <span className="text-[9px] font-bold text-gray-400">{formatCurrency(h.revenue).replace('$','$')}</span>
                                        <div className="w-full rounded-t-lg transition-all"
                                            style={{ height: `${Math.max(heightPct, 3)}%`, background: isLast ? '#f97316' : '#3b82f6', opacity: isLast ? 1 : 0.6 + (i / history.length) * 0.4 }} />
                                        <span className="text-[9px] text-gray-400 text-center">{h.month}</span>
                                    </div>
                                );
                            })}
                            {/* Forecast bar */}
                            {forecast && (
                                <div className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[9px] font-black text-blue-600">{formatCurrency(forecast.nextMonth.mid)}</span>
                                    <div className="w-full rounded-t-lg border-2 border-dashed border-blue-400"
                                        style={{ height: `${Math.max((forecast.nextMonth.mid / maxRev) * 100, 3)}%`, background: '#dbeafe' }} />
                                    <span className="text-[9px] font-black text-blue-500">Forecast</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500 opacity-80"></div>Historical</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-500"></div>Latest month</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded border-2 border-dashed border-blue-400 bg-blue-100"></div>AI Forecast</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
