import { useEffect, useState } from 'react';
import { PhoneCall, PhoneOff, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import {
    approveAgentTask,
    cancelAgentTask,
    createAgentTask,
    editAgentPlan,
    hangupAgentTask,
    listAgentTasks,
    setupStagingVoiceLine,
    type AgentTask,
} from '../../services/voiceService';

export interface AgentTranscriptLine {
    callId: string;
    role: string;
    text: string;
}

export interface OwnerQuestionBox {
    callId: string;
    functionId: string;
    question: string;
    timeoutSeconds: number;
}

interface Props {
    ownerQuestions: OwnerQuestionBox[];
    ownerAnswers: Record<string, string>;
    ownerSending: string | null;
    ownerError: string | null;
    onOwnerAnswerChange: (functionId: string, value: string) => void;
    onSendOwnerAnswer: (q: OwnerQuestionBox) => void;
    transcriptLines: AgentTranscriptLine[];
    onTaskUpdated?: (task: AgentTask) => void;
    liveTask?: AgentTask | null;
    onLineReady?: (apiKey: string, repId: number) => void;
}

export default function VoiceAgentPanel({
    ownerQuestions,
    ownerAnswers,
    ownerSending,
    ownerError,
    onOwnerAnswerChange,
    onSendOwnerAnswer,
    transcriptLines,
    liveTask,
    onLineReady,
}: Props) {
    const [phone, setPhone] = useState('');
    const [goal, setGoal] = useState('');
    const [tasks, setTasks] = useState<AgentTask[]>([]);
    const [selected, setSelected] = useState<AgentTask | null>(null);
    const [planDraft, setPlanDraft] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [setupBusy, setSetupBusy] = useState(false);
    const [setupNote, setSetupNote] = useState<string | null>(null);
    const [needsNewKey, setNeedsNewKey] = useState(false);

    const connectStagingLine = async (rotateKey: boolean) => {
        setSetupBusy(true);
        setSetupNote(null);
        try {
            const me = await api.get<{ id?: number }>('/api/auth/me');
            const repId = Number(me.data?.id);
            if (!Number.isFinite(repId) || repId <= 0) {
                setSetupNote('Your login has no numeric user id, so the dashboard cannot connect.');
                return;
            }
            const line = await setupStagingVoiceLine(rotateKey);
            if (!line.api_key) {
                setNeedsNewKey(true);
                setSetupNote(
                    'This line already has a key, and it cannot be shown again. Issue a new key to connect. The previous key will stop working.',
                );
                return;
            }
            onLineReady?.(line.api_key, repId);
            setNeedsNewKey(false);
            setSetupNote(`Connected ${line.telnyx_number}. The dashboard is using your login as rep ${repId}.`);
        } catch (e) {
            setSetupNote(e instanceof Error ? e.message : 'Could not set up the staging line');
        } finally {
            setSetupBusy(false);
        }
    };

    const loadTasks = async () => {
        try {
            const res = await listAgentTasks();
            setTasks(res.items);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load tasks');
        }
    };

    useEffect(() => {
        loadTasks();
    }, []);

    useEffect(() => {
        if (liveTask) {
            setSelected(liveTask);
            setPlanDraft(liveTask.plan_text);
            setTasks((prev) => [liveTask, ...prev.filter((t) => t.id !== liveTask.id)]);
        }
    }, [liveTask]);

    const run = async (fn: () => Promise<AgentTask | void>) => {
        setBusy(true);
        setError(null);
        try {
            const result = await fn();
            if (result) {
                setSelected(result);
                setPlanDraft(result.plan_text);
            }
            await loadTasks();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Request failed');
        } finally {
            setBusy(false);
        }
    };

    const current = selected || tasks[0] || null;

    return (
        <div className="bg-white rounded-xl border border-redwood-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-redwood-border flex items-center justify-between">
                <div>
                    <h3 className="text-[15px] font-black text-redwood-text-main">AI agent</h3>
                    <p className="text-[12px] text-redwood-text-muted font-medium">
                        Staging only. Draft a plan, approve to dial, hang up any time.
                    </p>
                </div>
                <button
                    onClick={loadTasks}
                    className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-redwood-text-muted"
                >
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>

            <div className="p-5 space-y-5">
                {error && <p className="text-sm text-rose-700">{error}</p>}

                <div className="rounded-xl border border-redwood-border bg-redwood-bg-light p-4 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">
                        Staging line +1 201 409 6065
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={setupBusy}
                            onClick={() => connectStagingLine(false)}
                            className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white bg-redwood-primary rounded-lg disabled:opacity-50"
                        >
                            {setupBusy ? 'Working…' : 'Set up staging line'}
                        </button>
                        {needsNewKey && (
                            <button
                                type="button"
                                disabled={setupBusy}
                                onClick={() => connectStagingLine(true)}
                                className="px-3 py-2 text-[11px] font-black uppercase tracking-widest border border-redwood-border rounded-lg disabled:opacity-50"
                            >
                                Issue a new key
                            </button>
                        )}
                    </div>
                    {setupNote && <p className="text-sm text-redwood-text-main">{setupNote}</p>}
                </div>

                <form
                    className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!phone.trim() || !goal.trim()) return;
                        run(() => createAgentTask({ phone_number: phone.trim(), goal: goal.trim() }));
                    }}
                >
                    <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1…"
                        className="px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary"
                    />
                    <input
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="Goal for this call"
                        className="px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary"
                    />
                    <button
                        type="submit"
                        disabled={busy || !phone.trim() || !goal.trim()}
                        className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white bg-redwood-primary rounded-lg disabled:opacity-50"
                    >
                        Draft plan
                    </button>
                </form>

                {current && (
                    <div className="space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">
                            {current.status} · {current.phone_number}
                        </p>
                        <textarea
                            value={planDraft}
                            onChange={(e) => setPlanDraft(e.target.value)}
                            rows={6}
                            className="w-full px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary"
                            disabled={current.status === 'calling'}
                        />
                        <div className="flex flex-wrap gap-2">
                            {current.status === 'draft' && (
                                <>
                                    <button
                                        disabled={busy}
                                        onClick={() => run(() => editAgentPlan(current.id, planDraft))}
                                        className="px-3 py-2 text-[11px] font-black uppercase tracking-widest border border-redwood-border rounded-lg"
                                    >
                                        Save plan
                                    </button>
                                    <button
                                        disabled={busy}
                                        onClick={() => run(() => approveAgentTask(current.id))}
                                        className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white bg-redwood-primary rounded-lg"
                                    >
                                        Approve & dial
                                    </button>
                                    <button
                                        disabled={busy}
                                        onClick={() => run(() => cancelAgentTask(current.id))}
                                        className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-rose-700"
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                            {current.status === 'calling' && (
                                <button
                                    disabled={busy}
                                    onClick={() => run(() => hangupAgentTask(current.id))}
                                    className="inline-flex items-center gap-1 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white bg-rose-600 rounded-lg"
                                >
                                    <PhoneOff size={12} /> Hang up
                                </button>
                            )}
                        </div>
                        {current.fail_reason && (
                            <p className="text-sm text-rose-700">Failed: {current.fail_reason}</p>
                        )}
                    </div>
                )}

                {ownerQuestions.length > 0 && (
                    <div className="space-y-3">
                        {ownerQuestions.map((q) => (
                            <div key={q.functionId} className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                                    Agent needs you · {q.timeoutSeconds}s
                                </p>
                                <p className="text-sm font-medium text-redwood-text-main">{q.question}</p>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={ownerAnswers[q.functionId] || ''}
                                        onChange={(e) => onOwnerAnswerChange(q.functionId, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') onSendOwnerAnswer(q);
                                        }}
                                        placeholder="Type your answer for the caller"
                                        className="flex-1 px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm outline-none"
                                    />
                                    <button
                                        onClick={() => onSendOwnerAnswer(q)}
                                        disabled={ownerSending === q.functionId || !(ownerAnswers[q.functionId] || '').trim()}
                                        className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white bg-redwood-primary rounded-lg disabled:opacity-50"
                                    >
                                        {ownerSending === q.functionId ? 'Sending…' : 'Send to caller'}
                                    </button>
                                </div>
                                {ownerError && <p className="text-xs text-rose-700">{ownerError}</p>}
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-redwood-text-muted mb-2">
                        Live transcript
                    </p>
                    {transcriptLines.length === 0 ? (
                        <p className="text-sm text-redwood-text-muted">No live agent speech yet.</p>
                    ) : (
                        <ul className="max-h-40 overflow-y-auto space-y-1 text-sm">
                            {transcriptLines.map((line, i) => (
                                <li key={`${line.callId}-${i}`}>
                                    <span className="font-black text-[11px] uppercase tracking-widest text-redwood-text-muted">
                                        {line.role}:
                                    </span>{' '}
                                    {line.text}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-redwood-text-muted mb-2">
                        Past tasks
                    </p>
                    {tasks.length === 0 ? (
                        <p className="text-sm text-redwood-text-muted">No agent tasks yet.</p>
                    ) : (
                        <ul className="divide-y divide-redwood-border">
                            {tasks.map((t) => (
                                <li key={t.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelected(t);
                                            setPlanDraft(t.plan_text);
                                        }}
                                        className="w-full text-left py-3 flex items-start gap-2 hover:bg-redwood-bg-light"
                                    >
                                        <PhoneCall size={14} className="mt-1 text-redwood-primary shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-redwood-text-main truncate">
                                                {t.phone_number} · {t.status}
                                            </p>
                                            <p className="text-[12px] text-redwood-text-muted truncate">{t.goal}</p>
                                            {t.result_summary && (
                                                <p className="text-[12px] text-redwood-text-main mt-1">{t.result_summary}</p>
                                            )}
                                            {t.transcript && (
                                                <pre className="text-[11px] text-redwood-text-muted mt-1 whitespace-pre-wrap font-sans">
                                                    {t.transcript}
                                                </pre>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
