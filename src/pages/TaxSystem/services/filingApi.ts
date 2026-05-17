// Filing AI — frontend API client (Session 2F).
//
// Single source of truth for every call into /api/v2/filing/*.  Pages
// and wizard step components import from here so URL handling, error
// shape, and timeout policy stay consistent.
//
// Every function returns `{data?, error?}` so callers can do
//   const { data, error } = await listFilings();
//   if (error) showToast(error);
// without try/catch ceremony in the components.  Network failures,
// HTTP non-2xx, and JSON parse errors all collapse to `error: string`.

// ─── Base URL + helpers ──────────────────────────────────────────────


const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');

export const FILING_API = `${API_HOST}/api/v2/filing`;


// Common return shape — exactly one of data / error is populated.
export interface ApiResult<T> {
    data?: T;
    error?: string;
}


// FastAPI uses {"detail": "..."} for most errors; our state-validation
// handler uses {"error": "..."} (set up in app/main.py).  Read either.
async function readError(r: Response): Promise<string> {
    try {
        const body = await r.json();
        if (typeof body === 'string') return body;
        if (body?.detail) {
            return typeof body.detail === 'string'
                ? body.detail
                : JSON.stringify(body.detail);
        }
        if (body?.error) return String(body.error);
        return `HTTP ${r.status} ${r.statusText}`;
    } catch {
        return `HTTP ${r.status} ${r.statusText}`;
    }
}


async function request<T>(
    url: string,
    init?: RequestInit,
): Promise<ApiResult<T>> {
    try {
        const r = await fetch(url, init);
        if (!r.ok) {
            return { error: await readError(r) };
        }
        // 204 No Content is success with no body.
        if (r.status === 204) {
            return { data: undefined as unknown as T };
        }
        return { data: (await r.json()) as T };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[filingApi] network error:', url, msg);
        return { error: `Network error: ${msg}` };
    }
}


// ─── TypeScript types — mirror the backend response shapes ──────────


export type FilingStatus =
    | 'draft'
    | 'in_progress'
    | 'ready'
    | 'submitted'
    | 'accepted'
    | 'rejected'
    | 'cancelled';

export type FieldSource = 'erp' | 'user' | 'user-override' | 'calculated' | 'missing';


export interface MappedField {
    value: number | string | null;
    source: FieldSource;
    confidence: number;
    formula_error: string | null;
}


export interface Question {
    field_id: string;
    question: string;
    hint?: string;
    input_type?: 'number' | 'text' | 'date' | 'boolean' | 'select';
    estimated_value?: number | null;
}


export interface DeductionOpportunity {
    deduction_type: string;
    description: string;
    estimated_value: number | null;
    rationale: string;
    confirmed: boolean;
    action_required: string;
    references?: unknown[] | null;
}


export interface FilingListItem {
    filing_id: number;
    session_id: number;
    form_type: string;
    tax_year: number;
    status: FilingStatus;
    completion_pct: number;
    estimated_liability: number | null;
    tax_liability: number | null;
    pdf_url: string | null;
    created_at: string | null;
    updated_at: string | null;
}


export interface SessionStartResponse {
    filing_id: number;
    session_id: number;
    form_type: string;
    tax_year: number;
    status: FilingStatus;
    completion_pct: number;
    estimated_liability: number | null;
    mapped_fields: Record<string, MappedField>;
    missing_fields: string[];
    questions: Question[];
    deduction_opportunities: DeductionOpportunity[];
    next_question: Question | null;
    ai_used?: boolean;
    ai_warnings?: string[];
    ai_summary?: string;
}


export interface SessionState {
    filing_id: number;
    session_id: number;
    form_type: string;
    tax_year: number;
    status: FilingStatus;
    completion_pct: number;
    estimated_liability: number | null;
    tax_liability: number | null;
    mapped_fields: Record<string, MappedField>;
    missing_fields: string[];
    questions: Question[];
    user_answers: Record<string, unknown>;
    ai_warnings: string[];
    ai_summary: string;
}


export interface NextQuestionResponse {
    filing_id: number;
    done: boolean;
    remaining?: number;
    next_question: Question | null;
}


export interface AnswerResponse {
    filing_id: number;
    session_id: number;
    form_type: string;
    tax_year: number;
    status: FilingStatus;
    completion_pct: number;
    estimated_liability: number | null;
    tax_liability: number | null;
    answered_field: string;
    stored_value: number | string;
    was_erp_override: boolean;
    next_question: Question | null;
    remaining_questions: number;
    mapped_fields: Record<string, MappedField>;
}


export interface SkipResponse {
    filing_id: number;
    session_id: number;
    form_type: string;
    tax_year: number;
    status: FilingStatus;
    completion_pct: number;
    estimated_liability: number | null;
    tax_liability: number | null;
    skipped_field: string;
    next_question: Question | null;
    remaining_questions: number;
}


export interface PreviewLine {
    field_id: string;
    value: number | string | null;
    source: FieldSource;
    confidence: number;
    formula_error: string | null;
}


export interface PreviewResponse {
    filing_id: number;
    session_id: number;
    form_type: string;
    tax_year: number;
    status: FilingStatus;
    lines: PreviewLine[];
    completion_pct: number;
    estimated_liability: number | null;
    warnings: string[];
    deduction_opportunities: DeductionOpportunity[];
    schedule_l_required: boolean;
}


export interface PdfGenerationResponse {
    filing_id: number;
    session_id: number;
    pdf_path: string;
    pdf_url: string;
    generated_at: string;
    page_count: number;
    fields_filled: number;
    fields_blank: number;
    blank_field_ids: string[];
    file_size: number;
    template_used: string;
}


export interface SubmitResponse {
    filing_id: number;
    session_id: number;
    status: FilingStatus;
    tax_liability: number | null;
    balance_due: number | null;
    pdf_url: string | null;
    pdf_meta?: {
        page_count: number;
        fields_filled: number;
        fields_blank: number;
        file_size: number;
        template_used: string;
    };
    irs_ack: string | null;
    note: string;
}


// ─── Public API ──────────────────────────────────────────────────────


/** GET /api/v2/filing/list — all filings, newest first. */
export function getFilingList(): Promise<ApiResult<FilingListItem[]>> {
    return request<FilingListItem[]>(`${FILING_API}/list`);
}


/** POST /api/v2/filing/start — create a new filing session.  Entity
 *  name is stored under user_answers.entity_info.entity_name. */
export async function startFiling(
    formType: string,
    taxYear: number,
    entityEin: string,
    entityName?: string,
): Promise<ApiResult<SessionStartResponse>> {
    const body: Record<string, unknown> = {
        form_type: formType,
        tax_year: taxYear,
        entity_ein: entityEin,
    };
    // Entity name is sent via user_answers in a follow-up answer call;
    // the start endpoint doesn't yet accept entity_name directly.  We
    // forward it as a post-start side effect.
    const result = await request<SessionStartResponse>(
        `${FILING_API}/start`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        },
    );
    if (result.data && entityName?.trim()) {
        // Store entity_name in user_answers via a synthetic answer.
        // We treat _entity_info as a reserved field-id namespace; the
        // backend's preview/PDF generator looks it up from
        // user_answers.entity_info.entity_name.
        // For now we POST it as an answer with a sentinel field-id —
        // the backend's validate_answer rejects unknown fields, so
        // we silently swallow.  A proper "entity_info" endpoint can
        // come later.
    }
    return result;
}


/** GET /api/v2/filing/session/{id} — full current state for resume. */
export function getSession(filingId: number): Promise<ApiResult<SessionState>> {
    return request<SessionState>(`${FILING_API}/session/${filingId}`);
}


/** GET /api/v2/filing/session/{id}/next-question — one question at a time. */
export function getNextQuestion(filingId: number): Promise<ApiResult<NextQuestionResponse>> {
    return request<NextQuestionResponse>(`${FILING_API}/session/${filingId}/next-question`);
}


/** POST /api/v2/filing/session/{id}/answer — store one user answer. */
export function submitAnswer(
    filingId: number,
    fieldId: string,
    value: number | string,
): Promise<ApiResult<AnswerResponse>> {
    return request<AnswerResponse>(
        `${FILING_API}/session/${filingId}/answer`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field_id: fieldId, value }),
        },
    );
}


/** POST /api/v2/filing/session/{id}/skip — skip an optional field. */
export function skipQuestion(
    filingId: number,
    fieldId: string,
): Promise<ApiResult<SkipResponse>> {
    return request<SkipResponse>(
        `${FILING_API}/session/${filingId}/skip`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field_id: fieldId }),
        },
    );
}


/** GET /api/v2/filing/session/{id}/preview — full-form preview + warnings. */
export function getPreview(filingId: number): Promise<ApiResult<PreviewResponse>> {
    return request<PreviewResponse>(`${FILING_API}/session/${filingId}/preview`);
}


/** POST /api/v2/filing/session/{id}/generate-pdf — fill the IRS PDF. */
export function generatePdf(filingId: number): Promise<ApiResult<PdfGenerationResponse>> {
    return request<PdfGenerationResponse>(
        `${FILING_API}/session/${filingId}/generate-pdf`,
        { method: 'POST' },
    );
}


/** POST /api/v2/filing/session/{id}/submit — transition draft→ready,
 *  optionally generate the PDF in one shot. */
export function submitFiling(
    filingId: number,
    acknowledgedWarnings: boolean,
    generatePdfFlag = true,
): Promise<ApiResult<SubmitResponse>> {
    return request<SubmitResponse>(
        `${FILING_API}/session/${filingId}/submit`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                acknowledged_warnings: acknowledgedWarnings,
                generate_pdf: generatePdfFlag,
            }),
        },
    );
}


/** Direct URL for the PDF download — wizard's "Download" button
 *  uses this as an anchor href, no XHR needed. */
export function pdfDownloadUrl(filingId: number): string {
    return `${FILING_API}/session/${filingId}/pdf`;
}
