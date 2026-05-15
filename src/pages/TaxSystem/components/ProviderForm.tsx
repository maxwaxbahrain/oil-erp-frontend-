// Reusable add/edit form for an external TaxProviderConfig (TaxJar /
// Avalara). Same inline-panel shape as RuleForm / NexusForm so the page
// feels consistent. "Internal Engine" is not editable here — it's the
// implicit fallback when no external provider is active.

import { useEffect, useState } from 'react';
import { Check, X, Wifi } from 'lucide-react';
import type { ProviderEnvironment, ProviderId, TaxProviderConfig } from '../data/types';
import { PROVIDER_BY_ID } from '../data/constants';
import { testConnection } from '../integrations/providerClient';

interface Props {
    initial: Partial<TaxProviderConfig> & { id: ProviderId };
    onSubmit: (payload: TaxProviderConfig) => Promise<string | null>;
    onCancel: () => void;
}

export function ProviderForm({ initial, onSubmit, onCancel }: Props) {
    const meta = PROVIDER_BY_ID[initial.id];
    const editing = !!initial.updatedAt;

    const [form, setForm] = useState({
        apiKey: initial.apiKey || '',
        environment: (initial.environment || 'sandbox') as ProviderEnvironment,
        isActive: initial.isActive ?? false,
    });
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setForm({
            apiKey: initial.apiKey || '',
            environment: (initial.environment || 'sandbox') as ProviderEnvironment,
            isActive: initial.isActive ?? false,
        });
        setTestResult(null);
        setError(null);
    }, [initial.id, initial.apiKey, initial.environment, initial.isActive]);

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const r = await testConnection({
                id: initial.id,
                apiKey: form.apiKey,
                environment: form.environment,
                isActive: true,
                updatedAt: new Date().toISOString(),
            });
            setTestResult(r.ok
                ? { ok: true, msg: `Connection OK · ${meta.label} ${form.environment}` }
                : { ok: false, msg: r.error || 'Connection failed' });
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = async () => {
        setError(null);
        if (!form.apiKey.trim()) { setError('API key is required'); return; }
        setSaving(true);
        try {
            const err = await onSubmit({
                id: initial.id,
                apiKey: form.apiKey.trim(),
                environment: form.environment,
                isActive: form.isActive,
                lastSyncedAt: testResult?.ok ? new Date().toISOString() : initial.lastSyncedAt,
                updatedAt: new Date().toISOString(),
            });
            if (err) setError(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-indigo-600 uppercase tracking-widest">
                    {editing ? `✏️ Edit ${meta.label}` : `➕ Configure ${meta.label}`}
                </h3>
                <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700">
                    <X size={16} />
                </button>
            </div>

            <p className="text-xs text-gray-500">
                {meta.blurb}
                {meta.mocked && (
                    <span className="ml-2 inline-block text-[10px] font-black uppercase px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                        stub
                    </span>
                )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">API Key *</label>
                    <input
                        type="text"
                        value={form.apiKey}
                        onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))}
                        placeholder={initial.id === 'taxjar' ? 'e.g. 5da2f5...' : 'Account number + license key'}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        Stored locally for now (Session 1D). Backend persistence lands in 1D-B.
                    </p>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Environment</label>
                    <select
                        value={form.environment}
                        onChange={e => setForm(p => ({ ...p, environment: e.target.value as ProviderEnvironment }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                    >
                        <option value="sandbox">Sandbox</option>
                        <option value="production">Production</option>
                    </select>
                </div>
                <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                            className="w-4 h-4 accent-indigo-600"
                        />
                        <span className="text-sm font-bold text-gray-700">
                            Use this provider for tax calculations
                        </span>
                    </label>
                </div>
            </div>

            {testResult && (
                <div className={`text-xs font-bold rounded-lg px-3 py-2 border ${testResult.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                    {testResult.ok ? '✅' : '❌'} {testResult.msg}
                </div>
            )}
            {error && (
                <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    ❌ {error}
                </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-xl text-sm font-black transition-all"
                >
                    <Check size={14} />
                    {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Save Provider')}
                </button>
                <button
                    onClick={handleTest}
                    disabled={testing || !form.apiKey.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 hover:bg-indigo-50 disabled:opacity-40 text-indigo-700 rounded-xl text-sm font-black transition-all"
                >
                    <Wifi size={14} />
                    {testing ? 'Testing…' : 'Test Connection'}
                </button>
                <button onClick={onCancel} className="px-4 py-2.5 text-sm font-black text-gray-500 hover:text-gray-800">
                    Cancel
                </button>
            </div>
        </div>
    );
}
