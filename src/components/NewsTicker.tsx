import { useEffect } from 'react';

const NEWS_CACHE_KEY = 'bettano_news_cache';

export default function NewsTicker() {
    useEffect(() => {
        localStorage.removeItem(NEWS_CACHE_KEY);
    }, []);

    return null;
}
