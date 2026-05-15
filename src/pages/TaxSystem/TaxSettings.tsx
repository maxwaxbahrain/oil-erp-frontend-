import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calculator, Save, Shield, ExternalLink,
    ArrowLeft, Check, RefreshCw, AlertTriangle, Zap
} from 'lucide-react';
import { formatCurrency } from '../../services/settingsService';

// ── Types ──────────────────────────────────────────────────
interface TaxConfig {
    enabled: boolean; provider: 'manual' | 'taxjar'; taxjar_api_key: string;
    default_rate: number; company_state: string; company_zip: string;
    nexus_states: string[]; apply_to_invoices: boolean; apply_to_quotes: boolean;
    tax_inclusive: boolean; product_tax_code: string; exemption_enabled: boolean;
}

const TAX_CONFIG_KEY = 'bettano_tax_config';
const TAX_RATES_KEY  = 'bettano_tax_rates';

const DEFAULT_CONFIG: TaxConfig = {
    enabled: false, provider: 'manual', taxjar_api_key: '', default_rate: 8.875,
    company_state: 'NY', company_zip: '12201', nexus_states: ['NY'],
    apply_to_invoices: true, apply_to_quotes: false, tax_inclusive: false,
    product_tax_code: '19005', exemption_enabled: true,
};

export function getTaxConfig(): TaxConfig {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(TAX_CONFIG_KEY) || '{}') }; }
    catch { return DEFAULT_CONFIG; }
}
function saveConfig(cfg: TaxConfig) { localStorage.setItem(TAX_CONFIG_KEY, JSON.stringify(cfg)); }
function getCachedRates(): Record<string, any> {
    try { return JSON.parse(localStorage.getItem(TAX_RATES_KEY) || '{}'); } catch { return {}; }
}

export async function calculateTax(amount: number, toZip: string, toState: string): Promise<{rate:number;amount:number;source:string}> {
    const config = getTaxConfig();
    if (!config.enabled) return { rate: 0, amount: 0, source: 'disabled' };
    const hasNexus = config.nexus_states.includes(toState);
    const cached = getCachedRates()[toZip];
    if (cached?.fetched_at && (Date.now() - new Date(cached.fetched_at).getTime()) < 3600000)
        return { rate: cached.combined_rate, amount: amount * (cached.combined_rate / 100), source: 'cache' };
    if (config.provider === 'taxjar' && config.taxjar_api_key) {
        try {
            const res = await fetch(`https://api.taxjar.com/v2/rates/${toZip}`, {
                headers: { 'Authorization': `Token token="${config.taxjar_api_key}"` }
            });
            if (res.ok) {
                const data = await res.json();
                const combined = parseFloat(data.rate?.combined_rate || '0') * 100;
                const rates = getCachedRates();
                rates[toZip] = { state: toState, combined_rate: combined, rate: parseFloat(data.rate?.state_rate||'0')*100, fetched_at: new Date().toISOString() };
                localStorage.setItem(TAX_RATES_KEY, JSON.stringify(rates));
                return { rate: combined, amount: amount * (combined / 100), source: 'taxjar' };
            }
        } catch { /* fall through */ }
    }
    // Use COMMON_RATES for state, fall back to config.default_rate
    const stateRates: Record<string, number> = {
        AL:9.0, AK:1.76, AZ:8.37, AR:9.47, CA:10.25, CO:7.72, CT:6.35, DE:0.0,
        FL:7.02, GA:7.35, HI:4.44, ID:6.02, IL:10.0, IN:7.0, IA:6.94, KS:8.68,
        KY:6.0, LA:9.55, ME:5.5, MD:6.0, MA:6.25, MI:6.0, MN:7.46, MS:7.07,
        MO:8.18, MT:0.0, NE:6.94, NV:8.23, NH:0.0, NJ:6.63, NM:7.83, NY:8.88,
        NC:6.98, ND:6.96, OH:7.24, OK:8.95, OR:0.0, PA:6.34, RI:7.0, SC:7.43,
        SD:6.4, TN:9.55, TX:8.25, UT:7.19, VT:6.18, VA:5.75, WA:10.23, WV:6.6,
        WI:5.43, WY:5.36, DC:6.0
    };
    const effectiveRate = stateRates[toState] ?? config.default_rate;
    const source = hasNexus ? 'manual' : 'no_nexus_info';
    return { rate: effectiveRate, amount: hasNexus ? amount * (effectiveRate / 100) : 0, source };
}

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const COMMON_RATES: Record<string, number> = {
    AL:9.0, AK:1.76, AZ:8.37, AR:9.47, CA:10.25, CO:7.72, CT:6.35, DE:0.0,
    FL:7.02, GA:7.35, HI:4.44, ID:6.02, IL:10.0, IN:7.0, IA:6.94, KS:8.68,
    KY:6.0, LA:9.55, ME:5.5, MD:6.0, MA:6.25, MI:6.0, MN:7.46, MS:7.07,
    MO:8.18, MT:0.0, NE:6.94, NV:8.23, NH:0.0, NJ:6.63, NM:7.83, NY:8.88,
    NC:6.98, ND:6.96, OH:7.24, OK:8.95, OR:0.0, PA:6.34, RI:7.0, SC:7.43,
    SD:6.4, TN:9.55, TX:8.25, UT:7.19, VT:6.18, VA:5.75, WA:10.23, WV:6.6,
    WI:5.43, WY:5.36, DC:6.0
};

export default function TaxSettings() {
    const navigate = useNavigate();
    const [config, setConfig] = useState<TaxConfig>(getTaxConfig());
    const [saved, setSaved] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [testResult, setTestResult] = useState('');
    const [activeTab, setActiveTab] = useState<'setup'|'calculator'|'nexus'|'rates'>('setup');
    const [calcAmount, setCalcAmount] = useState('');
    const [calcZip, setCalcZip] = useState(DEFAULT_CONFIG.company_zip);
    const [calcState, setCalcState] = useState(DEFAULT_CONFIG.company_state);
    const [calcResult, setCalcResult] = useState<{rate:number;amount:number;total:number;source:string}|null>(null);
    const [calcLoading, setCalcLoading] = useState(false);

    const upd = <K extends keyof TaxConfig>(field: K, val: TaxConfig[K]) => setConfig(p => ({ ...p, [field]: val }));

    const handleSave = () => { saveConfig(config); setSaved(true); setTimeout(() => setSaved(false), 3000); };

    const testTaxJar = async () => {
        if (!config.taxjar_api_key) { setTestResult('❌ No API key entered.'); return; }
        setTestLoading(true); setTestResult('');
        try {
            const res = await fetch('https://api.taxjar.com/v2/rates/10001', {
                headers: { 'Authorization': `Token token="${config.taxjar_api_key}"` }
            });
            if (res.ok) {
                const data = await res.json();
                const rate = (parseFloat(data.rate?.combined_rate || '0') * 100).toFixed(3);
                setTestResult(`✅ Connected! NYC (10001) combined rate: ${rate}%`);
            } else {
                setTestResult(`❌ Error ${res.status}: Invalid API key.`);
            }
        } catch { setTestResult('❌ Could not reach TaxJar. Check connection.'); }
        finally { setTestLoading(false); }
    };

    const runCalc = async () => {
        const amt = parseFloat(calcAmount);
        if (!amt) { alert('Enter amount'); return; }
        setCalcLoading(true); setCalcResult(null);
        const r = await calculateTax(amt, calcZip, calcState);
        setCalcResult({ rate: r.rate, amount: r.amount, total: amt + r.amount, source: r.source });
        setCalcLoading(false);
    };

    const cachedRates = getCachedRates();
    const nexusRates = config.nexus_states.map(s => ({ state: s, rate: COMMON_RATES[s] || config.default_rate }));

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10 animate-in fade-in duration-300">
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <Calculator size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Tax Management</h1>
                            <p className="text-gray-400 text-xs mt-0.5">US Sales Tax · TaxJar API · Manual rates · Optional</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Quick link to the Tax Engine (Session 1A foundation page).
                            Lives in the header so it's always reachable regardless
                            of which tab is active. */}
                        <button
                            onClick={() => navigate('/tax/engine')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-black transition-all shadow-md"
                            title="Open the Tax Engine module"
                        >
                            <Zap size={14} /> Open Tax Engine
                        </button>
                        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl">
                            <span className="text-xs font-black text-gray-300">Tax Collection</span>
                            <button onClick={() => upd('enabled', !config.enabled)}
                                className={`relative w-10 h-5 rounded-full transition-all ${config.enabled ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${config.enabled ? 'left-5' : 'left-0.5'}`} />
                            </button>
                            <span className={`text-xs font-black ${config.enabled ? 'text-emerald-400' : 'text-gray-500'}`}>{config.enabled ? 'ON' : 'OFF'}</span>
                        </div>
                        <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black transition-all">
                            {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save</>}
                        </button>
                    </div>
                </div>
                {!config.enabled && (
                    <div className="mt-3 bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-2 text-amber-300 text-xs font-bold">
                        ⚠️ Tax collection is OFF — invoices will not include tax. This is optional.
                    </div>
                )}
            </div>

            <div className="flex gap-2 flex-wrap">
                {[{id:'setup',label:'⚙️ Setup & Provider'},{id:'calculator',label:'🧮 Tax Calculator'},{id:'nexus',label:`🗺️ Nexus States (${config.nexus_states.length})`},{id:'rates',label:`💾 Cached Rates (${Object.keys(cachedRates).length})`}].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'setup' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Tax Provider — Choose One</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div onClick={() => upd('provider', 'manual')} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${config.provider==='manual' ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">📝</span>
                                    <div><p className="text-sm font-black text-gray-900">Manual Rate</p><p className="text-[10px] text-gray-400">Set a fixed % — no API needed</p></div>
                                    {config.provider==='manual' && <Check size={16} className="text-blue-600 ml-auto" />}
                                </div>
                                {config.provider==='manual' && (
                                    <div onClick={e => e.stopPropagation()}>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Default Tax Rate (%)</label>
                                        <input type="number" step="0.001" value={config.default_rate} onChange={e => upd('default_rate', parseFloat(e.target.value)||0)}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-400" />
                                        <p className="text-[10px] text-gray-400 mt-1">NYC combined = 8.875% · NJ = 6.625%</p>
                                    </div>
                                )}
                            </div>
                            <div onClick={() => upd('provider', 'taxjar')} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${config.provider==='taxjar' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-100 hover:border-gray-200'}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">🏦</span>
                                    <div><p className="text-sm font-black text-gray-900">TaxJar API</p><p className="text-[10px] text-gray-400">Real-time rates for every US ZIP code</p></div>
                                    {config.provider==='taxjar' && <Check size={16} className="text-emerald-600 ml-auto" />}
                                </div>
                                {config.provider==='taxjar' && (
                                    <div className="space-y-3" onClick={e => e.stopPropagation()}>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[10px] font-black text-gray-500 uppercase">TaxJar API Key</label>
                                                <a href="https://app.taxjar.com/api_sign_up" target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1">Free Key <ExternalLink size={9} /></a>
                                            </div>
                                            <input type="password" value={config.taxjar_api_key} onChange={e => upd('taxjar_api_key', e.target.value)}
                                                placeholder="Enter TaxJar API key..."
                                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                                        </div>
                                        <button onClick={testTaxJar} disabled={testLoading} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs font-black rounded-xl hover:bg-gray-700 disabled:opacity-50">
                                            {testLoading ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />} Test Connection
                                        </button>
                                        {testResult && <p className={`text-xs font-bold px-3 py-2 rounded-lg ${testResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{testResult}</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Your Business Location</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Your State</label>
                                <select value={config.company_state} onChange={e => upd('company_state', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                                    {US_STATES.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Your ZIP Code</label>
                                <input value={config.company_zip} onChange={e => upd('company_zip', e.target.value)} placeholder="12201" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Oil Product Tax Code</label>
                                <input value={config.product_tax_code} onChange={e => upd('product_tax_code', e.target.value)} placeholder="19005" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none" />
                                <p className="text-[9px] text-gray-400 mt-1">TaxJar code 19005 = Lubricating Oils</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Options</p>
                        {[{k:'apply_to_invoices',l:'Apply tax to Invoices'},{k:'apply_to_quotes',l:'Apply tax to Quotations'},{k:'tax_inclusive',l:'Prices include tax'},{k:'exemption_enabled',l:'Allow tax-exempt customers'}].map(r => (
                            <div key={r.k} className="flex items-center justify-between py-3 border-b border-gray-50">
                                <span className="text-sm font-bold text-gray-800">{r.l}</span>
                                <button onClick={() => upd(r.k as keyof TaxConfig, !config[r.k as keyof TaxConfig])}
                                    className={`relative w-10 h-5 rounded-full transition-all ${config[r.k as keyof TaxConfig] ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${config[r.k as keyof TaxConfig] ? 'left-5' : 'left-0.5'}`} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                        <div className="flex items-start gap-3">
                            <Shield size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-blue-800 space-y-1">
                                <p className="font-black text-sm mb-2">NYC Oil Distributor Tax Info</p>
                                <p>• <strong>NYC combined rate:</strong> 8.875% (4% state + 4.5% city + 0.375% MTA)</p>
                                <p>• <strong>Lubricating oils (code 19005):</strong> Generally taxable in most US states</p>
                                <p>• <strong>B2B resale exemptions:</strong> Businesses with NY ST-121 may be exempt</p>
                                <p>• <strong>TaxJar free tier:</strong> 200 API calls/month — enough for small distributors</p>
                                <a href="https://app.taxjar.com/api_sign_up" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">→ Get TaxJar free account</a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'calculator' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Calculate Tax for Any Amount</p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Amount ($)</label>
                                <input type="number" value={calcAmount} onChange={e => setCalcAmount(e.target.value)} placeholder="e.g. 5000"
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Customer State</label>
                                <select value={calcState} onChange={e => setCalcState(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                                    {US_STATES.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Customer ZIP</label>
                                <input value={calcZip} onChange={e => setCalcZip(e.target.value)} placeholder="10001" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none" />
                            </div>
                            <div className="flex items-end">
                                <button onClick={runCalc} disabled={calcLoading||!calcAmount} className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 disabled:opacity-50 transition-all">
                                    {calcLoading ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />} Calculate
                                </button>
                            </div>
                        </div>
                        {calcResult && (
                            <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    {[{l:'Sale Amount',v:formatCurrency(parseFloat(calcAmount)),c:'text-gray-900'},{l:`Tax Rate (${calcResult.rate.toFixed(3)}%)`,v:formatCurrency(calcResult.amount),c:calcResult.amount > 0 ? 'text-red-600' : 'text-gray-400'},{l:'Total Due',v:formatCurrency(calcResult.total),c:'text-emerald-600 text-xl'},{l:'Source',v:calcResult.source==='taxjar'?'TaxJar Live':calcResult.source==='cache'?'Cached':calcResult.source==='no_nexus_info'?'No Nexus (info only)':'Manual Rate',c:'text-blue-600 text-xs'}].map((m,i) => (
                                        <div key={i}><p className="text-[10px] font-black text-gray-400 uppercase mb-1">{m.l}</p><p className={`font-black ${m.c}`}>{m.v}</p></div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Common State Rates</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 max-h-80 overflow-y-auto">
                            {Object.entries(COMMON_RATES).sort(([a],[b])=>a.localeCompare(b)).map(([s,r]) => (
                                <div key={s} className={`flex justify-between px-3 py-2 rounded-lg text-sm ${config.nexus_states.includes(s)?'bg-emerald-50 border border-emerald-200':r===0?'bg-gray-50 opacity-50':'bg-gray-50'}`}>
                                    <span className="font-black text-gray-800">{s}</span>
                                    <span className={`font-mono font-bold ${config.nexus_states.includes(s)?'text-emerald-700':r===0?'text-gray-400':'text-gray-600'}`}>{r===0?'0%':r+'%'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'nexus' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex items-start gap-3 mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800"><strong>Nexus</strong> = states where you must collect tax (physical presence or $100K+ sales). Start with NY only.</p>
                        </div>
                        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                            {US_STATES.map(s => {
                                const active = config.nexus_states.includes(s);
                                return (
                                    <button key={s} onClick={() => upd('nexus_states', active ? config.nexus_states.filter(x=>x!==s) : [...config.nexus_states,s])}
                                        className={`py-2 text-xs font-black rounded-xl transition-all ${active?'bg-emerald-600 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                        {s}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Active Nexus — Tax Rates</p>
                        {nexusRates.map(nr => (
                            <div key={nr.state} className="flex justify-between px-4 py-3 mb-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                                <span className="font-black text-gray-900">{nr.state}</span>
                                <span className="font-mono font-black text-emerald-700">{nr.rate}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'rates' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {Object.keys(cachedRates).length === 0 ? (
                        <div className="p-12 text-center text-gray-400">No cached rates. Use the calculator to look up ZIP codes.</div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>{['ZIP','State','Combined Rate','Fetched'].map(h=><th key={h} className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {Object.entries(cachedRates).map(([zip, rate]:any) => (
                                    <tr key={zip} className="hover:bg-gray-50">
                                        <td className="px-5 py-3 font-mono font-black text-gray-900">{zip}</td>
                                        <td className="px-5 py-3 font-bold text-gray-700">{rate.state}</td>
                                        <td className="px-5 py-3 font-black text-blue-600 font-mono">{rate.combined_rate?.toFixed(3)}%</td>
                                        <td className="px-5 py-3 text-xs text-gray-400">{rate.fetched_at ? new Date(rate.fetched_at).toLocaleString() : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
