// HealthBadge — small pill that polls /api/tax-engine/health and shows
// the engine status. Used at the top of the Tax Engine landing page so
// the user knows whether the backend is reachable.

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchEngineHealth } from '../integrations/taxEngineApi';
import type { TaxEngineHealth } from '../data/types';

export function HealthBadge() {
    const [health, setHealth] = useState<TaxEngineHealth | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        setLoading(true);
        try { setHealth(await fetchEngineHealth()); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        refresh();
        const t = setInterval(refresh, 60_000); // re-check every minute
        return () => clearInterval(t);
    }, []);

    if (loading && !health) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full text-[11px] font-bold">
                <RefreshCw size={12} className="animate-spin" /> Checking…
            </span>
        );
    }
    const ok = health?.status === 'ok';
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                ok
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title={health ? `version ${health.version} · ${health.ruleCount} rules · ${new Date(health.timestamp).toLocaleString()}` : ''}
        >
            {ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
            Engine {ok ? 'online' : 'offline'} · {health?.ruleCount ?? 0} rules
        </span>
    );
}
