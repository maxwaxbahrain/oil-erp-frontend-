/**
 * Email Auto-Reply Agent — drafts professional replies to customer emails
 * using live ERP context via the backend API.
 *
 * Backend: POST /api/ai/email-reply/generate (and optional GET .../status)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Mail,
    RefreshCw,
    Copy,
    Check,
    Sparkles,
    Inbox,
    SendHorizonal,
} from 'lucide-react';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');

type Tone = 'professional' | 'friendly' | 'brief' | 'apologetic';

interface GenerateResponse {
    reply_subject?: string;
    reply_body?: string;
    reply?: string;
    subject?: string;
    model?: string;
}

const TONES: { id: Tone; label: string }[] = [
    { id: 'professional', label: 'Professional' },
    { id: 'friendly', label: 'Friendly' },
    { id: 'brief', label: 'Brief' },
    { id: 'apologetic', label: 'Apologetic' },
];

const SAMPLE_INCOMING = `Hi,

Can you send me a copy of invoice #INV-1042 and confirm when our last payment was applied? We're trying to close our books this week.

Thanks,
Sarah Chen
ABC Auto Parts`;

async function postGenerate(body: Record<string, unknown>): Promise<GenerateResponse> {
    const paths = ['/api/ai/email-reply/generate', '/api/ai/email-reply', '/ai/email-reply/generate', '/ai/email-reply'];
    let lastError = 'Email reply API not available';

    for (const path of paths) {
        const res = await fetch(`${API}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (res.status === 404) continue;
        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try {
                const err = (await res.json()) as { detail?: string };
                detail = err.detail || detail;
            } catch {
                /* ignore */
            }
            throw new Error(detail);
        }
        return (await res.json()) as GenerateResponse;
    }
    throw new Error(lastError);
}

export default function EmailReplyAgent() {
    const navigate = useNavigate();

    const [fromEmail, setFromEmail] = useState('');
    const [incomingSubject, setIncomingSubject] = useState('');
    const [incomingBody, setIncomingBody] = useState('');
    const [tone, setTone] = useState<Tone>('professional');
    const [includeErpContext, setIncludeErpContext] = useState(true);

    const [replySubject, setReplySubject] = useState('');
    const [replyBody, setReplyBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiOnline, setApiOnline] = useState<boolean | null>(null);
    const [copiedField, setCopiedField] = useState<'subject' | 'body' | 'all' | null>(null);

    useEffect(() => {
        const check = async () => {
            const statusPaths = ['/api/ai/email-reply/status', '/api/ai/email-reply/health', '/health'];
            for (const path of statusPaths) {
                try {
                    const res = await fetch(`${API}${path}`, { method: 'GET' });
                    if (res.ok) {
                        setApiOnline(true);
                        return;
                    }
                } catch {
                    /* try next */
                }
            }
            setApiOnline(null);
        };
        void check();
    }, []);

    const generateReply = useCallback(async () => {
        if (!incomingBody.trim()) {
            setError('Paste the customer email body first.');
            return;
        }
        setError(null);
        setLoading(true);
        setReplySubject('');
        setReplyBody('');

        try {
            const data = await postGenerate({
                from_email: fromEmail.trim(),
                subject: incomingSubject.trim(),
                incoming_body: incomingBody.trim(),
                tone,
                include_erp_context: includeErpContext,
            });

            const body = data.reply_body ?? data.reply ?? '';
            const subj =
                data.reply_subject ??
                data.subject ??
                (incomingSubject.trim().toLowerCase().startsWith('re:')
                    ? incomingSubject.trim()
                    : incomingSubject.trim()
                      ? `Re: ${incomingSubject.trim()}`
                      : 'Re: Your inquiry');

            setReplySubject(subj);
            setReplyBody(body);
            if (!body) setError('No reply text returned from the server.');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to generate reply.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [fromEmail, incomingSubject, incomingBody, tone, includeErpContext]);

    const copyText = async (text: string, field: 'subject' | 'body' | 'all') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            window.setTimeout(() => setCopiedField(null), 2000);
        } catch {
            setError('Could not copy to clipboard.');
        }
    };

    const resetAll = () => {
        setFromEmail('');
        setIncomingSubject('');
        setIncomingBody('');
        setReplySubject('');
        setReplyBody('');
        setError(null);
        setTone('professional');
        setIncludeErpContext(true);
    };

    return (
        <div className="max-w-[1100px] mx-auto pb-10 animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-emerald-900 to-teal-950 rounded-2xl p-5 mb-4 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/agents')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-all"
                        aria-label="Back to Agent Hub"
                    >
                        <ArrowLeft size={16} className="text-emerald-200" />
                    </button>
                    <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                        <Mail size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight">Email Auto-Reply</h1>
                        <p className="text-[11px] text-emerald-200/90">
                            AI drafts customer email replies using your live ERP data
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                            apiOnline === true
                                ? 'bg-emerald-500/25 text-emerald-100'
                                : apiOnline === false
                                  ? 'bg-red-500/25 text-red-100'
                                  : 'bg-white/10 text-emerald-100'
                        }`}
                    >
                        {apiOnline === true ? '✓ API reachable' : apiOnline === false ? 'API offline' : 'ERP · Claude'}
                    </span>
                    <button
                        type="button"
                        onClick={resetAll}
                        className="p-2 hover:bg-white/10 rounded-lg text-emerald-200 transition-all"
                        title="Clear form"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-wide">
                        <Inbox size={16} className="text-emerald-600" />
                        Incoming email
                    </h2>

                    <label className="block">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">From</span>
                        <input
                            type="email"
                            value={fromEmail}
                            onChange={(e) => setFromEmail(e.target.value)}
                            placeholder="customer@company.com"
                            className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400"
                        />
                    </label>

                    <label className="block">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Subject</span>
                        <input
                            type="text"
                            value={incomingSubject}
                            onChange={(e) => setIncomingSubject(e.target.value)}
                            placeholder="Question about invoice #1042"
                            className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400"
                        />
                    </label>

                    <label className="block flex flex-col min-h-[200px]">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Message</span>
                        <textarea
                            value={incomingBody}
                            onChange={(e) => setIncomingBody(e.target.value)}
                            placeholder="Paste the full customer email here..."
                            rows={10}
                            className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400 resize-y min-h-[180px]"
                        />
                    </label>

                    <button
                        type="button"
                        onClick={() => {
                            setIncomingSubject('Invoice copy and payment confirmation');
                            setIncomingBody(SAMPLE_INCOMING);
                            setFromEmail('sarah@abcautoparts.com');
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-900 font-medium self-start"
                    >
                        Load sample email
                    </button>

                    <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-full">Tone</span>
                        {TONES.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTone(t.id)}
                                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                                    tone === t.id
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-emerald-50'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeErpContext}
                            onChange={(e) => setIncludeErpContext(e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-gray-600">Include live ERP context (invoices, balances, orders)</span>
                    </label>

                    <button
                        type="button"
                        onClick={() => void generateReply()}
                        disabled={loading || !incomingBody.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition-all"
                    >
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {loading ? 'Drafting reply…' : 'Generate auto-reply'}
                    </button>

                    {error && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                    )}
                </section>

                <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-wide">
                        <SendHorizonal size={16} className="text-emerald-600" />
                        Draft reply
                    </h2>

                    {!replyBody && !loading && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-xl">
                            <Mail size={32} className="text-gray-200 mb-3" />
                            <p className="text-sm text-gray-500 font-medium">Your AI draft will appear here</p>
                            <p className="text-xs text-gray-400 mt-1 max-w-xs">
                                Paste a customer email on the left, choose a tone, then click Generate.
                            </p>
                        </div>
                    )}

                    {loading && (
                        <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
                            <RefreshCw size={28} className="text-emerald-500 animate-spin" />
                            <p className="text-sm text-gray-500">Drafting your reply…</p>
                        </div>
                    )}

                    {replyBody && !loading && (
                        <>
                            <label className="block">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        Reply subject
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void copyText(replySubject, 'subject')}
                                        className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 hover:text-emerald-900"
                                    >
                                        {copiedField === 'subject' ? <Check size={12} /> : <Copy size={12} />}
                                        {copiedField === 'subject' ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={replySubject}
                                    onChange={(e) => setReplySubject(e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400 font-medium"
                                />
                            </label>

                            <label className="block flex flex-col">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        Reply body
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void copyText(replyBody, 'body')}
                                            className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 hover:text-emerald-900"
                                        >
                                            {copiedField === 'body' ? <Check size={12} /> : <Copy size={12} />}
                                            {copiedField === 'body' ? 'Copied' : 'Copy body'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void copyText(`Subject: ${replySubject}\n\n${replyBody}`, 'all')
                                            }
                                            className="text-[10px] font-bold text-gray-600 flex items-center gap-1 hover:text-gray-900"
                                        >
                                            {copiedField === 'all' ? <Check size={12} /> : <Copy size={12} />}
                                            Copy all
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={replyBody}
                                    onChange={(e) => setReplyBody(e.target.value)}
                                    rows={14}
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400 resize-y min-h-[240px] leading-relaxed"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => void generateReply()}
                                disabled={loading}
                                className="w-full py-2.5 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all"
                            >
                                Regenerate draft
                            </button>
                        </>
                    )}
                </section>
            </div>

            <p className="text-[10px] text-center text-gray-300 mt-4">
                Email Auto-Reply · Powered by Claude · Review before sending to customers
            </p>
        </div>
    );
}
