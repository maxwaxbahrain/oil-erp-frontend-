import { useState, useEffect, type CSSProperties } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { getProducts, getImportedProducts } from '../../services/productService';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const NEWS_CACHE_KEY = 'bettano_news_cache';

const C = {
    bg: '#060f1c',
    bg3: '#0f1f33',
    bg4: '#142540',
    blue: '#4F8EF7',
    amber: '#F59E0B',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

interface NewsStatus {
    message: string;
    business_summary: string;
    source_configured: boolean;
    authoritative: boolean;
    generated_at?: string;
}

async function getBusinessContext(): Promise<{ context: string; count: number }> {
    try {
        const imported = getImportedProducts();
        const allProds = await getProducts();
        const products = [...imported, ...allProds].filter(p => p?.name);
        return {
            context: products.slice(0, 20).map(p => p.name).join(', '),
            count: products.length,
        };
    } catch {
        return { context: '', count: 0 };
    }
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

const unavailableStatus: NewsStatus = {
    message: 'Live news source not connected.',
    business_summary: 'Live news source not connected.',
    source_configured: false,
    authoritative: false,
};

export default function NewsIntelligence() {
    const [status, setStatus] = useState<NewsStatus>(unavailableStatus);
    const [loading, setLoading] = useState(false);
    const [updatedLabel, setUpdatedLabel] = useState('Not connected');
    const [productCount, setProductCount] = useState(0);
    const [businessCtx, setBusinessCtx] = useState('');

    useEffect(() => {
        localStorage.removeItem(NEWS_CACHE_KEY);
        getBusinessContext().then(({ context, count }) => {
            setBusinessCtx(context);
            setProductCount(count);
        });
    }, []);

    const refreshStatus = async (ctx?: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/ai/news`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_context: ctx || businessCtx, max_articles: 0 }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setStatus({
                message: data.message || 'Live news source not connected.',
                business_summary: data.business_summary || 'Live news source not connected.',
                source_configured: Boolean(data.source_configured),
                authoritative: Boolean(data.authoritative),
                generated_at: data.generated_at,
            });
            setUpdatedLabel(data.generated_at ? `Checked ${new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Checked just now');
        } catch {
            setStatus(unavailableStatus);
            setUpdatedLabel('Unable to check source');
        } finally {
            setLoading(false);
        }
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
                        N
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 600, color: C.text, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            Business news intelligence
                            <span style={{ background: 'rgba(245,158,11,0.16)', color: C.amber, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>
                                Not connected
                            </span>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <span>{updatedLabel}</span>
                            <span>·</span>
                            <span>{productCount || '—'} products available for future context</span>
                            <span>·</span>
                            <span>0 sourced articles</span>
                        </div>
                    </div>
                </div>
                <button type="button" style={btnGhost} onClick={() => refreshStatus()} disabled={loading}>
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    Check news source
                </button>
            </div>

            <div
                style={{
                    background: C.bg3,
                    border: '1px solid rgba(245,158,11,0.24)',
                    borderRadius: 12,
                    padding: '22px 24px',
                    marginBottom: 20,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <AlertTriangle size={22} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>
                            Live news source not connected.
                        </h1>
                        <p style={{ margin: '10px 0 0', maxWidth: 720, color: C.muted, fontSize: 13, lineHeight: 1.65 }}>
                            This page previously displayed AI-generated and hardcoded article headlines, outlet attributions, tariff-impact chips, and canned actions without a real news provider. Those items are hidden until a live, sourced news feed is connected.
                        </p>
                        <div
                            style={{
                                marginTop: 16,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: 10,
                            }}
                        >
                            {[
                                ['Sourced articles', '—'],
                                ['Tariff impact chips', '—'],
                                ['Immediate actions', '—'],
                                ['Source authority', status.authoritative ? 'Verified' : 'Not available'],
                            ].map(([label, value]) => (
                                <div key={label} style={{ background: C.bg4, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, padding: '12px 14px' }}>
                                    <div style={{ color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{label}</div>
                                    <div style={{ color: C.text, fontSize: 22, marginTop: 6, fontWeight: 700 }}>{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ background: C.bg3, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>News feed</div>
                <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
                    No sourced articles are available. Connect a live news provider before showing headlines, outlet names, dates, market events, or business-impact recommendations.
                </div>
            </div>
        </div>
    );
}
