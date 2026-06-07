import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Search, AlertTriangle, CheckCircle, XCircle,
    Zap, RefreshCw, Building2,
    ArrowLeft, ExternalLink, Star, DollarSign,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { authFetch } from '../../api/axios';
import PasswordInput from '../../components/ui/PasswordInput';
import { getCustomers, getInvoices, type Customer } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const SETTINGS_KEY = 'bettano_credit_settings';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

const INDUSTRIES = [
    'Auto Repair / Mechanic Shop','Fleet Management','Trucking / Logistics',
    'Construction','Manufacturing','Retail','Wholesale Distribution',
    'Agriculture','Mining','Government / Municipal','Other'
];

const BUSINESS_TYPES = ['Corporation','LLC','Partnership','Sole Proprietor','Government','Non-Profit','Unknown'];

interface ProspectForm {
    company_name: string;
    dba_name: string;
    business_type: string;
    industry: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string;
    email: string;
    website: string;
    duns_number: string;
    years_in_business: string;
    estimated_annual_revenue: string;
    contact_person: string;
    contact_title: string;
    requested_credit_limit: string;
    payment_terms_requested: string;
    notes: string;
}

const emptyForm = (): ProspectForm => ({
    company_name: '', dba_name: '', business_type: 'LLC', industry: 'Auto Repair / Mechanic Shop',
    address: '', city: '', state: 'NY', zip: '', country: 'US',
    phone: '', email: '', website: '', duns_number: '',
    years_in_business: '', estimated_annual_revenue: '',
    contact_person: '', contact_title: '',
    requested_credit_limit: '', payment_terms_requested: 'Net 30', notes: ''
});

interface CreditReport {
    company_name: string; credit_score?: number | null; risk_level?: string | null;
    credit_limit_suggestion?: number | null; payment_behavior?: string | null;
    years_in_business?: number | null; employees?: string | null; annual_revenue?: string | null;
    outstanding_liens?: number | null; bankruptcies?: number | null; judgments?: number | null;
    days_beyond_terms?: number | null; industry_risk?: string | null; payment_trend?: string | null;
    trade_lines?: number | null; negative_marks?: number | null; key_factors?: string[];
    ai_analysis?: string | null; ai_recommendation?: string | null; risk_flags?: string[];
    data_source: string; confidence?: string | null; searched_at: string;
    verified_credit_report?: boolean; authoritative?: boolean; credit_data_available?: boolean;
    source_label?: string; message?: string; creditsafe_company?: Record<string, unknown>;
    erp_balance?: number; erp_invoices?: number;
    erp_last_payment?: string; prospect_data?: ProspectForm;
    sell_decision?: 'approve' | 'conditional' | 'decline';
    sell_conditions?: string[];
    sell_max_order?: number;
}

interface CreditSettings { creditsafe_key: string; dnb_key: string; alert_threshold: number; }

function getSettings(): CreditSettings {
    try { return { creditsafe_key: '', dnb_key: '', alert_threshold: 500, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return { creditsafe_key: '', dnb_key: '', alert_threshold: 500 }; }
}

const SCORE_COLOR = (score: number) => {
    if (score >= 750) return { text: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-400', label: 'Excellent', hex: '#059669' };
    if (score >= 650) return { text: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-400', label: 'Good', hex: '#2563eb' };
    if (score >= 550) return { text: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-400', label: 'Fair', hex: '#d97706' };
    if (score >= 400) return { text: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-400', label: 'Poor', hex: '#ea580c' };
    return { text: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-500', label: 'Very Poor', hex: '#dc2626' };
};

const SELL_DECISION_UI = {
    approve:     { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', icon: '✅', label: 'APPROVED — SAFE TO SELL' },
    conditional: { bg: 'bg-amber-50',   border: 'border-amber-400',   text: 'text-amber-700',   icon: '⚠️', label: 'CONDITIONAL — SELL WITH TERMS' },
    decline:     { bg: 'bg-red-50',     border: 'border-red-400',     text: 'text-red-700',     icon: '❌', label: 'DECLINE — HIGH RISK' },
};

export default function CreditIntelligence() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'check' | 'erp' | 'history' | 'settings'>('check');
    const [form, setForm] = useState<ProspectForm>(emptyForm());
    const [formExpanded, setFormExpanded] = useState(true);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<CreditReport | null>(null);
    const [erpCustomers, setErpCustomers] = useState<Customer[]>([]);
    const [erpInvoices, setErpInvoices] = useState<any[]>([]);
    const [erpSearch, setErpSearch] = useState('');
    const [cachedReports, setCachedReports] = useState<Record<string, CreditReport>>({});
    const [settings, setSettings] = useState<CreditSettings>(getSettings());

    useEffect(() => {
        Promise.all([getCustomers().catch(() => []), getInvoices().catch(() => [])]).then(([c, i]) => {
            localStorage.removeItem('bettano_credit_reports');
            setErpCustomers(c); setErpInvoices(i); setCachedReports({});
        });
    }, []);

    const upd = (field: keyof ProspectForm, val: string) => setForm(p => ({ ...p, [field]: val }));

    const runCreditCheck = async (overrideForm?: ProspectForm) => {
        const f = overrideForm || form;
        if (!f.company_name.trim()) { alert('Company name is required.'); return; }
        setLoading(true); setReport(null); setFormExpanded(false);

        // ERP data for this company if exists
        const erpCust = erpCustomers.find(c => c.name.toLowerCase().includes(f.company_name.toLowerCase().slice(0, 6)));
        const custInvoices = erpCust ? erpInvoices.filter(i => String(i.customerId) === String(erpCust.id)) : [];
        const erpBalance = custInvoices.filter(i => i.status !== 'Paid').reduce((s: number, i: any) => s + i.grandTotal, 0);

        try {
            const res = await authFetch(`${API}/ai/credit/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_name: f.company_name,
                    country: f.country || 'US',
                    city: f.city,
                    state: f.state,
                    industry: f.industry,
                    business_type: f.business_type,
                    years_in_business: f.years_in_business,
                    estimated_revenue: f.estimated_annual_revenue,
                    requested_credit: f.requested_credit_limit,
                    duns_number: f.duns_number,
                    creditsafe_api_key: settings.creditsafe_key,
                    dnb_api_key: settings.dnb_key,
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            const data: CreditReport = await res.json();
            data.prospect_data = f;
            data.erp_balance = erpBalance;
            data.erp_invoices = custInvoices.length;

            const hasVerifiedScore = data.verified_credit_report === true && typeof data.credit_score === 'number';

            // Determine sell decision only when a verified source supplied a score.
            if (hasVerifiedScore && data.credit_score! >= 650 && (data.bankruptcies ?? 0) === 0 && data.risk_level !== 'High' && data.risk_level !== 'Very High') {
                data.sell_decision = 'approve';
                data.sell_max_order = data.credit_limit_suggestion ?? 0;
                data.sell_conditions = [];
            } else if (hasVerifiedScore && data.credit_score! >= 450) {
                data.sell_decision = 'conditional';
                data.sell_max_order = (data.credit_limit_suggestion ?? 0) * 0.5;
                data.sell_conditions = [
                    'Prepayment or 50% deposit required',
                    `Maximum order value: ${formatCurrency((data.credit_limit_suggestion ?? 0) * 0.5)}`,
                    'Review after 3 successful orders',
                    (data.days_beyond_terms ?? 0) > 30 ? 'Strict payment terms: Net 15 only' : 'Net 30 terms',
                ];
            } else if (hasVerifiedScore) {
                data.sell_decision = 'decline';
                data.sell_max_order = 0;
                data.sell_conditions = [
                    'Cash upfront only — no credit',
                    (data.bankruptcies ?? 0) > 0 ? 'Bankruptcy history detected' : '',
                    (data.judgments ?? 0) > 0 ? 'Outstanding judgments on file' : '',
                    'Escalate to management for approval',
                ].filter(Boolean);
            }

            setReport(data);
            setCachedReports({});
        } catch (e: any) {
            alert(`Credit check failed: ${e.message}`);
        } finally { setLoading(false); }
    };

    const hasVerifiedScore = report?.verified_credit_report === true && typeof report.credit_score === 'number';
    const verifiedScore = hasVerifiedScore ? (report.credit_score as number) : null;
    const scoreStyle = verifiedScore !== null ? SCORE_COLOR(verifiedScore) : null;
    const decisionUI = report?.sell_decision ? SELL_DECISION_UI[report.sell_decision] : null;
    const hasVerifiedReport = report?.verified_credit_report === true;
    const filteredErp = erpCustomers.filter(c => !erpSearch || c.name.toLowerCase().includes(erpSearch.toLowerCase())).slice(0, 20);

    return (
        <div className="space-y-4 max-w-[1300px] mx-auto pb-10 animate-in fade-in duration-300">

            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-5 text-white">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <Shield size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black uppercase tracking-tight">Credit Intelligence</h1>
                            <p className="text-gray-400 text-[11px]">Research any company before selling · verified credit data source required for scores</p>
                        </div>
                    </div>
                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-full ${settings.creditsafe_key ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {settings.creditsafe_key ? '✓ CreditSafe Connected' : 'Credit data source not connected'}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { id: 'check', label: '🔍 New Credit Check' },
                    { id: 'erp', label: `👥 Check ERP Customer (${erpCustomers.length})` },
                    { id: 'history', label: `📋 History (${Object.keys(cachedReports).length})` },
                    { id: 'settings', label: '⚙️ API Settings' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── NEW CREDIT CHECK TAB ── */}
            {activeTab === 'check' && (
                <div className="space-y-4">
                    {/* Research Form */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <button onClick={() => setFormExpanded(!formExpanded)}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-all">
                            <div className="flex items-center gap-3">
                                <Search size={18} className="text-blue-600" />
                                <div className="text-left">
                                    <p className="text-sm font-black text-gray-900">Company Research Form</p>
                                    <p className="text-[10px] text-gray-400">Fill in details for a more accurate credit assessment</p>
                                </div>
                            </div>
                            {formExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </button>

                        {formExpanded && (
                            <div className="px-6 pb-6 space-y-5">
                                {/* Section 1: Company Identity */}
                                <div>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <Building2 size={12} /> Company Identity
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Company / Business Name *</label>
                                            <input value={form.company_name} onChange={e => upd('company_name', e.target.value)}
                                                placeholder="e.g. ABC Auto Parts LLC"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">DBA / Trading Name</label>
                                            <input value={form.dba_name} onChange={e => upd('dba_name', e.target.value)}
                                                placeholder="Also known as..."
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Business Type</label>
                                            <select value={form.business_type} onChange={e => upd('business_type', e.target.value)}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400">
                                                {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Industry</label>
                                            <select value={form.industry} onChange={e => upd('industry', e.target.value)}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400">
                                                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">D-U-N-S Number</label>
                                            <input value={form.duns_number} onChange={e => upd('duns_number', e.target.value)}
                                                placeholder="9-digit D&B number"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-400" />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Address */}
                                <div>
                                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        📍 Business Address
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Street Address</label>
                                            <input value={form.address} onChange={e => upd('address', e.target.value)}
                                                placeholder="123 Main Street"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">City</label>
                                            <input value={form.city} onChange={e => upd('city', e.target.value)}
                                                placeholder="New York"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">State</label>
                                                <select value={form.state} onChange={e => upd('state', e.target.value)}
                                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400">
                                                    {US_STATES.map(s => <option key={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">ZIP</label>
                                                <input value={form.zip} onChange={e => upd('zip', e.target.value)}
                                                    placeholder="10001"
                                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Contact */}
                                <div>
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        📞 Contact Information
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {[
                                            { field: 'contact_person', label: 'Contact Person', ph: 'John Smith' },
                                            { field: 'contact_title', label: 'Title', ph: 'Owner / Manager' },
                                            { field: 'phone', label: 'Phone', ph: '+1 212 000 0000' },
                                            { field: 'email', label: 'Email', ph: 'john@company.com' },
                                            { field: 'website', label: 'Website', ph: 'www.company.com' },
                                        ].map(f2 => (
                                            <div key={f2.field}>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">{f2.label}</label>
                                                <input value={(form as any)[f2.field]} onChange={e => upd(f2.field as keyof ProspectForm, e.target.value)}
                                                    placeholder={f2.ph}
                                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Section 4: Credit Request */}
                                <div>
                                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <DollarSign size={12} /> Credit Request Details
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Credit Limit Requested</label>
                                            <input type="number" value={form.requested_credit_limit} onChange={e => upd('requested_credit_limit', e.target.value)}
                                                placeholder="e.g. 25000"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Payment Terms Wanted</label>
                                            <select value={form.payment_terms_requested} onChange={e => upd('payment_terms_requested', e.target.value)}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400">
                                                {['COD','Net 7','Net 15','Net 30','Net 45','Net 60','2/10 Net 30'].map(t => <option key={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Years in Business</label>
                                            <input value={form.years_in_business} onChange={e => upd('years_in_business', e.target.value)}
                                                placeholder="e.g. 5"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Est. Annual Revenue</label>
                                            <input value={form.estimated_annual_revenue} onChange={e => upd('estimated_annual_revenue', e.target.value)}
                                                placeholder="e.g. $500,000"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Additional Notes</label>
                                            <textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2}
                                                placeholder="Any additional context (referral, existing relationship, etc.)"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400 resize-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => runCreditCheck()} disabled={loading || !form.company_name.trim()}
                                        className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-gray-700 disabled:opacity-50 transition-all shadow-md">
                                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />}
                                        {loading ? 'Running Credit Check...' : 'Run Credit Check'}
                                    </button>
                                    <button onClick={() => { setForm(emptyForm()); setReport(null); setFormExpanded(true); }}
                                        className="px-5 py-3 text-sm font-black text-gray-400 hover:text-gray-700 transition-all">
                                        Clear Form
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                            <RefreshCw size={36} className="animate-spin text-blue-500 mx-auto mb-3" />
                            <p className="text-gray-700 font-black">Checking {form.company_name}...</p>
                            <p className="text-gray-400 text-sm mt-1">Requesting verified credit data. Scores are shown only when returned by CreditSafe.</p>
                        </div>
                    )}

                    {/* Results */}
                    {report && !loading && !hasVerifiedReport && (
                        <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center shadow-sm">
                            <Shield size={36} className="text-amber-500 mx-auto mb-3" />
                            <p className="text-lg font-black text-gray-900">Verified credit report unavailable</p>
                            <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">
                                Connect a credit data source (CreditSafe) to pull verified credit reports.
                                No AI-generated credit score, rating, risk number, or credit decision was produced.
                            </p>
                            <button
                                type="button"
                                onClick={() => setActiveTab('settings')}
                                className="mt-5 px-5 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-700 transition-all"
                            >
                                Connect CreditSafe
                            </button>
                        </div>
                    )}

                    {report && !loading && hasVerifiedReport && !hasVerifiedScore && (
                        <div className="bg-white rounded-2xl border border-blue-200 p-8 shadow-sm">
                            <div className="flex items-start gap-4">
                                <CheckCircle size={28} className="text-blue-600 flex-shrink-0" />
                                <div>
                                    <p className="text-lg font-black text-gray-900">Verified CreditSafe data returned</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        CreditSafe returned company data, but no score/rating field was available in the response. No score or credit decision is shown.
                                    </p>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div className="bg-gray-50 rounded-xl p-3">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Company</p>
                                            <p className="font-bold text-gray-900">{report.company_name}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl p-3">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Source</p>
                                            <p className="font-bold text-gray-900">{report.source_label || report.data_source}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {report && !loading && hasVerifiedScore && scoreStyle && decisionUI && (
                        <div className="space-y-4">
                            {/* SELL DECISION BANNER - Most important */}
                            <div className={`rounded-2xl p-5 border-2 ${decisionUI.border} ${decisionUI.bg}`}>
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        <span className="text-4xl">{decisionUI.icon}</span>
                                        <div>
                                            <p className={`text-xl font-black ${decisionUI.text}`}>{decisionUI.label}</p>
                                            <p className="text-gray-600 text-sm mt-0.5">{report.company_name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-500 uppercase mb-0.5">Max Credit / Order Value</p>
                                        <p className={`text-2xl font-black ${decisionUI.text}`}>{report.sell_max_order ? formatCurrency(report.sell_max_order) : '$0'}</p>
                                    </div>
                                </div>
                                {report.sell_conditions && report.sell_conditions.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                                        <p className="text-[10px] font-black uppercase tracking-widest mb-1.5">Terms & Conditions</p>
                                        <div className="flex flex-wrap gap-2">
                                            {report.sell_conditions.map((c2, i) => (
                                                <span key={i} className={`text-[11px] font-bold px-3 py-1 rounded-full bg-white/60 ${decisionUI.text}`}>
                                                    {c2}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Score + Details */}
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                                <div className="xl:col-span-8 space-y-3">
                                    {/* Score bar */}
                                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                        <div className="flex items-center gap-5 mb-4">
                                            <div className={`w-20 h-20 rounded-2xl ${scoreStyle.bg} ring-4 ${scoreStyle.ring} flex flex-col items-center justify-center flex-shrink-0`}>
                                                <span className={`text-2xl font-black ${scoreStyle.text}`}>{verifiedScore}</span>
                                                <span className={`text-[9px] font-black ${scoreStyle.text} uppercase`}>{scoreStyle.label}</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                                    <span>300</span><span>Poor</span><span>Fair</span><span>Good</span><span>850</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-3 relative">
                                                    <div className="h-3 rounded-full transition-all" style={{ width: `${(((verifiedScore ?? 300) - 300) / 550) * 100}%`, background: `linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)` }} />
                                                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-700 rounded-full shadow-sm" style={{ left: `calc(${(((verifiedScore ?? 300) - 300) / 550) * 100}% - 8px)` }} />
                                                </div>
                                                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                                    <span>Very Poor</span><span>Excellent</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[
                                                { label: 'Risk Level', value: report.risk_level || '—', warning: ['High','Very High'].includes(report.risk_level || '') },
                                                { label: 'Days Beyond Terms', value: report.days_beyond_terms == null ? '—' : `${report.days_beyond_terms}d`, warning: (report.days_beyond_terms ?? 0) > 30 },
                                                { label: 'Payment Trend', value: report.payment_trend || '—', warning: report.payment_trend === 'Declining' },
                                                { label: 'Industry Risk', value: report.industry_risk || '—', warning: report.industry_risk === 'High' },
                                            ].map((m, i) => (
                                                <div key={i} className={`rounded-xl p-3 text-center ${m.warning ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-100'}`}>
                                                    <p className={`text-sm font-black ${m.warning ? 'text-red-600' : 'text-gray-800'}`}>{m.value}</p>
                                                    <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-0.5">{m.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Negatives */}
                                    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${((report.bankruptcies ?? 0) + (report.judgments ?? 0) + (report.outstanding_liens ?? 0)) > 0 ? 'border-red-200' : 'border-gray-100'}`}>
                                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Public Records</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Bankruptcies', value: report.bankruptcies ?? 0 },
                                                { label: 'Judgments', value: report.judgments ?? 0 },
                                                { label: 'Liens', value: report.outstanding_liens ?? 0 },
                                            ].map((r2, i) => (
                                                <div key={i} className={`text-center p-3 rounded-xl ${r2.value > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                                    <p className={`text-2xl font-black ${r2.value > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{r2.value}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold">{r2.label}</p>
                                                    {r2.value > 0 ? <XCircle size={14} className="text-red-500 mx-auto mt-0.5" /> : <CheckCircle size={14} className="text-emerald-500 mx-auto mt-0.5" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Company info */}
                                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Company Profile</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                                            {[
                                                { label: 'Years in Business', value: report.years_in_business ?? '—' },
                                                { label: 'Employees', value: report.employees || '—' },
                                                { label: 'Annual Revenue', value: report.annual_revenue || '—' },
                                                { label: 'Trade Lines', value: report.trade_lines ?? '—' },
                                            ].map((m, i) => (
                                                <div key={i} className="bg-gray-50 rounded-xl p-3">
                                                    <p className="text-sm font-black text-gray-800">{m.value}</p>
                                                    <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-0.5">{m.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: AI */}
                                <div className="xl:col-span-4 space-y-3">
                                    <div className="bg-gray-900 rounded-2xl p-5 text-white">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap size={16} className="text-orange-400" />
                                            <p className="text-xs font-black text-orange-400 uppercase tracking-widest">Verified Source</p>
                                        </div>
                                        <p className="text-sm text-gray-300 leading-relaxed">{report.source_label || report.data_source}</p>
                                    </div>
                                    {report.risk_flags && report.risk_flags.length > 0 && (
                                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={14} className="text-red-600" /><p className="text-xs font-black text-red-700 uppercase tracking-widest">Risk Flags</p></div>
                                            {report.risk_flags.map((f2, i) => (
                                                <p key={i} className="text-xs text-red-700 mt-1 flex gap-1.5"><span>⚠</span>{f2}</p>
                                            ))}
                                        </div>
                                    )}
                                    {report.key_factors && report.key_factors.length > 0 && (
                                        <div className="bg-white border border-gray-100 rounded-2xl p-4">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Key Factors</p>
                                            {report.key_factors.map((f2, i) => (
                                                <p key={i} className="text-xs text-gray-600 mt-1.5 flex gap-1.5 items-start"><Star size={10} className="text-amber-400 flex-shrink-0 mt-0.5" />{f2}</p>
                                            ))}
                                        </div>
                                    )}
                                    <div className="bg-white border border-gray-100 rounded-2xl p-4 text-[10px] text-gray-400 space-y-1">
                                        <p><span className="font-black text-gray-600">Source:</span> {report.data_source}</p>
                                        <p><span className="font-black text-gray-600">Verified:</span> Yes</p>
                                        <p><span className="font-black text-gray-600">Checked:</span> {new Date(report.searched_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── ERP CUSTOMERS TAB ── */}
            {activeTab === 'erp' && (
                <div className="space-y-3">
                    <input value={erpSearch} onChange={e => setErpSearch(e.target.value)}
                        placeholder="Filter existing customers..."
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>{['Customer','Phone','Balance','Credit Status','Action'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredErp.map(c2 => {
                                    const custInvs = erpInvoices.filter(i => String(i.customerId) === String(c2.id));
                                    const balance = custInvs.filter(i => i.status !== 'Paid').reduce((s: number, i: any) => s + i.grandTotal, 0);
                                    return (
                                        <tr key={c2.id} className="hover:bg-gray-50">
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-black text-gray-900">{c2.name}</p>
                                                <p className="text-[10px] text-gray-400">{c2.email || ''}</p>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-gray-500 font-mono">{c2.phone || '—'}</td>
                                            <td className="px-5 py-4 text-sm font-black font-mono text-gray-700">{formatCurrency(balance)}</td>
                                            <td className="px-5 py-4">
                                                <span className="text-[10px] text-gray-400">Connect CreditSafe to check</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <button onClick={() => {
                                                    setActiveTab('check');
                                                    setForm({ ...emptyForm(), company_name: c2.name, phone: c2.phone || '', email: c2.email || '', address: c2.address || '' });
                                                    setFormExpanded(true);
                                                    setReport(null);
                                                }} className="flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-800 transition-all">
                                                    <Shield size={12} /> Check Credit
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {Object.keys(cachedReports).length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            Credit report history is disabled until verified report persistence is backed by the server.
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>{['Company','Score','Risk','Decision','Max Credit','DBT','Source','Date'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {Object.values(cachedReports).sort((a,b)=>new Date(b.searched_at).getTime()-new Date(a.searched_at).getTime()).map((r2,i) => {
                                    const s2 = typeof r2.credit_score === 'number' ? SCORE_COLOR(r2.credit_score) : null;
                                    const d2 = r2.sell_decision ? SELL_DECISION_UI[r2.sell_decision] : null;
                                    return (
                                        <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setReport(r2); setActiveTab('check'); setFormExpanded(false); if(r2.prospect_data) setForm(r2.prospect_data); }}>
                                            <td className="px-4 py-3 font-black text-sm text-gray-900">{r2.company_name}</td>
                                            <td className="px-4 py-3">{s2 ? <span className={`text-xs font-black px-2 py-0.5 rounded ${s2.bg} ${s2.text}`}>{r2.credit_score}</span> : '—'}</td>
                                            <td className="px-4 py-3 text-xs text-gray-500">{r2.risk_level || '—'}</td>
                                            <td className="px-4 py-3">{d2 && <span className="text-lg">{d2.icon}</span>}</td>
                                            <td className="px-4 py-3 text-sm font-mono font-black text-gray-700">{r2.credit_limit_suggestion == null ? '—' : formatCurrency(r2.credit_limit_suggestion)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{r2.days_beyond_terms == null ? '—' : `${r2.days_beyond_terms}d`}</td>
                                            <td className="px-4 py-3 text-xs text-gray-400">{r2.data_source}</td>
                                            <td className="px-4 py-3 text-xs font-mono text-gray-400">{new Date(r2.searched_at).toLocaleDateString()}</td>
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
                <div className="max-w-[600px] space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                        <p className="text-sm font-black text-gray-700 uppercase tracking-widest">Credit API Keys</p>
                        {[
                            { key: 'creditsafe_key', label: 'CreditSafe API', emoji: '🏦', url: 'https://www.creditsafe.com/gb/en/products/api.html', ph: 'Enter CreditSafe API key', note: 'Covers 365M+ companies worldwide' },
                            { key: 'dnb_key', label: 'Dun & Bradstreet', emoji: '📊', url: 'https://developer.dnb.com', ph: 'Enter D&B API key', note: 'Covers 500M+ businesses, DUNS number lookup' },
                        ].map(api => (
                            <div key={api.key} className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{api.emoji}</span>
                                        <div>
                                            <p className="text-sm font-black text-gray-900">{api.label}</p>
                                            <p className="text-[10px] text-gray-400">{api.note}</p>
                                        </div>
                                    </div>
                                    <a href={api.url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:underline">
                                        Get API Key <ExternalLink size={9} />
                                    </a>
                                </div>
                                <PasswordInput value={(settings as any)[api.key]} onChange={e => setSettings(p => ({ ...p, [api.key]: e.target.value }))}
                                    placeholder={api.ph}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                            </div>
                        ))}
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Alert if Score Below</label>
                            <input type="number" value={settings.alert_threshold} onChange={e => setSettings(p => ({...p, alert_threshold: parseInt(e.target.value)||500}))}
                                min={300} max={850} className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
                        </div>
                        <button onClick={() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); alert('Saved!'); }}
                            className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 transition-all">
                            Save Settings
                        </button>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
                        <p className="font-black mb-1">Without CreditSafe</p>
                        <p>No score, risk rating, or credit decision will be shown. Connect CreditSafe to pull verified credit reports.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
