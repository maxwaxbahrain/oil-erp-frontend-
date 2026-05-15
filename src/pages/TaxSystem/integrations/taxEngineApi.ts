// Tax Engine — backend API client.
// One place that talks to /api/tax-engine/*. Pages and other engine
// modules import from here so the URL / error handling stays consistent.

import type { TaxEngineHealth, TaxRule, TaxNexus } from '../data/types';

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

// Shared helper that surfaces a useful error message from the server.
async function readError(r: Response): Promise<string> {
    try {
        const data = await r.json();
        if (data?.detail) return String(data.detail);
        return `HTTP ${r.status}`;
    } catch {
        return `HTTP ${r.status}`;
    }
}

export async function createTaxRule(payload: Partial<TaxRule>): Promise<{ rule: TaxRule | null; error?: string }> {
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
        if (!r.ok) return { rule: null, error: await readError(r) };
        return { rule: (await r.json()) as TaxRule };
    } catch (e: any) {
        return { rule: null, error: e?.message || 'Network error' };
    }
}

export async function updateTaxRule(id: string, payload: Partial<TaxRule>): Promise<{ rule: TaxRule | null; error?: string }> {
    try {
        const r = await fetch(`${TAX_ENGINE_API}/rules/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jurisdiction: payload.jurisdiction,
                name: payload.name,
                rate: payload.rate,
                taxType: payload.taxType,
                productCategory: payload.productCategory,
                isActive: payload.isActive,
                notes: payload.notes,
            }),
        });
        if (!r.ok) return { rule: null, error: await readError(r) };
        return { rule: (await r.json()) as TaxRule };
    } catch (e: any) {
        return { rule: null, error: e?.message || 'Network error' };
    }
}

export async function deleteTaxRule(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const r = await fetch(`${TAX_ENGINE_API}/rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) return { ok: false, error: await readError(r) };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Session 1C — Nexus endpoints.
// ──────────────────────────────────────────────────────────────────────────

export async function listNexus(activeOnly = false): Promise<TaxNexus[]> {
    try {
        const url = new URL(`${TAX_ENGINE_API}/nexus`);
        if (activeOnly) url.searchParams.set('active_only', 'true');
        const r = await fetch(url.toString());
        if (!r.ok) return [];
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[taxEngineApi] listNexus network error:', e);
        return [];
    }
}

export async function createNexus(payload: Partial<TaxNexus>): Promise<{ nexus: TaxNexus | null; error?: string }> {
    try {
        const r = await fetch(`${TAX_ENGINE_API}/nexus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jurisdiction: payload.jurisdiction,
                nexusType: payload.nexusType || 'physical',
                establishedDate: payload.establishedDate || null,
                thresholdAmount: payload.thresholdAmount ?? null,
                notes: payload.notes,
                isActive: payload.isActive ?? true,
            }),
        });
        if (!r.ok) return { nexus: null, error: await readError(r) };
        return { nexus: (await r.json()) as TaxNexus };
    } catch (e: any) {
        return { nexus: null, error: e?.message || 'Network error' };
    }
}

export async function updateNexus(id: string, payload: Partial<TaxNexus>): Promise<{ nexus: TaxNexus | null; error?: string }> {
    try {
        const r = await fetch(`${TAX_ENGINE_API}/nexus/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jurisdiction: payload.jurisdiction,
                nexusType: payload.nexusType,
                establishedDate: payload.establishedDate,
                thresholdAmount: payload.thresholdAmount,
                notes: payload.notes,
                isActive: payload.isActive,
            }),
        });
        if (!r.ok) return { nexus: null, error: await readError(r) };
        return { nexus: (await r.json()) as TaxNexus };
    } catch (e: any) {
        return { nexus: null, error: e?.message || 'Network error' };
    }
}

export async function deleteNexus(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const r = await fetch(`${TAX_ENGINE_API}/nexus/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) return { ok: false, error: await readError(r) };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}
