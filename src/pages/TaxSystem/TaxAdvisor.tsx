// Tax Advisor — Session 3B.
//
// AI tax chat page.  Streams Claude's reply token-by-token over SSE
// from POST /ai/tax-advisor/stream so users see the answer materializing
// rather than staring at a spinner.
//
// We do NOT use the browser's EventSource API — it only supports GET.
// Instead we fetch() with a POST body and read response.body via the
// ReadableStream API, parsing SSE frames as they arrive.
//
// Structure copied from BusinessAdvisorAgent.tsx (Session 2 pattern).
// Key differences:
//   - calls /ai/tax-advisor/stream (sibling to /ai/chat, not replacement)
//   - system prompt + tax context are built ENTIRELY server-side; the
//     frontend never constructs the prompt (so the guardrail can't be
//     stripped by a tampered client)
//   - the only ERP call we make is getFilingList() so the page can
//     show a small "Filings on record: N" status chip — the AI itself
//     gets a richer tax context server-side
//   - streaming token append → current message bubble in real time
//   - violet/MessageSquare theme to match the 7th /tax landing card

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MessageSquare, User, RefreshCw, ShieldAlert } from 'lucide-react';
import { getFilingList } from './services/filingApi';


interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: Date;
    typing?: boolean;     // three-dot loader before any token arrives
    streaming?: boolean;  // currently appending tokens
}


const SUGGESTED = [
    "When is Form 1120 due this year?",
    "What's the difference between Form 1120 and Schedule C?",
    "Am I eligible for the QBI deduction?",
    "How does the R&D credit work?",
    "What's Section 179 and how much can I deduct?",
    "When should I file an extension (Form 7004 vs 4868)?",
    "What triggers FBAR filing requirements?",
    "Walk me through quarterly estimated payments.",
];


// Same env var the rest of the tax pages use.  Trim trailing slash so
// we don't end up with "//ai/tax-advisor/stream".
const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');


export default function TaxAdvisor() {
    const navigate = useNavigate();

    const [messages, setMessages] = useState<Message[]>([{
        id: 'welcome',
        role: 'agent',
        content:
            "**I am an AI tax assistant, not a licensed CPA or attorney.** My answers are for educational purposes only — for complex tax situations and filing decisions, always consult a qualified tax professional.\n\nWith that out of the way: I have knowledge of all **96 IRS forms** in our catalog, the **4 forms** this system can auto-file for you (1120, 1040, Schedule C, 941), federal brackets for 2024 + 2025, and the major deductions and credits (Section 179, R&D §41, QBI §199A, WOTC).\n\nWhat tax question can I help you with?",
        timestamp: new Date(),
    }]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // ERP context — for the status chip only.  The backend builds the
    // real tax context for the system prompt; we just want to show the
    // user that the system is grounded in their filings.
    const [contextLoaded, setContextLoaded] = useState(false);
    const [filingCount, setFilingCount] = useState<number | null>(null);

    // Conversation history we send back to Claude on each turn so it
    // can carry context across the chat.  Only user/assistant turns —
    // system prompt is server-side.
    const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);

    const bottomRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        // Single lightweight call — we don't need anything else from
        // the ERP because the backend pulls TaxFiling rows directly.
        getFilingList().then(({ data }) => {
            setFilingCount(Array.isArray(data) ? data.length : 0);
            setContextLoaded(true);
        }).catch(() => {
            setFilingCount(0);
            setContextLoaded(true);
        });
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    // Append a token to the current streaming agent message bubble.
    // Looks up the message by id (we set it when we create the bubble)
    // and mutates ONLY its content + clears typing on first token.
    const appendToken = (msgId: string, token: string) => {
        setMessages(prev => prev.map(m =>
            m.id === msgId
                ? { ...m, content: m.content + token, typing: false, streaming: true }
                : m
        ));
    };


    // Mark a streaming bubble as done — flips the streaming/typing
    // flags off so the timestamp / formatting renders cleanly.
    const finalizeMessage = (msgId: string) => {
        setMessages(prev => prev.map(m =>
            m.id === msgId
                ? { ...m, typing: false, streaming: false }
                : m
        ));
    };


    const sendMessage = async (text?: string) => {
        const userText = (text || input).trim();
        if (!userText || loading) return;
        setInput('');

        // Reserve a stable id for the assistant bubble up front so the
        // streaming reader can find it across multiple setMessages calls.
        const assistantMsgId = `agent-${Date.now()}`;

        setMessages(prev => [
            ...prev,
            { id: `user-${Date.now()}`, role: 'user', content: userText, timestamp: new Date() },
            { id: assistantMsgId, role: 'agent', content: '', timestamp: new Date(), typing: true },
        ]);
        setLoading(true);

        const newHistory = [...history, { role: 'user', content: userText }];
        let assistantReply = '';

        try {
            const res = await fetch(`${API}/ai/tax-advisor/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: newHistory }),
            });

            if (!res.ok || !res.body) {
                const errText = await res.text().catch(() => 'Stream failed to open.');
                appendToken(assistantMsgId, `**Error:** ${errText.slice(0, 300)}`);
                finalizeMessage(assistantMsgId);
                setLoading(false);
                return;
            }

            // Read the body as a UTF-8 stream and parse SSE frames
            // (`data: {...}\n\n`) as they arrive.  We buffer partial
            // lines because TCP doesn't respect message boundaries.
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // SSE event blocks are separated by a blank line ('\n\n').
                let sep: number;
                while ((sep = buffer.indexOf('\n\n')) !== -1) {
                    const frame = buffer.slice(0, sep);
                    buffer = buffer.slice(sep + 2);

                    // Each frame contains one or more `data:` lines.
                    for (const line of frame.split('\n')) {
                        if (!line.startsWith('data:')) continue;
                        const payload = line.slice(5).trim();
                        if (!payload) continue;
                        try {
                            const evt = JSON.parse(payload);
                            if (typeof evt.token === 'string') {
                                assistantReply += evt.token;
                                appendToken(assistantMsgId, evt.token);
                            } else if (evt.error) {
                                appendToken(assistantMsgId, `\n\n**Error:** ${evt.error}`);
                            }
                            // evt.done === true is a no-op; we use the
                            // reader.read() done signal as the real EOF.
                        } catch {
                            // ignore malformed frames — likely keepalives
                        }
                    }
                }
            }

            finalizeMessage(assistantMsgId);
            setHistory([...newHistory, { role: 'assistant', content: assistantReply }]);
        } catch (err) {
            appendToken(assistantMsgId,
                `**Network error** — could not reach the tax advisor. ${err instanceof Error ? err.message : ''}`);
            finalizeMessage(assistantMsgId);
        } finally {
            setLoading(false);
        }
    };


    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };


    // Tiny inline renderer — bold (**text**) + bullets (•/-).  Matches
    // BusinessAdvisorAgent so the visual language is consistent.
    const renderMessage = (content: string) => content.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="font-black text-gray-900">{part.slice(2, -2)}</strong>
                : part
        );
        if (line.startsWith('• ') || line.startsWith('- '))
            return (
                <p key={i} className="pl-3 text-gray-700 flex gap-1.5 text-sm">
                    <span className="text-gray-400 flex-shrink-0 mt-0.5">•</span>
                    <span>{rendered.map((p, j) => typeof p === 'string' ? p : <span key={j}>{p}</span>)}</span>
                </p>
            );
        return <p key={i} className="text-sm text-gray-700 leading-relaxed">{rendered}</p>;
    });


    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-[900px] mx-auto animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-4 mb-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/tax')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-all"
                        aria-label="Back to tax management"
                    >
                        <ArrowLeft size={16} className="text-gray-400" />
                    </button>
                    <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
                        <MessageSquare size={20} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-white">Tax Advisor</p>
                            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                        </div>
                        <p className="text-[10px] text-gray-400">
                            Powered by Claude AI · Not a substitute for professional advice
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                        contextLoaded
                            ? 'bg-violet-500/20 text-violet-300'
                            : 'bg-amber-500/20 text-amber-400'
                    }`}>
                        {contextLoaded
                            ? `✓ ${filingCount ?? 0} filing${filingCount === 1 ? '' : 's'} on record`
                            : '⟳ Loading context...'}
                    </span>
                    <button
                        onClick={() => { setMessages([messages[0]]); setHistory([]); }}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-all"
                        title="Reset conversation"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Disclaimer banner — always visible above the chat so the
                guardrail isn't dependent on Claude remembering to repeat it. */}
            <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2.5 flex-shrink-0">
                <ShieldAlert size={14} className="text-violet-700 flex-shrink-0" />
                <p className="text-[11px] text-violet-900 leading-relaxed">
                    <strong className="font-black">Disclaimer:</strong> Educational information only.
                    Not tax, legal, or financial advice.  For complex situations, consult a qualified CPA or tax attorney.
                </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-2">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            msg.role === 'agent' ? 'bg-violet-500' : 'bg-gray-700'
                        }`}>
                            {msg.role === 'agent'
                                ? <MessageSquare size={15} className="text-white" />
                                : <User size={15} className="text-white" />}
                        </div>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                            msg.role === 'agent' ? 'bg-white border border-gray-100 shadow-sm' : 'bg-gray-800'
                        }`}>
                            {msg.typing && !msg.content ? (
                                <div className="flex gap-1 py-1">
                                    {[0, 1, 2].map(i => (
                                        <div
                                            key={i}
                                            className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
                                            style={{ animationDelay: `${i * 0.15}s` }}
                                        />
                                    ))}
                                </div>
                            ) : msg.role === 'agent' ? (
                                <div className="space-y-0.5">
                                    {renderMessage(msg.content)}
                                    {msg.streaming && (
                                        <span className="inline-block w-1.5 h-3.5 bg-violet-500 ml-0.5 animate-pulse align-middle" />
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-white">{msg.content}</p>
                            )}
                            <p className={`text-[9px] mt-1.5 ${msg.role === 'agent' ? 'text-gray-300' : 'text-gray-500'}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Suggested questions — visible only on the welcome screen. */}
            {messages.length <= 1 && (
                <div className="flex gap-2 flex-wrap mb-2 flex-shrink-0">
                    {SUGGESTED.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => sendMessage(s)}
                            disabled={loading}
                            className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-all font-medium disabled:opacity-40"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 flex gap-3 items-end flex-shrink-0 shadow-sm">
                <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about forms, deductions, deadlines, tax strategy..."
                    rows={1}
                    className="flex-1 resize-none text-sm focus:outline-none text-gray-800 placeholder-gray-400 max-h-28"
                    disabled={loading}
                />
                <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                    aria-label="Send message"
                >
                    {loading
                        ? <RefreshCw size={14} className="animate-spin" />
                        : <Send size={14} />}
                </button>
            </div>
            <p className="text-[10px] text-center text-gray-300 mt-1.5 flex-shrink-0">
                Tax Advisor · Claude-powered streaming · Enter to send · Educational use only
            </p>
        </div>
    );
}
