import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Search, AlertTriangle, CheckCircle, XCircle,
    TrendingUp, Zap, RefreshCw, Building2,
    ArrowLeft, ExternalLink, Star, Clock, DollarSign, FileText
} from 'lucide-react';
import { getCustomers, type Customer } from '../../services/api';
import { getInvoices } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const CREDIT_CACHE_KEY = 'bettano_credit_reports';
const SETTINGS_KEY = 'bettano_credit_settings';

interface CreditReport {
    company_name: string;
    credit_score: number;
    risk_level: string;
    credit_limit_suggestion: number;
    payment_behavior: string;
    years_in_business: number;
    employees: string;
    annual_revenue: string;
    outstanding_liens: number;
    bankruptcies: number;
    judgments: number;
    days_beyond_terms: number;
    industry_risk: string;
    payment_trend: string;
    trade_lines: number;
    negative_marks: number;
    key_factors: string[];
    ai_analysis: string;
    ai_recommendation: string;
    risk_flags: string[];
    data_source: string;
    confidence: string;
    searched_at: string;
    // Internal ERP data
    erp_balance?: number;
    erp_invoices?: number;
    erp_last_payment?: string;
    erp_payment_history?: string;
}

interface CreditSettings {
    creditsafe_key: string;
    dnb_key: string;
    auto_check: boolean;
    alert_threshold: number;
}

function getCache(): Record<string, CreditReport> {
    try { return JSON.parse(localStorage.getItem(CREDIT_CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveCache(name: string, report: CreditReport) {
    const cache = getCache();
    cache[name.toLowerCase()] = report;
    localStorage.setItem(CREDIT_CACHE_KEY, JSON.stringify(cache));
}
function getSettings(): CreditSettings {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return { creditsafe_key: '', dnb_key: '', auto_check: false, alert_threshold: 500 }; }
}
function saveSettings(s: CreditSettings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

const SCORE_COLOR = (score: number) => {
    if (score >= 750) return { text: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-300', label: 'Excellent' };
    if (score >= 650) return { text: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300', label: 'Good' };
    if (score >= 550) return { text: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-300', label: 'Fair' };
    if (score >= 400) return { text: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-300', label: 'Poor' };
    return { text: 'text-red-600', bg: 'bg-red-100', border: 'border-red-300', label: 'Very Poor' };
};

const RISK_STYLE: Record<string, string> = {
    'Low': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'Low-Medium': 'bg-blue-100 text-blue-700 border-blue-300',
    'Medium': 'bg-amber-100 text-amber-700 border-amber-300',
    'High': 'bg-orange-100 text-orange-700 border-orange-300',
    'Very High': 'bg-red-100 text-red-700 border-red-300',
};

export default function CreditIntelligence() {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [report, setReport] = useState<CreditReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<CreditSettings>(getSettings());
    const [cachedReports, setCachedReports] = useState<Record<string, CreditReport>>({});
    const [invoices, setInvoices] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'report' | 'history' | 'settings'>('report');

    useEffect(() => {
        Promise.all([getCustomers().catch(() => []), getInvoices().catch(() => [])]).then(([custs, invs]) => {
            setCustomers(custs);
            setInvoices(invs);
            setCachedReports(getCache());
        });
    }, []);

    const handleSearch = (q: string) => {
        setSearchQuery(q);
        if (q.length < 2) { setSearchResults([]); return; }
        const results = customers.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
        setSearchResults(results);
    };

    const checkCredit = async (customer: Customer) => {
        setSelectedCustomer(customer);
        setSearchResults([]);
        setSearchQuery(customer.name);
        setActiveTab('report');

        // Check cache first
        const cached = getCache()[customer.name.toLowerCase()];
        if (cached && (Date.now() - new Date(cached.searched_at).getTime()) < 24 * 60 * 60 * 1000) {
            setReport(cached);
            return;
        }

        setLoading(true);
        setReport(null);

        // Get ERP data for this customer
        const custInvoices = invoices.filter(i => String(i.customerId) === String(customer.id));
        const totalBalance = custInvoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.grandTotal, 0);
        const paidInvoices = custInvoices.filter(i => i.status === 'Paid');
        const lastPayment = paidInvoices.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())[0];

        try {
            const res = await fetch(`${API}/ai/credit/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_name: customer.name,
                    country: 'US',
                    city: customer.address?.split(',').slice(-2, -1)[0]?.trim() || '',
                    creditsafe_api_key: settings.creditsafe_key,
                    dnb_api_key: settings.dnb_key,
                })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            // Enrich with ERP data
            data.erp_balance = totalBalance;
            data.erp_invoices = custInvoices.length;
            data.erp_last_payment = lastPayment?.invoiceDate;
            data.erp_payment_history = paidInvoices.length > 0 ? `${paidInvoices.length} invoices paid` : 'No payment history';

            setReport(data);
            saveCache(customer.name, data);
            setCachedReports(getCache());
        } catch (e: any) {
            alert(`Credit check failed: ${e.message}. Please ensure backend is running.`);
        } finally {
            setLoading(false);
        }
    };

    const scoreStyle = report ? SCORE_COLOR(report.credit_score) : null;

    return (
        <div className="space-y-5 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-300">

            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <Shield size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Credit Intelligence</h1>
                            <p className="text-gray-400 text-xs mt-0.5">CreditSafe · D&B · AI Analysis · Risk Assessment</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-full ${settings.creditsafe_key ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {settings.creditsafe_key ? '✓ CreditSafe Connected' : '⚠ CreditSafe: AI Mode'}
                        </span>
                        <button onClick={() => setActiveTab('settings')}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black transition-all">
                            ⚙ API Settings
                        </button>
                    </div>
                </div>

                {/* Search bar */}
                <div className="mt-5 relative">
                    <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
                        <Search size={18} className="text-gray-400 flex-shrink-0" />
                        <input
                            value={searchQuery}
                            onChange={e => handleSearch(e.target.value)}
                            placeholder="Search customer name to run credit check... e.g. KENZOL MULTI INDUSTRIES"
                            className="flex-1 bg-transparent text-white placeholder-gray-400 text-sm focus:outline-none"
                        />
                        {loading && <RefreshCw size={16} className="text-blue-400 animate-spin flex-shrink-0" />}
                    </div>
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                            {searchResults.map(c => {
                                const cached = getCache()[c.name.toLowerCase()];
                                const style = cached ? SCORE_COLOR(cached.credit_score) : null;
                                return (
                                    <button key={c.id} onClick={() => checkCredit(c)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 transition-all">
                                        <div className="flex items-center gap-3">
                                            <Building2 size={16} className="text-gray-400" />
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{c.name}</p>
                                                <p className="text-[10px] text-gray-400">{c.phone || c.email || 'No contact'}</p>
                                            </div>
                                        </div>
                                        {cached && style ? (
                                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                                                {cached.credit_score} · {style.label}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-blue-600 font-bold">Run Check →</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {[
                    { id: 'report', label: '📊 Credit Report' },
                    { id: 'history', label: `📋 Checked Customers (${Object.keys(cachedReports).length})` },
                    { id: 'settings', label: '⚙️ API Settings' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── CREDIT REPORT TAB ── */}
            {activeTab === 'report' && (
                <>
                    {!report && !loading && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                            <Shield size={56} className="mx-auto text-gray-200 mb-4" />
                            <p className="text-gray-500 font-black text-lg">Search a customer to run credit check</p>
                            <p className="text-gray-400 text-sm mt-2">Uses CreditSafe API when key provided, otherwise AI analysis</p>
                            <div className="flex justify-center gap-3 mt-5 flex-wrap">
                                {customers.slice(0, 5).map(c => (
                                    <button key={c.id} onClick={() => checkCredit(c)}
                                        className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                                        {c.name.slice(0, 25)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                            <RefreshCw size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
                            <p className="text-gray-700 font-black">Running credit check for {selectedCustomer?.name}...</p>
                            <p className="text-gray-400 text-sm mt-1">Checking CreditSafe · D&B · Payment history · AI Risk analysis</p>
                        </div>
                    )}

                    {report && !loading && scoreStyle && (
                        <div className="space-y-4">
                            {/* Score Banner */}
                            <div className={`rounded-2xl p-6 border-2 ${scoreStyle.border} ${scoreStyle.bg}`}>
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-5">
                                        {/* Score circle */}
                                        <div className={`w-24 h-24 rounded-2xl ${scoreStyle.bg} border-4 ${scoreStyle.border} flex flex-col items-center justify-center shadow-sm`}>
                                            <span className={`text-3xl font-black ${scoreStyle.text}`}>{report.credit_score}</span>
                                            <span className={`text-[10px] font-black ${scoreStyle.text} uppercase tracking-widest`}>{scoreStyle.label}</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-gray-900">{report.company_name}</h2>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className={`text-xs font-black px-3 py-1 rounded-full border ${RISK_STYLE[report.risk_level] || RISK_STYLE['Medium']}`}>
                                                    {report.risk_level === 'Low' ? '✅' : report.risk_level === 'Medium' ? '⚠️' : '🔴'} {report.risk_level} Risk
                                                </span>
                                                <span className="text-xs text-gray-500">Source: {report.data_source}</span>
                                                <span className="text-xs text-gray-400">Confidence: {report.confidence}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Checked: {new Date(report.searched_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Recommended Credit Limit</p>
                                        <p className={`text-3xl font-black ${scoreStyle.text}`}>{formatCurrency(report.credit_limit_suggestion)}</p>
                                        {report.erp_balance !== undefined && report.erp_balance > 0 && (
                                            <p className="text-xs text-red-500 font-bold mt-1">Current ERP Balance: {formatCurrency(report.erp_balance)}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Main Grid */}
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                                {/* Left: Key Metrics */}
                                <div className="xl:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {[
                                        { label: 'Years in Business', value: report.years_in_business, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
                                        { label: 'Employees', value: report.employees, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
                                        { label: 'Annual Revenue', value: report.annual_revenue, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                        { label: 'Trade Lines', value: report.trade_lines, icon: FileText, color: 'text-gray-700', bg: 'bg-gray-50' },
                                        { label: 'Days Beyond Terms', value: `${report.days_beyond_terms}d`, icon: Clock, color: report.days_beyond_terms > 30 ? 'text-red-600' : 'text-emerald-600', bg: report.days_beyond_terms > 30 ? 'bg-red-50' : 'bg-emerald-50' },
                                        { label: 'Payment Trend', value: report.payment_trend, icon: TrendingUp, color: report.payment_trend === 'Improving' ? 'text-emerald-600' : report.payment_trend === 'Declining' ? 'text-red-600' : 'text-amber-600', bg: 'bg-amber-50' },
                                    ].map((m, i) => {
                                        const Icon = m.icon;
                                        return (
                                            <div key={i} className={`${m.bg} rounded-2xl p-4 border border-gray-100`}>
                                                <Icon size={18} className={`${m.color} mb-2`} />
                                                <p className={`text-lg font-black ${m.color}`}>{m.value}</p>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{m.label}</p>
                                            </div>
                                        );
                                    })}

                                    {/* Negative marks */}
                                    <div className={`col-span-3 rounded-2xl p-4 border ${report.bankruptcies > 0 || report.judgments > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                        <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-3">Public Records & Negative Marks</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Bankruptcies', value: report.bankruptcies, danger: report.bankruptcies > 0 },
                                                { label: 'Judgments', value: report.judgments, danger: report.judgments > 0 },
                                                { label: 'Liens', value: report.outstanding_liens, danger: report.outstanding_liens > 0 },
                                            ].map((r, i) => (
                                                <div key={i} className="text-center">
                                                    <div className={`text-2xl font-black ${r.danger ? 'text-red-600' : 'text-emerald-600'}`}>{r.value}</div>
                                                    <p className="text-[10px] text-gray-500 font-bold">{r.label}</p>
                                                    {r.danger ? <XCircle size={14} className="text-red-500 mx-auto mt-0.5" /> : <CheckCircle size={14} className="text-emerald-500 mx-auto mt-0.5" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ERP Payment History */}
                                    {report.erp_invoices !== undefined && (
                                        <div className="col-span-3 bg-blue-50 rounded-2xl p-4 border border-blue-100">
                                            <p className="text-xs font-black text-blue-700 uppercase tracking-widest mb-2">Internal ERP Payment Record</p>
                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                <div><p className="text-xl font-black text-gray-900">{report.erp_invoices}</p><p className="text-[10px] text-gray-500">Total Invoices</p></div>
                                                <div><p className="text-xl font-black text-red-600">{report.erp_balance ? formatCurrency(report.erp_balance) : '$0'}</p><p className="text-[10px] text-gray-500">Outstanding</p></div>
                                                <div><p className="text-xs font-black text-gray-700">{report.erp_last_payment || 'N/A'}</p><p className="text-[10px] text-gray-500">Last Payment</p></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: AI Analysis */}
                                <div className="space-y-3">
                                    {/* AI Analysis */}
                                    <div className="bg-gray-900 rounded-2xl p-5 text-white">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap size={16} className="text-orange-400" />
                                            <p className="text-xs font-black text-orange-400 uppercase tracking-widest">AI Risk Analysis</p>
                                        </div>
                                        <p className="text-sm text-gray-300 leading-relaxed">{report.ai_analysis}</p>
                                    </div>

                                    {/* Recommendation */}
                                    <div className={`rounded-2xl p-5 border-2 ${report.risk_level === 'Low' ? 'bg-emerald-50 border-emerald-300' : report.risk_level === 'High' || report.risk_level === 'Very High' ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
                                        <p className="text-xs font-black uppercase tracking-widest mb-2 text-gray-600">AI Recommendation</p>
                                        <p className="text-sm font-bold text-gray-800 leading-relaxed">{report.ai_recommendation}</p>
                                    </div>

                                    {/* Risk Flags */}
                                    {report.risk_flags && report.risk_flags.length > 0 && (
                                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertTriangle size={16} className="text-red-600" />
                                                <p className="text-xs font-black text-red-700 uppercase tracking-widest">Risk Flags</p>
                                            </div>
                                            {report.risk_flags.map((flag, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-red-700 mt-1">
                                                    <span className="flex-shrink-0 mt-0.5">⚠</span> {flag}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Key Factors */}
                                    {report.key_factors && report.key_factors.length > 0 && (
                                        <div className="bg-white border border-gray-100 rounded-2xl p-4">
                                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Key Factors</p>
                                            {report.key_factors.map((f, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-gray-600 mt-1.5">
                                                    <Star size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                                    {f}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {Object.keys(cachedReports).length === 0 ? (
                        <div className="p-12 text-center text-gray-400">No credit checks yet. Search a customer to run your first check.</div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>{['Company', 'Credit Score', 'Risk Level', 'Credit Limit', 'DBT', 'Source', 'Checked'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {Object.values(cachedReports).sort((a, b) => new Date(b.searched_at).getTime() - new Date(a.searched_at).getTime()).map((r, i) => {
                                    const style = SCORE_COLOR(r.credit_score);
                                    return (
                                        <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setReport(r); setActiveTab('report'); setSearchQuery(r.company_name); }}>
                                            <td className="px-5 py-4 font-black text-sm text-gray-900">{r.company_name}</td>
                                            <td className="px-5 py-4">
                                                <span className={`text-sm font-black ${style.text} ${style.bg} px-2 py-1 rounded-lg`}>{r.credit_score}</span>
                                            </td>
                                            <td className="px-5 py-4"><span className={`text-[10px] font-black px-2 py-1 rounded-full border ${RISK_STYLE[r.risk_level] || ''}`}>{r.risk_level}</span></td>
                                            <td className="px-5 py-4 font-mono text-sm font-black text-gray-700">{formatCurrency(r.credit_limit_suggestion)}</td>
                                            <td className="px-5 py-4 text-sm font-mono text-gray-500">{r.days_beyond_terms}d</td>
                                            <td className="px-5 py-4 text-xs text-gray-400">{r.data_source}</td>
                                            <td className="px-5 py-4 text-xs text-gray-400 font-mono">{new Date(r.searched_at).toLocaleDateString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {activeTab === 'settings' && (
                <div className="space-y-4 max-w-[700px]">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
                        <p className="text-sm font-black text-gray-700 uppercase tracking-widest">API Configuration</p>

                        {/* CreditSafe */}
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">🏦</span>
                                <div>
                                    <p className="text-sm font-black text-gray-900">CreditSafe API</p>
                                    <a href="https://www.creditsafe.com/gb/en/products/api.html" target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">Get API Key <ExternalLink size={9} /></a>
                                </div>
                            </div>
                            <input value={settings.creditsafe_key} onChange={e => setSettings(p => ({ ...p, creditsafe_key: e.target.value }))}
                                type="password" placeholder="Enter CreditSafe API key..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>

                        {/* D&B */}
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">📊</span>
                                <div>
                                    <p className="text-sm font-black text-gray-900">Dun & Bradstreet (D&B) API</p>
                                    <a href="https://developer.dnb.com" target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] text-amber-600 hover:underline flex items-center gap-1">Get D&B Developer Access <ExternalLink size={9} /></a>
                                </div>
                            </div>
                            <input value={settings.dnb_key} onChange={e => setSettings(p => ({ ...p, dnb_key: e.target.value }))}
                                type="password" placeholder="Enter D&B API key..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                        </div>

                        {/* Alert threshold */}
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Auto-Alert if Credit Score Below</label>
                            <input type="number" value={settings.alert_threshold} onChange={e => setSettings(p => ({ ...p, alert_threshold: parseInt(e.target.value) || 500 }))}
                                min={300} max={850}
                                className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
                            <p className="text-[10px] text-gray-400 mt-1">Scores below this will be flagged as high risk automatically</p>
                        </div>

                        <button onClick={() => { saveSettings(settings); alert('Settings saved!'); }}
                            className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 transition-all">
                            Save Settings
                        </button>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Without API Keys</p>
                        <p className="text-sm text-gray-600">Claude AI generates a realistic credit assessment based on company name, industry patterns, and your ERP payment history. Results are clearly marked as "AI Analysis".</p>
                        <p className="text-xs text-gray-400 mt-2">For enterprise accuracy, connect CreditSafe (covers 365M+ companies) or D&B (covers 500M+ companies).</p>
                    </div>
                </div>
            )}
        </div>
    );
}
