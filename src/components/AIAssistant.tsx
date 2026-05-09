import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Minimize2, Maximize2, Loader } from 'lucide-react';

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
    "Which customers haven't ordered in 30 days?",
    "What are my top 5 customers by revenue?",
    "Which products are running low on stock?",
    "How much revenue did I make this month?",
    "Which invoices are overdue?",
    "What did I buy from suppliers this month?",
    "Show me unpaid invoices over $500",
    "Which product sells the most?",
];

export default function AIAssistant({ context }: AIAssistantProps) {
    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const buildSystemPrompt = () => {
        const today = new Date().toISOString().slice(0, 10);

        // Summarize data concisely to save tokens
        const invoiceSummary = context.invoices.slice(0, 100).map(inv => ({
            id: inv.invoiceNumber,
            customer: inv.customerName,
            date: inv.invoiceDate,
            amount: inv.grandTotal,
            status: inv.status,
            paid: inv.amount_paid || 0,
            due: inv.dueDate
        }));

        const customerSummary = context.customers.slice(0, 100).map(c => ({
            id: c.id,
            name: c.name,
            balance: c.balance || 0,
            credit_limit: c.credit_limit || 0
        }));

        const productSummary = context.products.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            stock: p.current_stock || 0,
            min_stock: p.minimum_stock || 10,
            price: p.unit_price
        }));

        const paymentSummary = context.payments.slice(0, 50).map(p => ({
            customer_id: p.customer_id,
            amount: p.amount,
            date: p.payment_date,
            method: p.payment_method
        }));

        const poSummary = context.purchaseOrders.slice(0, 50).map(po => ({
            id: po.poNumber,
            supplier: po.supplierName,
            date: po.date,
            total: po.grandTotal,
            status: po.status
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

RULES:
- Answer in plain English, be concise and direct
- Use bullet points for lists
- Show amounts with $ and 2 decimal places
- Always calculate from the actual data above
- If asked about a specific customer, search the data carefully
- For "last X days/months" calculate from today: ${today}
- Keep answers under 200 words unless a full list is needed
- Never say "I don't have access" — you have the data above`;
    };

    const sendMessage = async (text?: string) => {
        const query = text || input.trim();
        if (!query || loading) return;

        const userMsg: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5',
                    max_tokens: 1000,
                    system: buildSystemPrompt(),
                    messages: [
                        ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: query }
                    ]
                })
            });

            const data = await response.json();
            const reply = data.content?.[0]?.text || 'Sorry, I could not process that. Please try again.';
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch (e) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '⚠️ Connection error. Please check your internet and try again.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const formatMessage = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (line.startsWith('• ') || line.startsWith('- ')) {
                return <div key={i} className="flex gap-2 mt-1"><span className="text-orange-400 mt-0.5">•</span><span>{line.slice(2)}</span></div>;
            }
            if (line.startsWith('**') && line.endsWith('**')) {
                return <div key={i} className="font-black text-gray-900 mt-2">{line.slice(2, -2)}</div>;
            }
            if (line === '') return <div key={i} className="h-1" />;
            return <div key={i}>{line}</div>;
        });
    };

    return (
        <>
            {/* Floating Button */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-2xl shadow-2xl hover:bg-gray-800 transition-all hover:scale-105"
                >
                    <Sparkles size={18} className="text-orange-400" />
                    <span className="text-sm font-black">Ask AI Accountant</span>
                    {context.invoices.length > 0 && (
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    )}
                </button>
            )}

            {/* Chat Panel */}
            {open && (
                <div className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all ${minimized ? 'w-72 h-14' : 'w-96 h-[600px]'}`}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 rounded-t-2xl">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-orange-400" />
                            <span className="text-sm font-black text-white">AI Accountant</span>
                            <span className="text-[10px] px-2 py-0.5 bg-orange-500 text-white rounded-full font-black">LIVE DATA</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setMinimized(!minimized)} className="text-gray-400 hover:text-white transition-all">
                                {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                            </button>
                            <button onClick={() => { setOpen(false); setMessages([]); }} className="text-gray-400 hover:text-white transition-all">
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {!minimized && (
                        <>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {messages.length === 0 && (
                                    <div className="space-y-3">
                                        <div className="bg-orange-50 rounded-xl p-3">
                                            <p className="text-sm font-bold text-gray-800">👋 Ask me anything about your business data.</p>
                                            <p className="text-xs text-gray-500 mt-1">I can see your invoices, customers, products, payments and orders in real time.</p>
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
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-gray-900 text-white rounded-br-none'
                                                : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-none'
                                        }`}>
                                            {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
                                        </div>
                                    </div>
                                ))}

                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl rounded-bl-none px-3 py-2 flex items-center gap-2">
                                            <Loader size={14} className="animate-spin text-orange-500" />
                                            <span className="text-xs text-gray-500 font-medium">Analyzing your data...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-3 border-t border-gray-100">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                        placeholder="Ask your accountant anything..."
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
                                <p className="text-[10px] text-gray-300 mt-1.5 text-center">Powered by Claude Haiku · Your data stays private</p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
