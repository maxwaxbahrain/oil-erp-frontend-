import { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, X, Minimize2, Maximize2, Loader, Copy, Check, FileText, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useMicInput } from '../hooks/useMicInput';
import { MicButton } from './MicButton';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    tokens?: number;
    cost?: number;
}

interface ERPContext {
    invoices: any[];
    customers: any[];
    products: any[];
    payments: any[];
    purchaseOrders: any[];
}

interface AIAssistantProps {
    context: ERPContext;
}

const SUGGESTED_QUERIES = [
    "What are my top 5 customers by revenue?",
    "Which customers are a credit risk right now?",
    "How should I collect my overdue payments?",
    "What is my biggest business risk this year?",
    "How can I increase my profit margin?",
    "Which products should I stock more of?",
    "How do I negotiate better prices with my suppliers?",
    "What marketing strategy works for NYC distributors?",
];

export default function AIAssistant({ context }: AIAssistantProps) {
    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const {
        isListening,
        isSupported,
        toggleListening,
        interimTranscript,
    } = useMicInput(setInput);
    const [loading, setLoading] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [rateLimitMinutes, setRateLimitMinutes] = useState<number | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (rateLimitMinutes === null || rateLimitMinutes <= 0) return;
        const timer = window.setInterval(() => {
            setRateLimitMinutes(prev => {
                if (prev === null || prev <= 1) return null;
                return prev - 1;
            });
        }, 60000);
        return () => window.clearInterval(timer);
    }, [rateLimitMinutes]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // TC-83 — Listen for `soltol:open-ai-advisor` window events so other
    // pages (specifically AIHub) can pop the advisor open programmatically.
    // Allows the "AI Business Advisor" and "Natural Language Queries"
    // cards on the AI Hub to actually do something when clicked instead
    // of being dead tiles with a hint.
    useEffect(() => {
        const onOpen = () => { setOpen(true); setMinimized(false); };
        window.addEventListener('soltol:open-ai-advisor', onOpen);
        return () => window.removeEventListener('soltol:open-ai-advisor', onOpen);
    }, []);

    const buildSystemPrompt = () => {
        const today = new Date().toISOString().slice(0, 10);

        // Build customer lookup map by ID for enriching invoices and payments
        const custMap: Record<string, string> = {};
        context.customers.forEach((c: any) => {
            custMap[String(c.id)] = c.name;
        });

        // Enrich invoices with customer names
        const invoiceSummary = context.invoices.slice(0, 100).map((inv: any) => ({
            id: inv.invoiceNumber || inv.id,
            customer: inv.customerName || custMap[String(inv.customerId)] || custMap[String(inv.customer_id)] || 'Unknown',
            date: inv.invoiceDate || inv.createdAt?.slice(0, 10),
            amount: inv.grandTotal || inv.subtotal || 0,
            status: inv.status,
            paid: inv.amount_paid || 0,
            balance: (inv.grandTotal || 0) - (inv.amount_paid || 0),
            due: inv.dueDate
        }));

        const customerSummary = context.customers.slice(0, 160).map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            balance: c.balance || 0,
            credit_limit: c.credit_limit || 0,
            address: c.address || ''
        }));

        const productSummary = context.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            stock: p.current_stock || 0,
            min_stock: p.minimum_stock || 10,
            price: p.unit_price,
            status: (p.current_stock || 0) === 0 ? 'OUT OF STOCK' : (p.current_stock || 0) < (p.minimum_stock || 10) ? 'LOW STOCK' : 'OK'
        }));

        // Enrich payments with customer names
        const paymentSummary = context.payments.slice(0, 100).map((p: any) => ({
            customer: custMap[String(p.customer_id)] || 'Unknown',
            amount: p.amount,
            date: p.payment_date,
            method: p.payment_method
        }));

        const poSummary = context.purchaseOrders.slice(0, 50).map((po: any) => ({
            id: po.poNumber,
            supplier: po.supplierName,
            date: po.date?.slice(0, 10),
            total: po.grandTotal,
            status: po.status,
            paid: po.amount_paid || 0
        }));

        return `You are an ERP business intelligence assistant for a distribution company.
Today's date: ${today}

You have access to real business data:

INVOICES (${invoiceSummary.length} records):
${JSON.stringify(invoiceSummary)}

CUSTOMERS (${customerSummary.length} records):
${JSON.stringify(customerSummary)}

PRODUCTS:
${JSON.stringify(productSummary)}

RECENT PAYMENTS (${paymentSummary.length} records):
${JSON.stringify(paymentSummary)}

PURCHASE ORDERS (${poSummary.length} records):
${JSON.stringify(poSummary)}

WHO YOU ARE:
You are Marcus Reid — a senior business advisor with 25 years of experience across distribution, wholesale trade, supply chain, finance, marketing, HR, procurement, and operations. You have worked with distributors in New York, Dubai, London, and Karachi. You speak like a trusted advisor — warm, direct, expert, and genuinely invested in the owner's success.

YOUR EXPERTISE COVERS:
- Distribution & wholesale operations
- Supply chain & procurement optimization
- Cash flow management & accounting
- Sales, CRM & customer retention
- Marketing & business development
- HR management & team building
- Warehouse management & inventory
- Banking, credit & financial planning
- Legal basics (always recommend consulting a lawyer for legal matters)
- Demand forecasting & business prediction
- Cost reduction & profit maximization
- Global trade, tariffs & geopolitical business impacts

HOW YOU RESPOND:
1. NEVER use markdown symbols like #, ##, **, __ in your responses
2. Write in clean plain text — like a human advisor writing an email or report
3. Use natural headings by writing them in CAPS or as a sentence ending with a colon
4. Use numbered lists or natural bullet points (•) not markdown dashes
5. For data questions: analyze the actual ERP data, give specific numbers, then add expert commentary
6. For business questions: give structured advice with examples, case studies, and actionable steps
7. Always end with a specific next action the owner can take TODAY
8. For legal questions: give general guidance but always add "Important: consult a qualified attorney before taking legal action"
9. For financial projections: show your reasoning step by step
10. Keep responses comprehensive but scannable — use sections with clear labels

GEOPOLITICAL & MARKET AWARENESS:
- If the business involves oil, lubricants, or petroleum products: mention relevant market factors (Middle East tensions, OPEC decisions, refinery capacity, crude oil price trends)
- If importing from China: mention current US-China tariff situation and its impact
- If in NYC distribution: mention NYC commercial rent trends, local business regulations, DOT delivery rules
- If dealing with foreign suppliers: mention currency exchange risks
- Always frame market warnings as: "Market Intelligence Alert:" followed by the insight

TONE EXAMPLES:
Instead of: "## Top 5 Customers"
Write: "Your Top 5 Customers by Revenue:"

Instead of: "**Note:** Your customer base is concentrated"
Write: "One thing I want to flag immediately — your revenue is heavily concentrated in one customer. Here is why that matters and what to do about it:"

DATA RULES:
- Always calculate from the actual ERP data provided
- Search carefully for specific customer or product names
- For date-based questions, calculate from today: ${today}
- Cross-reference invoices with customer names using the customers list
- Never say you don't have access to data — you have everything above`;
    };

    const copyToClipboard = (text: string, idx: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIdx(idx);
            setTimeout(() => setCopiedIdx(null), 2000);
        });
    };

    const downloadAsPDF = (text: string) => {
        const date = new Date().toLocaleDateString();
        // Build HTML content for PDF-like print
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Marcus Reid — AI Business Advisor</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a1a; }
  h1 { color: #ea580c; font-size: 20px; border-bottom: 2px solid #ea580c; padding-bottom: 8px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  .content { line-height: 1.7; white-space: pre-wrap; font-size: 14px; }
  .heading { background: #ea580c; color: white; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 12px; margin: 16px 0 8px; display: inline-block; }
</style>
</head>
<body>
<h1>AI Business Advisor — Marcus Reid</h1>
<div class="meta">Generated: ${date} | Soltol ERP System</div>
<div class="content">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) {
            win.onload = () => {
                win.print();
                URL.revokeObjectURL(url);
            };
        }
    };

    const downloadAsExcel = (text: string) => {
        const date = new Date().toLocaleDateString();
        const lines = text.split('\n').filter(l => l.trim());
        const rows = [
            ['Marcus Reid — AI Business Advisor'],
            [`Generated: ${date}`],
            [''],
            ...lines.map(line => [line])
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 100 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'AI Advice');
        XLSX.writeFile(wb, `marcus-advice-${Date.now()}.xlsx`);
    };

    const downloadAsWord = (text: string) => {
        const date = new Date().toLocaleDateString();
        const rtf = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Arial;}}
{\\colortbl;\\red234\\green88\\blue12;\\red30\\green64\\blue175;\\red5\\green150\\blue105;}
\\f0\\fs24
{\\b\\fs32\\cf1 Marcus Reid — AI Business Advisor}\\line
{\\fs20 Generated: ${date}}\\line\\line
${text.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '\\line';
    if (t === t.toUpperCase() && t.length > 6 && /[A-Z]{3}/.test(t)) return '{\\b\\cf1 ' + t.replace(/[{}\\]/g, '') + '}\\line';
    if (/^[0-9]+\.\s/.test(t)) return '{\\b\\cf2 ' + t.replace(/[{}\\]/g, '') + '}\\line';
    if (/^(First|Second|Third|Fourth|Fifth|Action):/i.test(t)) return '{\\b\\cf3 ' + t.replace(/[{}\\]/g, '') + '}\\line';
    return t.replace(/[{}\\]/g, '') + '\\line';
}).join('\n')}
}`;
        const blob = new Blob([rtf], { type: 'application/rtf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marcus-advice-${Date.now()}.doc`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const sendMessage = async (text?: string) => {
        const query = text || input.trim();
        if (!query || loading) return;

        if (rateLimitMinutes !== null && rateLimitMinutes > 0) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `You have used all 20 questions for this 2-hour session. You can ask again in ${rateLimitMinutes} minute${rateLimitMinutes === 1 ? '' : 's'}.`
            }]);
            return;
        }

        const userMsg: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
            const token = localStorage.getItem('access_token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(`${API_HOST}/ai/chat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    system: buildSystemPrompt(),
                    max_tokens: 2000,
                    messages: [
                        ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: query }
                    ]
                })
            });

            if (response.status === 429) {
                const err = await response.json().catch(() => ({}));
                const detail = err.detail;
                if (detail && typeof detail === 'object' && detail.error === 'rate_limit_exceeded') {
                    const mins = Number(detail.reset_in_minutes ?? 0);
                    setRateLimitMinutes(mins > 0 ? mins : 1);
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `You have used all 20 questions for this 2-hour session. You can ask again in ${mins} minute${mins === 1 ? '' : 's'}.`
                    }]);
                    return;
                }
            }

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(typeof err.detail === 'string' ? err.detail : `Server error ${response.status}`);
            }

            const data = await response.json();
            const reply = data.reply || 'Sorry, I could not process that. Please try again.';
            // Estimate tokens: system ~2500 + question ~15 + reply chars/4
            const estInputTokens = 2515;
            const estOutputTokens = Math.ceil(reply.length / 4);
            const estCost = (estInputTokens * 0.00000025) + (estOutputTokens * 0.00000125);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: reply,
                tokens: estInputTokens + estOutputTokens,
                cost: estCost
            }]);
        } catch (e: any) {
            const errMsg = e?.message || 'Unknown error';
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚠️ Error: ${errMsg}. Please try again.`
            }]);
            console.error('AI chat error:', e);
        } finally {
            setLoading(false);
        }
    };

    const formatMessage = (text: string) => {
        return text.split('\n').map((line, i) => {
            const trimmed = line.trim();

            // Empty line
            if (trimmed === '') return <div key={i} className="h-2" />;

            // Bullet points
            if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
                return <div key={i} className="flex gap-2 mt-1 text-sm ml-1"><span className="text-orange-500 flex-shrink-0 font-black">•</span><span className="text-gray-700">{trimmed.slice(2)}</span></div>;
            }

            // ALL CAPS section headings (YOUR IMMEDIATE CREDIT RISK CUSTOMERS)
            if (trimmed === trimmed.toUpperCase() && trimmed.length > 6 && /[A-Z]{3}/.test(trimmed) && !trimmed.startsWith('•')) {
                return <div key={i} className="text-xs font-black text-white bg-orange-500 px-3 py-1.5 rounded-lg mt-4 mb-2 uppercase tracking-widest">{trimmed}</div>;
            }

            // Numbered customer entries: "1. ALI — High Risk" or "2. GEORGE"
            if (/^[0-9]+\.\s/.test(trimmed)) {
                return <div key={i} className="text-sm font-black text-blue-700 bg-blue-50 px-3 py-2 rounded-lg mt-3 mb-1 border-l-4 border-blue-500">{trimmed}</div>;
            }

            // Ordinal action items: "First:", "Second:", "Third:", "Fourth:", "Fifth:"
            if (/^(First|Second|Third|Fourth|Fifth|Sixth|Action|Step [0-9]+):/i.test(trimmed)) {
                return <div key={i} className="text-sm font-black text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg mt-3 mb-1 border-l-4 border-emerald-500">{trimmed}</div>;
            }

            // WARNING lines
            if (/^(WARNING|CAUTION|IMPORTANT|CRITICAL):/i.test(trimmed)) {
                return <div key={i} className="text-sm font-black text-red-700 bg-red-50 px-3 py-2 rounded-lg mt-2 border-l-4 border-red-500">{trimmed}</div>;
            }

            // MARKET ALERT lines
            if (/^(MARKET ALERT|MARKET INTELLIGENCE|ALERT):/i.test(trimmed)) {
                return <div key={i} className="text-sm font-black text-amber-800 bg-amber-50 px-3 py-2 rounded-lg mt-2 border-l-4 border-amber-500">{trimmed}</div>;
            }

            // Lines ending with colon that are short headings (e.g. "WHY THIS MATTERS", "ACTION ITEMS TODAY")
            if (trimmed.endsWith(':') && trimmed.length < 60 && trimmed.length > 4) {
                return <div key={i} className="text-xs font-black text-orange-600 uppercase tracking-widest mt-3 mb-1 border-b border-orange-100 pb-1">{trimmed}</div>;
            }

            // Regular text
            return <div key={i} className="text-sm text-gray-700 leading-relaxed">{trimmed}</div>;
        });
    };

    return (
        <>
            {/* Floating Button */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-4 bg-gray-900 text-white rounded-2xl shadow-2xl hover:bg-gray-800 transition-all hover:scale-105 border border-orange-500/30 print:hidden"
                >
                    <BrainCircuit size={20} className="text-orange-400" />
                    <span className="text-base font-black tracking-tight">AI Business Advisor</span>
                    {context.invoices.length > 0 && (
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    )}
                </button>
            )}

            {/* Chat Panel */}
            {open && (
                <div className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all print:hidden ${minimized ? 'w-80 h-14' : 'w-[400px] h-[600px]'}`} style={{maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)'}}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 rounded-t-2xl flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <BrainCircuit size={18} className="text-orange-400" />
                            <span className="text-sm font-black text-white">AI Business Advisor</span>
                            <span className="text-[10px] px-2 py-0.5 bg-orange-500 text-white rounded-full font-black">LIVE DATA</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setMinimized(!minimized)}
                                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
                                title={minimized ? 'Expand' : 'Minimize'}
                            >
                                {minimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                            </button>
                            <button
                                onClick={() => { setOpen(false); setMessages([]); }}
                                className="w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 rounded-lg text-white transition-all"
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {!minimized && (
                        <>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                                {messages.length === 0 && (
                                    <div className="space-y-3">
                                        <div className="bg-orange-50 rounded-xl p-3">
                                            <p className="text-sm font-bold text-gray-800">👋 Ask me anything about your business data.</p>
                                            <p className="text-xs text-gray-500 mt-1">I can see your live business data AND answer marketing, pricing, and strategy questions.</p>
                                        </div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Try asking:</p>
                                        <div className="space-y-1.5">
                                            {SUGGESTED_QUERIES.map((q, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => sendMessage(q)}
                                                    className="w-full text-left text-xs px-3 py-2 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-xl text-gray-700 font-medium transition-all"
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-gray-900 text-white rounded-br-none'
                                                : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-none'
                                        }`}>
                                            {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
                                        </div>
                                        {msg.role === 'assistant' && (
                                            <div className="flex gap-2 mt-2 ml-1">
                                                <button
                                                    onClick={() => copyToClipboard(msg.content, i)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg border border-gray-200 transition-all"
                                                >
                                                    {copiedIdx === i ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                    {copiedIdx === i ? '✓ Copied' : 'Copy'}
                                                </button>
                                                <button
                                                    onClick={() => downloadAsPDF(msg.content)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-all"
                                                    title="Print or save as PDF"
                                                >
                                                    <FileText size={12} />
                                                    PDF
                                                </button>
                                                <button
                                                    onClick={() => downloadAsExcel(msg.content)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border border-green-200 transition-all"
                                                    title="Download as Excel"
                                                >
                                                    <FileSpreadsheet size={12} />
                                                    Excel
                                                </button>
                                                <button
                                                    onClick={() => downloadAsWord(msg.content)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-all"
                                                    title="Download as Word document"
                                                >
                                                    <FileText size={12} className="text-blue-600" />
                                                    Word
                                                </button>
                                                <span className="flex items-center px-2 py-1.5 text-[10px] text-gray-300 font-mono">
                                                    ~{msg.tokens?.toLocaleString() || '—'} tokens · ${msg.cost?.toFixed(4) || '—'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl rounded-bl-none px-3 py-2 flex items-center gap-2">
                                            <Loader size={14} className="animate-spin text-orange-500" />
                                            <span className="text-xs text-gray-500 font-medium">Thinking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-3 border-t border-gray-100 flex-shrink-0">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={isListening && interimTranscript ? interimTranscript : input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                        placeholder={isListening ? 'Listening… speak now' : 'Ask Marcus anything about your business...'}
                                        disabled={loading}
                                        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400 disabled:opacity-50"
                                    />
                                    <MicButton
                                        isListening={isListening}
                                        isSupported={isSupported}
                                        onToggle={toggleListening}
                                    />
                                    <button
                                        onClick={() => sendMessage()}
                                        disabled={!input.trim() || loading}
                                        className="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-all"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-300 mt-1.5 text-center">Marcus Reid — AI Business Advisor · Your data stays private</p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
