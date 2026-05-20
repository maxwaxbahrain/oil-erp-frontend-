// VOICE SERVICE
// Frontend client for the Soltol Voice AI backend module
// (app/voice/* on bettano-erp-backend).
//
// Endpoint surface lives at <VITE_API_URL>/api/voice/* (REST) and
// <VITE_API_URL>/ws/voice/... + /voice/stream/... (WebSockets).
// All REST calls require the X-Tenant-Api-Key header, stored in
// localStorage under "voice_tenant_api_key".
//
// Phase 6.5 follow-up — the backend's users.id is an Integer auto-
// increment, while the frontend's authStore manages USR-*** string
// IDs in localStorage. There's no bridge today, so we ask the rep
// for their backend integer rep_id once and persist under
// "voice_rep_id". Improve when User gets a tenant_id and the two
// user systems are unified.
// ============================================

const RAW_BASE = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
export const VOICE_API_BASE = `${RAW_BASE}/api/voice`;
export const VOICE_API_TENANTS = `${RAW_BASE}/api/tenants`;
export const VOICE_WS_BASE = RAW_BASE.replace(/^http/, 'ws');

// ── localStorage keys (single place to rotate them later) ──
const STORAGE_KEYS = {
    apiKey: 'voice_tenant_api_key',
    repId: 'voice_rep_id',
} as const;

export function getStoredApiKey(): string {
    try { return localStorage.getItem(STORAGE_KEYS.apiKey) || ''; }
    catch { return ''; }
}

export function setStoredApiKey(key: string): void {
    try { localStorage.setItem(STORAGE_KEYS.apiKey, key); } catch { /* quota */ }
}

export function clearStoredApiKey(): void {
    try { localStorage.removeItem(STORAGE_KEYS.apiKey); } catch { /* noop */ }
}

export function getStoredRepId(): number | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.repId);
        if (!raw) return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
}

export function setStoredRepId(id: number): void {
    try { localStorage.setItem(STORAGE_KEYS.repId, String(id)); } catch { /* quota */ }
}

export function clearStoredRepId(): void {
    try { localStorage.removeItem(STORAGE_KEYS.repId); } catch { /* noop */ }
}

export function hasVoiceCredentials(): boolean {
    return !!getStoredApiKey() && getStoredRepId() != null;
}

// ── Low-level HTTP helper ──────────────────────────────────────
class VoiceApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
        super(detail || `HTTP ${status}`);
        this.status = status;
        this.detail = detail;
    }
}

interface VoiceRequestOptions extends RequestInit {
    /** Override the default api key (for admin-key endpoints). */
    apiKey?: string;
    /** Add a custom header — e.g. X-Platform-Admin-Key for onboard. */
    extraHeaders?: Record<string, string>;
    /** Skip X-Tenant-Api-Key entirely (admin endpoints). */
    noTenantAuth?: boolean;
}

async function voiceRequest<T>(path: string, options: VoiceRequestOptions = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${VOICE_API_BASE}${path}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
        ...(options.extraHeaders || {}),
    };
    if (!options.noTenantAuth) {
        const key = options.apiKey || getStoredApiKey();
        if (!key) {
            throw new VoiceApiError(401, 'Voice credentials not configured. Set your X-Tenant-Api-Key.');
        }
        headers['X-Tenant-Api-Key'] = key;
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        let detail = '';
        try { detail = (await res.json())?.detail || ''; } catch { /* ignore */ }
        throw new VoiceApiError(res.status, detail || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as unknown as T;
    return res.json();
}

// ── Type definitions (mirror backend Pydantic models) ──────────
export interface CallListItem {
    id: string;
    caller_phone: string | null;
    direction: 'inbound' | 'outbound';
    duration_seconds: number | null;
    status: string | null;
    summary: string | null;
    sentiment: 'positive' | 'neutral' | 'negative' | null;
    created_at: string;
}

export interface CallListResponse {
    items: CallListItem[];
    total: number;
    limit: number;
    offset: number;
}

export interface CallOrderEmbed {
    id: string;
    extracted_order: Record<string, unknown>;
    confirmed: boolean;
    order_id: string | null;
    created_at: string;
}

export interface CallDetail extends CallListItem {
    full_transcript: string | null;
    recording_url: string | null;
    call_orders: CallOrderEmbed[];
}

export interface AnalyticsResponse {
    calls_last_30d: number;
    calls_today: number;
    calls_by_day: { date: string; count: number }[];
    sentiment_breakdown: { positive: number; neutral: number; negative: number };
    avg_duration_seconds: number;
    orders_drafted_30d: number;
    orders_confirmed_30d: number;
}

export interface UsageResponse {
    plan: string;
    calls: number;
    minutes: number;
    ai_cost_usd: number;
    orders_drafted: number;
    limits: { calls_per_month: number | null; minutes_per_month: number | null };
    period_start: string;
}

export interface CoachingRule {
    id: string;
    rule_name: string;
    trigger_keywords: string[];
    suggestion_text: string;
    active: boolean;
    created_at: string;
}

export interface WSTokenResponse {
    token: string;
    expires_in: number;
    ws_path: string;
}

export interface ApproveCallOrderResponse {
    call_order_id: string;
    sales_order_id: string;
    so_number: string;
    customer_id: string;
    items: Record<string, unknown>[];
    notes: string | null;
    status: string;
    salesman_name: string | null;
}

export interface TenantOnboardResponse {
    id: string;
    slug: string;
    company_name: string;
    plan: string;
    telnyx_number: string | null;
    api_key: string;
    next_steps: string;
}

// ── REST endpoint wrappers ──────────────────────────────────────
export function getCalls(params: {
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
} = {}): Promise<CallListResponse> {
    const q = new URLSearchParams();
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.offset != null) q.set('offset', String(params.offset));
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    if (params.sentiment) q.set('sentiment', params.sentiment);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return voiceRequest<CallListResponse>(`/calls${qs}`);
}

export function getCall(callId: string): Promise<CallDetail> {
    return voiceRequest<CallDetail>(`/calls/${encodeURIComponent(callId)}`);
}

export function getCallRecordingUrl(callId: string): string {
    return `${VOICE_API_BASE}/calls/${encodeURIComponent(callId)}/recording`;
}

export function getAnalytics(): Promise<AnalyticsResponse> {
    return voiceRequest<AnalyticsResponse>('/analytics');
}

export function getUsage(): Promise<UsageResponse> {
    return voiceRequest<UsageResponse>('/usage');
}

export function getCoachingRules(includeInactive = false): Promise<CoachingRule[]> {
    const qs = includeInactive ? '?include_inactive=true' : '';
    return voiceRequest<CoachingRule[]>(`/coaching-rules${qs}`);
}

export function createCoachingRule(body: {
    rule_name: string;
    trigger_keywords: string[];
    suggestion_text: string;
}): Promise<CoachingRule> {
    return voiceRequest<CoachingRule>('/coaching-rules', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function updateCoachingRule(id: string, body: Partial<{
    rule_name: string;
    trigger_keywords: string[];
    suggestion_text: string;
    active: boolean;
}>): Promise<CoachingRule> {
    return voiceRequest<CoachingRule>(`/coaching-rules/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export function deleteCoachingRule(id: string): Promise<void> {
    return voiceRequest<void>(`/coaching-rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function approveCallOrder(
    callOrderId: string,
    body: { rep_id?: number } = {},
): Promise<ApproveCallOrderResponse> {
    return voiceRequest<ApproveCallOrderResponse>(
        `/call-orders/${encodeURIComponent(callOrderId)}/approve`,
        { method: 'POST', body: JSON.stringify(body) },
    );
}

export function getWsToken(repId: number): Promise<WSTokenResponse> {
    return voiceRequest<WSTokenResponse>(`/ws-token?rep_id=${repId}`);
}

// ── Admin (POST /api/tenants/onboard — platform admin key) ─────
export function onboardTenant(
    body: {
        company_name: string;
        plan: 'starter' | 'professional' | 'enterprise';
        country_code: string;
        slug: string;
    },
    platformAdminKey: string,
): Promise<TenantOnboardResponse> {
    return voiceRequest<TenantOnboardResponse>(
        `${VOICE_API_TENANTS}/onboard`,
        {
            method: 'POST',
            body: JSON.stringify(body),
            noTenantAuth: true,
            extraHeaders: { 'X-Platform-Admin-Key': platformAdminKey },
        },
    );
}

// ── WebSocket connection helper ────────────────────────────────
export type VoiceWSMessage =
    | { type: 'connected'; tenant_id: string; rep_id: number }
    | { type: 'ping'; ts: number }
    | { type: 'incoming_call'; call_id: string; call_sid: string; caller_phone: string | null;
        customer: Record<string, unknown> | null; open_orders: unknown[]; unpaid_invoices: number;
        is_new_lead: boolean }
    | { type: 'transcript_partial'; call_id: string; text: string }
    | { type: 'transcript_final'; call_id: string; text: string }
    | { type: 'coaching_tip'; call_id: string; message: string }
    | { type: 'draft_order'; call_id: string | null; call_order_id: string;
        items: Record<string, unknown>[]; delivery_date: string | null; confidence: number }
    | { type: 'stock_alert'; call_id: string | null; sku: string; product_name: string;
        requested: number; available: number }
    | { type: 'call_ended'; call_id: string; duration: number; summary: string;
        sentiment: string; order_drafts_count: number };

export interface VoiceWSHandle {
    /** Close the connection. Auto-reconnect is also stopped. */
    close: () => void;
    /** True while a socket is open. */
    isOpen: () => boolean;
}

interface ConnectVoiceWSOptions {
    repId: number;
    onMessage: (msg: VoiceWSMessage) => void;
    onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

/** Connect to the rep-dashboard WS with transparent auto-reconnect.
 *
 * Per Q5 (owner 2026-05-20): exponential backoff capped at 30s, no
 * user action required to reconnect. Status callbacks let the UI
 * show a "Reconnecting..." indicator and a transient "Connected"
 * flash on recovery.
 */
export function connectVoiceWS({ repId, onMessage, onStatusChange }: ConnectVoiceWSOptions): VoiceWSHandle {
    let ws: WebSocket | null = null;
    let closedByUser = false;
    let retryDelayMs = 1000;
    const MAX_RETRY_MS = 30_000;

    const notifyStatus = (s: 'connecting' | 'connected' | 'disconnected') => {
        if (onStatusChange) try { onStatusChange(s); } catch { /* ignore */ }
    };

    const open = async () => {
        if (closedByUser) return;
        notifyStatus('connecting');
        let tokenResp: WSTokenResponse;
        try {
            tokenResp = await getWsToken(repId);
        } catch (e) {
            console.error('[voiceWS] ws-token fetch failed:', e);
            scheduleReconnect();
            return;
        }
        const wsUrl = `${VOICE_WS_BASE}${tokenResp.ws_path}`;
        try {
            ws = new WebSocket(wsUrl);
        } catch (e) {
            console.error('[voiceWS] socket construct failed:', e);
            scheduleReconnect();
            return;
        }
        ws.onopen = () => {
            retryDelayMs = 1000; // reset backoff on successful connect
            notifyStatus('connected');
        };
        ws.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data) as VoiceWSMessage;
                if (data.type === 'ping') return; // server heartbeat — swallow
                onMessage(data);
            } catch (e) {
                console.warn('[voiceWS] non-json frame ignored:', e);
            }
        };
        ws.onerror = (e) => {
            console.warn('[voiceWS] socket error:', e);
        };
        ws.onclose = () => {
            notifyStatus('disconnected');
            if (!closedByUser) scheduleReconnect();
        };
    };

    const scheduleReconnect = () => {
        if (closedByUser) return;
        const delay = Math.min(retryDelayMs, MAX_RETRY_MS);
        setTimeout(() => {
            retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_MS);
            void open();
        }, delay);
    };

    void open();

    return {
        close: () => {
            closedByUser = true;
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                try { ws.close(1000, 'client-closed'); } catch { /* ignore */ }
            }
            ws = null;
        },
        isOpen: () => ws != null && ws.readyState === WebSocket.OPEN,
    };
}

export { VoiceApiError };
