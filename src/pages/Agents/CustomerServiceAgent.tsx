import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bot, User, RefreshCw, Headphones } from 'lucide-react';
import { getCustomers, getInvoices, getPayments, type Customer, type Invoice } from '../../services/api';
import { getProducts } from '../../services/productService';
import { getPurchaseOrders } from '../../services/purchasesService';
import { formatCurrency } from '../../services/settingsService';
import { authFetch } from '../../api/axios';

interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: Date;
    typing?: boolean;
}

const SUGGESTED = [
    "What does Ahmed owe us?",
    "Which invoices are overdue?",
    "What's our total outstanding balance?",
    "Which products are low on stock?",
    "Show me our top 5 customers",
    "Any overdue payments this month?",
];

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function buildERPContext(): Promise<string> {
    try {
        const [customers, invoices, payments, products, purchaseOrders] = await Promise.allSettled([
            getCustomers(),
            getInvoices(),
            getPayments(),
            getProducts(),
            getPurchaseOrders(),
        ]);

        const custs: Customer[] = customers.status === 'fulfilled' ? customers.value : [];
        const invs: Invoice[] = invoices.status === 'fulfilled' ? invoices.value : [];
        const pays = payments.status === 'fulfilled' ? payments.value : [];
        const prods = products.status === 'fulfilled' ? products.value : [];
        const pos = purchaseOrders.status === 'fulfilled' ? purchaseOrders.value : [];

        const today = new Date();

        // Overdue invoices
        const overdue = invs.filter(i => {
            if (i.status === 'Paid') return false;
            const due = new Date(i.dueDate);
            return due < today;
        });

        // Customer balances
        const custBalances: Record<string, number> = {};
        invs.filter(i => i.status !== 'Paid').forEach(i => {
            custBalances[i.customerName] = (custBalances[i.customerName] || 0) + (i.grandTotal - (i.amount_paid || 0));
        });

        const topOwing = Object.entries(custBalances)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, bal]) => `${name}: ${formatCurrency(bal)}`)
            .join(', ');

        // Low stock
        const lowStock = prods
            .filter(p => (p.locations?.[0]?.currentStock || 0) <= (p.reorderLevel || 10))
            .map(p => `${p.name}: ${p.locations?.[0]?.currentStock || 0} units`)
            .slice(0, 10);

        // Total outstanding
        const totalOutstanding = Object.values(custBalances).reduce((s, v) => s + v, 0);

        // Recent invoices (last 10)
        const recentInvoices = [...invs]
            .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
            .slice(0, 10)
            .map(i => `${i.invoiceNumber} — ${i.customerName} — ${formatCurrency(i.grandTotal)} — ${i.status}`)
            .join('\n');

        return `
=== SOLTOL ERP — LIVE DATA SNAPSHOT ===
Date: ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

CUSTOMERS: ${custs.length} total
Top customers by outstanding balance: ${topOwing || 'None outstanding'}

INVOICES: ${invs.length} total
- Overdue: ${overdue.length} invoices (${formatCurrency(overdue.reduce((s, i) => s + i.grandTotal, 0))})
- Total Outstanding AR: ${formatCurrency(totalOutstanding)}
- Recent invoices:
${recentInvoices}

PRODUCTS: ${prods.length} in catalog
Low stock alerts: ${lowStock.length > 0 ? lowStock.join(', ') : 'All products adequately stocked'}

PURCHASE ORDERS: ${pos.length} total
- Pending: ${pos.filter(p => p.status === 'Pending').length}
- Received: ${pos.filter(p => p.status === 'Received').length}

PAYMENTS: ${pays.length} total recorded
Total collected: ${formatCurrency(pays.reduce((s, p) => s + (p.amount || 0), 0))}

CUSTOMER LIST (first 30):
${custs.slice(0, 30).map(c => `• ${c.name} | Phone: ${c.phone || 'N/A'} | Balance: ${formatCurrency(custBalances[c.name] || 0)}`).join('\n')}
`.trim();
    } catch (e) {
        return 'ERP data temporarily unavailable. I can still answer general questions.';
    }
}

export default function CustomerServiceAgent() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'agent',
            content: "Hi! I'm **ARIA**, your Soltol Customer Service Agent.\n\nI have full access to your ERP — customers, invoices, orders, payments, and inventory. Ask me anything about your business data.\n\nFor example: *\"What does Ibrahim owe us?\"* or *\"Which products need reordering?\"*",
            timestamp: new Date(),
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [erpContext, setErpContext] = useState('');
    const [contextLoaded, setContextLoaded] = useState(false);
    const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        buildERPContext().then(ctx => {
            setErpContext(ctx);
            setContextLoaded(true);
        });
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text?: string) => {
        const userText = text || input.trim();
        if (!userText || loading) return;
        setInput('');

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: userText,
            timestamp: new Date(),
        };

        const typingMsg: Message = {
            id: 'typing',
            role: 'agent',
            content: '',
            timestamp: new Date(),
            typing: true,
        };

        setMessages(prev => [...prev, userMsg, typingMsg]);
        setLoading(true);

        const newHistory = [...history, { role: 'user', content: userText }];

        try {
            const res = await authFetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are ARIA, the intelligent Customer Service Agent for Soltol, a premium oil distribution company in New York.

PERSONALITY: Professional, warm, concise, data-driven. You sound like a knowledgeable senior account manager — not a bot.
- Use customer names, exact figures, and specific details
- Never say "I don't have access" — you have full ERP access below
- Keep answers focused and clear. Use bullet points for lists
- If asked about a specific customer, give their exact balance, last invoice, contact info
- Sound human: "Let me pull that up..." / "I can see that..." / "Based on the latest data..."

LIVE ERP DATA:
${erpContext}

RULES:
- Always use exact numbers from the data above
- If a customer name is close match, find them (e.g. "Ahmed" matches any Ahmed)
- For overdue invoices, tell them exactly which ones and how many days overdue
- Always mention what action to take next`,
                    max_tokens: 800,
                    messages: newHistory,
                })
            });

            if (!res.ok) {
                let detail = '';
                try { detail = (await res.json())?.detail || ''; } catch { /* not JSON */ }
                throw new Error(detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            const reply = data.reply || 'Sorry, I had trouble processing that. Please try again.';

            setHistory([...newHistory, { role: 'assistant', content: reply }]);
            setMessages(prev => prev.filter(m => m.id !== 'typing').concat({
                id: Date.now().toString(),
                role: 'agent',
                content: reply,
                timestamp: new Date(),
            }));
        } catch {
            setMessages(prev => prev.filter(m => m.id !== 'typing').concat({
                id: Date.now().toString(),
                role: 'agent',
                content: 'Connection error. Please check your network and try again.',
                timestamp: new Date(),
            }));
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

    const renderMessage = (content: string) => {
        return content
            .split('\n')
            .map((line, i) => {
                if (line.startsWith('**') && line.endsWith('**'))
                    return <p key={i} className="font-black text-gray-900">{line.slice(2, -2)}</p>;
                if (line.startsWith('• ') || line.startsWith('- '))
                    return <p key={i} className="pl-3 text-gray-700 flex gap-1.5"><span className="text-gray-400 flex-shrink-0">•</span><span>{line.slice(2)}</span></p>;
                if (line.startsWith('*') && line.endsWith('*'))
                    return <p key={i} className="italic text-gray-500">{line.slice(1, -1)}</p>;
                if (!line.trim()) return <div key={i} className="h-1.5" />;
                // Bold inline **text**
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                    <p key={i} className="text-gray-700 leading-relaxed">
                        {parts.map((part, j) =>
                            part.startsWith('**') && part.endsWith('**')
                                ? <strong key={j} className="font-black text-gray-900">{part.slice(2, -2)}</strong>
                                : part
                        )}
                    </p>
                );
            });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-[900px] mx-auto animate-in fade-in duration-300">

            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/agents')} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                        <ArrowLeft size={16} className="text-gray-400" />
                    </button>
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                        <Headphones size={20} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-gray-900">ARIA</p>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-emerald-600">Online</span>
                        </div>
                        <p className="text-[10px] text-gray-400">Customer Service Agent · Soltol</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${contextLoaded ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {contextLoaded ? '✓ ERP Connected' : '⟳ Loading ERP...'}
                    </span>
                    <button onClick={() => { setMessages([messages[0]]); setHistory([]); }} title="Reset conversation"
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-all">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-2">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === 'agent' ? 'bg-blue-600' : 'bg-gray-900'}`}>
                            {msg.role === 'agent' ? <Bot size={16} className="text-white" /> : <User size={16} className="text-white" />}
                        </div>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === 'agent' ? 'bg-white border border-gray-100 shadow-sm' : 'bg-gray-900 text-white'}`}>
                            {msg.typing ? (
                                <div className="flex gap-1 py-1">
                                    {[0,1,2].map(i => (
                                        <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                    ))}
                                </div>
                            ) : msg.role === 'agent' ? (
                                <div className="text-sm space-y-0.5">{renderMessage(msg.content)}</div>
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

            {/* Suggested prompts */}
            {messages.length <= 2 && (
                <div className="flex gap-2 flex-wrap mb-2 flex-shrink-0">
                    {SUGGESTED.map((s, i) => (
                        <button key={i} onClick={() => sendMessage(s)}
                            className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all font-medium">
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 flex gap-3 items-end flex-shrink-0 shadow-sm">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about customers, invoices, orders, stock levels..."
                    rows={1}
                    className="flex-1 resize-none text-sm focus:outline-none text-gray-800 placeholder-gray-400 max-h-28 overflow-y-auto"
                    style={{ lineHeight: '1.5' }}
                />
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                    className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0">
                    {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
            </div>
            <p className="text-[10px] text-center text-gray-300 mt-1.5 flex-shrink-0">
                ARIA · Powered by Claude · Press Enter to send · Shift+Enter for new line
            </p>
        </div>
    );
}
