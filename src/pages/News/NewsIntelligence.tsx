import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Newspaper, RefreshCw, Send, ExternalLink,
    Globe, Zap, Clock, Bot, User
} from 'lucide-react';
import { getProducts, getImportedProducts } from '../../services/productService';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const NEWS_CACHE_KEY = 'bettano_news_cache';
const NEWS_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

interface NewsArticle {
    title: string;
    summary: string;
    source: string;
    url: string;
    relevance: string;
    impact: 'high' | 'medium' | 'low';
    category: 'tariff' | 'oil_price' | 'regulation' | 'market' | 'supply_chain';
}

interface NewsData {
    articles: NewsArticle[];
    business_summary: string;
    alert_level: 'urgent' | 'watch' | 'normal';
    generated_at: string;
    business_context?: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    articles?: NewsArticle[];
    typing?: boolean;
}

const IMPACT_STYLE: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const CAT_ICON: Record<string, string> = {
    tariff: '🚢',
    oil_price: '🛢️',
    regulation: '📋',
    market: '📈',
    supply_chain: '🔗',
};

const ALERT_STYLE: Record<string, string> = {
    urgent: 'bg-red-50 border-red-300 text-red-800',
    watch: 'bg-amber-50 border-amber-300 text-amber-800',
    normal: 'bg-emerald-50 border-emerald-300 text-emerald-800',
};

const QUICK_SEARCHES = [
    'Latest US tariffs on oil imports',
    'Lubricant prices this week',
    'NYC distribution news today',
    'OPEC supply decisions impact',
    'Base oil market update',
    'Import duty changes 2025',
];

// TC-77 — Sample fallback articles. Shown when the live news endpoint is
// unavailable so the page is never blank. Each card is clearly labeled
// "Sample" in the UI so users don't mistake them for live news.
const SAMPLE_FALLBACK_ARTICLES: NewsArticle[] = [
    {
        title: 'OPEC+ holds production cuts through Q2 — base oil prices firm',
        summary: 'Oil ministers extended the current voluntary production cuts, supporting base oil price floors. Distributors should expect $2–4/barrel firmness on Group I and II stocks over the next 60 days.',
        source: 'Sample — Reuters Energy',
        url: 'https://www.reuters.com/business/energy/',
        relevance: 'Base oil cost & margin planning',
        impact: 'high',
        category: 'oil_price',
    },
    {
        title: 'NYC DOT begins phased fuel surcharge audit for commercial fleets',
        summary: 'New York City has started auditing fuel-surcharge invoicing for delivery fleets operating in the five boroughs. Lubricant distributors with their own vans should ensure documented surcharge calculations are on file.',
        source: 'Sample — NYC Business Journal',
        url: 'https://www.nyc.gov/',
        relevance: 'Local delivery operations compliance',
        impact: 'medium',
        category: 'regulation',
    },
    {
        title: 'Port of Newark container dwell-times back to pre-2024 levels',
        summary: 'Average container dwell time at Newark has dropped to 4.1 days, the lowest in 14 months. Importers of finished lubricants and additives can plan tighter inventory cycles.',
        source: 'Sample — JOC Maritime',
        url: 'https://www.joc.com/',
        relevance: 'Inventory and reorder timing',
        impact: 'low',
        category: 'supply_chain',
    },
];

function getCache(): NewsData | null {
    try {
        const raw = localStorage.getItem(NEWS_CACHE_KEY);
        if (!raw) return null;
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp > NEWS_CACHE_TTL) return null;
        return data;
    } catch { return null; }
}

function setCache(data: NewsData) {
    try {
        localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* ignore */ }
}

async function getBusinessContext(): Promise<string> {
    try {
        const imported = getImportedProducts();
        const allProds = await getProducts();
        const products = [...imported, ...allProds].slice(0, 20);
        if (products.length === 0) return 'Engine oils, lubricants, ATF, gear oils — oil distribution';
        return products.map(p => p.name).filter(Boolean).join(', ');
    } catch {
        return 'Engine oils, lubricants, ATF — oil distribution';
    }
}

export default function NewsIntelligence() {
    const navigate = useNavigate();
    const [news, setNews] = useState<NewsData | null>(null);
    const [loading, setLoading] = useState(false);
    // TC-77 — show fetch errors to the user instead of swallowing them.
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [businessCtx, setBusinessCtx] = useState('');
    const [activeTab, setActiveTab] = useState<'feed' | 'chat'>('feed');
    const [chatHistory, setChatHistory] = useState<Array<{role: string; content: string}>>([]);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(true); // Show loading immediately
        getBusinessContext().then(ctx => {
            setBusinessCtx(ctx);
            const cached = getCache();
            if (cached && cached.articles && cached.articles.length > 0) {
                setNews(cached);
                setLoading(false);
            } else {
                fetchNews(ctx); // Auto-fetch if no valid cache
            }
        });
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchNews = async (ctx?: string) => {
        setLoading(true);
        setError(null);
        try {
            const context = ctx || businessCtx;
            const res = await fetch(`${API}/ai/news`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_context: context, max_articles: 8 })
            });
            if (!res.ok) {
                // Try to surface the backend's detail message when present.
                let detail = '';
                try { detail = (await res.json())?.detail || ''; } catch { /* not JSON */ }
                throw new Error(detail || `HTTP ${res.status}`);
            }
            const data: NewsData = await res.json();
            data.business_context = context;
            setNews(data);
            setCache(data);
        } catch (e: any) {
            console.error('News fetch failed:', e);
            setError(e instanceof Error ? e.message : 'Could not load news.');
        } finally {
            setLoading(false);
        }
    };

    const sendChat = async (text?: string) => {
        const userText = text || input.trim();
        if (!userText || chatLoading) return;
        setInput('');
        setActiveTab('chat');

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText, timestamp: new Date() };
        const typingMsg: ChatMessage = { id: 'typing', role: 'assistant', content: '', timestamp: new Date(), typing: true };
        setMessages(prev => [...prev, userMsg, typingMsg]);
        setChatLoading(true);

        const newHistory = [...chatHistory, { role: 'user', content: userText }];

        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are a business news analyst for Soltol, a NYC oil & lubricants distributor.

PRODUCTS IN THEIR ERP: ${businessCtx}

CURRENT NEWS CONTEXT:
${news ? `Alert Level: ${news.alert_level}
Business Summary: ${news.business_summary}
Recent Articles:
${news.articles.slice(0, 5).map(a => `- ${a.title} (${a.source}): ${a.summary}`).join('\n')}` : 'No news loaded yet.'}

Your role: Answer questions about business news, tariffs, oil prices, market conditions.
- Reference specific news articles when relevant
- Always explain HOW the news impacts Soltol specifically
- Give actionable advice based on the news
- If asked about tariffs, give specific percentages and affected products
- Keep responses concise and business-focused`,
                    max_tokens: 800,
                    messages: newHistory
                })
            });

            const data = await res.json();
            const reply = data.reply || 'Could not get response.';

            setChatHistory([...newHistory, { role: 'assistant', content: reply }]);
            setMessages(prev => prev.filter(m => m.id !== 'typing').concat({
                id: Date.now().toString(), role: 'assistant', content: reply, timestamp: new Date()
            }));
        } catch {
            setMessages(prev => prev.filter(m => m.id !== 'typing').concat({
                id: Date.now().toString(), role: 'assistant', content: 'Connection error. Please try again.', timestamp: new Date()
            }));
        } finally {
            setChatLoading(false);
        }
    };

    const alertLevel = news?.alert_level || 'normal';
    const timeAgo = news?.generated_at
        ? Math.round((Date.now() - new Date(news.generated_at).getTime()) / 60000)
        : null;

    return (
        <div className="space-y-4 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-300">

            {/* Header */}
            <div className={`rounded-2xl p-6 border-2 ${ALERT_STYLE[alertLevel]}`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-black/10 rounded-lg transition-all">
                            <ArrowLeft size={16} />
                        </button>
                        <div className="w-12 h-12 bg-white/60 rounded-xl flex items-center justify-center">
                            <Newspaper size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black uppercase tracking-tight">Business News Intelligence</h1>
                                {alertLevel === 'urgent' && <span className="animate-pulse text-xs font-black bg-red-600 text-white px-2 py-0.5 rounded-full">🔴 URGENT</span>}
                                {alertLevel === 'watch' && <span className="text-xs font-black bg-amber-600 text-white px-2 py-0.5 rounded-full">🟡 WATCH</span>}
                            </div>
                            <div className="flex items-center gap-3 text-xs opacity-70 mt-0.5">
                                <span>AI reads real news for your oil business</span>
                                {timeAgo !== null && <span className="flex items-center gap-1"><Clock size={11} /> Updated {timeAgo < 1 ? 'just now' : `${timeAgo}m ago`}</span>}
                                <span className="font-bold">{businessCtx.split(',').length} products tracked</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => fetchNews()} disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 disabled:opacity-50 transition-all">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Searching...' : 'Refresh News'}
                    </button>
                </div>

                {news?.business_summary && (
                    <div className="mt-4 p-4 bg-white/60 rounded-xl">
                        <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-60">Market Summary</p>
                        <p className="text-sm font-medium">{news.business_summary}</p>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {(['feed', 'chat'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === tab ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {tab === 'feed' ? `📰 News Feed ${news ? `(${news.articles.length})` : ''}` : `💬 Ask About News`}
                    </button>
                ))}
            </div>

            {/* News Feed */}
            {activeTab === 'feed' && (
                <div>
                    {loading && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                            <RefreshCw size={32} className="animate-spin text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500 font-bold">AI is searching real-time news...</p>
                            <p className="text-gray-400 text-sm mt-1">Reading your product catalog · Searching oil tariffs · Lubricant prices · NYC regulations · OPEC...</p>
                        </div>
                    )}

                    {/* TC-77 — visible error banner.  Surfaces missing
                        ANTHROPIC_API_KEY, network failures, and HTTP
                        errors instead of leaving the page looking
                        like nothing happened. */}
                    {!loading && error && (
                        <>
                            {/* TC-77 — User-friendly error banner with retry. The raw error
                                message is kept underneath in a smaller line for debugging. */}
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3 shadow-sm">
                                <div className="flex-1">
                                    <p className="text-amber-800 font-black uppercase tracking-widest text-xs mb-1">News feed unavailable</p>
                                    <p className="text-amber-800 text-sm">
                                        News feed unavailable — live news requires backend setup. Showing sample articles below so you can see what the feed looks like.
                                    </p>
                                    <p className="text-amber-700/70 text-[11px] font-mono mt-1">Backend said: {error}</p>
                                </div>
                                <button
                                    onClick={() => fetchNews()}
                                    className="px-4 py-2 bg-amber-600 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-amber-700 transition-all shadow"
                                >
                                    Retry
                                </button>
                            </div>
                            {/* TC-77 — Sample article cards so the page is never empty. */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2">Sample articles · for layout preview only</p>
                                {SAMPLE_FALLBACK_ARTICLES.map((article, i) => (
                                    <div key={`fallback-${i}`} className={`bg-white rounded-2xl border-2 p-5 shadow-sm transition-all hover:shadow-md ${article.impact === 'high' ? 'border-l-4 border-l-red-400' : article.impact === 'medium' ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-blue-300'} border-gray-100 opacity-90`}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    <span className="text-lg">{CAT_ICON[article.category] || '📰'}</span>
                                                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${IMPACT_STYLE[article.impact]}`}>{article.impact.toUpperCase()}</span>
                                                    <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-gray-100 text-gray-600 uppercase tracking-widest">Sample</span>
                                                </div>
                                                <h4 className="font-black text-gray-900 mb-2 leading-tight">{article.title}</h4>
                                                <p className="text-sm text-gray-600 leading-relaxed">{article.summary}</p>
                                                <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-400 font-bold">
                                                    <span>{article.source}</span>
                                                    <span>·</span>
                                                    <span className="italic">{article.relevance}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {!loading && !error && !news && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                            <Globe size={48} className="mx-auto text-gray-200 mb-4" />
                            <p className="text-gray-500 font-black">Click "Refresh News" to load today's business news</p>
                            <p className="text-gray-400 text-sm mt-1">AI will search for news relevant to oil distribution in NYC</p>
                        </div>
                    )}

                    {!loading && news && news.articles.length === 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                            <p className="text-gray-400 font-bold">No articles found in this search. Try refreshing.</p>
                        </div>
                    )}

                    {!loading && news && news.articles.length > 0 && (
                        <div className="space-y-3">
                            {news.articles.map((article, i) => (
                                <div key={i} className={`bg-white rounded-2xl border-2 p-5 shadow-sm transition-all hover:shadow-md ${article.impact === 'high' ? 'border-l-4 border-l-red-400' : article.impact === 'medium' ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-blue-300'} border-gray-100`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className="text-lg">{CAT_ICON[article.category] || '📰'}</span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${IMPACT_STYLE[article.impact]}`}>
                                                    {article.impact.toUpperCase()} IMPACT
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{article.category.replace('_',' ')}</span>
                                                <span className="text-[10px] font-bold text-gray-500">{article.source}</span>
                                            </div>
                                            <h3 className="text-sm font-black text-gray-900 mb-1.5 leading-tight">{article.title}</h3>
                                            <p className="text-xs text-gray-600 leading-relaxed mb-2">{article.summary}</p>
                                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-0.5">Why this affects Soltol</p>
                                                <p className="text-xs text-amber-800">{article.relevance}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 flex-shrink-0">
                                            {article.url && article.url.startsWith('http') && (
                                                <a href={article.url} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-black rounded-xl hover:bg-gray-700 transition-all whitespace-nowrap">
                                                    <ExternalLink size={12} /> Read Article
                                                </a>
                                            )}
                                            <button onClick={() => sendChat(`Tell me more about this news and how it affects our business: "${article.title}"`)}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-black rounded-xl hover:bg-orange-100 transition-all whitespace-nowrap">
                                                <Zap size={12} /> Ask Marcus
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Chat Tab */}
            {activeTab === 'chat' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" style={{ height: '520px' }}>
                    <div className="bg-gray-900 px-5 py-3 flex items-center gap-3 flex-shrink-0">
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                            <Bot size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-white">Marcus — News Analyst</p>
                            <p className="text-[10px] text-gray-400">Ask about tariffs, oil prices, market impact on your business</p>
                        </div>
                        <div className="ml-auto text-[10px] text-gray-400">
                            {news ? `${news.articles.length} articles in context` : 'Load news feed first'}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.length === 0 && (
                            <div className="py-8 text-center space-y-4">
                                <p className="text-gray-400 text-sm font-medium">Ask me anything about business news</p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {QUICK_SEARCHES.map((q, i) => (
                                        <button key={i} onClick={() => sendChat(q)}
                                            className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-all">
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-orange-500' : 'bg-gray-800'}`}>
                                    {msg.role === 'assistant' ? <Bot size={14} className="text-white" /> : <User size={14} className="text-white" />}
                                </div>
                                <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'assistant' ? 'bg-gray-50 border border-gray-100 text-gray-700' : 'bg-gray-900 text-white'}`}>
                                    {msg.typing ? (
                                        <div className="flex gap-1 py-1">
                                            {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    <div className="border-t border-gray-100 p-3 flex gap-2 flex-shrink-0">
                        <input value={input} onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendChat()}
                            placeholder="Ask about tariffs, oil prices, market trends..."
                            className="flex-1 text-sm focus:outline-none text-gray-800 placeholder-gray-400 px-1" />
                        <button onClick={() => sendChat()} disabled={!input.trim() || chatLoading}
                            className="w-9 h-9 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all">
                            {chatLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
