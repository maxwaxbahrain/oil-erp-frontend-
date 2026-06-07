// Tax Engine — backend API client.
// One place that talks to /api/tax-engine/*. Pages and other engine
// modules import from here so the URL / error handling stays consistent.

import type { TaxEngineHealth, TaxRule, TaxNexus, TaxProviderConfig, ProviderId, TaxExemption } from '../data/types';
import { authFetch } from '../../../api/axios';

const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
export const TAX_ENGINE_API = `${API_HOST}/api/tax-engine`;
// Session 1C Track A — the v1 tax API (calculate / commit / cancel /
// transactions).  Co-exists with /api/tax-engine/* (rules, nexus,
// providers, exemptions config); the v1 namespace is the
// transaction-shaped one.
export const TAX_V1_API = `${API_HOST}/api/v1/tax`;

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
        const r = await authFetch(`${TAX_ENGINE_API}/health`);
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
        const r = await authFetch(url.toString());
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
// Handles both FastAPI default {"detail": "..."} and the v1-tax
// {"error": "..."} formats (the latter from the strict US-state-validation
// handler in app/main.py).
async function readError(r: Response): Promise<string> {
    try {
        const data = await r.json();
        if (data?.error) return String(data.error);
        if (data?.detail) return String(data.detail);
        return `HTTP ${r.status}`;
    } catch {
        return `HTTP ${r.status}`;
    }
}

export async function createTaxRule(payload: Partial<TaxRule>): Promise<{ rule: TaxRule | null; error?: string }> {
    try {
        const r = await authFetch(`${TAX_ENGINE_API}/rules`, {
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
        const r = await authFetch(`${TAX_ENGINE_API}/rules/${encodeURIComponent(id)}`, {
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
        const r = await authFetch(`${TAX_ENGINE_API}/rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
        const r = await authFetch(url.toString());
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
        const r = await authFetch(`${TAX_ENGINE_API}/nexus`, {
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
        const r = await authFetch(`${TAX_ENGINE_API}/nexus/${encodeURIComponent(id)}`, {
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
        const r = await authFetch(`${TAX_ENGINE_API}/nexus/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) return { ok: false, error: await readError(r) };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Session 1D-B — External provider config (TaxJar / Avalara).
//
// Backend-persisted via /api/tax-engine/providers. The earlier 1D shipped
// localStorage-only; 1E-B moves to the database so config follows the
// business across devices / browsers / users instead of being trapped
// in one browser. The old localStorage key 'taxEngine.providerConfigs.v1'
// is migrated up by migrateLocalStorageToBackend() on first load.
// ──────────────────────────────────────────────────────────────────────────

const PROVIDER_STORAGE_KEY = 'taxEngine.providerConfigs.v1';

export async function listProviderConfigs(): Promise<TaxProviderConfig[]> {
    try {
        const r = await authFetch(`${TAX_ENGINE_API}/providers`);
        if (!r.ok) return [];
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[taxEngineApi] listProviderConfigs network error:', e);
        return [];
    }
}

export async function saveProviderConfig(
    config: TaxProviderConfig,
): Promise<{ config: TaxProviderConfig | null; error?: string }> {
    if (!config.id) return { config: null, error: 'Provider id is required' };
    try {
        const r = await authFetch(`${TAX_ENGINE_API}/providers/${encodeURIComponent(config.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: config.apiKey,
                environment: config.environment,
                isActive: config.isActive ?? false,
                lastSyncedAt: config.lastSyncedAt,
            }),
        });
        if (!r.ok) return { config: null, error: await readError(r) };
        return { config: (await r.json()) as TaxProviderConfig };
    } catch (e: any) {
        return { config: null, error: e?.message || 'Network error' };
    }
}

/** Toggle exactly one provider active (the others are flipped off in the
 *  same transaction on the backend so the calculator has an unambiguous
 *  source). Pass providerId='internal' to disable all external providers
 *  — the backend treats that as "deactivate all" even though no row
 *  named 'internal' exists. */
export async function setActiveProvider(
    providerId: ProviderId,
): Promise<{ ok: boolean; active: ProviderId; error?: string }> {
    try {
        const r = await authFetch(`${TAX_ENGINE_API}/providers/${encodeURIComponent(providerId)}/activate`, {
            method: 'POST',
        });
        if (!r.ok) return { ok: false, active: providerId, error: await readError(r) };
        const data = await r.json();
        return { ok: !!data?.ok, active: (data?.active as ProviderId) || providerId };
    } catch (e: any) {
        return { ok: false, active: providerId, error: e?.message || 'Network error' };
    }
}

export async function deleteProviderConfig(providerId: ProviderId): Promise<{ ok: boolean; error?: string }> {
    try {
        const r = await authFetch(`${TAX_ENGINE_API}/providers/${encodeURIComponent(providerId)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) return { ok: false, error: await readError(r) };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Session 1E-B — Exemption certificates.
// Backend-persisted via /api/tax-engine/exemptions. Same migration story.
// ──────────────────────────────────────────────────────────────────────────

const EXEMPTION_STORAGE_KEY = 'taxEngine.exemptions.v1';

export async function listExemptions(): Promise<TaxExemption[]> {
    try {
        const r = await authFetch(`${TAX_ENGINE_API}/exemptions`);
        if (!r.ok) return [];
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[taxEngineApi] listExemptions network error:', e);
        return [];
    }
}

export async function createExemption(
    payload: Partial<TaxExemption>,
): Promise<{ exemption: TaxExemption | null; error?: string }> {
    if (!payload.customerId?.trim()) return { exemption: null, error: 'Customer is required' };
    if (!payload.jurisdiction?.trim()) return { exemption: null, error: 'Jurisdiction is required' };
    if (!payload.certificateNumber?.trim()) return { exemption: null, error: 'Certificate number is required' };
    try {
        const r = await authFetch(`${TAX_ENGINE_API}/exemptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerId: payload.customerId,
                customerName: payload.customerName,
                jurisdiction: payload.jurisdiction,
                exemptionType: payload.exemptionType || 'resale',
                certificateNumber: payload.certificateNumber,
                issuedDate: payload.issuedDate,
                expiryDate: payload.expiryDate,
                notes: payload.notes,
                isActive: payload.isActive ?? true,
            }),
        });
        if (!r.ok) return { exemption: null, error: await readError(r) };
        return { exemption: (await r.json()) as TaxExemption };
    } catch (e: any) {
        return { exemption: null, error: e?.message || 'Network error' };
    }
}

export async function updateExemption(
    id: string,
    payload: Partial<TaxExemption>,
): Promise<{ exemption: TaxExemption | null; error?: string }> {
    try {
        const r = await authFetch(`${TAX_ENGINE_API}/exemptions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerId: payload.customerId,
                customerName: payload.customerName,
                jurisdiction: payload.jurisdiction,
                exemptionType: payload.exemptionType,
                certificateNumber: payload.certificateNumber,
                issuedDate: payload.issuedDate,
                expiryDate: payload.expiryDate,
                notes: payload.notes,
                isActive: payload.isActive,
            }),
        });
        if (!r.ok) return { exemption: null, error: await readError(r) };
        return { exemption: (await r.json()) as TaxExemption };
    } catch (e: any) {
        return { exemption: null, error: e?.message || 'Network error' };
    }
}

export async function deleteExemption(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const r = await authFetch(`${TAX_ENGINE_API}/exemptions/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) return { ok: false, error: await readError(r) };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

// ──────────────────────────────────────────────────────────────────────────
// One-time localStorage → backend migration (1D-B / 1E-B cutover).
//
// Anyone who used Sessions 1D / 1E during the localStorage-only window
// has provider configs and / or exemptions stored under
// 'taxEngine.providerConfigs.v1' / 'taxEngine.exemptions.v1'. After the
// backend ships those keys would be silently abandoned — the UI would
// read from the backend and the user would think their data was lost.
//
// migrateLocalStorageToBackend() reads the old keys ONCE per page load,
// uploads anything it finds (only when the backend currently has zero
// rows of that kind — so we don't create duplicates if a sibling browser
// already migrated), then removes the keys. On any error we leave the
// keys in place so the next page load can retry.
//
// Idempotent + safe-by-default: backend-has-data → skip → log so a
// curious developer can find the abandoned key and clean it up by hand.
// ──────────────────────────────────────────────────────────────────────────

let migrationAttempted = false;

export interface MigrationResult {
    providersUploaded: number;
    exemptionsUploaded: number;
    providersSkipped: number;
    exemptionsSkipped: number;
    errors: string[];
}

export async function migrateLocalStorageToBackend(): Promise<MigrationResult> {
    const result: MigrationResult = {
        providersUploaded: 0, exemptionsUploaded: 0,
        providersSkipped: 0, exemptionsSkipped: 0,
        errors: [],
    };
    if (migrationAttempted) return result;
    migrationAttempted = true;

    // Providers
    try {
        const raw = localStorage.getItem(PROVIDER_STORAGE_KEY);
        if (raw) {
            const local = JSON.parse(raw) as TaxProviderConfig[];
            if (Array.isArray(local) && local.length > 0) {
                const remote = await listProviderConfigs();
                if (remote.length > 0) {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `[taxEngine migration] backend already has ${remote.length} provider config(s); ` +
                        `leaving ${local.length} localStorage entr${local.length === 1 ? 'y' : 'ies'} in place under "${PROVIDER_STORAGE_KEY}" — clear manually if you no longer need them.`,
                    );
                    result.providersSkipped = local.length;
                } else {
                    for (const cfg of local) {
                        const { error } = await saveProviderConfig(cfg);
                        if (error) result.errors.push(`provider ${cfg.id}: ${error}`);
                        else result.providersUploaded += 1;
                    }
                    // Only remove the key if all uploads succeeded; otherwise
                    // a partial migration could lose data.
                    if (result.providersUploaded === local.length) {
                        localStorage.removeItem(PROVIDER_STORAGE_KEY);
                    }
                }
            }
        }
    } catch (e: any) {
        result.errors.push(`provider migration: ${e?.message || e}`);
    }

    // Exemptions
    try {
        const raw = localStorage.getItem(EXEMPTION_STORAGE_KEY);
        if (raw) {
            const local = JSON.parse(raw) as TaxExemption[];
            if (Array.isArray(local) && local.length > 0) {
                const remote = await listExemptions();
                if (remote.length > 0) {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `[taxEngine migration] backend already has ${remote.length} exemption(s); ` +
                        `leaving ${local.length} localStorage entr${local.length === 1 ? 'y' : 'ies'} in place under "${EXEMPTION_STORAGE_KEY}" — clear manually if you no longer need them.`,
                    );
                    result.exemptionsSkipped = local.length;
                } else {
                    for (const x of local) {
                        const { error } = await createExemption(x);
                        if (error) result.errors.push(`exemption ${x.customerId} ${x.jurisdiction}: ${error}`);
                        else result.exemptionsUploaded += 1;
                    }
                    if (result.exemptionsUploaded === local.length) {
                        localStorage.removeItem(EXEMPTION_STORAGE_KEY);
                    }
                }
            }
        }
    } catch (e: any) {
        result.errors.push(`exemption migration: ${e?.message || e}`);
    }

    if (result.providersUploaded || result.exemptionsUploaded || result.errors.length) {
        // eslint-disable-next-line no-console
        console.info('[taxEngine migration] result:', result);
    }
    return result;
}

// ──────────────────────────────────────────────────────────────────────────
// Session 1C Track A — v1 tax transaction API client.
//
// These talk to the backend's POST /api/v1/tax/calculate + the
// transactions list/get/commit/cancel endpoints.  Used by the Session 1E
// frontend pages (Calculator, Transactions).
// ──────────────────────────────────────────────────────────────────────────

export interface CalculateLineItemInput {
    description?: string;
    category?: string;
    quantity: number;
    unitPrice: number;
    taxable?: boolean;
    lineId?: string;
}

export interface CalculateRequest {
    sellerState?: string;
    buyerState: string;
    lineItems: CalculateLineItemInput[];
    customerId?: string;
    exemptCertNum?: string;
    enforceNexus?: boolean;
}

export interface CalculateLineBreakdown {
    lineId?: string;
    description?: string;
    category?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    taxable: boolean;
    rate: number;
    stateTax: number;
    localTax: number;
    totalTax: number;
    source: string;
}

export interface CalculateResponse {
    transactionId: string;
    sellerState?: string;
    buyerState: string;
    customerId?: string | null;
    exemptCertNum?: string | null;
    subtotal: number;
    stateTax: number;
    localTax: number;
    totalTax: number;
    grandTotal: number;
    effectiveRate: number;
    status: string;
    filed?: boolean;
    createdAt?: string;
    updatedAt?: string;
    lineBreakdown: CalculateLineBreakdown[];
}

export interface TaxTransactionRow extends CalculateResponse {}

/** POST /api/v1/tax/calculate — compute tax + persist as draft.
 *  Returns the transaction with its line breakdown, OR an error string.
 *  State validation errors (buyerState / sellerState not valid US codes)
 *  come back as `{ error: "Invalid buyer_state: '...'. Must be a valid
 *  2-letter US state code." }` — readError() handles both `error` and
 *  `detail` keys so callers get a clean string either way. */
export async function calculateTaxApi(
    payload: CalculateRequest,
): Promise<{ result: CalculateResponse | null; error?: string }> {
    try {
        const r = await authFetch(`${TAX_V1_API}/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) return { result: null, error: await readError(r) };
        return { result: (await r.json()) as CalculateResponse };
    } catch (e: any) {
        return { result: null, error: e?.message || 'Network error' };
    }
}

export interface ListTransactionsFilters {
    status?: 'draft' | 'committed' | 'cancelled';
    customerId?: string;
    limit?: number;
    offset?: number;
}

/** GET /api/v1/tax/transactions — paginated list, newest first. */
export async function listTaxTransactions(
    filters: ListTransactionsFilters = {},
): Promise<TaxTransactionRow[]> {
    try {
        const url = new URL(`${TAX_V1_API}/transactions`);
        if (filters.status) url.searchParams.set('status', filters.status);
        if (filters.customerId) url.searchParams.set('customerId', filters.customerId);
        if (filters.limit !== undefined) url.searchParams.set('limit', String(filters.limit));
        if (filters.offset !== undefined) url.searchParams.set('offset', String(filters.offset));
        const r = await authFetch(url.toString());
        if (!r.ok) return [];
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[taxEngineApi] listTaxTransactions network error:', e);
        return [];
    }
}

/** GET /api/v1/tax/transaction/{id} — one transaction + line breakdown. */
export async function getTaxTransaction(transactionId: string): Promise<TaxTransactionRow | null> {
    try {
        const r = await authFetch(`${TAX_V1_API}/transaction/${encodeURIComponent(transactionId)}`);
        if (!r.ok) return null;
        return (await r.json()) as TaxTransactionRow;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[taxEngineApi] getTaxTransaction network error:', e);
        return null;
    }
}

/** POST /api/v1/tax/commit — flip status='draft' → 'committed'. */
export async function commitTaxTransaction(transactionId: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const r = await authFetch(`${TAX_V1_API}/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId }),
        });
        if (!r.ok) return { ok: false, error: await readError(r) };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

/** POST /api/v1/tax/cancel — void a transaction (preserves audit row). */
export async function cancelTaxTransaction(
    transactionId: string,
    reason?: string,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const r = await authFetch(`${TAX_V1_API}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId, reason }),
        });
        if (!r.ok) return { ok: false, error: await readError(r) };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

/** DELETE /api/v1/tax/transaction/{id} — only allowed for draft status. */
export async function deleteTaxTransaction(transactionId: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const r = await authFetch(`${TAX_V1_API}/transaction/${encodeURIComponent(transactionId)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) return { ok: false, error: await readError(r) };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}
