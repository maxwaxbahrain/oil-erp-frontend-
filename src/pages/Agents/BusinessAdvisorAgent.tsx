import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Brain, User, RefreshCw } from 'lucide-react';
import { getCustomers, getInvoices, getPayments } from '../../services/api';
import { getProducts } from '../../services/productService';
import { getPurchaseOrders } from '../../services/purchasesService';
import { formatCurrency } from '../../services/settingsService';

interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: Date;
    typing?: boolean;
}

const SUGGESTED = [
    "What's our revenue trend this month?",
    "Which customers are at risk of churning?",
    "Do we need to reorder any products?",
    "What's our cash flow situation?",
    "Which products have the best margins?",
    "Give me a business health summary",
    "What should I focus on today?",
    "Any unusual patterns in our data?",
];

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function buildBusinessContext(): Promise<string> {
    try {
        const [customers, invoices, payments, products, pos] = await Promise.allSettled([
            getCustomers(), getInvoices(), getPayments(), getProducts(), getPurchaseOrders(),
        ]);
        const custs = customers.status === 'fulfilled' ? customers.value : [];
        const invs = invoices.status === 'fulfilled' ? invoices.value : [];
        const pays = payments.status === 'fulfilled' ? payments.value : [];
        const prods = products.status === 'fulfilled' ? products.value : [];
        const purchOrders = pos.status === 'fulfilled' ? pos.value : [];

        const today = new Date();
        const thisMonth = today.getMonth();
        const thisYear = today.getFullYear();

        const thisMonthInvoices = invs.filter(i => {
            const d = new Date(i.invoiceDate);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        });

        const lastMonthInvoices = invs.filter(i => {
            const d = new Date(i.invoiceDate);
            const lm = thisMonth === 0 ? 11 : thisMonth - 1;
            const ly = thisMonth === 0 ? thisYear - 1 : thisYear;
            return d.getMonth() === lm && d.getFullYear() === ly;
        });

        const thisMonthRev = thisMonthInvoices.reduce((s, i) => s + i.grandTotal, 0);
        const lastMonthRev = lastMonthInvoices.reduce((s, i) => s + i.grandTotal, 0);
        const revGrowth = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev * 100).toFixed(1) : 'N/A';

        const overdueInvs = invs.filter(i => i.status !== 'Paid' && new Date(i.dueDate) < today);
        const totalAR = invs.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.grandTotal - (i.amount_paid || 0), 0);

        // Customer purchase frequency
        const custPurchases: Record<string, number> = {};
        invs.forEach(i => { custPurchases[i.customerName] = (custPurchases[i.customerName] || 0) + 1; });
        const topCustomers = Object.entries(custPurchases).sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([name, count]) => `${name}: ${count} orders`).join(', ');

        const lowStockProds = prods.filter(p => (p.locations?.[0]?.currentStock || 0) <= (p.reorderLevel || 10));
        const zeroStock = prods.filter(p => (p.locations?.[0]?.currentStock || 0) === 0);

        const totalCollected = pays.reduce((s, p) => s + (p.amount || 0), 0);

        return `
=== SOLTOL — BUSINESS INTELLIGENCE DASHBOARD ===
Report Date: ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Industry: Oil & Lubricants Distribution, New York, USA

REVENUE:
- This month: ${formatCurrency(thisMonthRev)} (${invs.filter(i => { const d=new Date(i.invoiceDate); return d.getMonth()===thisMonth&&d.getFullYear()===thisYear; }).length} invoices)
- Last month: ${formatCurrency(lastMonthRev)}
- Month-over-month growth: ${revGrowth}%
- Total collected (all time): ${formatCurrency(totalCollected)}

ACCOUNTS RECEIVABLE:
- Total outstanding: ${formatCurrency(totalAR)}
- Overdue invoices: ${overdueInvs.length} (${formatCurrency(overdueInvs.reduce((s,i)=>s+i.grandTotal,0))})
- Invoice count: ${invs.length} total

CUSTOMERS:
- Total: ${custs.length}
- Active buyers: ${Object.keys(custPurchases).length}
- Top customers by order frequency: ${topCustomers}

INVENTORY:
- Products: ${prods.length} in catalog
- Low stock: ${lowStockProds.length} products (${lowStockProds.map(p=>p.name).slice(0,5).join(', ')})
- Zero stock: ${zeroStock.length} products
- Total stock value: ${formatCurrency(prods.reduce((s,p)=>{const stock=p.locations?.[0]?.currentStock||0; const cost=p.pricing?.purchasePriceExWorks||0; return s+stock*cost;},0))}

PROCUREMENT:
- Purchase orders: ${purchOrders.length} total
- Pending approval: ${purchOrders.filter(p=>p.status==='Pending').length}
- Received this month: ${purchOrders.filter(p=>p.status==='Received').length}

PRODUCTS CATALOG:
${prods.slice(0,15).map(p=>`• ${p.name} | Cost: ${formatCurrency(p.pricing?.purchasePriceExWorks||0)} | Stock: ${p.locations?.[0]?.currentStock||0} units`).join('\n')}
`.trim();
    } catch (e) {
        return 'Live data temporarily unavailable. Answering from general business knowledge.';
    }
}

export default function BusinessAdvisorAgent() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([{
        id: '1',
        role: 'agent',
        content: "Good day. I'm **Marcus**, your Senior Business Advisor at Soltol.\n\nI've analyzed your complete ERP data — revenue trends, customer patterns, inventory position, and cash flow. I give you direct, actionable advice — no fluff.\n\nWhat would you like to tackle today?",
        timestamp: new Date(),
    }]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [contextLoaded, setContextLoaded] = useState(false);
    const [erpContext, setErpContext] = useState('');
    const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        buildBusinessContext().then(ctx => { setErpContext(ctx); setContextLoaded(true); });
    }, []);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const sendMessage = async (text?: string) => {
        const userText = text || input.trim();
        if (!userText || loading) return;
        setInput('');

        setMessages(prev => [...prev,
            { id: Date.now().toString(), role: 'user', content: userText, timestamp: new Date() },
            { id: 'typing', role: 'agent', content: '', timestamp: new Date(), typing: true }
        ]);
        setLoading(true);

        const newHistory = [...history, { role: 'user', content: userText }];

        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are Marcus Reid, Senior Business Advisor for Soltol, an oil distribution company in New York.

PERSONA: You are a seasoned CFO/COO-level advisor with 20 years in oil distribution. You are:
- Direct and confident — give recommendations, not options
- Data-driven — always reference specific numbers from the ERP data
- Proactive — spot problems before they're asked about
- Concise — no filler words, no generic advice
- Honest — if something looks bad, say so clearly

TONE: Like talking to a trusted senior advisor at a board meeting. Professional but human.
- "I'm seeing a concerning pattern in..." 
- "Here's what I'd do..."
- "The numbers tell a clear story..."
- "Your immediate priority should be..."

LIVE ERP DATA:
${erpContext}

RULES:
- Reference exact figures from the data
- Give a clear recommendation at the end of every response
- Flag risks proactively even if not asked
- Keep responses under 250 words unless detailed analysis is requested
- Use bullet points for multi-item lists`,
                    max_tokens: 1000,
                    messages: newHistory,
                })
            });

            const data = await res.json();
            const reply = data.reply || 'Connection issue. Please try again.';
            setHistory([...newHistory, { role: 'assistant', content: reply }]);
            setMessages(prev => prev.filter(m => m.id !== 'typing').concat({
                id: Date.now().toString(), role: 'agent', content: reply, timestamp: new Date(),
            }));
        } catch {
            setMessages(prev => prev.filter(m => m.id !== 'typing').concat({
                id: Date.now().toString(), role: 'agent', content: 'Network error. Please try again.', timestamp: new Date(),
            }));
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const renderMessage = (content: string) => content.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="font-black text-gray-900">{part.slice(2,-2)}</strong>
                : part
        );
        if (line.startsWith('• ') || line.startsWith('- '))
            return <p key={i} className="pl-3 text-gray-700 flex gap-1.5 text-sm"><span className="text-gray-400 flex-shrink-0 mt-0.5">•</span><span>{rendered.map((p,j)=>typeof p==='string'?p:<span key={j}>{p}</span>)}</span></p>;
        return <p key={i} className="text-sm text-gray-700 leading-relaxed">{rendered}</p>;
    });

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-[900px] mx-auto animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-4 mb-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/agents')} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                        <ArrowLeft size={16} className="text-gray-400" />
                    </button>
                    <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                        <Brain size={20} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-white">Marcus Reid</p>
                            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                        </div>
                        <p className="text-[10px] text-gray-400">Senior Business Advisor · Soltol</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${contextLoaded ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {contextLoaded ? '✓ Data loaded' : '⟳ Loading...'}
                    </span>
                    <button onClick={() => { setMessages([messages[0]]); setHistory([]); }}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-all" title="Reset">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-2">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === 'agent' ? 'bg-orange-500' : 'bg-gray-700'}`}>
                            {msg.role === 'agent' ? <Brain size={15} className="text-white" /> : <User size={15} className="text-white" />}
                        </div>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${msg.role === 'agent' ? 'bg-white border border-gray-100 shadow-sm' : 'bg-gray-800'}`}>
                            {msg.typing ? (
                                <div className="flex gap-1 py-1">
                                    {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
                                </div>
                            ) : msg.role === 'agent' ? (
                                <div className="space-y-0.5">{renderMessage(msg.content)}</div>
                            ) : (
                                <p className="text-sm text-white">{msg.content}</p>
                            )}
                            <p className={`text-[9px] mt-1.5 ${msg.role==='agent'?'text-gray-300':'text-gray-500'}`}>
                                {msg.timestamp.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Suggested */}
            {messages.length <= 2 && (
                <div className="flex gap-2 flex-wrap mb-2 flex-shrink-0">
                    {SUGGESTED.map((s, i) => (
                        <button key={i} onClick={() => sendMessage(s)}
                            className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-all font-medium">
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 flex gap-3 items-end flex-shrink-0 shadow-sm">
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Ask Marcus about revenue, customers, inventory, strategy..."
                    rows={1} className="flex-1 resize-none text-sm focus:outline-none text-gray-800 placeholder-gray-400 max-h-28" />
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                    className="w-9 h-9 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0">
                    {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
            </div>
            <p className="text-[10px] text-center text-gray-300 mt-1.5 flex-shrink-0">Marcus · Senior Business Advisor · Claude-powered · Enter to send</p>
        </div>
    );
}
