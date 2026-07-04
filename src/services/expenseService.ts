// Expense Management Service
import { authFetch } from '../api/axios';
import { getOilErpApiBase, getOilErpApiHost } from '../config/apiBase';

export interface ExpenseCategory {
    id: string;
    name: string;
    parentCategory: string;
    type: 'Operating' | 'Employee' | 'Marketing' | 'Administrative' | 'Inventory' | 'Asset' | 'Financial' | 'Miscellaneous';
    description?: string;
    isRecurring?: boolean;
    taxTreatment?: string;
    accountCode?: string;
    createdAt: string;
}

// ─── Expenses-module data-model extension (STEP 1) ──────────────────
// All new fields are OPTIONAL so historical rows in localStorage
// (which lack them) deserialize without errors.  Enums are widened
// supersets — every value previously valid is still valid.

export interface PolicyFlag {
    rule: string;                            // e.g. "meal_max_amount"
    severity: 'warning' | 'error';
    message: string;                         // human-readable for the UI
}

export interface Expense {
    id: string;
    category: string;
    amount: number;
    currency: string;
    date: string;
    vendor: string;
    description: string;
    // Widened to include 'Petty Cash' per master-prompt spec; kept
    // 'Check' and 'Other' so existing data stays valid.
    paymentMethod: 'Cash' | 'Card' | 'Bank Transfer' | 'Petty Cash' | 'Check' | 'Other';
    receiptUrl?: string;
    taxAmount?: number;
    // Widened with master-prompt statuses ('Submitted', 'Under Review',
    // 'Reimbursed').  Existing 'Pending Approval' kept so legacy rows
    // in localStorage don't fail type checks.
    status:
        | 'Draft'
        | 'Pending Approval'
        | 'Submitted'
        | 'Under Review'
        | 'Approved'
        | 'Rejected'
        | 'Paid'
        | 'Reimbursed';
    isRecurring: boolean;
    recurringFrequency?: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
    approvedBy?: string;
    approvedAt?: string;
    createdBy: string;
    createdAt: string;

    // ── Existing AI provenance (kept for back-compat) ───────────────
    aiExtracted?: boolean;
    aiConfidence?: number;                   // legacy per-field/overall

    // ── STEP 1 additions (all optional) ────────────────────────────
    policy_flags?: PolicyFlag[];             // STEP 5 output
    is_duplicate_flag?: boolean;             // STEP 4 output
    duplicate_of_id?: string | null;
    ai_confidence_score?: number;            // 0–100 rollup (STEP 2)
    receipt_extracted_data?: AIExtractedData | null;

    // Billing / org context (STEP 7 routing, STEP 11B integration)
    is_billable?: boolean;
    client_id?: string | null;               // FK -> Customer
    department_id?: string | null;
    project_id?: string | null;
    vendor_id?: string | null;               // FK -> Supplier when matched

    // FX (populated at save time)
    amount_in_base_currency?: number;
    exchange_rate?: number;

    // STEP 11A — set after pushExpenseToAccounting() succeeds.
    journal_voucher_number?: string;

    // STEP 11B — Customer billable
    invoiced_to?: string | null;          // invoice id once billed

    // STEP 11C — Payroll reimbursable
    is_reimbursable?: boolean;
    payroll_reimbursed_in?: string | null;  // period label e.g. "2026-05"

    // Root C — GL expense account
    account_id?: number | null;
    accountId?: number | null;
}

export interface AIExtractedData {
    vendor: string;
    amount: number;
    date: string;
    items: string[];
    taxAmount: number;
    suggestedCategory: string;
    confidence: number;                      // rollup (min of perField, 0-100)
    currency: string;
    // STEP 2 — per-field confidence so the UI can render colored
    // badges (green ≥90, amber 60-89, red <60) next to each field.
    perFieldConfidence?: {
        vendor: number;
        date: number;
        amount: number;
    };
    paymentMethod?: 'Cash' | 'Card' | 'Unknown';
    receiptNumber?: string | null;
}

// TASK 2 — Backend-backed expenses. The old EXPENSES_KEY localStorage
// pattern is gone. We keep an in-memory cache populated by getExpenses()
// so the sync helpers (checkExpenseDuplicate, checkExpensePolicy,
// exportExpensesAsCSV) keep working without becoming async — they read
// the cache, which is refreshed every time the list page mounts.
const EXPENSE_CATEGORIES_KEY = 'zavi_expense_categories';
const EXPENSES_API = `${getOilErpApiBase()}/expenses`;

let _expensesCache: Expense[] = [];
let _expensesCacheLoaded = false;
let _expensesCacheStale = false;

/** Backend → UI field mapping (snake_case → camelCase). */
function _expenseFromApi(raw: any): Expense {
    return {
        id: String(raw.id),
        category: String(raw.category ?? 'Other'),
        amount: Number(raw.amount ?? 0),
        currency: String(raw.currency ?? 'USD'),
        date: raw.date ? String(raw.date).slice(0, 10) : '',
        vendor: raw.vendor != null ? String(raw.vendor) : '',
        description: raw.description != null ? String(raw.description) : '',
        paymentMethod: (raw.payment_method ?? 'Cash') as Expense['paymentMethod'],
        receiptUrl: raw.receipt_url ?? undefined,
        taxAmount: raw.tax_amount != null ? Number(raw.tax_amount) : undefined,
        status: (raw.status ?? 'Draft') as Expense['status'],
        isRecurring: Boolean(raw.is_recurring),
        recurringFrequency: raw.recurring_frequency ?? undefined,
        approvedBy: raw.approved_by ?? undefined,
        approvedAt: raw.approved_at ?? undefined,
        createdBy: raw.created_by ?? 'Unknown User',
        createdAt: raw.created_at ?? new Date().toISOString(),
        aiExtracted: raw.ai_extracted ?? undefined,
        aiConfidence: raw.ai_confidence ?? undefined,
        policy_flags: raw.policy_flags ?? undefined,
        is_duplicate_flag: raw.is_duplicate_flag ?? undefined,
        duplicate_of_id: raw.duplicate_of_id ?? null,
        ai_confidence_score: raw.ai_confidence_score ?? undefined,
        receipt_extracted_data: raw.receipt_extracted_data ?? null,
        is_billable: raw.is_billable ?? undefined,
        client_id: raw.client_id != null ? String(raw.client_id) : null,
        department_id: raw.department_id ?? null,
        project_id: raw.project_id ?? null,
        vendor_id: raw.vendor_id != null ? String(raw.vendor_id) : null,
        amount_in_base_currency: raw.amount_in_base_currency ?? undefined,
        exchange_rate: raw.exchange_rate ?? undefined,
        journal_voucher_number: raw.journal_voucher_number ?? undefined,
        invoiced_to: raw.invoiced_to ?? null,
        is_reimbursable: raw.is_reimbursable ?? undefined,
        payroll_reimbursed_in: raw.payroll_reimbursed_in ?? null,
        account_id: raw.account_id ?? null,
        accountId: raw.account_id ?? null,
    };
}

/** UI → Backend field mapping (camelCase → snake_case).
    Only includes fields that are actually set (so PATCH payloads stay tight). */
function _expenseToApi(e: Partial<Expense>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (e.category !== undefined) out.category = e.category;
    if (e.amount !== undefined) out.amount = e.amount;
    if (e.currency !== undefined) out.currency = e.currency;
    if (e.date !== undefined) out.date = e.date;
    if (e.vendor !== undefined) out.vendor = e.vendor;
    if (e.description !== undefined) out.description = e.description;
    if (e.paymentMethod !== undefined) out.payment_method = e.paymentMethod;
    if (e.receiptUrl !== undefined) out.receipt_url = e.receiptUrl;
    if (e.taxAmount !== undefined) out.tax_amount = e.taxAmount;
    if (e.status !== undefined) out.status = e.status;
    if (e.isRecurring !== undefined) out.is_recurring = e.isRecurring;
    if (e.recurringFrequency !== undefined) out.recurring_frequency = e.recurringFrequency;
    if (e.approvedBy !== undefined) out.approved_by = e.approvedBy;
    if (e.approvedAt !== undefined) out.approved_at = e.approvedAt;
    if (e.createdBy !== undefined) out.created_by = e.createdBy;
    if (e.aiExtracted !== undefined) out.ai_extracted = e.aiExtracted;
    if (e.aiConfidence !== undefined) out.ai_confidence = e.aiConfidence;
    if (e.policy_flags !== undefined) out.policy_flags = e.policy_flags;
    if (e.is_duplicate_flag !== undefined) out.is_duplicate_flag = e.is_duplicate_flag;
    if (e.duplicate_of_id !== undefined) out.duplicate_of_id = e.duplicate_of_id;
    if (e.ai_confidence_score !== undefined) out.ai_confidence_score = e.ai_confidence_score;
    if (e.receipt_extracted_data !== undefined) out.receipt_extracted_data = e.receipt_extracted_data;
    if (e.is_billable !== undefined) out.is_billable = e.is_billable;
    if (e.client_id !== undefined && e.client_id !== null) out.client_id = Number(e.client_id);
    if (e.department_id !== undefined) out.department_id = e.department_id;
    if (e.project_id !== undefined) out.project_id = e.project_id;
    if (e.vendor_id !== undefined && e.vendor_id !== null) out.vendor_id = Number(e.vendor_id);
    if (e.amount_in_base_currency !== undefined) out.amount_in_base_currency = e.amount_in_base_currency;
    if (e.exchange_rate !== undefined) out.exchange_rate = e.exchange_rate;
    if (e.journal_voucher_number !== undefined) out.journal_voucher_number = e.journal_voucher_number;
    if (e.invoiced_to !== undefined) out.invoiced_to = e.invoiced_to;
    if (e.is_reimbursable !== undefined) out.is_reimbursable = e.is_reimbursable;
    if (e.payroll_reimbursed_in !== undefined) out.payroll_reimbursed_in = e.payroll_reimbursed_in;
    const acctId = e.account_id ?? e.accountId;
    if (acctId != null) {
        out.account_id = Number(acctId);
    }
    return out;
}

// Default comprehensive expense categories
const getInitialExpenseCategories = (): ExpenseCategory[] => {
    const stored = localStorage.getItem(EXPENSE_CATEGORIES_KEY);
    if (stored) return JSON.parse(stored);

    const categories: ExpenseCategory[] = [
        // Operating Expenses
        { id: 'EXP-001', name: 'Rent & Utilities', parentCategory: 'Operating Expenses', type: 'Operating', description: 'Office rent and building costs', createdAt: new Date().toISOString() },
        { id: 'EXP-002', name: 'Electricity', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },
        { id: 'EXP-003', name: 'Water', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },
        { id: 'EXP-004', name: 'Internet & Phone', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },
        { id: 'EXP-005', name: 'Office Supplies', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },
        { id: 'EXP-006', name: 'Maintenance & Repairs', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },

        // Employee Expenses
        { id: 'EXP-007', name: 'Salaries & Wages', parentCategory: 'Employee Expenses', type: 'Employee', isRecurring: true, createdAt: new Date().toISOString() },
        { id: 'EXP-008', name: 'Benefits & Insurance', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },
        { id: 'EXP-009', name: 'Travel & Accommodation', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },
        { id: 'EXP-010', name: 'Meals & Entertainment', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },
        { id: 'EXP-011', name: 'Training & Development', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },
        { id: 'EXP-012', name: 'Fuel & Transportation', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },

        // Marketing & Sales
        { id: 'EXP-013', name: 'Advertising', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },
        { id: 'EXP-014', name: 'Social Media Marketing', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },
        { id: 'EXP-015', name: 'Promotional Materials', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },
        { id: 'EXP-016', name: 'Events & Exhibitions', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },
        { id: 'EXP-017', name: 'Commission & Incentives', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },

        // Administrative
        { id: 'EXP-018', name: 'Legal & Professional Fees', parentCategory: 'Administrative', type: 'Administrative', createdAt: new Date().toISOString() },
        { id: 'EXP-019', name: 'Accounting Services', parentCategory: 'Administrative', type: 'Administrative', createdAt: new Date().toISOString() },
        { id: 'EXP-020', name: 'Bank Charges', parentCategory: 'Administrative', type: 'Administrative', createdAt: new Date().toISOString() },
        { id: 'EXP-021', name: 'Software Subscriptions', parentCategory: 'Administrative', type: 'Administrative', isRecurring: true, createdAt: new Date().toISOString() },
        { id: 'EXP-022', name: 'Licenses & Permits', parentCategory: 'Administrative', type: 'Administrative', createdAt: new Date().toISOString() },

        // Inventory & Purchasing
        { id: 'EXP-023', name: 'Raw Materials', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },
        { id: 'EXP-024', name: 'Finished Goods', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },
        { id: 'EXP-025', name: 'Packaging Materials', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },
        { id: 'EXP-026', name: 'Shipping & Freight', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },
        { id: 'EXP-027', name: 'Import Duties', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },

        // Asset Related
        { id: 'EXP-028', name: 'Equipment Purchase', parentCategory: 'Asset Related', type: 'Asset', createdAt: new Date().toISOString() },
        { id: 'EXP-029', name: 'Vehicle Expenses', parentCategory: 'Asset Related', type: 'Asset', createdAt: new Date().toISOString() },
        { id: 'EXP-030', name: 'Depreciation', parentCategory: 'Asset Related', type: 'Asset', createdAt: new Date().toISOString() },
        { id: 'EXP-031', name: 'Asset Maintenance', parentCategory: 'Asset Related', type: 'Asset', createdAt: new Date().toISOString() },

        // Financial
        { id: 'EXP-032', name: 'Loan Interest', parentCategory: 'Financial', type: 'Financial', createdAt: new Date().toISOString() },
        { id: 'EXP-033', name: 'Credit Card Fees', parentCategory: 'Financial', type: 'Financial', createdAt: new Date().toISOString() },
        { id: 'EXP-034', name: 'Investment Costs', parentCategory: 'Financial', type: 'Financial', createdAt: new Date().toISOString() },
        { id: 'EXP-035', name: 'Insurance Premiums', parentCategory: 'Financial', type: 'Financial', createdAt: new Date().toISOString() },

        // Miscellaneous
        { id: 'EXP-036', name: 'Donations', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
        { id: 'EXP-037', name: 'Penalties & Fines', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
        { id: 'EXP-038', name: 'Refunds & Returns', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
        { id: 'EXP-039', name: 'Petty Cash', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
        { id: 'EXP-040', name: 'Other Expenses', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
    ];

    localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(categories));
    return categories;
};

// TASK 2 — Returns the in-memory cache populated by getExpenses().
// Kept as a sync helper so existing sync callers (checkExpenseDuplicate,
// checkExpensePolicy, exportExpensesAsCSV) keep their API contract.
// If the cache hasn't been loaded yet, returns []; the calling page
// always runs getExpenses() on mount so dupe/policy checks see fresh data.
const getInitialExpenses = (): Expense[] => _expensesCache;

// Expense CRUD operations — now backend-backed.
export async function getExpenses(): Promise<Expense[]> {
    const snapshot = await getExpensesSnapshot();
    if (snapshot.stale) {
        throw snapshot.error || new Error('Expense data unavailable.');
    }
    return snapshot.expenses;
}

export async function getExpensesSnapshot(): Promise<{ expenses: Expense[]; stale: boolean; error?: Error }> {
    try {
        const r = await authFetch(`${EXPENSES_API}/`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rows = await r.json();
        _expensesCache = (Array.isArray(rows) ? rows : []).map(_expenseFromApi);
        _expensesCacheLoaded = true;
        _expensesCacheStale = false;
        return { expenses: _expensesCache, stale: false };
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (_expensesCacheLoaded) {
            console.warn('[expenses] getExpenses fetch failed, cached snapshot is stale:', err);
            _expensesCacheStale = true;
            return { expenses: _expensesCache, stale: true, error };
        }
        throw error;
    }
}

export function isExpenseCacheStale(): boolean {
    return _expensesCacheStale;
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(getInitialExpenseCategories()), 100);
    });
}

export async function saveExpense(expense: Partial<Expense>): Promise<Expense> {
    // TASK 2 — Backend-backed. POST for new, PATCH for existing.
    // Cache is kept in sync so the sync helpers (duplicate/policy/export)
    // see the latest state without a round-trip.
    if (expense.id) {
        // PATCH — drop fields the backend doesn't accept on updates.
        // We forward whatever's present in `expense`; _expenseToApi
        // filters undefined keys so we don't accidentally null-out
        // unrelated fields.
        const body = _expenseToApi(expense);
        const res = await authFetch(`${EXPENSES_API}/${encodeURIComponent(String(expense.id))}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const detail = await _readErrorDetail(res);
            throw new Error(detail || `Failed to update expense (HTTP ${res.status})`);
        }
        const updated = _expenseFromApi(await res.json());
        _expensesCache = _expensesCache.map(e => e.id === updated.id ? updated : e);
        return updated;
    }

    // POST — new expense. Resolve createdBy from the auth store if not
    // explicitly provided (W7-5 behavior preserved). Default date to today
    // so the backend's required-date check never fails on form-omits.
    const resolvedCreator = expense.createdBy || (() => {
        try {
            const raw = localStorage.getItem('bettano_current_user');
            if (raw) {
                const u = JSON.parse(raw) as { name?: string };
                if (u?.name) return u.name;
            }
        } catch { /* fall through */ }
        return 'Unknown User';
    })();
    const seeded: Partial<Expense> = {
        ...expense,
        createdBy: resolvedCreator,
        date: expense.date || new Date().toISOString().slice(0, 10),
        status: expense.status || 'Draft',
        currency: expense.currency || 'USD',
        category: expense.category || 'Other',
        paymentMethod: expense.paymentMethod || 'Cash',
    };
    const body = _expenseToApi(seeded);
    const res = await authFetch(`${EXPENSES_API}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const detail = await _readErrorDetail(res);
        throw new Error(detail || `Failed to create expense (HTTP ${res.status})`);
    }
    const created = _expenseFromApi(await res.json());
    _expensesCache = [created, ..._expensesCache];
    return created;
}

/** Parse a FastAPI error payload to a human-readable string. */
async function _readErrorDetail(res: Response): Promise<string> {
    try {
        const j = await res.json();
        if (typeof j?.detail === 'string') return j.detail;
        if (Array.isArray(j?.detail)) return JSON.stringify(j.detail);
    } catch { /* not JSON */ }
    try {
        return await res.text();
    } catch {
        return '';
    }
}

export async function saveExpenseCategory(category: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    return new Promise((resolve) => {
        const categories = getInitialExpenseCategories();
        let savedCategory: ExpenseCategory;

        if (category.id) {
            const index = categories.findIndex(c => c.id === category.id);
            if (index !== -1) {
                categories[index] = { ...categories[index], ...category } as ExpenseCategory;
                savedCategory = categories[index];
            } else {
                savedCategory = { ...category, id: category.id } as ExpenseCategory;
                categories.push(savedCategory);
            }
        } else {
            savedCategory = {
                ...category,
                id: `EXP-${Date.now()}`,
                createdAt: new Date().toISOString()
            } as ExpenseCategory;
            categories.push(savedCategory);
        }

        localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(categories));
        setTimeout(() => resolve(savedCategory), 100);
    });
}

// FIX W7-3 — CSV export so users can back up their localStorage expense
// records before clearing browser data. Includes JV linkage so orphaned-JV
// reconciliation can be done manually if needed.
export function exportExpensesAsCSV(): string {
    const expenses = getInitialExpenses();
    const headers: (keyof Expense | string)[] = [
        'id', 'date', 'vendor', 'category', 'description',
        'amount', 'currency', 'paymentMethod', 'status',
        'createdBy', 'createdAt', 'approvedBy', 'approvedAt',
        'journal_voucher_number', 'payroll_reimbursed_in',
        'is_reimbursable', 'is_billable', 'client_id',
        'taxAmount', 'isRecurring', 'recurringFrequency',
    ];
    const escape = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
        headers.join(','),
        ...expenses.map(e => headers.map(h => escape((e as unknown as Record<string, unknown>)[h])).join(',')),
    ];
    return rows.join('\n');
}

export async function deleteExpense(id: string, opts?: { force?: boolean }): Promise<void> {
    // TASK 2 — Backend-backed. The W7-2 JV-orphan guard now lives on the
    // backend (returns 409 if journal_voucher_number is set and
    // force=true isn't passed). The frontend forwards the force flag
    // when the user acknowledges the second confirmation.
    const query = opts?.force ? '?force=true' : '';
    const res = await authFetch(`${EXPENSES_API}/${encodeURIComponent(id)}${query}`, {
        method: 'DELETE',
    });
    if (!res.ok) {
        const detail = await _readErrorDetail(res);
        throw new Error(detail || `Failed to delete expense (HTTP ${res.status})`);
    }
    _expensesCache = _expensesCache.filter(e => String(e.id) !== String(id));
}

// ─── STEP 2 — Real receipt OCR via Anthropic multimodal /ai/chat ────
// Replaces the previous mock that returned fake "AWS / $156.75" data
// for every upload regardless of file content.  Function signature
// unchanged so the callsite in ExpenseManagement.tsx needs no change.
// Throws on every real failure path instead of resolving to fake data.

const API_HOST = getOilErpApiHost();

const RECEIPT_OCR_PROMPT =
    "You are a receipt reading assistant for an ERP system. " +
    "Extract the following from this receipt image and return ONLY valid JSON with no extra text:\n" +
    "{\n" +
    "  \"vendor_name\": string,\n" +
    "  \"date\": \"YYYY-MM-DD\",\n" +
    "  \"total_amount\": number,\n" +
    "  \"currency\": \"ISO code\",\n" +
    "  \"line_items\": [{\"description\": string, \"amount\": number}],\n" +
    "  \"payment_method\": \"Cash\" | \"Card\" | \"Unknown\",\n" +
    "  \"tax_amount\": number | null,\n" +
    "  \"receipt_number\": string | null,\n" +
    "  \"confidence\": { \"vendor\": 0-100, \"date\": 0-100, \"amount\": 0-100 }\n" +
    "}\n" +
    "If you cannot read a field clearly, set it to null and its confidence to 0.";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;  // 5 MB Anthropic multimodal ceiling

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const m = /^data:([^;]+);base64,(.+)$/.exec(result);
            if (!m) return reject(new Error('Could not encode file.'));
            resolve({ mediaType: m[1] || file.type, data: m[2] || '' });
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(file);
    });
}

function parseLooseJson(text: string): Record<string, unknown> {
    const trimmed = text.trim();
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
    const body = fenced ? fenced[1] : trimmed;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI did not return JSON.');
    return JSON.parse(body.slice(start, end + 1));
}

export async function extractExpenseFromReceipt(file: File): Promise<AIExtractedData> {
    if (!file) throw new Error('No file provided.');
    if (file.size > MAX_RECEIPT_BYTES) {
        throw new Error(
            `Receipt is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
            `Please use a clearer photo under 5 MB.`
        );
    }
    const mime = (file.type || '').toLowerCase();
    let block: Record<string, unknown>;
    if (mime.startsWith('image/')) {
        const { data, mediaType } = await fileToBase64(file);
        block = { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
    } else if (mime === 'application/pdf') {
        const { data, mediaType } = await fileToBase64(file);
        block = { type: 'document', source: { type: 'base64', media_type: mediaType, data } };
    } else {
        throw new Error(`Unsupported receipt type "${mime || 'unknown'}". Use JPG, PNG, or PDF.`);
    }

    const res = await authFetch(`${API_HOST}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system: RECEIPT_OCR_PROMPT,
            max_tokens: 1500,
            messages: [{
                role: 'user',
                content: [block, { type: 'text', text: 'Extract the receipt fields per the schema.' }],
            }],
        }),
    });

    if (!res.ok) {
        // Mirror the error-surfacing pattern from TC-77/79/83.
        let detail = '';
        try { detail = ((await res.json()) as { detail?: string })?.detail || ''; } catch { /* not JSON */ }
        throw new Error(detail || `Receipt OCR failed (HTTP ${res.status}).`);
    }
    const body = await res.json() as { reply?: string };
    const reply = String(body?.reply || '');
    if (!reply) throw new Error('AI returned an empty response.');

    const parsed = parseLooseJson(reply);
    const conf = (parsed.confidence as Record<string, number>) || {};
    const vendorConf = Number(conf.vendor) || 0;
    const dateConf   = Number(conf.date)   || 0;
    const amountConf = Number(conf.amount) || 0;

    const lineItems = Array.isArray(parsed.line_items)
        ? (parsed.line_items as Array<{ description?: string; amount?: number }>)
        : [];

    const allowedPayment = ['Cash', 'Card', 'Unknown'] as const;
    const pm = String(parsed.payment_method || '');
    const paymentMethod: typeof allowedPayment[number] =
        (allowedPayment as readonly string[]).includes(pm)
            ? (pm as typeof allowedPayment[number])
            : 'Unknown';

    return {
        vendor:            String(parsed.vendor_name || ''),
        amount:            Number(parsed.total_amount) || 0,
        date:              String(parsed.date || new Date().toISOString().slice(0, 10)),
        items:             lineItems.map(li => String(li.description || '')).filter(Boolean),
        taxAmount:         Number(parsed.tax_amount) || 0,
        // Suggested category is filled by Smart Categorization (STEP 3).
        suggestedCategory: 'Other',
        confidence:        Math.min(vendorConf, dateConf, amountConf),
        currency:          String(parsed.currency || 'USD'),
        perFieldConfidence: { vendor: vendorConf, date: dateConf, amount: amountConf },
        paymentMethod,
        receiptNumber:     parsed.receipt_number == null ? null : String(parsed.receipt_number),
    };
}

// LLM-powered custom expense head creator via backend /ai/chat.
export async function generateExpenseHeadWithAI(description: string, amount = 0): Promise<{
    name: string;
    parentCategory: string;
    type: string;
    isRecurring: boolean;
    taxTreatment: string;
    accountCode: string;
    similarCategories: string[];
}> {
    const res = await authFetch(API_HOST + '/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system:
                'You are an accounting assistant. Suggest an expense account head for the provided expense. ' +
                'Return ONLY valid JSON with keys: name, parentCategory, type, isRecurring, taxTreatment, accountCode, similarCategories. ' +
                'Use "—" for any field you cannot infer. Do not invent an account code; use "—" unless it is provided.',
            messages: [
                {
                    role: 'user',
                    content:
                        `Expense description: ${description || '(none)'}\n` +
                        `Amount: ${amount || 0}\n` +
                        'Suggest one concise expense account name and category.',
                },
            ],
            max_tokens: 500,
        }),
    });

    if (!res.ok) {
        throw new Error(`AI expense-head request failed (${res.status})`);
    }

    const data = await res.json();
    const raw = String(data.reply || '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) {
        throw new Error('AI response did not include JSON');
    }

    const parsed = JSON.parse(raw.slice(start, end + 1));
    return {
        name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : '—',
        parentCategory: typeof parsed.parentCategory === 'string' && parsed.parentCategory.trim() ? parsed.parentCategory.trim() : '—',
        type: typeof parsed.type === 'string' && parsed.type.trim() ? parsed.type.trim() : '—',
        isRecurring: Boolean(parsed.isRecurring),
        taxTreatment: typeof parsed.taxTreatment === 'string' && parsed.taxTreatment.trim() ? parsed.taxTreatment.trim() : '—',
        accountCode: typeof parsed.accountCode === 'string' && parsed.accountCode.trim() ? parsed.accountCode.trim() : '—',
        similarCategories: Array.isArray(parsed.similarCategories)
            ? parsed.similarCategories
                .filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
                .map((item: string) => item.trim())
            : [],
    };
}


// ─── STEP 3 — Smart Categorization via /ai/chat ──────────────────────
// Sends vendor + description + amount to Claude with the master-prompt
// system prompt verbatim; returns the suggested category mapped back
// to one of the 40 existing localStorage categories so the UI's
// existing <select> can accept it.

export interface CategorySuggestion {
    category: string;        // raw AI label (one of the 15 master-prompt cats)
    mappedCategory: string;  // closest match in the existing 40-category list
    confidence: number;      // 0-100
    reason: string;          // one-sentence explanation
}

const AI_CATEGORY_VALUES = [
    'Travel', 'Accommodation', 'Meals', 'Software/SaaS', 'Office Supplies',
    'Marketing', 'Training', 'Utilities', 'Equipment', 'Professional Services',
    'Petty Cash', 'Vehicle/Mileage', 'Client Entertainment', 'Medical', 'Other',
] as const;

const CATEGORIZE_PROMPT =
    'You are an expense categorization assistant.\n' +
    'Given:\n' +
    '  Vendor: {VENDOR}\n' +
    '  Description: {DESCRIPTION}\n' +
    '  Amount: {AMOUNT}\n\n' +
    'Return ONLY valid JSON with no extra text:\n' +
    '{\n' +
    '  "category": "exact category name from this list: [Travel, ' +
    'Accommodation, Meals, Software/SaaS, Office Supplies, Marketing, ' +
    'Training, Utilities, Equipment, Professional Services, Petty Cash, ' +
    'Vehicle/Mileage, Client Entertainment, Medical, Other]",\n' +
    '  "confidence": 0-100,\n' +
    '  "reason": "one sentence explanation"\n' +
    '}';

// 15 master-prompt category labels → closest names in the existing
// 40-category seed list (getInitialExpenseCategories above).  These
// are the strings actually stored in Expense.category — must match
// what the <select> renders or the dropdown won't reflect the choice.
const CATEGORY_MAP: Record<string, string> = {
    'Travel':              'Travel & Accommodation',
    'Accommodation':       'Travel & Accommodation',
    'Meals':               'Meals & Entertainment',
    'Software/SaaS':       'Software Subscriptions',
    'Office Supplies':     'Office Supplies',
    'Marketing':           'Advertising',
    'Training':            'Training & Development',
    'Utilities':           'Internet & Phone',
    'Equipment':           'Equipment Purchase',
    'Professional Services':'Legal & Professional Fees',
    'Petty Cash':          'Petty Cash',
    'Vehicle/Mileage':     'Vehicle Expenses',
    'Client Entertainment':'Meals & Entertainment',
    'Medical':             'Benefits & Insurance',
    'Other':               'Other Expenses',
};

export async function suggestExpenseCategory(
    vendor: string,
    description: string,
    amount: number,
): Promise<CategorySuggestion> {
    const system = CATEGORIZE_PROMPT
        .replace('{VENDOR}',      vendor || '(unknown)')
        .replace('{DESCRIPTION}', description || '(none)')
        .replace('{AMOUNT}',      String(amount || 0));

    const res = await authFetch(API_HOST + '/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system,
            max_tokens: 300,
            messages: [{ role: 'user', content: 'Categorize this expense.' }],
        }),
    });
    if (!res.ok) {
        let detail = '';
        try { detail = ((await res.json()) as { detail?: string })?.detail || ''; } catch { /* not JSON */ }
        throw new Error(detail || ('Categorization failed (HTTP ' + res.status + ').'));
    }
    const body = await res.json() as { reply?: string };
    const reply = String(body?.reply || '');
    if (!reply) throw new Error('AI returned an empty response.');

    const parsed = parseLooseJson(reply);
    const rawCategory = String(parsed.category || 'Other');
    const safeCategory = (AI_CATEGORY_VALUES as readonly string[]).includes(rawCategory)
        ? rawCategory : 'Other';
    return {
        category:        safeCategory,
        mappedCategory:  CATEGORY_MAP[safeCategory] || 'Other Expenses',
        confidence:      Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
        reason:          String(parsed.reason || ''),
    };
}


// ─── STEP 4 — Duplicate Detection (pure-local rule-based) ───────────
// Rules per master prompt:
//   - Same vendor AND same amount AND date within 7 days
//   - Same amount AND same date AND same category
// Pure-local — no AI round trip needed; vendor/amount/date math is
// deterministic.  Returns up to 3 matches with human-readable reasons.

export interface DuplicateMatch {
    expenseId: string;
    vendor: string;
    amount: number;
    date: string;
    reason: string;
    // TASK 8 — Confidence score 0-100. Rule A (vendor + amount + date≤7d)
    // is high-confidence (95); Rule B (amount + date + category, vendors
    // may differ) is medium (70). Form treats ≥90 as a hard block.
    confidence: number;
}

export interface DuplicateResult {
    isDuplicate: boolean;
    matches: DuplicateMatch[];
    // TASK 8 — Convenience rollup so the form can `result.maxConfidence >= 90`
    // without traversing matches itself. 0 when no matches.
    maxConfidence: number;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function checkExpenseDuplicate(candidate: {
    vendor: string;
    amount: number;
    date: string;
    category: string;
    excludeId?: string;       // when editing, don't match the row itself
}): DuplicateResult {
    const all = getInitialExpenses();
    const now = Date.now();
    const candidateDateMs = new Date(candidate.date).getTime();
    if (!Number.isFinite(candidateDateMs)) return { isDuplicate: false, matches: [], maxConfidence: 0 };

    const recent = all.filter(e => {
        if (candidate.excludeId && e.id === candidate.excludeId) return false;
        const eDateMs = new Date(e.date).getTime();
        if (!Number.isFinite(eDateMs)) return false;
        return now - eDateMs <= NINETY_DAYS_MS;
    });

    const matches: DuplicateMatch[] = [];
    const same = (a: string, b: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
    const amtEq = (a: number, b: number) => Math.abs(a - b) < 0.005;
    const dayDiff = (a: number, b: number) => Math.abs(a - b) / (24 * 60 * 60 * 1000);

    for (const e of recent) {
        const eDateMs = new Date(e.date).getTime();
        const days = dayDiff(eDateMs, candidateDateMs);

        // Rule A: same vendor + same amount + date within 7 days. HIGH confidence.
        if (same(e.vendor, candidate.vendor) && amtEq(e.amount, candidate.amount) && days <= 7) {
            matches.push({
                expenseId: e.id, vendor: e.vendor, amount: e.amount, date: e.date,
                reason: 'Same vendor + same amount + date within 7 days',
                confidence: 95,
            });
            if (matches.length >= 3) break;
            continue;
        }
        // Rule B: same amount + same date + same category. MEDIUM confidence
        // (vendors differ — could be coincidence). Warns but doesn't hard-block.
        if (amtEq(e.amount, candidate.amount) && days < 1 && same(e.category, candidate.category)) {
            matches.push({
                expenseId: e.id, vendor: e.vendor, amount: e.amount, date: e.date,
                reason: 'Same amount + same date + same category',
                confidence: 70,
            });
            if (matches.length >= 3) break;
        }
    }
    const maxConfidence = matches.reduce((m, x) => Math.max(m, x.confidence), 0);
    return { isDuplicate: matches.length > 0, matches, maxConfidence };
}


// ─── STEP 5 — Policy Checker (pure-local rule-based) ───────────────
// All 4 rules from the master prompt.  Returns PolicyFlag[] reusing
// the interface from STEP 1.  All current rules are warnings (no
// hard errors) — UI surfaces them in a yellow banner but never blocks
// the save.

const POLICY_MEAL_MAX = 200;
const POLICY_RECEIPT_REQUIRED_THRESHOLD = 50;
const POLICY_LATE_SUBMISSION_DAYS = 30;
const POLICY_ROUND_NUMBER_THRESHOLD = 500;

export function checkExpensePolicy(candidate: {
    category: string;
    amount: number;
    date: string;
    hasReceipt: boolean;
}): PolicyFlag[] {
    const flags: PolicyFlag[] = [];
    const cat = (candidate.category || '').toLowerCase();
    const amount = Number(candidate.amount) || 0;

    // Rule 1: Meals category + amount > $200
    if (cat.includes('meal') && amount > POLICY_MEAL_MAX) {
        flags.push({
            rule:     'meal_max_amount',
            severity: 'warning',
            message:  `Exceeds the $${POLICY_MEAL_MAX} meal limit.`,
        });
    }

    // Rule 2: No receipt + amount > $50
    if (!candidate.hasReceipt && amount > POLICY_RECEIPT_REQUIRED_THRESHOLD) {
        flags.push({
            rule:     'receipt_required',
            severity: 'warning',
            message:  `Receipts are required for amounts over $${POLICY_RECEIPT_REQUIRED_THRESHOLD}.`,
        });
    }

    // Rule 3: Expense date older than 30 days (late submission)
    if (candidate.date) {
        const expenseDateMs = new Date(candidate.date).getTime();
        if (Number.isFinite(expenseDateMs)) {
            const ageDays = (Date.now() - expenseDateMs) / (24 * 60 * 60 * 1000);
            if (ageDays > POLICY_LATE_SUBMISSION_DAYS) {
                flags.push({
                    rule:     'late_submission',
                    severity: 'warning',
                    message:  `Late submission — expense is ${Math.floor(ageDays)} days old (over ${POLICY_LATE_SUBMISSION_DAYS}-day window).`,
                });
            }
        }
    }

    // Rule 4: Round-number amount over $500
    if (amount > POLICY_ROUND_NUMBER_THRESHOLD && Number.isInteger(amount) && amount % 100 === 0) {
        flags.push({
            rule:     'round_number_high',
            severity: 'warning',
            message:  `Round amount over $${POLICY_ROUND_NUMBER_THRESHOLD} — may require extra documentation.`,
        });
    }

    return flags;
}


// ─── STEP 6 — Bulk Upload parser ────────────────────────────────────
// Accepts an image, PDF, raw text (e.g. pasted bank-statement rows),
// or CSV string and returns one row per detected expense.  Each row
// is shallow-categorized (STEP 3) + duplicate-checked (STEP 4) +
// policy-checked (STEP 5) so the review table can show everything
// inline.

export interface ParsedExpenseRow {
    id: string;                  // local table reactivity
    vendor: string;
    date: string;                // YYYY-MM-DD
    amount: number;
    currency: string;
    description: string;
    category: string;            // mappedCategory from STEP 3
    categoryConfidence: number;
    extractionConfidence: number;
    isDuplicate: boolean;
    duplicateOfId: string | null;
    policyFlags: PolicyFlag[];
}

const BULK_PARSER_PROMPT =
    'You are reading an expense document.  Extract every individual ' +
    'expense line item you can find.\n' +
    'Return ONLY a valid JSON array with no extra text:\n' +
    '[{\n' +
    '  "vendor_name": string or null,\n' +
    '  "date": "YYYY-MM-DD" or null,\n' +
    '  "amount": number or null,\n' +
    '  "currency": "ISO" or null,\n' +
    '  "description": string or null,\n' +
    '  "confidence": 0-100\n' +
    '}]\n' +
    'Ignore totals, headings, and page numbers.  Only extract ' +
    'individual expense line items.';

function parseLooseJsonArray(text: string): unknown[] {
    const trimmed = text.trim();
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
    const body = fenced ? fenced[1] : trimmed;
    const start = body.indexOf('[');
    const end = body.lastIndexOf(']');
    if (start < 0 || end <= start) throw new Error('AI did not return a JSON array.');
    const parsed = JSON.parse(body.slice(start, end + 1));
    if (!Array.isArray(parsed)) throw new Error('AI returned non-array.');
    return parsed;
}

// Minimal CSV parser — handles quoted fields with embedded commas.
// Not a full RFC 4180 implementation; sufficient for bank exports.
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (!line.trim()) continue;
        const cells: string[] = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
                else inQ = !inQ;
            } else if (c === ',' && !inQ) {
                cells.push(cur); cur = '';
            } else {
                cur += c;
            }
        }
        cells.push(cur);
        rows.push(cells);
    }
    return rows;
}

async function callBulkParserAI(payload: Record<string, unknown>): Promise<unknown[]> {
    const res = await authFetch(API_HOST + '/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        let detail = '';
        try { detail = ((await res.json()) as { detail?: string })?.detail || ''; } catch { /* not JSON */ }
        throw new Error(detail || ('Bulk parser failed (HTTP ' + res.status + ').'));
    }
    const body = await res.json() as { reply?: string };
    const reply = String(body?.reply || '');
    if (!reply) throw new Error('AI returned an empty response.');
    return parseLooseJsonArray(reply);
}

export type BulkInput =
    | { kind: 'image';   file: File }
    | { kind: 'pdf';     file: File }
    | { kind: 'csv';     text: string }
    | { kind: 'text';    text: string };

export async function parseBulkExpenses(input: BulkInput): Promise<ParsedExpenseRow[]> {
    let rawRows: Array<Record<string, unknown>> = [];

    if (input.kind === 'image' || input.kind === 'pdf') {
        if (input.file.size > MAX_RECEIPT_BYTES) {
            throw new Error('File is too large (over 5 MB).');
        }
        const { data, mediaType } = await fileToBase64(input.file);
        const block: Record<string, unknown> = input.kind === 'pdf'
            ? { type: 'document', source: { type: 'base64', media_type: mediaType, data } }
            : { type: 'image',    source: { type: 'base64', media_type: mediaType, data } };
        const parsed = await callBulkParserAI({
            system: BULK_PARSER_PROMPT,
            max_tokens: 3000,
            messages: [{ role: 'user', content: [block, { type: 'text', text: 'Extract every expense row per the schema.' }] }],
        });
        rawRows = parsed as Array<Record<string, unknown>>;
    } else if (input.kind === 'csv') {
        // Send first 50 rows as text — AI is better at mapping arbitrary
        // column names than a brittle column-detector heuristic.
        const rows = parseCsv(input.text);
        const preview = rows.slice(0, 50).map(r => r.join('\t')).join('\n');
        const parsed = await callBulkParserAI({
            system: BULK_PARSER_PROMPT + '\n\nThe document is tab-separated rows.  First row may be headers.',
            max_tokens: 3000,
            messages: [{ role: 'user', content: preview }],
        });
        rawRows = parsed as Array<Record<string, unknown>>;
    } else {
        const parsed = await callBulkParserAI({
            system: BULK_PARSER_PROMPT,
            max_tokens: 3000,
            messages: [{ role: 'user', content: input.text }],
        });
        rawRows = parsed as Array<Record<string, unknown>>;
    }

    // Hydrate each row with categorization + duplicate + policy.
    const out: ParsedExpenseRow[] = [];
    for (let i = 0; i < rawRows.length; i++) {
        const r = rawRows[i] || {};
        const vendor = String(r.vendor_name || '');
        const date = String(r.date || new Date().toISOString().slice(0, 10));
        const amount = Number(r.amount) || 0;
        const description = String(r.description || '');
        const currency = String(r.currency || 'USD');
        const extractionConfidence = Math.max(0, Math.min(100, Number(r.confidence) || 0));

        // Categorize — non-fatal if AI fails for one row.
        let category = 'Other Expenses';
        let categoryConfidence = 0;
        if (vendor && amount > 0) {
            try {
                const s = await suggestExpenseCategory(vendor, description, amount);
                category = s.mappedCategory;
                categoryConfidence = s.confidence;
            } catch { /* leave default */ }
        }

        // Duplicate + policy (pure-local, never fail).
        const dup = checkExpenseDuplicate({ vendor, amount, date, category });
        const policyFlags = checkExpensePolicy({ category, amount, date, hasReceipt: false });

        out.push({
            id: `bulk-${Date.now()}-${i}`,
            vendor,
            date,
            amount,
            currency,
            description,
            category,
            categoryConfidence,
            extractionConfidence,
            isDuplicate: dup.isDuplicate,
            duplicateOfId: dup.matches[0]?.expenseId || null,
            policyFlags,
        });
    }
    return out;
}


// ─── STEP 8 — Mileage Tracker ───────────────────────────────────────
// Pure-local CRUD for mileage entries (localStorage), plus an AI
// distance estimator using the exact prompt from the master file.

export interface MileageEntry {
    id: string;
    date: string;                  // YYYY-MM-DD
    fromLocation: string;
    toLocation: string;
    distanceKm: number;
    roundTrip: boolean;
    ratePerKm: number;
    totalAmount: number;
    purpose: string;
    linkedExpenseId: string | null;
    createdAt: string;
}

const MILEAGE_KEY = 'zavi_mileage_entries';

export async function getMileageEntries(): Promise<MileageEntry[]> {
    return new Promise(resolve => {
        const raw = localStorage.getItem(MILEAGE_KEY);
        const list: MileageEntry[] = raw ? JSON.parse(raw) : [];
        // Newest first.
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setTimeout(() => resolve(list), 50);
    });
}

export async function saveMileageEntry(entry: Partial<MileageEntry>): Promise<MileageEntry> {
    return new Promise(resolve => {
        const raw = localStorage.getItem(MILEAGE_KEY);
        const list: MileageEntry[] = raw ? JSON.parse(raw) : [];
        let saved: MileageEntry;
        if (entry.id) {
            const idx = list.findIndex(e => e.id === entry.id);
            if (idx >= 0) {
                list[idx] = { ...list[idx], ...entry } as MileageEntry;
                saved = list[idx];
            } else {
                saved = { ...entry, id: entry.id } as MileageEntry;
                list.push(saved);
            }
        } else {
            saved = {
                id: 'MIL-' + Date.now(),
                date: entry.date || new Date().toISOString().slice(0, 10),
                fromLocation: entry.fromLocation || '',
                toLocation: entry.toLocation || '',
                distanceKm: Number(entry.distanceKm) || 0,
                roundTrip: Boolean(entry.roundTrip),
                ratePerKm: Number(entry.ratePerKm) || 0.45,
                totalAmount: Number(entry.totalAmount) || 0,
                purpose: entry.purpose || '',
                linkedExpenseId: entry.linkedExpenseId ?? null,
                createdAt: new Date().toISOString(),
            };
            list.push(saved);
        }
        localStorage.setItem(MILEAGE_KEY, JSON.stringify(list));
        setTimeout(() => resolve(saved), 50);
    });
}

export interface MileageEstimate {
    distanceKm: number;
    confidence: 'exact' | 'approximate' | 'rough';
    note: string;
}

export async function estimateMileage(from: string, to: string): Promise<MileageEstimate> {
    if (!from?.trim() || !to?.trim()) {
        throw new Error('Enter both From and To locations.');
    }
    const system =
        'Estimate the driving distance in km between:\n' +
        'From: ' + from.trim() + '\n' +
        'To: ' + to.trim() + '\n\n' +
        'Return ONLY valid JSON:\n' +
        '{\n' +
        '  "distance_km": number,\n' +
        '  "confidence": "exact" | "approximate" | "rough",\n' +
        '  "note": "string if approximate"\n' +
        '}\n' +
        'You are not a maps API — your estimates are inherently rough.  ' +
        'Use "rough" or "approximate" for confidence unless you have ' +
        'verified the route.';

    const res = await authFetch(API_HOST + '/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system,
            max_tokens: 250,
            messages: [{ role: 'user', content: 'Estimate the driving distance.' }],
        }),
    });
    if (!res.ok) {
        let detail = '';
        try { detail = ((await res.json()) as { detail?: string })?.detail || ''; } catch { /* not JSON */ }
        throw new Error(detail || ('Mileage estimate failed (HTTP ' + res.status + ').'));
    }
    const body = await res.json() as { reply?: string };
    const reply = String(body?.reply || '');
    if (!reply) throw new Error('AI returned an empty response.');

    const parsed = parseLooseJson(reply);
    const conf = String(parsed.confidence || 'rough');
    const safeConf: MileageEstimate['confidence'] =
        conf === 'exact' || conf === 'approximate' || conf === 'rough' ? conf : 'rough';
    return {
        distanceKm: Math.max(0, Number(parsed.distance_km) || 0),
        confidence: safeConf,
        note:       String(parsed.note || ''),
    };
}


// ─── STEP 9 — Natural Language Report Query ─────────────────────────
// Sends a compact slice of expenses + the user's question to Claude.
// Capped at the most recent 200 rows so the prompt stays reasonable
// for localStorage-scale data.  For real production you'd push this
// down to SQL — this is sufficient for the UI.

export type AnswerType = 'number' | 'table' | 'text';
export type ChartType  = 'bar' | 'pie' | 'line' | 'none';

export interface NlQueryResult {
    answerType: AnswerType;
    answer: string;
    value: number | null;
    filteredExpenses: Expense[];
    chartType: ChartType;
}

const NL_QUERY_MAX_ROWS = 200;

export async function queryExpensesNaturalLanguage(question: string): Promise<NlQueryResult> {
    if (!question?.trim()) throw new Error('Ask a question first.');

    // Send a compact slice — most recent N expenses, only the fields
    // the analyst would actually need.  Saves tokens vs. dumping the
    // entire Expense record.
    const all = getInitialExpenses();
    const recent = [...all]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, NL_QUERY_MAX_ROWS)
        .map(e => ({
            id: e.id,
            vendor: e.vendor,
            amount: e.amount,
            currency: e.currency,
            date: e.date,
            category: e.category,
            status: e.status,
            description: e.description,
            paymentMethod: e.paymentMethod,
        }));

    const system =
        'You are a financial analyst for an ERP system.\n' +
        'Expenses data (most recent ' + recent.length + ' rows, JSON): ' + JSON.stringify(recent) + '\n\n' +
        'The user asks: "' + question.trim() + '"\n\n' +
        'Answer the question directly.  If the answer is a list, return ' +
        'a table.  If the answer is a number, return the number with ' +
        'context.  If you need to filter, list which expense ids matched.\n\n' +
        'Return ONLY valid JSON with no extra text:\n' +
        '{\n' +
        '  "answer_type": "number" | "table" | "text",\n' +
        '  "answer": "plain English answer",\n' +
        '  "value": number | null,\n' +
        '  "filtered_ids": ["expense id 1", "expense id 2", ...] | null,\n' +
        '  "chart_type": "bar" | "pie" | "line" | "none"\n' +
        '}';

    const res = await authFetch(API_HOST + '/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system,
            max_tokens: 1500,
            messages: [{ role: 'user', content: 'Answer the question per the JSON schema.' }],
        }),
    });
    if (!res.ok) {
        let detail = '';
        try { detail = ((await res.json()) as { detail?: string })?.detail || ''; } catch { /* not JSON */ }
        throw new Error(detail || ('NL query failed (HTTP ' + res.status + ').'));
    }
    const body = await res.json() as { reply?: string };
    const reply = String(body?.reply || '');
    if (!reply) throw new Error('AI returned an empty response.');

    const parsed = parseLooseJson(reply);
    const at = String(parsed.answer_type || 'text');
    const ct = String(parsed.chart_type || 'none');
    const safeAnswerType: AnswerType = (at === 'number' || at === 'table' || at === 'text') ? at : 'text';
    const safeChartType: ChartType   = (ct === 'bar' || ct === 'pie' || ct === 'line') ? ct : 'none';

    // Map the AI's returned ids back to full Expense rows the UI can
    // render (the AI only sees the compact slice).
    const filteredIds = Array.isArray(parsed.filtered_ids) ? parsed.filtered_ids.map(String) : [];
    const filteredExpenses = filteredIds.length > 0
        ? all.filter(e => filteredIds.includes(e.id))
        : [];

    return {
        answerType:       safeAnswerType,
        answer:           String(parsed.answer || ''),
        value:            parsed.value == null ? null : Number(parsed.value),
        filteredExpenses,
        chartType:        safeChartType,
    };
}


// ─── STEP 10 — Expense Settings ─────────────────────────────────────
// Persisted to localStorage under EXPENSE_SETTINGS_KEY.  When no
// stored settings exist getExpenseSettings() returns DEFAULT_SETTINGS,
// whose values match the hardcoded constants used by STEP 5's checker
// before this step — so unchanged behaviour for legacy users.
//
// The policy checker (STEP 5) reads getExpenseSettings() at call time
// so threshold edits in the Settings UI take immediate effect.

export interface ExpenseSettings {
    policyRules: {
        mealMaxAmount:            number;
        receiptRequiredThreshold: number;
        lateSubmissionDays:       number;
        roundNumberThreshold:     number;
        enabled: {
            meal:    boolean;
            receipt: boolean;
            late:    boolean;
            round:   boolean;
        };
    };
    autoApproveThreshold:         number;
    mileageRatePerKm:             number;
    aiFeaturesEnabled: {
        ocr:                 boolean;
        categorization:      boolean;
        duplicateDetection:  boolean;
        bulkParser:          boolean;
        nlReports:           boolean;
        mileageEstimator:    boolean;
    };
}

const EXPENSE_SETTINGS_KEY = 'zavi_expense_settings';

export const DEFAULT_SETTINGS: ExpenseSettings = {
    policyRules: {
        mealMaxAmount:            POLICY_MEAL_MAX,
        receiptRequiredThreshold: POLICY_RECEIPT_REQUIRED_THRESHOLD,
        lateSubmissionDays:       POLICY_LATE_SUBMISSION_DAYS,
        roundNumberThreshold:     POLICY_ROUND_NUMBER_THRESHOLD,
        enabled: { meal: true, receipt: true, late: true, round: true },
    },
    autoApproveThreshold: 100,
    mileageRatePerKm:     0.45,
    aiFeaturesEnabled: {
        ocr:                true,
        categorization:     true,
        duplicateDetection: true,
        bulkParser:         true,
        nlReports:          true,
        mileageEstimator:   true,
    },
};

export function getExpenseSettings(): ExpenseSettings {
    try {
        const raw = localStorage.getItem(EXPENSE_SETTINGS_KEY);
        if (!raw) return DEFAULT_SETTINGS;
        const parsed = JSON.parse(raw) as Partial<ExpenseSettings>;
        // Deep-merge with defaults so older saved settings don't crash
        // when we add new fields in a future step.
        return {
            policyRules: {
                ...DEFAULT_SETTINGS.policyRules,
                ...(parsed.policyRules || {}),
                enabled: {
                    ...DEFAULT_SETTINGS.policyRules.enabled,
                    ...((parsed.policyRules?.enabled) || {}),
                },
            },
            autoApproveThreshold: parsed.autoApproveThreshold ?? DEFAULT_SETTINGS.autoApproveThreshold,
            mileageRatePerKm:     parsed.mileageRatePerKm     ?? DEFAULT_SETTINGS.mileageRatePerKm,
            aiFeaturesEnabled: {
                ...DEFAULT_SETTINGS.aiFeaturesEnabled,
                ...((parsed.aiFeaturesEnabled) || {}),
            },
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function saveExpenseSettings(settings: ExpenseSettings): void {
    localStorage.setItem(EXPENSE_SETTINGS_KEY, JSON.stringify(settings));
}

// Re-implementation of checkExpensePolicy that uses the live settings
// rather than the hardcoded constants.  Exported under a new name —
// the old `checkExpensePolicy` stays for back-compat, but callers
// gradually migrate to this one.
export function checkExpensePolicyWithSettings(candidate: {
    category: string;
    amount: number;
    date: string;
    hasReceipt: boolean;
}): PolicyFlag[] {
    const s = getExpenseSettings().policyRules;
    const flags: PolicyFlag[] = [];
    const cat = (candidate.category || '').toLowerCase();
    const amount = Number(candidate.amount) || 0;

    if (s.enabled.meal && cat.includes('meal') && amount > s.mealMaxAmount) {
        flags.push({ rule: 'meal_max_amount', severity: 'warning',
            message: 'Exceeds the $' + s.mealMaxAmount + ' meal limit.' });
    }
    if (s.enabled.receipt && !candidate.hasReceipt && amount > s.receiptRequiredThreshold) {
        flags.push({ rule: 'receipt_required', severity: 'warning',
            message: 'Receipts are required for amounts over $' + s.receiptRequiredThreshold + '.' });
    }
    if (s.enabled.late && candidate.date) {
        const expenseDateMs = new Date(candidate.date).getTime();
        if (Number.isFinite(expenseDateMs)) {
            const ageDays = (Date.now() - expenseDateMs) / (24 * 60 * 60 * 1000);
            if (ageDays > s.lateSubmissionDays) {
                flags.push({ rule: 'late_submission', severity: 'warning',
                    message: 'Late submission — expense is ' + Math.floor(ageDays) + ' days old (over ' + s.lateSubmissionDays + '-day window).' });
            }
        }
    }
    if (s.enabled.round && amount > s.roundNumberThreshold
        && Number.isInteger(amount) && amount % 100 === 0) {
        flags.push({ rule: 'round_number_high', severity: 'warning',
            message: 'Round amount over $' + s.roundNumberThreshold + ' — may require extra documentation.' });
    }
    return flags;
}


// ─── STEP 11A — Accounting integration ──────────────────────────────
// Push an Approved Expense to the Accounting module as a balanced
// Journal Voucher.  Debit = the expense category's GL account,
// Credit = Accounts Payable (id 2110).  Posts to the live JV backend
// at /api/journal-vouchers/ — same contract JournalVoucher.tsx uses.
//
// Manual button on the Approval Queue (Option A from the design
// discussion) — surfaces failures immediately rather than auto-firing
// silently.  Records the resulting journal_voucher_number back on the
// Expense for traceability.

// Map our expense-category names to ChartOfAccounts account ids.  We
// list the most common categories; anything not in this map falls
// back to "Operating Expenses" (id 5200), the parent of most line
// items.  Adding new mappings is data-only — no logic change.
const CATEGORY_TO_ACCOUNT_ID: Record<string, string> = {
    // Operating Expenses (5200 family)
    'Rent & Utilities':        '5220',
    'Electricity':             '5220',
    'Water':                   '5220',
    'Internet & Phone':        '5220',
    'Office Supplies':         '5200',
    'Maintenance & Repairs':   '5200',
    // Employee Expenses
    'Salaries & Wages':        '5210',
    'Benefits & Insurance':    '5210',
    'Travel & Accommodation':  '5200',
    'Meals & Entertainment':   '5200',
    'Training & Development':  '5210',
    'Fuel & Transportation':   '5230',
    'Vehicle Expenses':        '5230',
    // Marketing
    'Advertising':             '5240',
    'Social Media Marketing':  '5240',
    'Promotional Materials':   '5240',
    'Events & Exhibitions':    '5240',
    'Commission & Incentives': '5240',
    // Administrative
    'Legal & Professional Fees': '5200',
    'Accounting Services':     '5200',
    'Bank Charges':            '5260',
    'Software Subscriptions':  '5200',
    'Licenses & Permits':      '5200',
    // Other defaults
    'Other Expenses':          '5200',
    'Petty Cash':              '5200',
};

interface JVLinePayload {
    id: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
}

interface JVPayload {
    id: string;
    jvNumber: string;
    date: string;
    reference: string;
    narration: string;
    lines: JVLinePayload[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
    createdAt: string;
    status: 'Draft' | 'Posted';
    type: 'General' | 'Bad Debt' | 'Depreciation' | 'Opening Balance' | 'Adjustment';
}

export async function pushExpenseToAccounting(expense: Expense): Promise<{ jvNumber: string; jvId: string }> {
    if (expense.status !== 'Approved') {
        throw new Error('Only Approved expenses can be pushed to Accounting.');
    }
    // FIX W7-1 — Idempotency guard. Without this, two clicks of the
    // "Push to Accounting" button create two distinct JVs against one
    // expense, double-counting it on the books. The expense's
    // journal_voucher_number is stamped at the end of this function;
    // if it's already set, the push has already happened.
    if (expense.journal_voucher_number) {
        throw new Error(
            `This expense has already been pushed to Accounting as JV ${expense.journal_voucher_number}. ` +
            `To re-post, void the existing JV first.`
        );
    }
    if (expense.amount <= 0) {
        throw new Error('Expense amount must be greater than zero.');
    }

    // Resolve debit account from category (with fallback).
    const debitAccountId = CATEGORY_TO_ACCOUNT_ID[expense.category] || '5200';
    const creditAccountId = '2110';  // Accounts Payable

    // Load chart of accounts to fetch account names/codes for the JV
    // line shape.  Read directly from localStorage (matches what
    // ChartOfAccounts.getAccounts uses), no React state required.
    const coaRaw = localStorage.getItem('chart_of_accounts');
    let accounts: Array<{ id: string; code: string; name: string }> = [];
    try {
        accounts = coaRaw ? JSON.parse(coaRaw) : [];
    } catch { /* fall through */ }
    const findAcc = (id: string) =>
        accounts.find(a => a.id === id) ||
        { id, code: id, name: id === '2110' ? 'Accounts Payable' : 'Operating Expenses' };

    const debit  = findAcc(debitAccountId);
    const credit = findAcc(creditAccountId);

    const ts = Date.now();
    const jv: JVPayload = {
        id:       'JV-EXP-' + ts,
        jvNumber: '',  // backend assigns
        date:     expense.date,
        reference: 'EXP/' + expense.id,
        narration: `Expense ${expense.id} — ${expense.vendor || 'Vendor'} · ${expense.category}`,
        type:     'General',
        status:   'Posted',
        createdAt: new Date().toISOString(),
        totalDebit:  expense.amount,
        totalCredit: expense.amount,
        isBalanced:  true,
        lines: [
            {
                id: 'L-' + ts + '-D',
                accountId: debit.id, accountCode: debit.code, accountName: debit.name,
                description: 'Expense — ' + (expense.description || expense.vendor || expense.category),
                debit:  expense.amount,
                credit: 0,
            },
            {
                id: 'L-' + ts + '-C',
                accountId: credit.id, accountCode: credit.code, accountName: credit.name,
                description: 'Liability for expense ' + expense.id,
                debit:  0,
                credit: expense.amount,
            },
        ],
    };

    const res = await authFetch(`${getOilErpApiBase()}/journal-vouchers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jv),
    });
    if (!res.ok) {
        let detail = '';
        try { detail = ((await res.json()) as { detail?: string })?.detail || ''; } catch { /* not JSON */ }
        throw new Error(detail || ('Could not post JV (HTTP ' + res.status + ').'));
    }
    const created = await res.json() as { jvNumber?: string; id?: string };
    const jvNumber = String(created?.jvNumber || jv.id);
    const jvId     = String(created?.id || jv.id);

    // Stamp the JV number back on the Expense for traceability.
    await saveExpense({ id: expense.id, journal_voucher_number: jvNumber });

    return { jvNumber, jvId };
}
