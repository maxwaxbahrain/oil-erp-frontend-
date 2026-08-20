// ─── STEP 10 — Expense Settings page ────────────────────────────────
// New route: /finance/expenses/settings
//
// Five sections per master prompt: Categories, Policies, Approval
// Rules, Mileage Rate, AI Settings.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Save, Settings as SettingsIcon, CheckCircle, AlertTriangle,
    Plus, Sparkles, Receipt, DollarSign, Tag,
} from 'lucide-react';
import {
    getExpenseCategories,
    getExpenseSettings, saveExpenseSettings,
    DEFAULT_SETTINGS,
    type ExpenseCategory, type ExpenseSettings,
} from '../../services/expenseService';

export default function ExpenseSettingsPage() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [settings, setSettings] = useState<ExpenseSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [savedFlash, setSavedFlash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refreshCategories = async () => {
        try {
            setCategories(await getExpenseCategories());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load categories.');
        }
    };

    useEffect(() => {
        void (async () => {
            try {
                await refreshCategories();
                setSettings(getExpenseSettings());
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        const onFocus = () => { void refreshCategories(); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, []);

    const flash = (msg: string) => {
        setSavedFlash(msg);
        setTimeout(() => setSavedFlash(null), 2500);
    };

    const handleSaveSettings = () => {
        try {
            saveExpenseSettings(settings);
            flash('✓ Settings saved.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed.');
        }
    };

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10 animate-in fade-in duration-300">
            <div>
                <button
                    onClick={() => navigate('/finance/expenses')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 transition-all"
                >
                    <ArrowLeft size={14} /> Back to Expenses
                </button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <SettingsIcon size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Expense Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Categories, policies, approval rules, mileage rate, AI feature toggles.</p>
                </div>
            </div>

            {savedFlash && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 shadow-sm">
                    <CheckCircle size={16} className="text-emerald-600" />
                    <p className="text-sm font-bold text-emerald-700">{savedFlash}</p>
                </div>
            )}
            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2 shadow-sm">
                    <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700">{error}</p>
                </div>
            )}

            {loading ? (
                <div className="bg-white p-10 rounded-2xl border border-gray-100 shadow-sm text-center text-sm text-gray-400">Loading…</div>
            ) : (
                <>
                {/* ── Section 1: Categories (Chart of Accounts) ── */}
                <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                            <Tag size={16} className="text-purple-600" />
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                                Expense Accounts ({categories.length})
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/finance/chart-of-accounts')}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1"
                        >
                            <Plus size={12} /> Manage in Chart of Accounts
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        Expense categories are driven by active expense-type accounts in your Chart of Accounts.
                        Add or edit accounts there — they appear automatically in the expense form.
                    </p>
                    {categories.length === 0 ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            No expense accounts yet.{' '}
                            <button type="button" onClick={() => navigate('/finance/chart-of-accounts')} className="underline font-bold">
                                Open Chart of Accounts
                            </button>{' '}
                            to create expense-type accounts.
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-2">
                            {categories.map(c => (
                                <div key={c.id} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 truncate" title={`${c.code} · ${c.name}`}>
                                    {c.code ? <span className="text-gray-400 font-mono mr-1">{c.code}</span> : null}
                                    {c.name}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Section 2: Policies ── */}
                <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <Receipt size={16} className="text-amber-600" />
                        <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Policy Rules</h2>
                    </div>

                    {/* Each rule: on/off toggle + threshold input */}
                    {[
                        { key: 'meal',    label: 'Meal max amount',            field: 'mealMaxAmount',            unit: '$',  step: 10 },
                        { key: 'receipt', label: 'Receipt required threshold', field: 'receiptRequiredThreshold', unit: '$',  step: 10 },
                        { key: 'late',    label: 'Late submission window',     field: 'lateSubmissionDays',       unit: 'days', step: 1 },
                        { key: 'round',   label: 'Round-number high threshold', field: 'roundNumberThreshold',    unit: '$',  step: 50 },
                    ].map(rule => {
                        type RuleField = 'mealMaxAmount' | 'receiptRequiredThreshold' | 'lateSubmissionDays' | 'roundNumberThreshold';
                        type RuleKey   = 'meal' | 'receipt' | 'late' | 'round';
                        const enabled = settings.policyRules.enabled[rule.key as RuleKey];
                        return (
                            <div key={rule.key} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enabled}
                                        onChange={e => setSettings(s => ({
                                            ...s,
                                            policyRules: { ...s.policyRules, enabled: { ...s.policyRules.enabled, [rule.key]: e.target.checked } },
                                        }))}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-xs font-bold text-gray-700">{rule.label}</span>
                                </label>
                                <div className="ml-auto flex items-center gap-1 text-xs">
                                    <span className="text-gray-500">{rule.unit}</span>
                                    <input
                                        type="number"
                                        step={rule.step}
                                        disabled={!enabled}
                                        value={settings.policyRules[rule.field as RuleField]}
                                        onChange={e => setSettings(s => ({
                                            ...s,
                                            policyRules: { ...s.policyRules, [rule.field]: Number(e.target.value) || 0 },
                                        }))}
                                        className="w-24 px-2 py-1 border border-gray-200 rounded-lg font-mono text-right focus:outline-none focus:border-gray-900 disabled:opacity-40"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </section>

                {/* ── Section 3: Approval Rules ── */}
                <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle size={16} className="text-emerald-600" />
                        <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Approval Rules</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <span className="text-xs font-bold text-gray-700">Auto-approve expenses under</span>
                        <span className="text-xs text-gray-500">$</span>
                        <input
                            type="number"
                            step="10"
                            value={settings.autoApproveThreshold}
                            onChange={e => setSettings(s => ({ ...s, autoApproveThreshold: Number(e.target.value) || 0 }))}
                            className="w-28 px-2 py-1 border border-gray-200 rounded-lg font-mono text-right focus:outline-none focus:border-gray-900"
                        />
                        <span className="text-[10px] text-gray-500 ml-2">Anything above this needs a manager.</span>
                    </div>
                </section>

                {/* ── Section 4: Mileage Rate ── */}
                <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <DollarSign size={16} className="text-blue-600" />
                        <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Mileage Rate</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <span className="text-xs font-bold text-gray-700">Default rate per km</span>
                        <span className="text-xs text-gray-500">$</span>
                        <input
                            type="number"
                            step="0.01"
                            value={settings.mileageRatePerKm}
                            onChange={e => setSettings(s => ({ ...s, mileageRatePerKm: Number(e.target.value) || 0 }))}
                            className="w-28 px-2 py-1 border border-gray-200 rounded-lg font-mono text-right focus:outline-none focus:border-gray-900"
                        />
                        <span className="text-[10px] text-gray-500 ml-2">Used as the default on the Mileage Tracker.</span>
                    </div>
                </section>

                {/* ── Section 5: AI Settings ── */}
                <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-violet-600" />
                        <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">AI Features</h2>
                    </div>
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        ⚠ Toggles are persisted, but the AI helpers themselves don't yet read these flags — they currently always run.  This UI is here so settings can be plumbed through in a future pass.
                    </p>
                    {[
                        { key: 'ocr',                label: 'Receipt OCR (STEP 2)' },
                        { key: 'categorization',     label: 'Smart Categorization (STEP 3)' },
                        { key: 'duplicateDetection', label: 'Duplicate Detection (STEP 4)' },
                        { key: 'bulkParser',         label: 'Bulk Upload Parser (STEP 6)' },
                        { key: 'nlReports',          label: 'NL Report Queries (STEP 9)' },
                        { key: 'mileageEstimator',   label: 'Mileage Distance Estimator (STEP 8)' },
                    ].map(f => {
                        type FeatureKey = keyof typeof settings.aiFeaturesEnabled;
                        const k = f.key as FeatureKey;
                        return (
                            <label key={f.key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                                <input
                                    type="checkbox"
                                    checked={settings.aiFeaturesEnabled[k]}
                                    onChange={e => setSettings(s => ({
                                        ...s,
                                        aiFeaturesEnabled: { ...s.aiFeaturesEnabled, [f.key]: e.target.checked },
                                    }))}
                                    className="w-4 h-4"
                                />
                                <span className="text-xs font-bold text-gray-700">{f.label}</span>
                            </label>
                        );
                    })}
                </section>

                {/* Save bar */}
                <div className="sticky bottom-3 bg-gray-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-widest text-white/60">Changes are not saved until you click Save.</span>
                    <button
                        onClick={handleSaveSettings}
                        className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2"
                    >
                        <Save size={14} /> Save Settings
                    </button>
                </div>
                </>
            )}
        </div>
    );
}
