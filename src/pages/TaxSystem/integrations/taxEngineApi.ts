// Tax Engine — backend API client.
// One place that talks to /api/tax-engine/*. Pages and other engine
// modules import from here so the URL / error handling stays consistent.

import type { TaxEngineHealth, TaxRule } from '../data/types';

const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
export const TAX_ENGINE_API = `${API_HOST}/api/tax-engine`;

// Down-state used whenever the engine is unreachable for ANY reason —
// HTTP error, network failure, CORS, Render cold start timeout, etc.
// Returning a fully-shaped object instead of throwing means HealthBadge
// never has to wrap calls in extra try/catch.
const ENGINE_DOWN: TaxEngineHealth = {
    status: 'down',
    timestamp: new Date(0).toISOString(),
    version: 'unknown',
    ruleCount: 0,
};

export async function fetchEngineHealth(): Promise<TaxEngineHealth> {
    try {
        const r = await fetch(`${TAX_ENGINE_API}/health`);
        if (!r.ok) return { ...ENGINE_DOWN, timestamp: new Date().toISOString() };
        return (await r.json()) as TaxEngineHealth;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[taxEngineApi] fetchEngineHealth network error:', e);
        return { ...ENGINE_DOWN, timestamp: new Date().toISOString() };
    }
}

export async function listTaxRules(activeOnly = false): Promise<TaxRule[]> {
    try {
        const url = new URL(`${TAX_ENGINE_API}/rules`);
        if (activeOnly) url.searchParams.set('active_only', 'true');
        const r = await fetch(url.toString());
        if (!r.ok) return [];
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[taxEngineApi] listTaxRules network error:', e);
        return [];
    }
}

export async function createTaxRule(payload: Partial<TaxRule>): Promise<TaxRule | null> {
    try {
        const r = await fetch(`${TAX_ENGINE_API}/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jurisdiction: payload.jurisdiction,
                name: payload.name,
                rate: payload.rate ?? 0,
                taxType: payload.taxType || 'sales',
                productCategory: payload.productCategory,
                isActive: payload.isActive ?? true,
                notes: payload.notes,
            }),
        });
        if (!r.ok) {
            const text = await r.text().catch(() => '');
            throw new Error(`HTTP ${r.status} ${text}`);
        }
        return (await r.json()) as TaxRule;
    } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('[taxEngineApi] createTaxRule failed:', e);
        return null;
    }
}
