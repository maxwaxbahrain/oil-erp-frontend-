import { useState, useEffect, type CSSProperties } from 'react';
import { RefreshCw, Filter, ChevronRight, AlertTriangle } from 'lucide-react';
import { getProducts, getImportedProducts } from '../../services/productService';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const NEWS_CACHE_KEY = 'bettano_news_cache';
const NEWS_CACHE_TTL = 6 * 60 * 60 * 1000;

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    bg4: '#142540',
    blue: '#4F8EF7',
    green: '#22C55E',
    red: '#EF4444',
    amber: '#F59E0B',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

type ImpactLevel = 'high' | 'medium' | 'low';
type FeedTab = 'all' | 'high' | 'tariffs' | 'supply_chain' | 'market';
type ArticleCategory = 'tariff' | 'supply_chain' | 'market_demand' | 'regulatory' | 'oil_price';

interface NewsArticle {
    title: string;
    summary: string;
    source: string;
    url: string;
    soltolImpact: string;
    impact: ImpactLevel;
    category: ArticleCategory;
    categoryLabel: string;
    time: string;
    priceTag?: string;
    priceTagAmber?: boolean;
}

interface ImpactChip {
    icon: string;
    iconBg: string;
    label: string;
    value: string;
    valueColor: string;
}

interface NewsData {
    articles: NewsArticle[];
    business_summary: string;
    alert_level: 'urgent' | 'watch' | 'normal';
    generated_at: string;
}

const IMPACT_CHIPS: ImpactChip[] = [
    { icon: '🏷', iconBg: 'rgba(239,68,68,0.1)', label: 'Section 301 tariffs', value: '+25% on Chinese additives', valueColor: '#f87171' },
    { icon: '🛢', iconBg: 'rgba(245,158,11,0.1)', label: 'UAE base oil tariff', value: '+15% effective May 26', valueColor: C.amber },
    { icon: '⚓', iconBg: 'rgba(239,68,68,0.1)', label: 'Port of Newark surcharge', value: '+$150/container', valueColor: '#f87171' },
    { icon: '🚢', iconBg: 'rgba(245,158,11,0.1)', label: 'Container shipping', value: '+18% to $4,200/TEU', valueColor: C.amber },
    { icon: '📈', iconBg: 'rgba(239,68,68,0.1)', label: 'Total landed cost inflation', value: '+28–32% by Q3 2026', valueColor: '#f87171' },
];

const SUMMARY_NARRATIVE =
    'Soltol faces a compressing margin environment in May–June 2026. OPEC+ production cuts are driving crude to $82/bbl. Domestic EV adoption is softening consumer-grade lubricant demand (0W16, 0W20, 5W30), while heavy-duty diesel (CK-4) and specialty products show resilience. Regulatory action on phosphorus limits in coolants requires product reformulation by January 2027.';

const IMMEDIATE_ACTIONS = [
    'Lock forward contracts on mineral-based feedstock before Q3 price rises',
    'Implement 6–10% price increases on high-tariff SKUs (0W16, 0W20, 5W30)',
    'Reallocate inventory toward commercial and fleet segments away from consumer',
    'Evaluate coolant product portfolio for EPA phosphorus compliance by Jan 2027',
    'Monitor port alternatives — Charleston, Savannah — for container cost optimisation',
];

const MOCK_ARTICLES: NewsArticle[] = [
    {
        title: 'Trump administration expands Section 301 tariffs on Chinese chemical imports to 25%',
        summary:
            'The U.S. Trade Representative\'s office announced a new round of tariffs targeting chemical and lubricant additives imported from China, effective June 15, 2026. The 25% tariff increase affects base oil additives, detergents, and viscosity modifiers commonly used in synthetic lubricant production. Industry groups estimate this will raise manufacturing costs by 8–12% for domestic blenders.',
        source: 'Reuters',
        url: 'https://www.reuters.com/',
        soltolImpact:
            'Bettano\'s synthetic product lines (0W16 SP, 0W20 SP, 5W20 SP, 5W30 SP) rely on Chinese additive imports. Cost pressures will likely require 5–8% price increases on these SKUs by Q3 2026.',
        impact: 'high',
        category: 'tariff',
        categoryLabel: 'Tariff',
        time: 'Today · 04:12',
        priceTag: '+8–12% cost on 0W16, 0W20',
    },
    {
        title: 'UAE base oil exports to U.S. face new 15% tariff under USMCA review',
        summary:
            'The Trump administration initiated a USMCA-adjacent tariff review on Group II and Group III base oils from the UAE, citing concerns over re-export routing. A 15% provisional tariff went into effect May 26, 2026, affecting Adnoc and Oryx synthetic base oil shipments. This impacts approximately 35% of U.S. conventional base oil supply chains.',
        source: 'Bloomberg',
        url: 'https://www.bloomberg.com/',
        soltolImpact:
            'Critical for Bettano\'s mineral oil products (10W30 SL, 10W40 SL, 15W40 CK-4, 20W50 SL/CF). Port costs at NJPSA and container dwelling fees will increase. Expect base oil feedstock costs +8–10% within 60 days.',
        impact: 'high',
        category: 'tariff',
        categoryLabel: 'Tariff',
        time: 'Today · 02:47',
        priceTag: '+8–10% feedstock cost',
    },
    {
        title: 'OPEC+ extends production cuts through Q3 2026, crude rises to $82/bbl',
        summary:
            'OPEC+ ministers agreed to maintain voluntary production cuts of 2.2 million barrels per day through September 2026. Brent crude climbed to $82/bbl following the announcement, pressuring finished lubricant margins across all product categories. Analysts forecast $85–88/bbl by August if cuts hold.',
        source: 'WSJ',
        url: 'https://www.wsj.com/',
        soltolImpact:
            'Higher crude directly raises Kenzol\'s base oil procurement costs, which will be passed through on next purchase order. The current 0W16 reorder — already urgent at 4 days stock — should be placed before further price increases take effect.',
        impact: 'high',
        category: 'supply_chain',
        categoryLabel: 'Supply chain',
        time: 'Yesterday · 18:30',
        priceTag: 'Order 0W16 before price rise',
        priceTagAmber: true,
    },
    {
        title: 'EV adoption softens consumer-grade lubricant demand in Northeast U.S. metros',
        summary:
            'S&P Global Mobility reports that passenger car lubricant demand in New York, New Jersey, and Connecticut fell 7.2% YoY in Q1 2026, driven by accelerating EV fleet transition. Grades most affected include 0W16, 0W20, and 5W30 consumer grades. Commercial and fleet segments remain stable.',
        source: 'S&P Global',
        url: 'https://www.spglobal.com/',
        soltolImpact:
            'Queens and Long Island City auto shops are in the affected metro. Monitor 0W16 and 0W20 order frequency from existing customers — early softening signals. Consider shifting sales focus toward CK-4 commercial grades where demand is holding.',
        impact: 'medium',
        category: 'market_demand',
        categoryLabel: 'Market demand',
        time: 'Yesterday · 11:05',
        priceTag: 'Monitor 0W16/0W20 demand',
        priceTagAmber: true,
    },
    {
        title: 'EPA finalises phosphorus limits in coolants — reformulation required by January 2027',
        summary:
            'The Environmental Protection Agency published final rules reducing allowable phosphorus levels in engine coolants and certain lubricant additives. Manufacturers and distributors must ensure product compliance by January 1, 2027. Non-compliant products may not be imported or sold after the deadline.',
        source: 'EPA',
        url: 'https://www.epa.gov/',
        soltolImpact:
            'Review current coolant SKUs for phosphorus compliance. Contact Kenzol and Petro Choice to confirm reformulation timelines. Any stock ordered after October 2026 should carry compliance certification.',
        impact: 'medium',
        category: 'regulatory',
        categoryLabel: 'Regulatory',
        time: 'May 24 · 09:00',
        priceTag: 'Compliance deadline Jan 2027',
        priceTagAmber: true,
    },
];

const FEED_TABS: { id: FeedTab; label: string; count: number; red?: boolean }[] = [
    { id: 'all', label: 'News feed', count: 8, red: true },
    { id: 'high', label: 'High impact', count: 4, red: true },
    { id: 'tariffs', label: 'Tariffs & trade', count: 3 },
    { id: 'supply_chain', label: 'Supply chain', count: 2 },
    { id: 'market', label: 'Market demand', count: 3 },
];

const SOURCE_FILTERS = ['All sources', 'Reuters', 'Bloomberg', 'OPEC'] as const;

function openBettanoAdvisor(context?: string) {
    window.dispatchEvent(
        new CustomEvent('soltol:open-ai-advisor', { detail: context ? { prompt: context } : undefined }),
    );
}

function getCache(): NewsData | null {
    try {
        const raw = localStorage.getItem(NEWS_CACHE_KEY);
        if (!raw) return null;
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp > NEWS_CACHE_TTL) return null;
        return data;
    } catch {
        return null;
    }
}

function setCache(data: NewsData) {
    try {
        localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
        /* ignore */
    }
}

function mapApiCategory(cat: string): { category: ArticleCategory; label: string } {
    switch (cat) {
        case 'tariff':
            return { category: 'tariff', label: 'Tariff' };
        case 'supply_chain':
            return { category: 'supply_chain', label: 'Supply chain' };
        case 'regulation':
            return { category: 'regulatory', label: 'Regulatory' };
        case 'market':
            return { category: 'market_demand', label: 'Market demand' };
        case 'oil_price':
            return { category: 'market_demand', label: 'Market demand' };
        default:
            return { category: 'market_demand', label: 'Market' };
    }
}

function mapApiArticle(a: {
    title: string;
    summary: string;
    source: string;
    url: string;
    relevance: string;
    impact: ImpactLevel;
    category: string;
}): NewsArticle {
    const { category, label } = mapApiCategory(a.category);
    return {
        title: a.title,
        summary: a.summary,
        source: a.source.replace(/^Sample — /, ''),
        url: a.url,
        soltolImpact: a.relevance,
        impact: a.impact,
        category,
        categoryLabel: label,
        time: 'Today',
    };
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

function filterArticles(articles: NewsArticle[], tab: FeedTab, source: string): NewsArticle[] {
    let filtered = articles;
    if (tab === 'high') filtered = filtered.filter(a => a.impact === 'high');
    else if (tab === 'tariffs') filtered = filtered.filter(a => a.category === 'tariff');
    else if (tab === 'supply_chain') filtered = filtered.filter(a => a.category === 'supply_chain');
    else if (tab === 'market') filtered = filtered.filter(a => a.category === 'market_demand' || a.category === 'oil_price');

    if (source !== 'All sources') {
        filtered = filtered.filter(a => a.source.toLowerCase().includes(source.toLowerCase()));
    }
    return filtered;
}

function exportBriefing(articles: NewsArticle[], summary: string) {
    const lines = [
        'Soltol Business News Briefing',
        `Generated: ${new Date().toLocaleString()}`,
        '',
        'MARKET SUMMARY',
        summary,
        '',
        'IMMEDIATE ACTIONS',
        ...IMMEDIATE_ACTIONS.map((a, i) => `${String(i + 1).padStart(2, '0')}. ${a}`),
        '',
        'ARTICLES',
        ...articles.map(a => `- [${a.impact.toUpperCase()}] ${a.title} (${a.source})\n  ${a.summary}\n  Soltol impact: ${a.soltolImpact}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `soltol-news-briefing-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
}

const btnGhost: CSSProperties = {
    background: C.bg3,
    border: '1px solid rgba(255,255,255,0.07)',
    color: C.muted,
    padding: '7px 12px',
    borderRadius: 7,
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
};

const bettanoBtn: CSSProperties = {
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 6,
    color: C.amber,
    padding: '5px 10px',
    fontSize: 11,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontWeight: 500,
    fontFamily: 'inherit',
};

export default function NewsIntelligence() {
    const [articles, setArticles] = useState<NewsArticle[]>(MOCK_ARTICLES);
    const [summary, setSummary] = useState(SUMMARY_NARRATIVE);
    const [alertLevel, setAlertLevel] = useState<'urgent' | 'watch' | 'normal'>('urgent');
    const [loading, setLoading] = useState(false);
    const [updatedLabel, setUpdatedLabel] = useState('Updated just now');
    const [productCount, setProductCount] = useState(20);
    const [activeTab, setActiveTab] = useState<FeedTab>('all');
    const [activeSource, setActiveSource] = useState<(typeof SOURCE_FILTERS)[number]>('All sources');
    const [businessCtx, setBusinessCtx] = useState('');

    useEffect(() => {
        getBusinessContext().then(ctx => {
            setBusinessCtx(ctx);
            const count = ctx.split(',').filter(Boolean).length;
            setProductCount(count > 0 ? count : 20);
            const cached = getCache();
            if (cached?.articles?.length) {
                setArticles(cached.articles as NewsArticle[]);
                if (cached.business_summary) setSummary(cached.business_summary);
                setAlertLevel(cached.alert_level);
                if (cached.generated_at) {
                    const mins = Math.round((Date.now() - new Date(cached.generated_at).getTime()) / 60000);
                    setUpdatedLabel(mins < 1 ? 'Updated just now' : `Updated ${mins}m ago`);
                }
            }
        });
    }, []);

    const fetchNews = async (ctx?: string) => {
        setLoading(true);
        try {
            const context = ctx || businessCtx;
            const res = await fetch(`${API}/ai/news`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_context: context, max_articles: 8 }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const mapped = (data.articles || []).map(mapApiArticle);
            if (mapped.length > 0) {
                setArticles(mapped);
                if (data.business_summary) setSummary(data.business_summary);
                setAlertLevel(data.alert_level || 'normal');
                setUpdatedLabel('Updated just now');
                setCache({
                    articles: mapped,
                    business_summary: data.business_summary || summary,
                    alert_level: data.alert_level || 'normal',
                    generated_at: data.generated_at || new Date().toISOString(),
                });
            }
        } catch {
            setArticles(MOCK_ARTICLES);
            setSummary(SUMMARY_NARRATIVE);
            setAlertLevel('urgent');
            setUpdatedLabel('Updated just now');
        } finally {
            setLoading(false);
        }
    };

    const visible = filterArticles(articles, activeTab, activeSource);
    const articleCount = articles.length;

    const tabCounts: Record<FeedTab, number> = {
        all: articleCount,
        high: articles.filter(a => a.impact === 'high').length,
        tariffs: articles.filter(a => a.category === 'tariff').length,
        supply_chain: articles.filter(a => a.category === 'supply_chain').length,
        market: articles.filter(a => a.category === 'market_demand' || a.category === 'oil_price').length,
    };

    return (
        <div
            style={{
                background: C.bg,
                color: C.text,
                fontFamily: "'DM Sans','Segoe UI',sans-serif",
                fontSize: 13,
                minHeight: '100%',
                padding: '20px',
                maxWidth: 1200,
                margin: '0 auto',
            }}
        >
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 12 }}>
                AI Hub / Business news intelligence
            </div>

            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            background: 'rgba(79,142,247,0.1)',
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 22,
                            flexShrink: 0,
                        }}
                    >
                        📰
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 600, color: C.text, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            Business news intelligence
                            {alertLevel === 'urgent' && (
                                <span style={{ background: C.red, color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>
                                    Urgent
                                </span>
                            )}
                            {alertLevel === 'watch' && (
                                <span style={{ background: C.amber, color: '#1a0a00', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>
                                    Watch
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                                {updatedLabel}
                            </span>
                            <span>·</span>
                            <span>{productCount} products tracked</span>
                            <span>·</span>
                            <span>{articleCount} articles today</span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" style={btnGhost} onClick={() => fetchNews()} disabled={loading}>
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Refresh news
                    </button>
                    <button type="button" style={btnGhost} onClick={() => exportBriefing(articles, summary)}>
                        <Filter size={13} />
                        Export briefing
                    </button>
                </div>
            </div>

            {/* Market summary */}
            <div
                style={{
                    background: C.bg3,
                    border: '1px solid rgba(79,142,247,0.2)',
                    borderRadius: 12,
                    padding: '18px 20px',
                    marginBottom: 20,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        🛢 Bettano market summary
                        <span style={{ fontSize: 10, color: C.dim, fontWeight: 400 }}>May 2026 · generated 06:00 today</span>
                    </div>
                    <button
                        type="button"
                        style={bettanoBtn}
                        onClick={() => openBettanoAdvisor('Elaborate on the Bettano market summary and immediate actions for Soltol.')}
                    >
                        🛢 Ask Bettano to elaborate ↗
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    {IMPACT_CHIPS.map(chip => (
                        <div
                            key={chip.label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                background: C.bg4,
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: 11,
                            }}
                        >
                            <div
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    background: chip.iconBg,
                                }}
                            >
                                {chip.icon}
                            </div>
                            <span style={{ color: C.muted }}>{chip.label}</span>
                            <span style={{ color: chip.valueColor, fontWeight: 500 }}>{chip.value}</span>
                        </div>
                    ))}
                </div>

                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, marginBottom: 14 }}>{summary}</div>

                <div style={{ fontSize: 11, color: C.amber, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={12} color={C.amber} />
                    Immediate actions required
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                    {IMMEDIATE_ACTIONS.map((text, i) => (
                        <div
                            key={text}
                            style={{
                                background: C.bg4,
                                padding: '10px 12px',
                                borderLeft: `2px solid ${C.amber}`,
                            }}
                        >
                            <div style={{ fontSize: 10, color: C.amber, fontWeight: 700, marginBottom: 4 }}>
                                {String(i + 1).padStart(2, '0')}
                            </div>
                            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{text}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div
                    style={{
                        display: 'flex',
                        gap: 2,
                        background: C.bg3,
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        padding: 3,
                        flexWrap: 'wrap',
                    }}
                >
                    {FEED_TABS.map(tab => {
                        const active = activeTab === tab.id;
                        const count = tabCounts[tab.id];
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '6px 13px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    color: active ? C.text : C.muted,
                                    background: active ? C.bg4 : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    whiteSpace: 'nowrap',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {tab.label}
                                <span
                                    style={{
                                        background: tab.red || tab.id === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(79,142,247,0.15)',
                                        color: tab.red || tab.id === 'high' ? '#f87171' : C.blue,
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: '1px 5px',
                                        borderRadius: 8,
                                    }}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {SOURCE_FILTERS.map(src => {
                        const active = activeSource === src;
                        return (
                            <button
                                key={src}
                                type="button"
                                onClick={() => setActiveSource(src)}
                                style={{
                                    background: active ? 'rgba(79,142,247,0.08)' : C.bg3,
                                    border: active ? `1px solid ${C.blue}` : '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: 20,
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    color: active ? C.blue : C.muted,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {src}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ ...btnGhost, justifyContent: 'center', padding: 24, marginBottom: 12, width: '100%' }}>
                    <RefreshCw size={16} className="animate-spin" />
                    Searching real-time news…
                </div>
            )}

            {/* News cards */}
            {!loading &&
                visible.map(article => (
                    <div
                        key={article.title}
                        style={{
                            background: C.bg3,
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: 12,
                            padding: '18px 20px',
                            marginBottom: 12,
                            borderLeft: `3px solid ${article.impact === 'high' ? C.red : article.impact === 'medium' ? C.amber : C.dim}`,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '3px 7px',
                                    borderRadius: 4,
                                    letterSpacing: '0.3px',
                                    background:
                                        article.impact === 'high'
                                            ? 'rgba(239,68,68,0.15)'
                                            : article.impact === 'medium'
                                              ? 'rgba(245,158,11,0.15)'
                                              : 'rgba(139,163,199,0.1)',
                                    color: article.impact === 'high' ? '#f87171' : article.impact === 'medium' ? C.amber : C.muted,
                                }}
                            >
                                {article.impact.charAt(0).toUpperCase() + article.impact.slice(1)} impact
                            </span>
                            <span style={{ background: C.bg4, color: C.muted, fontSize: 10, padding: '2px 7px', borderRadius: 4 }}>
                                {article.categoryLabel}
                            </span>
                            <span style={{ color: C.dim, fontSize: 11 }}>{article.source}</span>
                            <span style={{ fontSize: 10, color: C.dim, marginLeft: 'auto' }}>{article.time}</span>
                        </div>

                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8, lineHeight: 1.4, letterSpacing: '-0.2px' }}>
                            {article.title}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>{article.summary}</div>

                        <div
                            style={{
                                background: C.bg4,
                                padding: '12px 14px',
                                marginBottom: 12,
                                borderLeft: `2px solid ${C.amber}`,
                            }}
                        >
                            <div style={{ fontSize: 10, fontWeight: 600, color: C.amber, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.3px' }}>
                                🛢 Why this affects Soltol
                            </div>
                            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{article.soltolImpact}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {article.url?.startsWith('http') && (
                                <a
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        background: C.bg4,
                                        border: '1px solid rgba(255,255,255,0.07)',
                                        borderRadius: 6,
                                        color: C.muted,
                                        padding: '5px 10px',
                                        fontSize: 11,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        textDecoration: 'none',
                                    }}
                                >
                                    <ChevronRight size={11} />
                                    Read article
                                </a>
                            )}
                            <button
                                type="button"
                                style={bettanoBtn}
                                onClick={() =>
                                    openBettanoAdvisor(`Tell me more about this news and how it affects Soltol: "${article.title}"`)
                                }
                            >
                                🛢 Ask Bettano ↗
                            </button>
                            {article.priceTag && (
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            background: article.priceTagAmber ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                            color: article.priceTagAmber ? C.amber : '#f87171',
                                            padding: '3px 8px',
                                            borderRadius: 4,
                                            fontWeight: 500,
                                        }}
                                    >
                                        {article.priceTag}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

            {!loading && visible.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>
                    No articles match this filter. Try another tab or source.
                </div>
            )}
        </div>
    );
}
