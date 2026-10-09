import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, Copy, Package, Send, Users, X } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { AnswerBody } from './formatAnswer';
import {
    ERRORS,
    INVALID_EMAIL,
    MAILBOX_WARNING,
    SUGGESTIONS,
    VIOLET,
    cannotReceiveMail,
    firstName,
    isValidEmail,
    messageForFailure,
    presentAnswer,
    showMorningBriefing,
    showNewConversation,
    stepView,
} from './zavaCopy';

type Step = { kind: string; name: string; input?: string; output?: string };

type Turn = {
    id: number;
    role: 'user' | 'zava';
    text: string;
    steps?: Step[];
    at?: Date;
    error?: boolean;
};

type BriefingSettings = {
    enabled: boolean;
    send_time: string;
    recipients: string[];
    timezone?: string;
    timezone_label?: string;
};

const ICONS = {
    attention: AlertCircle,
    overdue: Clock,
    stock: Package,
    customers: Users,
} as const;

let turnId = 1;

function failureFromError(error: unknown): string {
    const err = error as { code?: string; message?: string; response?: { status?: number; data?: { detail?: string } } };
    const timedOut = err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '');
    const network = !err?.response;
    return messageForFailure({
        status: err?.response?.status,
        detail: err?.response?.data?.detail,
        network,
        timedOut,
    });
}

function ZavaOrb({ thinking, size }: { thinking?: boolean; size: number }) {
    return (
        <span className={thinking ? 'zava-orb zava-orb-thinking' : 'zava-orb'} style={{ width: size, height: size }} aria-hidden="true">
            <svg viewBox="0 0 64 64" width={size} height={size}>
                <defs>
                    <radialGradient id="zava-orb-fill" cx="38%" cy="32%" r="70%">
                        <stop offset="0%" stopColor="#F5F3FF" />
                        <stop offset="45%" stopColor={VIOLET} />
                        <stop offset="100%" stopColor="#6D28D9" />
                    </radialGradient>
                </defs>
                <circle cx="32" cy="32" r="22" fill="url(#zava-orb-fill)" />
                <circle cx="26" cy="24" r="6" fill="#FFFFFF" opacity="0.55" />
            </svg>
        </span>
    );
}

export default function AgentPage() {
    const { user } = useAuth();
    const isAdmin = showMorningBriefing(user?.role);
    const [turns, setTurns] = useState<Turn[]>([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [announcement, setAnnouncement] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [briefing, setBriefing] = useState<BriefingSettings>({ enabled: false, send_time: '07:00', recipients: [] });
    const [chipDraft, setChipDraft] = useState('');
    const [chipError, setChipError] = useState('');
    const [briefingNote, setBriefingNote] = useState('');
    const [savingBriefing, setSavingBriefing] = useState(false);
    const [saved, setSaved] = useState(false);
    const threadRef = useRef<HTMLDivElement>(null);
    const questionRef = useRef<HTMLTextAreaElement>(null);

    function resizeQuestion(node: HTMLTextAreaElement | null = questionRef.current) {
        if (!node) return;
        node.style.height = '24px';
        node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
    }

    useEffect(() => {
        if (!sending) return;
        setElapsed(0);
        const started = Date.now();
        const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
        return () => window.clearInterval(timer);
    }, [sending]);

    useEffect(() => {
        threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
    }, [turns, sending]);

    async function ask(text: string) {
        const question = text.trim();
        if (!question || sending) return;
        setDraft('');
        if (questionRef.current) questionRef.current.style.height = '24px';
        setTurns((current) => [...current, { id: turnId++, role: 'user', text: question, at: new Date() }]);
        setSending(true);
        setAnnouncement('Zava is looking this up');
        try {
            const response = await api.post<{ answer: string; steps: Step[] }>(
                '/api/agent/chat',
                { message: question },
                { timeout: 70_000 },
            );
            const answer = presentAnswer(response.data.answer || '');
            setTurns((current) => [...current, {
                id: turnId++,
                role: 'zava',
                text: answer,
                steps: response.data.steps || [],
                at: new Date(),
                error: answer === ERRORS.timeout || answer === ERRORS.limit || answer === ERRORS.off,
            }]);
            setAnnouncement(`Zava says ${answer}`);
        } catch (error) {
            const message = failureFromError(error);
            setTurns((current) => [...current, { id: turnId++, role: 'zava', text: message, at: new Date(), error: true }]);
            setAnnouncement(message);
        } finally {
            setSending(false);
        }
    }

    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!sending) void ask(draft);
        }
    }

    async function openBriefing() {
        setPanelOpen(true);
        setBriefingNote('');
        try {
            const response = await api.get<BriefingSettings>('/api/agent/briefing');
            setBriefing({ ...response.data, recipients: response.data.recipients || [] });
            setSaved(false);
        } catch (error) {
            setBriefingNote(failureFromError(error));
        }
    }

    function addChip(raw: string) {
        const email = raw.trim().replace(/,$/, '');
        if (!email) return;
        if (!isValidEmail(email)) {
            setChipError(INVALID_EMAIL);
            return;
        }
        setChipError('');
        setSaved(false);
        setBriefing((current) => (
            current.recipients.includes(email) ? current : { ...current, recipients: [...current.recipients, email] }
        ));
        setChipDraft('');
    }

    async function saveBriefing() {
        let recipients = briefing.recipients;
        const pending = chipDraft.trim();
        if (pending) {
            if (!isValidEmail(pending)) {
                setChipError(INVALID_EMAIL);
                return;
            }
            if (!recipients.includes(pending)) recipients = [...recipients, pending];
            setChipDraft('');
            setChipError('');
        }
        setSavingBriefing(true);
        setBriefingNote('');
        try {
            const response = await api.put<BriefingSettings>('/api/agent/briefing', {
                enabled: briefing.enabled,
                send_time: briefing.send_time,
                recipients,
            });
            setBriefing({ ...response.data, recipients: response.data.recipients || [] });
            setSaved(true);
            setBriefingNote('Saved');
        } catch (error) {
            const err = error as { response?: { data?: { detail?: string } } };
            setBriefingNote(err?.response?.data?.detail || 'The briefing could not be saved.');
        } finally {
            setSavingBriefing(false);
        }
    }

    async function sendTest() {
        setSavingBriefing(true);
        setBriefingNote('');
        try {
            const response = await api.post<{ sent_to: string }>('/api/agent/briefing/test', {}, { timeout: 70_000 });
            const address = response.data.sent_to;
            const warning = cannotReceiveMail(address) ? ` ${MAILBOX_WARNING}` : '';
            setBriefingNote(`Test briefing sent only to ${address}.${warning}`);
        } catch (error) {
            setBriefingNote(failureFromError(error));
        } finally {
            setSavingBriefing(false);
        }
    }

    const welcome = turns.length === 0;

    return (
        <div className="zava-page">
            <style>{`
                .zava-page {
                    box-sizing: border-box;
                    width: 100%;
                    max-width: 760px;
                    margin-left: auto;
                    margin-right: auto;
                    min-width: 0;
                    height: calc(100dvh - 64px - 38px - 40px - 24px - 72px);
                    padding: 0 16px 96px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                @media (min-width: 640px) {
                    .zava-page { height: calc(100dvh - 64px - 38px - 40px - 48px - 72px); }
                }
                @media (min-width: 768px) {
                    .zava-page { padding-left: 24px; padding-right: 24px; }
                }
                @media (min-width: 1024px) {
                    .zava-page { height: calc(100dvh - 64px - 38px - 40px - 80px); }
                }
                @media (min-width: 1328px) {
                    .zava-page { padding-bottom: 24px; }
                }
                .zava-orb { display: inline-flex; position: relative; z-index: 1; filter: drop-shadow(0 0 10px rgba(196,181,253,0.55)); }
                .zava-orb-thinking { animation: zava-glow 1.6s ease-in-out infinite; }
                @keyframes zava-glow { 50% { filter: drop-shadow(0 0 16px rgba(196,181,253,0.95)); transform: scale(1.05); } }
                .zava-spot {
                    position: absolute;
                    left: 50%;
                    top: 28px;
                    width: min(600px, 100%);
                    aspect-ratio: 1;
                    height: auto;
                    transform: translate(-50%, -50%);
                    background: radial-gradient(circle, rgba(196,181,253,0.45) 0%, rgba(196,181,253,0.14) 22%, rgba(196,181,253,0.03) 55%, transparent 100%);
                    pointer-events: none;
                }
                .zava-control:focus-visible:not(#zava-question) { outline: 2px solid #C4B5FD; outline-offset: 2px; }
                .zava-ask {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-radius: 16px;
                    background: var(--color-redwood-bg-surface);
                    padding: 16px 8px 16px 0;
                    box-shadow: 0 0 0 1px rgba(196,181,253,0.65), 0 0 18px rgba(196,181,253,0.22);
                }
                .zava-ask:focus-within {
                    box-shadow: 0 0 0 2px #C4B5FD, 0 0 28px rgba(196,181,253,0.45);
                }
                .zava-page textarea#zava-question,
                .zava-page textarea#zava-question:hover,
                .zava-page textarea#zava-question:focus,
                .zava-page textarea#zava-question:focus-visible,
                .zava-page textarea#zava-question:active {
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    resize: none !important;
                    border-style: none !important;
                    border-width: 0 !important;
                    border-radius: 0 !important;
                    outline: none !important;
                    outline-style: none !important;
                    outline-width: 0 !important;
                    outline-offset: 0 !important;
                    box-shadow: none !important;
                    background: transparent !important;
                    background-color: transparent !important;
                    margin: 0 !important;
                    padding: 0 0 0 16px !important;
                    box-sizing: border-box !important;
                    --tw-ring-shadow: 0 0 #0000;
                    --tw-ring-offset-shadow: 0 0 #0000;
                }
                .zava-card { transition: border-color 0.15s ease; }
                .zava-card:hover { border-color: rgba(238,242,255,0.38); }
                @media (prefers-reduced-motion: reduce) {
                    .zava-orb-thinking { animation: none; }
                    .zava-card { transition: none; }
                }
            `}</style>
            <div aria-live="polite" className="sr-only">{announcement}</div>
            <header className="flex h-11 shrink-0 items-center justify-end gap-2">
                {showNewConversation(turns.length) && (
                    <button type="button" className="zava-control h-9 rounded-lg border border-redwood-border px-3 text-sm text-redwood-text-main" onClick={() => { setTurns([]); setAnnouncement(''); }}>
                        New conversation
                    </button>
                )}
                {isAdmin && (
                    <button type="button" className="zava-control inline-flex h-9 items-center gap-2 rounded-lg border border-redwood-border px-3 text-sm text-redwood-text-main" onClick={() => void openBriefing()}>
                        <Clock size={16} />
                        Morning briefing
                    </button>
                )}
            </header>

            <div ref={threadRef} className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden ${welcome ? '' : 'gap-6 py-4'}`}>
                {welcome && (
                    <div className="flex min-h-full w-full items-center justify-center">
                    <div className="relative flex w-full flex-col items-center text-center">
                        <div className="zava-spot" aria-hidden="true" />
                        <div className="relative z-[1] flex h-14 w-14 items-center justify-center">
                            <ZavaOrb size={56} />
                        </div>
                        <p className="relative z-[1] mt-5 text-[15px] text-redwood-text-muted">Hi {firstName(user?.full_name)}, I'm Zava</p>
                        <h1 className="relative z-[1] mt-2 text-[28px] font-semibold leading-tight text-redwood-text-main sm:text-4xl" style={{ fontFamily: "'Syne', sans-serif" }}>
                            How can I help you today?
                        </h1>
                        <p className="relative z-[1] mx-auto mt-3 max-w-[520px] text-[15px] leading-6 text-redwood-text-muted" style={{ textWrap: 'balance' }}>
                            I look up your sales, cash, stock and deliveries. I never change your data.
                        </p>
                        <div className="relative z-[1] mt-10 grid w-full grid-cols-1 gap-3 min-[480px]:grid-cols-2 text-left">
                            {SUGGESTIONS.map((item) => {
                                const Icon = ICONS[item.id];
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        disabled={sending}
                                        onClick={() => void ask(item.question)}
                                        className="zava-control zava-card flex min-h-16 items-center gap-3 rounded-2xl border border-redwood-border bg-redwood-bg-surface p-4 text-left text-[15px] leading-5 text-redwood-text-main disabled:opacity-60"
                                    >
                                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(196,181,253,0.16)' }}>
                                            <Icon size={18} color={VIOLET} />
                                        </span>
                                        <span className="line-clamp-2">{item.question}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    </div>
                )}

                {!welcome && turns.map((turn) => (
                    turn.role === 'user' ? (
                        <div key={turn.id} className="flex justify-end">
                            <p className="max-w-[85%] rounded-2xl bg-redwood-row-bg px-4 py-2 text-[15px] leading-6 text-redwood-text-main">{turn.text}</p>
                        </div>
                    ) : (
                        <article key={turn.id} className="flex min-w-0 items-start gap-3">
                            <ZavaOrb size={28} />
                            <div className="min-w-0 flex-1">
                                {turn.error ? <p className="text-[15px] leading-6 text-redwood-text-main">{turn.text}</p> : <AnswerBody source={turn.text} />}
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-redwood-text-muted">
                                    <button
                                        type="button"
                                        className="zava-control inline-flex items-center gap-1"
                                        onClick={() => {
                                            void navigator.clipboard.writeText(turn.text).then(() => setCopiedId(turn.id));
                                        }}
                                    >
                                        <Copy size={12} /> {copiedId === turn.id ? 'Copied' : 'Copy'}
                                    </button>
                                    {turn.at && <time dateTime={turn.at.toISOString()}>{turn.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>}
                                </div>
                                {turn.steps && turn.steps.length > 0 && (
                                    <details className="mt-2">
                                        <summary className="zava-control cursor-pointer text-sm text-redwood-text-muted">How I got this</summary>
                                        <ul className="mt-2 space-y-1">
                                            {turn.steps.map((step, index) => {
                                                const view = stepView(step.name);
                                                return (
                                                    <li key={`${step.name}-${index}`} className="text-sm text-redwood-text-main">
                                                        {view.label}
                                                        {view.href && (
                                                            <>
                                                                {' · '}
                                                                <Link className="zava-control underline" to={view.href}>Open the page</Link>
                                                            </>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </details>
                                )}
                            </div>
                        </article>
                    )
                ))}

                {sending && (
                    <div className="flex items-center gap-3 text-sm text-redwood-text-muted">
                        <ZavaOrb thinking size={28} />
                        <p>Zava is looking this up{elapsed > 0 ? ` · ${elapsed} ${elapsed === 1 ? 'second' : 'seconds'}` : ''}</p>
                    </div>
                )}
            </div>

            <form
                className="shrink-0 pt-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    void ask(draft);
                }}
            >
                <div className="zava-ask">
                    <label className="sr-only" htmlFor="zava-question">Ask Zava</label>
                    <textarea
                        id="zava-question"
                        ref={questionRef}
                        rows={1}
                        value={draft}
                        disabled={sending}
                        maxLength={4000}
                        placeholder="Ask Zava about your business..."
                        onChange={(event) => {
                            setDraft(event.target.value);
                            resizeQuestion(event.target);
                        }}
                        onKeyDown={onKeyDown}
                        className="h-6 max-h-[120px] min-w-0 flex-1 overflow-y-auto text-[15px] leading-6 text-redwood-text-main placeholder:text-redwood-text-muted disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        aria-label="Send"
                        className="zava-control inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-redwood-brand text-white disabled:opacity-40"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </form>

            {panelOpen && (
                <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="zava-briefing-title">
                    <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close morning briefing" onClick={() => setPanelOpen(false)} />
                    <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-redwood-bg-surface p-5 text-redwood-text-main">
                        <div className="flex items-center justify-between">
                            <h2 id="zava-briefing-title" className="text-lg font-semibold">Morning briefing</h2>
                            <button type="button" className="zava-control" aria-label="Close" onClick={() => setPanelOpen(false)}><X size={18} /></button>
                        </div>
                        <p className="mt-2 text-sm text-redwood-text-muted">Off until you turn it on. A test goes only to the email on your login.</p>
                        <label className="mt-5 flex items-center justify-between gap-3 text-sm">
                            Send the morning briefing
                            <input
                                type="checkbox"
                                role="switch"
                                className="zava-control h-5 w-5"
                                checked={briefing.enabled}
                                onChange={(event) => { setSaved(false); setBriefing((current) => ({ ...current, enabled: event.target.checked })); }}
                            />
                        </label>
                        <label className="mt-4 block text-sm">
                            Send time
                            <span className="mt-1 block text-redwood-text-muted">{briefing.timezone_label || 'Company time'}</span>
                            <input
                                type="time"
                                value={briefing.send_time}
                                onChange={(event) => { setSaved(false); setBriefing((current) => ({ ...current, send_time: event.target.value })); }}
                                className="zava-control mt-2 rounded-xl border border-redwood-border bg-redwood-bg-light px-3 py-2 text-redwood-text-main"
                            />
                        </label>
                        <div className="mt-4">
                            <p className="text-sm">Recipients</p>
                            <p className="text-sm text-redwood-text-muted">Leave this empty to use tenant admins.</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {briefing.recipients.map((email) => (
                                    <span key={email} className="inline-flex items-center gap-1 rounded-full border border-redwood-border px-2 py-1 text-sm">
                                        {email}
                                        <button type="button" className="zava-control" aria-label={`Remove ${email}`} onClick={() => { setSaved(false); setBriefing((current) => ({ ...current, recipients: current.recipients.filter((item) => item !== email) })); }}>
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <input
                                value={chipDraft}
                                onChange={(event) => { setChipDraft(event.target.value); setChipError(''); }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ',') {
                                        event.preventDefault();
                                        addChip(chipDraft);
                                    }
                                }}
                                placeholder="Add an email"
                                className="zava-control mt-2 w-full rounded-xl border border-redwood-border bg-redwood-bg-light px-3 py-2 text-sm text-redwood-text-main"
                            />
                            {chipError && <p className="mt-1 text-sm text-brand-red">{chipError}</p>}
                        </div>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <button type="button" disabled={savingBriefing} className="zava-control rounded-full bg-redwood-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => void saveBriefing()}>
                                {saved ? 'Saved' : 'Save briefing'}
                            </button>
                            <button type="button" disabled={savingBriefing} className="zava-control rounded-full border border-redwood-border px-4 py-2 text-sm disabled:opacity-60" onClick={() => void sendTest()}>
                                Send me a test briefing
                            </button>
                        </div>
                        {briefingNote && <p className="mt-3 text-sm">{briefingNote}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
