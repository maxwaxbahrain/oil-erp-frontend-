// CoachingRules — manage the keyword-triggered coaching suggestions
// the AI raises to the rep during live calls.
// CRUD against /api/voice/coaching-rules. Each rule has:
//   • rule_name (display only)
//   • trigger_keywords[]  — Claude scans the caller transcript for any match
//   • suggestion_text     — what the rep sees on screen
//   • active              — toggle without deleting

import { useEffect, useState } from 'react';
import {
    Brain, Plus, Trash2, Edit3, X, Check, RefreshCw, AlertCircle, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import {
    getCoachingRules, createCoachingRule, updateCoachingRule, deleteCoachingRule,
    type CoachingRule,
} from '../../services/voiceService';

interface DraftRule {
    rule_name: string;
    trigger_keywords: string; // comma-separated for the textarea
    suggestion_text: string;
}

const EMPTY_DRAFT: DraftRule = { rule_name: '', trigger_keywords: '', suggestion_text: '' };

export default function CoachingRules() {
    const [rules, setRules] = useState<CoachingRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<DraftRule>(EMPTY_DRAFT);
    const [showCreate, setShowCreate] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getCoachingRules(true);
            setRules(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load coaching rules');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const parseKeywords = (s: string): string[] =>
        s.split(',').map((k) => k.trim()).filter(Boolean);

    const handleCreate = async () => {
        if (!draft.rule_name.trim() || !draft.suggestion_text.trim()) return;
        const keywords = parseKeywords(draft.trigger_keywords);
        if (keywords.length === 0) {
            setError('At least one trigger keyword is required.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await createCoachingRule({
                rule_name: draft.rule_name.trim(),
                trigger_keywords: keywords,
                suggestion_text: draft.suggestion_text.trim(),
            });
            setDraft(EMPTY_DRAFT);
            setShowCreate(false);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create rule');
        } finally {
            setBusy(false);
        }
    };

    const handleStartEdit = (r: CoachingRule) => {
        setEditingId(r.id);
        setDraft({
            rule_name: r.rule_name,
            trigger_keywords: r.trigger_keywords.join(', '),
            suggestion_text: r.suggestion_text,
        });
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        const keywords = parseKeywords(draft.trigger_keywords);
        if (keywords.length === 0) {
            setError('At least one trigger keyword is required.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await updateCoachingRule(editingId, {
                rule_name: draft.rule_name.trim(),
                trigger_keywords: keywords,
                suggestion_text: draft.suggestion_text.trim(),
            });
            setEditingId(null);
            setDraft(EMPTY_DRAFT);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update rule');
        } finally {
            setBusy(false);
        }
    };

    const handleToggleActive = async (r: CoachingRule) => {
        setBusy(true);
        setError(null);
        try {
            await updateCoachingRule(r.id, { active: !r.active });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to toggle rule');
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (r: CoachingRule) => {
        if (!confirm(`Delete coaching rule "${r.rule_name}"? This cannot be undone.`)) return;
        setBusy(true);
        setError(null);
        try {
            await deleteCoachingRule(r.id);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete rule');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Coaching Rules</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium mt-1">
                        Tell the AI what hints to whisper to your reps during live calls.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-redwood-border hover:border-redwood-text-muted rounded-xl text-[11px] font-black uppercase tracking-widest text-redwood-text-main shadow-sm transition-all"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button
                        onClick={() => { setShowCreate(true); setDraft(EMPTY_DRAFT); }}
                        className="flex items-center gap-2 px-3 py-2 bg-redwood-primary text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:brightness-95"
                    >
                        <Plus size={12} /> New Rule
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Create form */}
            {showCreate && (
                <div className="bg-white rounded-xl border-2 border-redwood-primary/30 shadow-md p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[15px] font-black text-redwood-text-main">New Coaching Rule</h3>
                        <button
                            onClick={() => { setShowCreate(false); setDraft(EMPTY_DRAFT); }}
                            className="p-1 rounded text-redwood-text-muted hover:bg-redwood-bg-light"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <RuleFormFields draft={draft} onChange={setDraft} />
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={() => { setShowCreate(false); setDraft(EMPTY_DRAFT); }}
                            className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-redwood-text-muted hover:bg-redwood-bg-light rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={busy}
                            className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white bg-redwood-primary rounded-lg hover:brightness-95 disabled:opacity-50 flex items-center gap-1"
                        >
                            {busy && <Loader2 size={12} className="animate-spin" />}
                            Create Rule
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {rules.length === 0 && !loading ? (
                <div className="bg-white rounded-xl border border-redwood-border p-10 text-center">
                    <Brain size={32} className="mx-auto text-redwood-text-muted mb-3" />
                    <p className="text-sm text-redwood-text-muted">No coaching rules yet. Create one to start coaching your reps.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {rules.map((r) => (
                        <div
                            key={r.id}
                            className={clsx(
                                'bg-white rounded-xl border shadow-sm overflow-hidden transition-all',
                                r.active ? 'border-redwood-border' : 'border-redwood-border opacity-70',
                            )}
                        >
                            {editingId === r.id ? (
                                <div className="p-5 space-y-3">
                                    <RuleFormFields draft={draft} onChange={setDraft} />
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); }}
                                            className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-redwood-text-muted hover:bg-redwood-bg-light rounded-lg"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveEdit}
                                            disabled={busy}
                                            className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white bg-redwood-primary rounded-lg hover:brightness-95 disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {busy && <Loader2 size={12} className="animate-spin" />}
                                            Save
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-base font-black text-redwood-text-main truncate">{r.rule_name}</h4>
                                                <span className={clsx(
                                                    'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border',
                                                    r.active
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                        : 'bg-gray-50 border-gray-200 text-gray-500',
                                                )}>
                                                    {r.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-redwood-text-main leading-snug">{r.suggestion_text}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => handleToggleActive(r)}
                                                disabled={busy}
                                                title={r.active ? 'Deactivate' : 'Activate'}
                                                className="p-2 rounded-lg text-redwood-text-muted hover:bg-redwood-bg-light"
                                            >
                                                <Check size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleStartEdit(r)}
                                                disabled={busy}
                                                className="p-2 rounded-lg text-redwood-text-muted hover:bg-redwood-bg-light"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(r)}
                                                disabled={busy}
                                                className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {r.trigger_keywords.map((k, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-redwood-bg-light text-redwood-text-main border border-redwood-border"
                                            >
                                                {k}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function RuleFormFields({
    draft, onChange,
}: { draft: DraftRule; onChange: (d: DraftRule) => void }) {
    return (
        <>
            <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-redwood-text-muted mb-1">Rule name</label>
                <input
                    type="text"
                    value={draft.rule_name}
                    onChange={(e) => onChange({ ...draft, rule_name: e.target.value })}
                    placeholder='e.g. "Mention promo for hesitant customers"'
                    className="w-full px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary"
                />
            </div>
            <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-redwood-text-muted mb-1">
                    Trigger keywords <span className="normal-case font-medium text-redwood-text-muted/80">(comma-separated)</span>
                </label>
                <input
                    type="text"
                    value={draft.trigger_keywords}
                    onChange={(e) => onChange({ ...draft, trigger_keywords: e.target.value })}
                    placeholder="too expensive, can't afford, price"
                    className="w-full px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary font-mono"
                />
            </div>
            <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-redwood-text-muted mb-1">Suggestion (shown to rep)</label>
                <textarea
                    value={draft.suggestion_text}
                    onChange={(e) => onChange({ ...draft, suggestion_text: e.target.value })}
                    rows={3}
                    placeholder="Offer the bulk-buy 10% discount; mention free delivery on orders above 500."
                    className="w-full px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary resize-none"
                />
            </div>
        </>
    );
}
