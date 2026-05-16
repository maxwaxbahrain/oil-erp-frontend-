// TaxEngine — landing page for the Tax Engine module.
//
// Session 1A (foundation): health badge + quick calculator + read-only rules.
// Session 1B: full CRUD for rules.
// Session 1C: tabs (Rules / Nexus), nexus CRUD, calculator enforces nexus.
// Session 1D: Providers tab + external-provider integration (TaxJar /
//   Avalara, stubbed). Provider-aware async calculator with fallback.
// Session 1E (this update): Exemptions tab + customer-aware calculator.
//   A valid certificate for (customer, jurisdiction) zeros out tax with
//   source='exempt', regardless of rule / state default / provider quote /
//   nexus status — the customer's exemption wins.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Plus, Edit2, Trash2, MapPin, Plug, FileCheck } from 'lucide-react';
import { HealthBadge } from './components/HealthBadge';
import { RuleForm } from './components/RuleForm';
import { NexusForm } from './components/NexusForm';
import { ProviderForm } from './components/ProviderForm';
import { ExemptionForm } from './components/ExemptionForm';
import {
    listTaxRules,
    createTaxRule,
    updateTaxRule,
    deleteTaxRule,
    listNexus,
    createNexus,
    updateNexus,
    deleteNexus,
    listProviderConfigs,
    saveProviderConfig,
    setActiveProvider,
    deleteProviderConfig,
    listExemptions,
    createExemption,
    updateExemption,
    deleteExemption,
    migrateLocalStorageToBackend,
} from './integrations/taxEngineApi';
import { calculateTax, calculateTaxWithProvider } from './engine';
import type { TaxComputation } from './engine';
import { TAX_ENGINE_VERSION, NEXUS_TYPE_LABELS, PROVIDERS, PROVIDER_BY_ID, EXEMPTION_TYPE_LABELS, EXEMPTION_ANY_JURISDICTION } from './data/constants';
import type { TaxRule, TaxNexus, TaxProviderConfig, ProviderId, TaxExemption } from './data/types';
import { formatCurrency } from '../../services/settingsService';

// Calculator was pulled out of the tab strip in Session 1C-fix because it's
// the primary thing users hit the Tax Engine for — keeping it tucked
// behind a tab as the *last* option meant users had to click through
// twice on first visit to see any calculation. It now lives above the
// tabs and is always visible.
type Tab = 'rules' | 'nexus' | 'providers' | 'exemptions';

// Static class lookup for provider chips — Tailwind v4 still does
// build-time class scanning, so `bg-${accent}-50` would be tree-shaken
// out and the chip would render unstyled. Listing the full class names
// here keeps them in the scanner's view.
const PROVIDER_ICON_CLASSES: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
};

export default function TaxEngine() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('rules');

    // Rules
    const [rules, setRules] = useState<TaxRule[]>([]);
    const [loadingRules, setLoadingRules] = useState(true);
    const [editingRule, setEditingRule] = useState<Partial<TaxRule> | null>(null);

    // Nexus
    const [nexusList, setNexusList] = useState<TaxNexus[]>([]);
    const [loadingNexus, setLoadingNexus] = useState(true);
    const [editingNexus, setEditingNexus] = useState<Partial<TaxNexus> | null>(null);

    // Providers (Session 1D) — external tax APIs (TaxJar / Avalara). Only one
    // is "active" at a time; activeProvider is the source of truth for the
    // calculator. providerConfigs holds saved configs for any provider the
    // user has set up (active or not).
    const [providerConfigs, setProviderConfigs] = useState<TaxProviderConfig[]>([]);
    const [editingProvider, setEditingProvider] = useState<(Partial<TaxProviderConfig> & { id: ProviderId }) | null>(null);

    // Exemptions (Session 1E) — customer-level certificates that zero out
    // tax for matching (customer, jurisdiction) tuples.
    const [exemptions, setExemptions] = useState<TaxExemption[]>([]);
    const [loadingExemptions, setLoadingExemptions] = useState(true);
    const [editingExemption, setEditingExemption] = useState<Partial<TaxExemption> | null>(null);

    const [flash, setFlash] = useState<string | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [demoAmount, setDemoAmount] = useState('1000');
    const [demoJurisdiction, setDemoJurisdiction] = useState('US-NY');
    const [demoCustomer, setDemoCustomer] = useState('');
    // Provider-aware calc is async, so the result lives in state instead of
    // being derived inline like in 1C. The effect below re-runs whenever
    // inputs change.
    const [result, setResult] = useState<TaxComputation>(() => calculateTax(1000, 'US-NY', []));
    const [calculating, setCalculating] = useState(false);

    const reloadRules = async () => {
        setLoadingRules(true);
        try { setRules(await listTaxRules()); }
        finally { setLoadingRules(false); }
    };
    const reloadNexus = async () => {
        setLoadingNexus(true);
        try { setNexusList(await listNexus()); }
        finally { setLoadingNexus(false); }
    };
    const reloadProviders = async () => {
        setProviderConfigs(await listProviderConfigs());
    };
    const reloadExemptions = async () => {
        setLoadingExemptions(true);
        try { setExemptions(await listExemptions()); }
        finally { setLoadingExemptions(false); }
    };

    useEffect(() => {
        // 1D-B / 1E-B cutover: if the user has provider configs or exemptions
        // sitting in localStorage from the pre-backend window, upload them
        // before we list — so the data they see is the same data they had
        // five minutes ago, just now backed by the database. The helper is
        // safe to call every load (in-memory flag + only-when-backend-empty
        // guard); it's just sequenced before the lists to avoid a flash of
        // "no providers / no exemptions" while migration runs.
        (async () => {
            await migrateLocalStorageToBackend();
            reloadRules();
            reloadNexus();
            reloadProviders();
            reloadExemptions();
        })();
        return () => {
            if (flashTimer.current) clearTimeout(flashTimer.current);
        };
    }, []);

    const activeProvider = providerConfigs.find(p => p.isActive) || null;

    const showFlash = (msg: string) => {
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlash(msg);
        flashTimer.current = setTimeout(() => setFlash(null), 4000);
    };

    // ─── Rule handlers ─────────────────────────────────────────────────
    const handleRuleSubmit = async (payload: Partial<TaxRule>): Promise<string | null> => {
        if (editingRule?.id) {
            const { rule, error } = await updateTaxRule(String(editingRule.id), payload);
            if (error || !rule) return error || 'Failed to update rule';
            setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
            showFlash(`✅ Updated rule: ${rule.jurisdiction} · ${rule.name}`);
        } else {
            const { rule, error } = await createTaxRule(payload);
            if (error || !rule) return error || 'Failed to create rule';
            setRules(prev => [rule, ...prev]);
            showFlash(`✅ Created rule: ${rule.jurisdiction} · ${rule.name}`);
        }
        setEditingRule(null);
        listTaxRules().then(fresh => { if (fresh.length > 0) setRules(fresh); });
        return null;
    };
    const handleRuleDelete = async (rule: TaxRule) => {
        if (!confirm(`Delete rule "${rule.name}" (${rule.jurisdiction})?`)) return;
        const { ok, error } = await deleteTaxRule(rule.id);
        if (!ok) { alert(`❌ ${error || 'Failed to delete'}`); return; }
        setRules(prev => prev.filter(r => r.id !== rule.id));
        showFlash(`🗑 Deleted rule: ${rule.jurisdiction} · ${rule.name}`);
    };
    const handleRuleToggleActive = async (rule: TaxRule) => {
        const { rule: updated, error } = await updateTaxRule(rule.id, { isActive: !rule.isActive });
        if (error || !updated) { alert(`❌ ${error || 'Failed to update'}`); return; }
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    };
    const openRuleEdit = (r: TaxRule) => {
        setEditingRule(r);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    };

    // ─── Nexus handlers ────────────────────────────────────────────────
    const handleNexusSubmit = async (payload: Partial<TaxNexus>): Promise<string | null> => {
        if (editingNexus?.id) {
            const { nexus, error } = await updateNexus(String(editingNexus.id), payload);
            if (error || !nexus) return error || 'Failed to update nexus';
            setNexusList(prev => prev.map(n => n.id === nexus.id ? nexus : n));
            showFlash(`✅ Updated nexus: ${nexus.jurisdiction}`);
        } else {
            const { nexus, error } = await createNexus(payload);
            if (error || !nexus) return error || 'Failed to create nexus';
            setNexusList(prev => [nexus, ...prev]);
            showFlash(`✅ Created nexus: ${nexus.jurisdiction}`);
        }
        setEditingNexus(null);
        listNexus().then(fresh => { if (fresh.length > 0) setNexusList(fresh); });
        return null;
    };
    const handleNexusDelete = async (n: TaxNexus) => {
        if (!confirm(`Delete nexus for ${n.jurisdiction}?`)) return;
        const { ok, error } = await deleteNexus(n.id);
        if (!ok) { alert(`❌ ${error || 'Failed to delete'}`); return; }
        setNexusList(prev => prev.filter(x => x.id !== n.id));
        showFlash(`🗑 Deleted nexus: ${n.jurisdiction}`);
    };
    const handleNexusToggleActive = async (n: TaxNexus) => {
        const { nexus, error } = await updateNexus(n.id, { isActive: !n.isActive });
        if (error || !nexus) { alert(`❌ ${error || 'Failed to update'}`); return; }
        setNexusList(prev => prev.map(x => x.id === nexus.id ? nexus : x));
    };
    const openNexusEdit = (n: TaxNexus) => {
        setEditingNexus(n);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    };

    // ─── Provider handlers (Session 1D) ────────────────────────────────
    const handleProviderSubmit = async (payload: TaxProviderConfig): Promise<string | null> => {
        // If the user is flipping this provider on, switch active to it
        // first so we don't briefly have two active providers in storage.
        if (payload.isActive) {
            await setActiveProvider(payload.id);
        }
        const { config, error } = await saveProviderConfig(payload);
        if (error || !config) return error || 'Failed to save provider';
        await reloadProviders();
        setEditingProvider(null);
        showFlash(`✅ Saved ${PROVIDER_BY_ID[config.id].label}${config.isActive ? ' (now active)' : ''}`);
        return null;
    };
    const handleProviderDelete = async (id: ProviderId) => {
        if (!confirm(`Remove ${PROVIDER_BY_ID[id].label} configuration?`)) return;
        await deleteProviderConfig(id);
        await reloadProviders();
        showFlash(`🗑 Removed ${PROVIDER_BY_ID[id].label}`);
    };
    const handleSetActive = async (id: ProviderId) => {
        await setActiveProvider(id);
        await reloadProviders();
        showFlash(`🔌 Active provider: ${PROVIDER_BY_ID[id].label}`);
    };
    const openProviderEdit = (cfg: TaxProviderConfig | { id: ProviderId }) => {
        setEditingProvider(cfg as Partial<TaxProviderConfig> & { id: ProviderId });
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    };

    // ─── Exemption handlers (Session 1E) ───────────────────────────────
    const handleExemptionSubmit = async (payload: Partial<TaxExemption>): Promise<string | null> => {
        if (editingExemption?.id) {
            const { exemption, error } = await updateExemption(String(editingExemption.id), payload);
            if (error || !exemption) return error || 'Failed to update exemption';
            setExemptions(prev => prev.map(x => x.id === exemption.id ? exemption : x));
            showFlash(`✅ Updated exemption: ${exemption.customerName || exemption.customerId} · ${exemption.jurisdiction}`);
        } else {
            const { exemption, error } = await createExemption(payload);
            if (error || !exemption) return error || 'Failed to create exemption';
            setExemptions(prev => [exemption, ...prev]);
            showFlash(`✅ Created exemption: ${exemption.customerName || exemption.customerId} · ${exemption.jurisdiction}`);
        }
        setEditingExemption(null);
        return null;
    };
    const handleExemptionDelete = async (x: TaxExemption) => {
        if (!confirm(`Delete exemption for "${x.customerName || x.customerId}" (${x.jurisdiction})?`)) return;
        await deleteExemption(x.id);
        setExemptions(prev => prev.filter(e => e.id !== x.id));
        showFlash(`🗑 Deleted exemption: ${x.customerName || x.customerId} · ${x.jurisdiction}`);
    };
    const handleExemptionToggleActive = async (x: TaxExemption) => {
        const { exemption, error } = await updateExemption(x.id, { isActive: !x.isActive });
        if (error || !exemption) { alert(`❌ ${error || 'Failed to update'}`); return; }
        setExemptions(prev => prev.map(e => e.id === exemption.id ? exemption : e));
    };
    const openExemptionEdit = (x: TaxExemption) => {
        setEditingExemption(x);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    };

    // Today's ISO date used to flag expired certs in the table.
    const todayISO = new Date().toISOString().slice(0, 10);
    const isCertExpired = (x: TaxExemption) => !!x.expiryDate && x.expiryDate < todayISO;

    const amt = parseFloat(demoAmount) || 0;

    // Provider-aware calc — re-runs whenever any input changes. Same nexus
    // gating as 1C: while loading we pass undefined so the amber / purple
    // banners don't flash before the registries have loaded.
    useEffect(() => {
        let cancelled = false;
        const effectiveNexus = loadingNexus ? undefined : nexusList;
        const effectiveExemptions = loadingExemptions ? undefined : exemptions;
        const cust = demoCustomer.trim() || undefined;

        // Fast path — no external provider, run the pure sync calc.
        if (!activeProvider) {
            setResult(calculateTax(amt, demoJurisdiction, rules, undefined, effectiveNexus, effectiveExemptions, cust));
            return;
        }

        // Slow path — provider takes ~250 ms (real or stubbed). Show a
        // lightweight "calculating" hint and update when the quote returns.
        setCalculating(true);
        calculateTaxWithProvider(amt, demoJurisdiction, rules, undefined, effectiveNexus, activeProvider, effectiveExemptions, cust)
            .then(r => { if (!cancelled) setResult(r); })
            .finally(() => { if (!cancelled) setCalculating(false); });

        return () => { cancelled = true; };
    }, [amt, demoJurisdiction, demoCustomer, rules, nexusList, loadingNexus, activeProvider, exemptions, loadingExemptions]);

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: 'rules', label: '📜 Rules', count: rules.length },
        { id: 'nexus', label: '📍 Nexus', count: nexusList.length },
        { id: 'providers', label: '🔌 Providers', count: providerConfigs.length },
        { id: 'exemptions', label: '📄 Exemptions', count: exemptions.length },
    ];

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Flash banner */}
            {flash && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-bold text-emerald-700 animate-in slide-in-from-top-2">
                    {flash}
                </div>
            )}

            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                            <Calculator size={22} className="text-orange-500" />
                            Tax Engine
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Module · version {TAX_ENGINE_VERSION}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <HealthBadge externalRuleCount={rules.length} />
                        {activeTab === 'rules' && (
                            <button
                                onClick={() => { setEditingRule({}); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0); }}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                            >
                                <Plus size={14} /> Add Rule
                            </button>
                        )}
                        {activeTab === 'nexus' && (
                            <button
                                onClick={() => { setEditingNexus({}); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0); }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                            >
                                <MapPin size={14} /> Add Nexus
                            </button>
                        )}
                        {activeTab === 'providers' && !editingProvider && (
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                Pick a provider below to configure
                            </span>
                        )}
                        {activeTab === 'exemptions' && (
                            <button
                                onClick={() => { setEditingExemption({}); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0); }}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                            >
                                <FileCheck size={14} /> Add Exemption
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Calculator — pinned at the top, ALWAYS visible.
                Was previously buried as the third (last) tab so users
                couldn't see any calculation result without two extra clicks
                on first visit. */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                        🧮 Quick Calculator
                    </h2>
                    <div className="flex items-center gap-2">
                        {activeProvider && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                                <Plug size={10} />
                                via {PROVIDER_BY_ID[activeProvider.id].label}
                                <span className="opacity-60">· {activeProvider.environment}</span>
                            </span>
                        )}
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {calculating ? 'calculating…' : 'live · re-runs as you type'}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Amount</label>
                        <input
                            type="number"
                            value={demoAmount}
                            onChange={e => setDemoAmount(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Jurisdiction</label>
                        <input
                            type="text"
                            value={demoJurisdiction}
                            onChange={e => setDemoJurisdiction(e.target.value)}
                            placeholder="e.g. US-NY"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Customer (optional)</label>
                        <input
                            type="text"
                            value={demoCustomer}
                            onChange={e => setDemoCustomer(e.target.value)}
                            placeholder="ID to check for exemption"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-purple-400"
                        />
                    </div>
                    <div className="flex flex-col justify-end">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Computed Tax</label>
                        <div className={`rounded-xl px-4 py-2.5 border ${
                            result.source === 'exempt' ? 'bg-purple-50 border-purple-200'
                                : result.source === 'no-nexus' ? 'bg-amber-50 border-amber-200'
                                : result.source === 'provider' ? 'bg-indigo-50 border-indigo-200'
                                : 'bg-orange-50 border-orange-200'
                        }`}>
                            <p className={`text-lg font-black font-mono ${
                                result.source === 'exempt' ? 'text-purple-700'
                                    : result.source === 'no-nexus' ? 'text-amber-700'
                                    : result.source === 'provider' ? 'text-indigo-700'
                                    : 'text-orange-700'
                            }`}>
                                {formatCurrency(result.taxAmount)}
                            </p>
                            <p className={`text-[10px] font-bold ${
                                result.source === 'exempt' ? 'text-purple-600'
                                    : result.source === 'no-nexus' ? 'text-amber-700'
                                    : result.source === 'provider' ? 'text-indigo-600'
                                    : 'text-orange-600'
                            }`}>
                                {result.rate.toFixed(3)}% · source: {result.source}
                                {result.providerId && result.source !== 'exempt' ? ` · ${PROVIDER_BY_ID[result.providerId].label}` : ''}
                                {result.matchedRule ? ` · ${result.matchedRule.name}` : ''}
                                {result.matchedExemption ? ` · ${result.matchedExemption.certificateNumber}` : ''}
                            </p>
                        </div>
                    </div>
                </div>
                {result.source === 'no-nexus' && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs font-bold text-amber-700">
                        ⚠️ No active nexus on file for <strong>{demoJurisdiction.toUpperCase()}</strong> —{' '}
                        {result.providerId
                            ? <>{PROVIDER_BY_ID[result.providerId].label} quoted <strong>{result.rate.toFixed(3)}%</strong></>
                            : <>a rule rated <strong>{result.rate.toFixed(3)}%</strong> would have applied</>}
                        {' '}but tax is suppressed. Add an active nexus on the <strong>Nexus</strong> tab to start collecting.
                    </div>
                )}
                {result.providerFallbackReason && (
                    <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs font-bold text-rose-700">
                        ⚠️ {activeProvider ? PROVIDER_BY_ID[activeProvider.id].label : 'Provider'} quote failed — <em>{result.providerFallbackReason}</em>. Falling back to internal engine.
                    </div>
                )}
                {result.source === 'exempt' && result.matchedExemption && (
                    <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-xs font-bold text-purple-700">
                        📄 Customer <strong>{result.matchedExemption.customerName || result.matchedExemption.customerId}</strong> holds an active{' '}
                        <strong>{EXEMPTION_TYPE_LABELS[result.matchedExemption.exemptionType]}</strong>
                        {' '}(<span className="font-mono">{result.matchedExemption.certificateNumber}</span>)
                        {' '}for <strong>{result.matchedExemption.jurisdiction === EXEMPTION_ANY_JURISDICTION ? 'any jurisdiction' : result.matchedExemption.jurisdiction}</strong>.
                        Tax of <strong>{result.rate.toFixed(3)}%</strong> suppressed.
                        {result.matchedExemption.expiryDate ? ` Expires ${result.matchedExemption.expiryDate}.` : ''}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === t.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                        {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
                    </button>
                ))}
            </div>

            {/* Rule editor */}
            {activeTab === 'rules' && editingRule !== null && (
                <RuleForm initial={editingRule} onSubmit={handleRuleSubmit} onCancel={() => setEditingRule(null)} />
            )}

            {/* Nexus editor */}
            {activeTab === 'nexus' && editingNexus !== null && (
                <NexusForm initial={editingNexus} onSubmit={handleNexusSubmit} onCancel={() => setEditingNexus(null)} />
            )}

            {/* Provider editor */}
            {activeTab === 'providers' && editingProvider !== null && (
                <ProviderForm initial={editingProvider} onSubmit={handleProviderSubmit} onCancel={() => setEditingProvider(null)} />
            )}

            {/* Exemption editor */}
            {activeTab === 'exemptions' && editingExemption !== null && (
                <ExemptionForm initial={editingExemption} onSubmit={handleExemptionSubmit} onCancel={() => setEditingExemption(null)} />
            )}

            {/* ───── Rules tab ───── */}
            {activeTab === 'rules' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                        <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                            Configured Rules · {rules.length}
                        </p>
                    </div>
                    {loadingRules ? (
                        <div className="p-12 text-center text-gray-400 font-bold">Loading…</div>
                    ) : rules.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-gray-400 font-bold uppercase text-sm">No tax rules configured yet</p>
                            <p className="text-gray-300 text-xs mt-1">Click <strong>Add Rule</strong> to create the first one.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Jurisdiction', 'Name', 'Type', 'Rate', 'Category', 'Active', 'Actions'].map(h => (
                                        <th key={h} className={`px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {rules.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50 group">
                                        <td className="px-5 py-3 text-sm font-bold text-gray-900 font-mono">{r.jurisdiction}</td>
                                        <td className="px-5 py-3 text-sm text-gray-700">{r.name}</td>
                                        <td className="px-5 py-3">
                                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{r.taxType}</span>
                                        </td>
                                        <td className="px-5 py-3 text-sm font-mono font-bold text-orange-600">{r.rate.toFixed(3)}%</td>
                                        <td className="px-5 py-3 text-xs text-gray-500">{r.productCategory || '—'}</td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => handleRuleToggleActive(r)}
                                                className={`relative w-9 h-5 rounded-full transition-all ${r.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                title={r.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                                            >
                                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${r.isActive ? 'left-4' : 'left-0.5'}`} />
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openRuleEdit(r)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700" title="Edit rule">
                                                    <Edit2 size={13} />
                                                </button>
                                                <button onClick={() => handleRuleDelete(r)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600" title="Delete rule">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ───── Nexus tab ───── */}
            {activeTab === 'nexus' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                            Nexus Registry · {nexusList.length}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Tax is only collected in jurisdictions with an <strong>active</strong> nexus. Even if a rule exists, no-nexus jurisdictions produce \$0 tax.
                        </p>
                    </div>
                    {loadingNexus ? (
                        <div className="p-12 text-center text-gray-400 font-bold">Loading…</div>
                    ) : nexusList.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-gray-400 font-bold uppercase text-sm">No nexus configured yet</p>
                            <p className="text-gray-300 text-xs mt-1">Click <strong>Add Nexus</strong> to record where you have an obligation to collect tax.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Jurisdiction', 'Type', 'Established', 'Threshold', 'Notes', 'Active', 'Actions'].map(h => (
                                        <th key={h} className={`px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {nexusList.map(n => (
                                    <tr key={n.id} className="hover:bg-gray-50 group">
                                        <td className="px-5 py-3 text-sm font-bold text-gray-900 font-mono">{n.jurisdiction}</td>
                                        <td className="px-5 py-3">
                                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{NEXUS_TYPE_LABELS[n.nexusType] || n.nexusType}</span>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-500 font-mono">{n.establishedDate || '—'}</td>
                                        <td className="px-5 py-3 text-xs text-gray-600 font-mono">
                                            {n.thresholdAmount != null ? formatCurrency(n.thresholdAmount) : '—'}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-500 max-w-[200px] truncate">{n.notes || '—'}</td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => handleNexusToggleActive(n)}
                                                className={`relative w-9 h-5 rounded-full transition-all ${n.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                title={n.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                                            >
                                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${n.isActive ? 'left-4' : 'left-0.5'}`} />
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openNexusEdit(n)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700" title="Edit nexus">
                                                    <Edit2 size={13} />
                                                </button>
                                                <button onClick={() => handleNexusDelete(n)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600" title="Delete nexus">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ───── Providers tab (Session 1D) ───── */}
            {activeTab === 'providers' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                            External Tax Providers
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Choose where the calculator gets its rates. The <strong>Internal Engine</strong> uses your configured rules + US state defaults. <strong>TaxJar</strong> and <strong>Avalara</strong> would normally call external APIs — they currently return stubbed quotes so you can see the integration flow without real API keys. Configurations are saved to your database and sync across devices.
                        </p>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {PROVIDERS.map(meta => {
                            const cfg = providerConfigs.find(c => c.id === meta.id);
                            const isInternal = meta.id === 'internal';
                            const isActive = isInternal ? !activeProvider : !!cfg?.isActive;
                            const isConfigured = isInternal || !!cfg;

                            return (
                                <div key={meta.id} className="p-5 flex items-center justify-between gap-4 flex-wrap hover:bg-gray-50">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center ${PROVIDER_ICON_CLASSES[meta.accent] || PROVIDER_ICON_CLASSES.gray}`}>
                                            <Plug size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-black text-gray-900">{meta.label}</p>
                                                {isActive && (
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                                                        Active
                                                    </span>
                                                )}
                                                {meta.mocked && (
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                                                        Stub
                                                    </span>
                                                )}
                                                {cfg && (
                                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                                        {cfg.environment}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{meta.blurb}</p>
                                            {cfg?.lastSyncedAt && (
                                                <p className="text-[10px] text-gray-400 mt-1">
                                                    Last tested {new Date(cfg.lastSyncedAt).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {!isInternal && !isConfigured && (
                                            <button
                                                onClick={() => openProviderEdit({ id: meta.id })}
                                                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                                            >
                                                Configure
                                            </button>
                                        )}
                                        {!isInternal && isConfigured && (
                                            <>
                                                {!isActive && (
                                                    <button
                                                        onClick={() => handleSetActive(meta.id)}
                                                        className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                                                    >
                                                        Set Active
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => cfg && openProviderEdit(cfg)}
                                                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700"
                                                    title="Edit provider"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleProviderDelete(meta.id)}
                                                    className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600"
                                                    title="Remove configuration"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                        {isInternal && !isActive && (
                                            <button
                                                onClick={() => handleSetActive('internal')}
                                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                                            >
                                                Set Active
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ───── Exemptions tab (Session 1E) ───── */}
            {activeTab === 'exemptions' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                            Exemption Certificates · {exemptions.length}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Customers with an <strong>active</strong>, non-expired certificate matching the jurisdiction (or <code className="font-mono">*</code> for any) pay <strong>$0 tax</strong>, regardless of rule / nexus / provider quote. Enter a customer in the calculator above to see suppression in action.
                        </p>
                    </div>
                    {loadingExemptions ? (
                        <div className="p-12 text-center text-gray-400 font-bold">Loading…</div>
                    ) : exemptions.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-gray-400 font-bold uppercase text-sm">No exemption certificates on file</p>
                            <p className="text-gray-300 text-xs mt-1">Click <strong>Add Exemption</strong> to record a customer's resale / nonprofit / govt cert.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Customer', 'Jurisdiction', 'Type', 'Cert #', 'Expires', 'Active', 'Actions'].map(h => (
                                        <th key={h} className={`px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {exemptions.map(x => {
                                    const expired = isCertExpired(x);
                                    return (
                                        <tr key={x.id} className="hover:bg-gray-50 group">
                                            <td className="px-5 py-3 text-sm text-gray-900">
                                                <div className="font-bold">{x.customerName || x.customerId}</div>
                                                {x.customerName && x.customerName !== x.customerId && (
                                                    <div className="text-[10px] text-gray-400 font-mono">{x.customerId}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-sm font-bold text-gray-900 font-mono">
                                                {x.jurisdiction === EXEMPTION_ANY_JURISDICTION
                                                    ? <span className="text-purple-600">* (any)</span>
                                                    : x.jurisdiction}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                                    {EXEMPTION_TYPE_LABELS[x.exemptionType] || x.exemptionType}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-xs text-gray-600 font-mono">{x.certificateNumber}</td>
                                            <td className="px-5 py-3 text-xs font-mono">
                                                {x.expiryDate ? (
                                                    <span className={expired ? 'text-rose-600 font-bold' : 'text-gray-500'}>
                                                        {x.expiryDate}{expired ? ' (expired)' : ''}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">never</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3">
                                                <button
                                                    onClick={() => handleExemptionToggleActive(x)}
                                                    className={`relative w-9 h-5 rounded-full transition-all ${x.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                    title={x.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                                                >
                                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${x.isActive ? 'left-4' : 'left-0.5'}`} />
                                                </button>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => openExemptionEdit(x)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700" title="Edit exemption">
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button onClick={() => handleExemptionDelete(x)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600" title="Delete exemption">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            <p className="text-xs text-gray-400 text-center">
                Tax Engine v{TAX_ENGINE_VERSION} · Sessions 1D-B + 1E-B: providers &amp; exemptions backend-persisted
            </p>
        </div>
    );
}
