// Tax Engine — backend API client.
// One place that talks to /api/tax-engine/*. Pages and other engine
// modules import from here so the URL / error handling stays consistent.

import type { TaxEngineHealth, TaxRule } from '../data/types';

const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
export const TAX_ENGINE_API = `${API_HOST}/api/tax-engine`;

export async function fetchEngineHealth(): Promise<TaxEngineHealth> {
    const r = await fetch(`${TAX_ENGINE_API}/health`);
    if (!r.ok) {
        return {
            status: 'down',
            timestamp: new Date().toISOString(),
            version: 'unknown',
            ruleCount: 0,
        };
    }
    return (await r.json()) as TaxEngineHealth;
}

export async function listTaxRules(activeOnly = false): Promise<TaxRule[]> {
    const url = new URL(`${TAX_ENGINE_API}/rules`);
    if (activeOnly) url.searchParams.set('active_only', 'true');
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
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
