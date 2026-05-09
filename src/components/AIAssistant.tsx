import { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, X, Minimize2, Maximize2, Loader, Download, Copy, Check } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
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
    const [loading, setLoading] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const DAILY_LIMIT = 20;

    const getTodayCount = () => {
        const today = new Date().toISOString().slice(0, 10);
        const stored = JSON.parse(localStorage.getItem('ai_usage') || '{}');
        return stored[today] || 0;
    };

    const incrementCount = () => {
        const today = new Date().toISOString().slice(0, 10);
        const stored = JSON.parse(localStorage.getItem('ai_usage') || '{}');
        stored[today] = (stored[today] || 0) + 1;
        localStorage.setItem('ai_usage', JSON.stringify(stored));
    };


    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

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

    const downloadAsPDF = (text: string, _idx: number) => {
        const date = new Date().toLocaleDateString();
        const content = `AI Business Advisor — Marcus Reid\nGenerated: ${date}\n\n${text}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marcus-advice-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const sendMessage = async (text?: string) => {
        const query = text || input.trim();
        if (!query || loading) return;

        // Rate limit check
        if (getTodayCount() >= DAILY_LIMIT) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'You have used all 20 free queries for today. Your limit resets tomorrow at midnight. Upgrade to Pro for unlimited daily queries.'
            }]);
            return;
        }
        incrementCount();

        const userMsg: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

            const response = await fetch(`${API_HOST}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: buildSystemPrompt(),
                    max_tokens: 2000,
                    messages: [
                        ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: query }
                    ]
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || `Server error ${response.status}`);
            }

            const data = await response.json();
            const reply = data.reply || 'Sorry, I could not process that. Please try again.';
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
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
            // Bullet points
            if (line.startsWith('• ') || line.startsWith('- ')) {
                return <div key={i} className="flex gap-2 mt-1 text-sm"><span className="text-orange-400 flex-shrink-0">•</span><span>{line.slice(2)}</span></div>;
            }
            // CAPS headings (e.g. "YOUR TOP CUSTOMERS:")
            if (line === line.toUpperCase() && line.endsWith(':') && line.length > 4) {
                return <div key={i} className="text-xs font-black text-orange-600 uppercase tracking-widest mt-3 mb-1 border-b border-orange-100 pb-1">{line}</div>;
            }
            // Action line
            if (line.startsWith('Action:')) {
                return <div key={i} className="mt-2 text-sm font-bold bg-emerald-50 text-emerald-800 px-2 py-1.5 rounded-lg">{line}</div>;
            }
            // Warning
            if (line.startsWith('WARNING:')) {
                return <div key={i} className="mt-2 text-sm font-bold bg-red-50 text-red-700 px-2 py-1.5 rounded-lg">{line}</div>;
            }
            // Market alert
            if (line.startsWith('MARKET ALERT:')) {
                return <div key={i} className="mt-2 text-sm font-bold bg-amber-50 text-amber-800 px-2 py-1.5 rounded-lg">{line}</div>;
            }
            // Numbered list
            if (/^[0-9]+\./.test(line)) {
                return <div key={i} className="mt-1.5 text-sm font-bold text-gray-800">{line}</div>;
            }
            if (line === '') return <div key={i} className="h-1" />;
            return <div key={i} className="text-sm">{line}</div>;
        });
    };

    return (
        <>
            {/* Floating Button */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-4 bg-gray-900 text-white rounded-2xl shadow-2xl hover:bg-gray-800 transition-all hover:scale-105 border border-orange-500/30"
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
                <div className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all ${minimized ? 'w-80 h-14' : 'w-[400px] h-[600px]'}`} style={{maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)'}}>

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
                                            <div className="flex gap-2 mt-1 ml-1">
                                                <button
                                                    onClick={() => copyToClipboard(msg.content, i)}
                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                                                    title="Copy to clipboard"
                                                >
                                                    {copiedIdx === i ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                                    {copiedIdx === i ? 'Copied!' : 'Copy'}
                                                </button>
                                                <button
                                                    onClick={() => downloadAsPDF(msg.content, i)}
                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                                                    title="Download as text file"
                                                >
                                                    <Download size={11} />
                                                    Save
                                                </button>
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
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                        placeholder="Ask Marcus anything about your business..."
                                        disabled={loading}
                                        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400 disabled:opacity-50"
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
