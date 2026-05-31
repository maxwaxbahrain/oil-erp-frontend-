// VOICE ASSISTANT SERVICE — sends a spoken transcript to the existing
// backend /ai/chat endpoint (Claude Haiku proxy), parses the response
// into a structured VoiceAction the UI can execute.
//
// Why backend proxy: keeps the Anthropic API key server-side, never
// exposed to the browser.  Same pattern the existing AI Business
// Advisor uses (src/components/AIAssistant.tsx).
//
// ISOLATION: imports nothing.  Uses plain fetch() and inlines the
// API_HOST lookup.  Does NOT import from src/services/api.ts.
// ============================================

export type VoiceActionType =
    | 'NAVIGATE'
    | 'CREATE_INVOICE'
    | 'SEARCH'
    | 'ANSWER';

export interface VoiceAction {
    action: VoiceActionType;
    path?: string;
    data?: Record<string, unknown>;
    message?: string;
}

// ── Backend endpoint ──────────────────────────────────────────────
// Same VITE_API_URL convention as api.ts, just inlined so this file
// stays isolated.  No import from api.ts.
const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
const CHAT_ENDPOINT = `${API_HOST}/ai/chat`;

// Per spec — use claude-haiku-4-5-20251001 exactly as written.  The
// backend may or may not respect this field; if it ignores it, the
// call still succeeds and uses the backend's default model.
const MODEL = 'claude-haiku-4-5-20251001';

// ── System prompt ─────────────────────────────────────────────────
// Lists every navigable route from src/app/routes.tsx so Claude can
// pick the right path for "open / show / go to ..." commands without
// inventing paths that don't exist.  Kept compact (path + label per
// line) to minimise input tokens.
const ROUTE_CATALOG = [
    // Core
    '/                                  Dashboard',
    '/portal                            Employee Portal',
    '/pulse                             Team Chat',
    '/pulse/notes                       Meeting Notes',
    '/migrate                           Data Migration',
    // Customers + Sales
    '/customers                         Customer list  (supports ?search=NAME)',
    '/customers/new                     New customer form',
    '/sales                             Sales overview',
    '/sales/orders                      Sales orders workflow',
    '/sales/orders/new                  New sales order',
    '/sales/quotations                  Quotations',
    '/sales/invoices                    Invoice list  (supports ?search=NUMBER)',
    '/sales/invoices/new                New invoice form',
    '/sales/returns                     Sales returns',
    '/sales/returns/new                 New sales return',
    '/sales/credit-notes                Credit notes',
    '/sales/credit-notes/new            New credit note',
    '/sales/by-product                  Sales by product report',
    '/sales/by-customer                 Sales by customer report',
    '/sales/by-salesman                 Sales by salesman report',
    '/sales/profit-analysis             Profit analysis',
    '/sales/van-performance             Van performance',
    '/sales/price-lists                 Customer price lists',
    '/sales/recurring                   Recurring invoices',
    // Inventory
    '/products                          Product catalog',
    '/products/new                      New product',
    '/products/reports                  Inventory reports',
    '/inventory/transfer                Stock transfer',
    '/inventory/adjustments             Stock adjustment',
    '/inventory/ai-stock-control        AI stock control',
    // Procurement
    '/purchases                         Purchase orders',
    '/purchases/new                     New purchase order',
    '/purchases/suppliers               Supplier list',
    '/suppliers/new                     New supplier',
    '/receiving                         Goods received list',
    '/receiving/new                     New goods received',
    // Van Sales
    '/van-sales                         Van sales dashboard',
    '/van-sales/new                     New van sale',
    '/van-sales/history                 Van sales history',
    '/van-sales/manage-vans             Manage vans',
    // Finance
    '/finance/expenses                  Expenses',
    '/finance/expenses/approvals        Expense approvals',
    '/finance/expenses/bulk-upload      Expenses bulk upload',
    '/finance/expenses/mileage          Mileage tracker',
    '/finance/expenses/reports          Expense reports',
    '/finance/expenses/settings         Expense settings',
    '/finance/payroll                   Payroll',
    '/finance/accounting                Accounting',
    '/finance/banking                   Banking',
    '/finance/chart-of-accounts         Chart of accounts',
    '/finance/journal-voucher           Journal voucher',
    '/finance/all-ledger                All-accounts ledger',
    '/finance/financial-statement       Financial statement',
    '/finance/bad-debts                 Bad debts write-off',
    // Reports
    '/reports                           All reports',
    '/reports/sales                     Profitability reports',
    '/reports/demand-forecast           Demand forecast',
    '/reports/aged-receivable           Aged receivable',
    '/reports/aged-payable              Aged payable',
    '/reports/outstanding-bills         Outstanding bills',
    '/reports/day-book                  Day book',
    '/reports/trial-balance             Trial balance',
    '/reports/financial                 Financial statements',
    // AI
    '/ai                                AI hub',
    '/ai/auto-po                        Auto PO generation',
    '/ai/anomaly                        Anomaly detection',
    '/ai/customer-forecast              Customer forecast',
    '/ai/revenue-forecast               Revenue forecast',
    // Agents
    '/agents                            Agent hub',
    '/agents/customer-service           ARIA — customer service agent',
    '/agents/business-advisor           Marcus — business advisor',
    '/agents/email-reply                Email auto-reply',
    // Marketing
    '/marketing                         Marketing hub',
    '/marketing/studio                  AI content studio',
    '/marketing/segments                Customer segments',
    '/marketing/campaigns               Campaign manager',
    '/marketing/analytics               Marketing analytics',
    // Tax
    '/tax                               Tax settings',
    '/tax/engine                        Tax engine',
    '/tax/calculator                    Tax calculator',
    '/tax/dashboard                     Tax dashboard',
    '/tax/advisor                       AI tax advisor',
    '/tax/forms                         Tax forms library',
    '/tax/filing                        Tax filings',
    '/tax/filing/new                    New tax filing',
    // Soltol Voice (telephony module)
    '/voice/dashboard                   Voice dashboard',
    '/voice/calls                       Call history',
    '/voice/analytics                   Voice analytics',
    '/voice/coaching-rules              Coaching rules',
    '/voice/onboard                     Onboard tenant',
    // Logistics
    '/logistics/pod                     POD driver app',
    '/logistics/operations              Van operations',
    '/logistics/routes                  Route navigator',
    // CRM / Misc
    '/crm                               CRM pipeline',
    '/credit                            Credit intelligence',
    '/news                              Business news',
    '/amazon                            Amazon integration',
    '/access-management                 User access management',
    '/users/dashboard                   User dashboard',
    '/users/directory                   User directory',
    '/users/hierarchy                   Organization chart',
    '/users/roles                       Role manager',
    '/settings                          Settings',
].join('\n');

const SYSTEM_PROMPT = `You are a voice command processor for the Soltol ERP system.
Today's date is ${new Date().toISOString().slice(0, 10)}.  Use it as the
reference when resolving relative dates like "today", "yesterday",
"tomorrow", "first of june", "next monday".  Always emit dates as
strict YYYY-MM-DD format.
The user speaks a short command and you must reply with a JSON action
to execute.  Reply with JSON ONLY — no markdown, no prose, no fences.

Available pages and routes:
${ROUTE_CATALOG}

Action schema (return EXACTLY one JSON object matching this shape):
{
  "action": "NAVIGATE" | "CREATE_INVOICE" | "SEARCH" | "ANSWER",
  "path": "/route/here",
  "data": {},
  "message": "short sentence to speak back to the user"
}

Rules:
- "open X" / "show X" / "go to X" / "take me to X" → NAVIGATE.
- "find / search customer NAME" → SEARCH with path "/customers?search=NAME".
- "find / search invoice NUMBER" → SEARCH with path "/sales/invoices?search=NUMBER".
- "make invoice for CUSTOMER, QTY of PRODUCT at PRICE" → CREATE_INVOICE.
  Put structured data in "data": { "customer": "...", "salesman": "salesman name if mentioned, else omit", "date": "YYYY-MM-DD if mentioned, else omit", "items": [{"name": "...", "qty": N, "price": P}] }.
  Always set "path" to "/sales/invoices/new" for CREATE_INVOICE.
- "X bought from me / X purchased / sold to X / sold to customer X /
  X took / X got" + quantity + product → CREATE_INVOICE.  Extract:
  * customer name — the buyer.  Strip leading "customer" qualifier
    (e.g. "to customer Ali" → customer: "Ali").
  * salesman name — when phrased as "from / via / by SALESMAN" or
    "salesman NAME".  Omit "salesman" entirely when none is spoken.
  * product name — the item sold.  Use the noun phrase verbatim
    (e.g. "bettano oil", "0W20 engine oil").
  * qty — the spoken count.  "N cases of PRODUCT" → qty: N.
  * price — the spoken unit price.  "at N dollars" or "at $N" or
    "for N each" → price: N.  Use price: 0 when no price is spoken.
  * date — when phrased as "on DATE" / "dated DATE" / "for DATE",
    resolve to YYYY-MM-DD using today's date as the reference.
    Omit "date" entirely when none is spoken.
  Always set "path" to "/sales/invoices/new".
- "what can I do" / "what pages are there" / general questions → ANSWER.
  Leave "path" empty; put the spoken reply in "message".
- The "message" field must be a single short sentence, 12 words or fewer,
  suitable to speak aloud.  No emoji.  No markdown.
- If the command is ambiguous, return ANSWER with a clarifying question.
- ALWAYS return valid JSON.  No code fences.  No leading or trailing text.

Examples:
Input: "open customers"
Output: {"action":"NAVIGATE","path":"/customers","message":"Opening customers"}

Input: "show invoices"
Output: {"action":"NAVIGATE","path":"/sales/invoices","message":"Opening invoices"}

Input: "go to dashboard"
Output: {"action":"NAVIGATE","path":"/","message":"Opening dashboard"}

Input: "find customer named John"
Output: {"action":"SEARCH","path":"/customers?search=John","message":"Searching for John"}

Input: "search invoice 1042"
Output: {"action":"SEARCH","path":"/sales/invoices?search=1042","message":"Searching invoice 1042"}

Input: "make invoice for Ali, 20 cases of 0W20 Bettano at 43 dollars"
Output: {"action":"CREATE_INVOICE","path":"/sales/invoices/new","data":{"customer":"Ali","items":[{"name":"0W20 Bettano","qty":20,"price":43}]},"message":"Creating invoice for Ali"}

Input: "Ali bought from me 5 cases of engine oil"
Output: {"action":"CREATE_INVOICE","path":"/sales/invoices/new","data":{"customer":"Ali","items":[{"name":"engine oil","qty":5,"price":0}]},"message":"Creating invoice for Ali"}

Input: "salesman John sold 10 cases of bettano oil to customer Ali at 50 dollars on first of june"
Output: {"action":"CREATE_INVOICE","path":"/sales/invoices/new","data":{"customer":"Ali","salesman":"John","date":"2026-06-01","items":[{"name":"bettano oil","qty":10,"price":50}]},"message":"Creating invoice for Ali"}

Input: "what can I do"
Output: {"action":"ANSWER","message":"You can say: open any page, create invoices, or search customers and invoices."}`;

// ── Public API ────────────────────────────────────────────────────
export async function sendVoiceCommandToClaude(
    transcript: string
): Promise<VoiceAction> {
    const text = (transcript || '').trim();
    if (!text) {
        throw new Error('Empty transcript');
    }

    let response: Response;
    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        response = await fetch(CHAT_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                system: SYSTEM_PROMPT,
                max_tokens: 300,
                model: MODEL,
                messages: [{ role: 'user', content: text }],
            }),
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Network error';
        throw new Error(`Could not reach voice assistant backend: ${msg}`);
    }

    if (!response.ok) {
        let detail = '';
        try {
            const errPayload = (await response.json()) as { detail?: unknown; message?: unknown };
            if (typeof errPayload.detail === 'string') detail = errPayload.detail;
            else if (typeof errPayload.message === 'string') detail = errPayload.message;
        } catch {
            /* body wasn't JSON — fall back to status code */
        }
        throw new Error(
            detail || `Voice assistant backend returned ${response.status}`
        );
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        throw new Error('Voice assistant backend returned invalid JSON.');
    }

    const reply = extractReplyString(payload);
    if (!reply) {
        throw new Error('Voice assistant returned an empty reply.');
    }

    const parsed = parseClaudeJSON(reply);
    if (!parsed) {
        throw new Error('Could not parse voice assistant reply as JSON.');
    }

    const action = normalizeAction(parsed);
    if (!action) {
        throw new Error('Voice assistant returned an unknown action shape.');
    }

    return action;
}

// ── Helpers ───────────────────────────────────────────────────────

function extractReplyString(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const p = payload as Record<string, unknown>;
    if (typeof p.reply === 'string') return p.reply;
    // Defensive fallbacks for slightly different backend shapes.
    if (typeof p.content === 'string') return p.content;
    if (typeof p.text === 'string') return p.text;
    return '';
}

/** Claude sometimes wraps JSON in ```json ... ``` fences or includes
 *  a leading sentence despite the system prompt.  Strip fences, then
 *  parse from the first '{' to the last '}'. */
function parseClaudeJSON(raw: string): unknown {
    let s = raw.trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) return null;
    try {
        return JSON.parse(s.slice(first, last + 1));
    } catch {
        return null;
    }
}

const VALID_ACTIONS = new Set<VoiceActionType>([
    'NAVIGATE',
    'CREATE_INVOICE',
    'SEARCH',
    'ANSWER',
]);

function normalizeAction(parsed: unknown): VoiceAction | null {
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const rawAction = String(obj.action || '').toUpperCase();
    if (!VALID_ACTIONS.has(rawAction as VoiceActionType)) return null;
    const action = rawAction as VoiceActionType;

    const path = typeof obj.path === 'string' ? obj.path : undefined;
    const message =
        typeof obj.message === 'string' && obj.message.trim()
            ? obj.message.trim()
            : undefined;
    const data =
        obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
            ? (obj.data as Record<string, unknown>)
            : undefined;

    return { action, path, data, message };
}
