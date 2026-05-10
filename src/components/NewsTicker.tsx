import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, AlertTriangle, X } from 'lucide-react';

const NEWS_CACHE_KEY = 'bettano_news_cache';
const TICKER_DISMISSED_KEY = 'bettano_ticker_dismissed';

interface NewsTickerData {
    alert_level: string;
    business_summary: string;
    top_headline: string;
    articles_count: number;
}

export default function NewsTicker() {
    const navigate = useNavigate();
    const [tickerData, setTickerData] = useState<NewsTickerData | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Load from news cache
        const loadFromCache = () => {
            try {
                const raw = localStorage.getItem(NEWS_CACHE_KEY);
                if (!raw) return;
                const { data, timestamp } = JSON.parse(raw);
                // Show if cache is less than 12 hours old
                if (Date.now() - timestamp < 12 * 60 * 60 * 1000 && data?.articles?.length > 0) {
                    const topHighImpact = data.articles.find((a: any) => a.impact === 'high') || data.articles[0];
                    setTickerData({
                        alert_level: data.alert_level,
                        business_summary: data.business_summary,
                        top_headline: topHighImpact?.title || '',
                        articles_count: data.articles.length,
                    });
                }
            } catch { /* ignore */ }
        };

        loadFromCache();
        // Re-check every 5 minutes
        const interval = setInterval(loadFromCache, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Check if dismissed today
    useEffect(() => {
        try {
            const val = localStorage.getItem(TICKER_DISMISSED_KEY);
            if (val) {
                const { date } = JSON.parse(val);
                if (date === new Date().toDateString()) setDismissed(true);
            }
        } catch { /* ignore */ }
    }, []);

    const dismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDismissed(true);
        localStorage.setItem(TICKER_DISMISSED_KEY, JSON.stringify({ date: new Date().toDateString() }));
    };

    if (!tickerData || dismissed) return null;

    const isUrgent = tickerData.alert_level === 'urgent';
    const isWatch = tickerData.alert_level === 'watch';

    return (
        <div
            onClick={() => navigate('/news')}
            className={`mx-2 mb-2 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                isUrgent ? 'bg-red-900/80 border-red-700' :
                isWatch ? 'bg-amber-900/60 border-amber-700' :
                'bg-gray-800/60 border-gray-700'
            }`}
        >
            <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                        {isUrgent ? (
                            <AlertTriangle size={11} className="text-red-400 animate-pulse" />
                        ) : (
                            <Newspaper size={11} className={isWatch ? 'text-amber-400' : 'text-gray-400'} />
                        )}
                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                            isUrgent ? 'text-red-400' : isWatch ? 'text-amber-400' : 'text-gray-400'
                        }`}>
                            {isUrgent ? '🔴 Alert' : isWatch ? '🟡 Watch' : '📰 News'} · {tickerData.articles_count} articles
                        </span>
                    </div>
                    <button onClick={dismiss} className="text-gray-600 hover:text-gray-400 transition-all">
                        <X size={10} />
                    </button>
                </div>
                {tickerData.top_headline && (
                    <p className="text-[10px] text-gray-300 leading-tight line-clamp-2">
                        {tickerData.top_headline}
                    </p>
                )}
                <p className={`text-[9px] font-black mt-1 ${isUrgent ? 'text-red-400' : 'text-gray-500'}`}>
                    Tap to view full news →
                </p>
            </div>
        </div>
    );
}
