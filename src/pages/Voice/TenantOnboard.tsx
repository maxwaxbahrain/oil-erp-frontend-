// TenantOnboard — platform-admin tool for spinning up a new tenant.
// Calls POST /api/tenants/onboard with X-Platform-Admin-Key header.
// The admin key is NEVER persisted — it's typed in fresh each session
// per the Q4 decision (Phase 6 spec). The minted tenant API key IS
// shown ONCE; the operator must copy it immediately.

import { useState } from 'react';
import { Building2, Loader2, CheckCircle2, AlertCircle, Copy, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import PasswordInput from '../../components/ui/PasswordInput';
import { onboardTenant, type TenantOnboardResponse } from '../../services/voiceService';

interface FormState {
    company_name: string;
    slug: string;
    plan: 'starter' | 'professional' | 'enterprise';
    country_code: string;
    admin_key: string;
}

const EMPTY: FormState = {
    company_name: '',
    slug: '',
    plan: 'starter',
    country_code: 'US',
    admin_key: '',
};

function slugify(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

export default function TenantOnboard() {
    const [form, setForm] = useState<FormState>(EMPTY);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<TenantOnboardResponse | null>(null);
    const [copied, setCopied] = useState(false);

    const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
        setForm((f) => {
            const next = { ...f, [k]: v };
            // auto-derive slug from company name until the user edits slug manually
            if (k === 'company_name' && (!f.slug || f.slug === slugify(f.company_name))) {
                next.slug = slugify(v as string);
            }
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.company_name.trim() || !form.slug.trim() || !form.admin_key.trim()) return;
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            const res = await onboardTenant(
                {
                    company_name: form.company_name.trim(),
                    slug: form.slug.trim(),
                    plan: form.plan,
                    country_code: form.country_code.trim().toUpperCase(),
                },
                form.admin_key.trim(),
            );
            setResult(res);
            // wipe the form admin key — never persist it
            setForm((f) => ({ ...f, admin_key: '' }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to onboard tenant');
        } finally {
            setBusy(false);
        }
    };

    const copyKey = async () => {
        if (!result?.api_key) return;
        try {
            await navigator.clipboard.writeText(result.api_key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };

    const startAnother = () => {
        setResult(null);
        setForm(EMPTY);
    };

    return (
        <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-redwood-primary/10 flex items-center justify-center">
                    <Building2 size={20} className="text-redwood-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main tracking-tight">Onboard Tenant</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium">
                        Platform-admin only. Creates a new Voice AI tenant + provisions an API key.
                    </p>
                </div>
            </div>

            {/* Admin key advisory */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-2">
                <ShieldCheck size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                    <p className="font-black uppercase tracking-widest text-[11px] mb-0.5">Security</p>
                    <p className="text-xs leading-relaxed">
                        Your platform admin key is never stored in the browser. Paste it for this single request — the form clears it after submit.
                    </p>
                </div>
            </div>

            {/* Result */}
            {result && (
                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-700" />
                        <h3 className="text-base font-black text-emerald-900 uppercase tracking-widest">Tenant Created</h3>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        <Field label="Tenant ID" value={result.id} mono />
                        <Field label="Slug" value={result.slug} mono />
                        <Field label="Company" value={result.company_name} />
                        <Field label="Plan" value={result.plan.toUpperCase()} />
                        <Field label="Telnyx number" value={result.telnyx_number || '— pending provision —'} mono />
                    </dl>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-900 mb-1">
                            API Key (shown once — copy now)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                readOnly
                                value={result.api_key}
                                className="flex-1 px-3 py-2 rounded-lg border border-emerald-300 bg-white font-mono text-xs text-emerald-900"
                            />
                            <button
                                type="button"
                                onClick={copyKey}
                                className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest hover:brightness-95 flex items-center gap-1"
                            >
                                <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                    {result.next_steps && (
                        <div className="rounded-lg bg-white border border-emerald-200 p-3 text-xs text-emerald-900">
                            <span className="text-[10px] font-black uppercase tracking-widest block mb-1">Next steps</span>
                            {result.next_steps}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={startAnother}
                        className="px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100"
                    >
                        Onboard another tenant
                    </button>
                </div>
            )}

            {/* Form */}
            {!result && (
                <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-redwood-border shadow-sm p-5 space-y-4">
                    {error && (
                        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 flex items-start gap-2">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Company name" required>
                            <input
                                type="text"
                                value={form.company_name}
                                onChange={(e) => update('company_name', e.target.value)}
                                required
                                placeholder="Acme Distribution"
                                className="w-full px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary"
                            />
                        </FormField>
                        <FormField label="Slug" required hint="lowercase, kebab-case identifier">
                            <input
                                type="text"
                                value={form.slug}
                                onChange={(e) => update('slug', slugify(e.target.value))}
                                required
                                placeholder="acme-distribution"
                                className="w-full px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary font-mono"
                            />
                        </FormField>
                        <FormField label="Plan" required>
                            <select
                                value={form.plan}
                                onChange={(e) => update('plan', e.target.value as FormState['plan'])}
                                className="w-full px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary bg-white"
                            >
                                <option value="starter">Starter</option>
                                <option value="professional">Professional</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </FormField>
                        <FormField label="Country code" required hint="ISO-3166 alpha-2 (US, AE, GB, …)">
                            <input
                                type="text"
                                value={form.country_code}
                                onChange={(e) => update('country_code', e.target.value.toUpperCase().slice(0, 2))}
                                required
                                maxLength={2}
                                placeholder="US"
                                className="w-full px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary font-mono uppercase"
                            />
                        </FormField>
                    </div>
                    <FormField label="Platform admin key" required hint="not stored — used for this request only">
                        <PasswordInput
                            value={form.admin_key}
                            onChange={(e) => update('admin_key', e.target.value)}
                            required
                            placeholder="••••••••••••"
                            className="w-full px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary font-mono"
                        />
                    </FormField>
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={busy}
                            className={clsx(
                                'px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white shadow-sm transition-all flex items-center gap-2',
                                busy ? 'bg-redwood-primary/60 cursor-wait' : 'bg-redwood-primary hover:brightness-95',
                            )}
                        >
                            {busy && <Loader2 size={14} className="animate-spin" />}
                            {busy ? 'Onboarding…' : 'Create Tenant'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-redwood-text-muted mb-1">
                {label}{required && <span className="text-redwood-brand ml-0.5">*</span>}
            </label>
            {children}
            {hint && <p className="text-[10px] text-redwood-text-muted mt-1">{hint}</p>}
        </div>
    );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <dt className="text-[10px] font-black uppercase tracking-widest text-emerald-900/70">{label}</dt>
            <dd className={clsx('text-sm text-emerald-900 truncate', mono && 'font-mono text-xs')} title={value}>{value}</dd>
        </div>
    );
}
