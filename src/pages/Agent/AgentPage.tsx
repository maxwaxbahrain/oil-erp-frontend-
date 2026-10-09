import { useEffect, useState, type FormEvent } from 'react';
import { Bot, Send } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

type Step = {
    kind: string;
    name: string;
    input?: string;
    output?: string;
};

type Turn = {
    role: 'user' | 'agent';
    text: string;
    steps?: Step[];
};

type BriefingSettings = {
    enabled: boolean;
    send_time: string;
    recipients: string[];
};

function errorText(error: unknown, fallback: string): string {
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    return typeof detail === 'string' && detail.trim() ? detail : fallback;
}

export default function AgentPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [turns, setTurns] = useState<Turn[]>([]);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [chatError, setChatError] = useState('');
    const [briefing, setBriefing] = useState<BriefingSettings>({
        enabled: false,
        send_time: '07:00',
        recipients: [],
    });
    const [recipientText, setRecipientText] = useState('');
    const [briefingNote, setBriefingNote] = useState('');
    const [savingBriefing, setSavingBriefing] = useState(false);

    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;
        api.get<BriefingSettings>('/api/agent/briefing')
            .then((response) => {
                if (cancelled) return;
                setBriefing(response.data);
                setRecipientText((response.data.recipients || []).join('\n'));
            })
            .catch((error) => {
                if (!cancelled) setBriefingNote(errorText(error, 'The briefing settings could not be loaded.'));
            });
        return () => {
            cancelled = true;
        };
    }, [isAdmin]);

    async function onSend(event: FormEvent) {
        event.preventDefault();
        const text = message.trim();
        if (!text || sending) return;
        setMessage('');
        setChatError('');
        setTurns((current) => [...current, { role: 'user', text }]);
        setSending(true);
        try {
            const response = await api.post<{ answer: string; steps: Step[] }>(
                '/api/agent/chat',
                { message: text },
                { timeout: 70_000 },
            );
            setTurns((current) => [
                ...current,
                { role: 'agent', text: response.data.answer, steps: response.data.steps || [] },
            ]);
        } catch (error) {
            setChatError(errorText(error, 'The agent could not answer.'));
        } finally {
            setSending(false);
        }
    }

    async function saveBriefing(event: FormEvent) {
        event.preventDefault();
        setSavingBriefing(true);
        setBriefingNote('');
        const recipients = recipientText.split('\n').map((line) => line.trim()).filter(Boolean);
        try {
            const response = await api.put<BriefingSettings>('/api/agent/briefing', {
                enabled: briefing.enabled,
                send_time: briefing.send_time,
                recipients,
            });
            setBriefing(response.data);
            setRecipientText((response.data.recipients || []).join('\n'));
            setBriefingNote(response.data.enabled ? 'Morning briefing is on.' : 'Morning briefing is off.');
        } catch (error) {
            setBriefingNote(errorText(error, 'The briefing settings could not be saved.'));
        } finally {
            setSavingBriefing(false);
        }
    }

    async function sendTest() {
        setSavingBriefing(true);
        setBriefingNote('');
        try {
            const response = await api.post<{ sent_to: string }>('/api/agent/briefing/test', {}, { timeout: 70_000 });
            setBriefingNote(`Test briefing sent only to ${response.data.sent_to}.`);
        } catch (error) {
            setBriefingNote(errorText(error, 'The test briefing could not be sent.'));
        } finally {
            setSavingBriefing(false);
        }
    }

    return (
        <div className="mx-auto flex h-full max-w-3xl flex-col gap-6">
            <div>
                <div className="flex items-center gap-2 text-redwood-brand">
                    <Bot size={18} />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">SOLTOL ONE</span>
                </div>
                <h1 className="mt-1 text-2xl font-black text-redwood-text-main">AI Agent</h1>
                <p className="mt-1 text-sm text-redwood-text-muted">
                    Ask about sales, cash, stock, deliveries, and what is waiting for approval.
                </p>
            </div>

            {isAdmin && (
                <form onSubmit={saveBriefing} className="rounded-sm border border-redwood-border bg-redwood-bg-surface p-4">
                    <h2 className="text-sm font-black uppercase tracking-wide text-redwood-text-main">Morning briefing</h2>
                    <p className="mt-1 text-sm text-redwood-text-muted">
                        Off until you turn it on. A test send goes only to the email on your login.
                    </p>
                    <label className="mt-3 flex items-center gap-2 text-sm text-redwood-text-main">
                        <input
                            type="checkbox"
                            checked={briefing.enabled}
                            onChange={(event) => setBriefing((current) => ({ ...current, enabled: event.target.checked }))}
                        />
                        Send the morning briefing
                    </label>
                    <label className="mt-3 block text-sm text-redwood-text-muted">
                        Local send time
                        <input
                            className="mt-1 block rounded-sm border border-redwood-border bg-redwood-bg-light px-2 py-1 text-redwood-text-main"
                            value={briefing.send_time}
                            onChange={(event) => setBriefing((current) => ({ ...current, send_time: event.target.value }))}
                        />
                    </label>
                    <label className="mt-3 block text-sm text-redwood-text-muted">
                        Recipients, one email per line. Leave blank to use tenant admins.
                        <textarea
                            className="mt-1 block w-full rounded-sm border border-redwood-border bg-redwood-bg-light px-2 py-1 text-redwood-text-main"
                            rows={3}
                            value={recipientText}
                            onChange={(event) => setRecipientText(event.target.value)}
                        />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="submit"
                            disabled={savingBriefing}
                            className="rounded-sm bg-redwood-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                        >
                            Save briefing
                        </button>
                        <button
                            type="button"
                            disabled={savingBriefing}
                            onClick={sendTest}
                            className="rounded-sm border border-redwood-border px-3 py-2 text-sm font-bold text-redwood-text-main disabled:opacity-60"
                        >
                            Send me a test briefing now
                        </button>
                    </div>
                    {briefingNote && <p className="mt-2 text-sm text-redwood-text-main">{briefingNote}</p>}
                </form>
            )}

            <div className="flex min-h-[240px] flex-1 flex-col gap-4 overflow-y-auto">
                {turns.length === 0 && (
                    <p className="text-sm text-redwood-text-muted">Ask a question about this company.</p>
                )}
                {turns.map((turn, index) => (
                    <div key={`${turn.role}-${index}`} className="rounded-sm border border-redwood-border bg-redwood-bg-surface p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-redwood-text-muted">
                            {turn.role === 'user' ? 'You' : 'Agent'}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-redwood-text-main">{turn.text}</p>
                        {turn.steps && turn.steps.length > 0 && (
                            <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-redwood-text-muted">How I got this</summary>
                                <ul className="mt-2 space-y-2">
                                    {turn.steps.map((step, stepIndex) => (
                                        <li key={`${step.name}-${stepIndex}`} className="text-xs text-redwood-text-muted">
                                            <span className="font-bold text-redwood-text-main">{step.name}</span>
                                            {step.output ? ` — ${step.output}` : ''}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                ))}
                {sending && <p className="text-sm text-redwood-text-muted">Working…</p>}
                {chatError && <p className="text-sm text-brand-red">{chatError}</p>}
            </div>

            <form onSubmit={onSend} className="flex gap-2">
                <input
                    className="flex-1 rounded-sm border border-redwood-border bg-redwood-bg-surface px-3 py-2 text-sm text-redwood-text-main"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="What needs attention today?"
                    maxLength={4000}
                />
                <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="inline-flex items-center gap-2 rounded-sm bg-redwood-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                    <Send size={14} />
                    Send
                </button>
            </form>
        </div>
    );
}
