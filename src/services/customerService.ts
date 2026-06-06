import { getOilErpApiBase } from '../config/apiBase';

// CUSTOMER SERVICE
// Centralized customer management with mock data support
// ============================================

const USE_MOCK = false; // Enable mock mode by default

function apiUrl(path: string): string {
    const base = getOilErpApiBase().replace(/\/$/, '');
    const p = path.replace(/^\//, '');
    return `${base}/${p}`;
}

/** FastAPI uses numeric `id` and optional strings; UI expects string id + safe name. */
function normalizeCustomerFromApi(raw: Record<string, unknown>): Customer {
    const bal = raw.balance;
    const balanceNum =
        typeof bal === 'number' && !Number.isNaN(bal)
            ? bal
            : parseFloat(String(bal ?? '0')) || 0;
    return {
        ...(raw as unknown as Customer),
        id: String(raw.id ?? ''),
        name: raw.name != null ? String(raw.name) : '',
        balance: balanceNum,
    };
}

function parseCustomersJson(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    if (payload && typeof payload === 'object') {
        const o = payload as Record<string, unknown>;
        const inner = o.items ?? o.data ?? o.results ?? o.customers;
        if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    }
    return [];
}

// ============================================
// INTERFACES
// ============================================

export interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    balance?: number;
    credit_limit?: number;
    category?: string;
    opening_balance?: number;
    gps_location?: string;
    notes?: string;
    created_at?: string;
    code?: string;
    // Additional fields
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    tax_id?: string;
    payment_terms?: string;
    status?: 'Active' | 'Inactive' | 'Suspended';
}

export interface LedgerEntry {
    id: string;
    customer_id: string;
    date: string;
    type:
        | 'invoice'
        | 'payment'
        | 'credit'
        | 'debit'
        | 'opening_balance'
        | 'van_sale'
        | 'transaction'
        | 'credit_note'
        | 'return_credit'
        | 'credit_adjustment';
    amount: number;
    balance: number;
    description?: string;
    reference?: string;
    invoice_number?: string;
    payment_method?: string;
    van_number?: string;        // Van number for van sales
    salesman_name?: string;     // Salesman/driver name for van sales
    /** Present when row comes from API `debit`/`credit` shape */
    debit?: number;
    credit?: number;
    mode?: string;
    /** Populated for synthetic invoice rows from GET .../ledger */
    invoice_id?: string;
}

export interface Payment {
    id: string;
    customer_id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference?: string;
    notes?: string;
    created_at?: string;
}

export interface CustomerStats {
    total_customers: number;
    active_customers: number;
    total_receivables: number;
    overdue_amount: number;
    total_sales: number;
    average_order_value: number;
}

// ============================================
// MOCK DATA HELPERS
// ============================================

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getStorage = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

const setStorage = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// Initialize with sample data if empty
const initializeMockData = () => {
    const customers = getStorage<Customer>('customers');
    if (customers.length === 0) {
        const sampleCustomers: Customer[] = [
            {
                id: crypto.randomUUID(),
                name: 'Al-Khaleej Trading Co.',
                email: 'info@alkhaleej.com',
                phone: '+971-4-1234567',
                address: 'Sheikh Zayed Road, Dubai',
                city: 'Dubai',
                country: 'UAE',
                category: 'Wholesale',
                balance: -15000,
                credit_limit: 50000,
                status: 'Active',
                created_at: new Date('2024-01-15').toISOString()
            },
            {
                id: crypto.randomUUID(),
                name: 'Pakistan Motors Ltd.',
                email: 'sales@pakmotors.pk',
                phone: '+92-21-35678901',
                address: 'I.I. Chundrigar Road, Karachi',
                city: 'Karachi',
                country: 'Pakistan',
                category: 'Retail',
                balance: -8500,
                credit_limit: 25000,
                status: 'Active',
                created_at: new Date('2024-02-20').toISOString()
            },
            {
                id: crypto.randomUUID(),
                name: 'Gulf Petroleum Services',
                email: 'contact@gulfpetro.com',
                phone: '+966-11-4567890',
                address: 'King Fahd Road, Riyadh',
                city: 'Riyadh',
                country: 'Saudi Arabia',
                category: 'Wholesale',
                balance: 0,
                credit_limit: 100000,
                status: 'Active',
                created_at: new Date('2024-03-10').toISOString()
            }
        ];
        setStorage('customers', sampleCustomers);
    }
};

// ============================================
// CUSTOMER CRUD OPERATIONS
// ============================================

/** Direct FastAPI URL when Vite proxy returns HTML/404 (backend running but /api not proxied). */
function directCustomersUrl(): string {
    return 'http://127.0.0.1:8000/api/customers/';
}

function formatCustomersHttpError(status: number, text: string): string {
    const t = text.trim();
    if (t.startsWith('{')) {
        try {
            const j = JSON.parse(t) as { detail?: unknown };
            if (typeof j.detail === 'string') return j.detail;
            if (Array.isArray(j.detail))
                return j.detail
                    .map((x: { msg?: string }) => x.msg || JSON.stringify(x))
                    .join('; ');
        } catch {
            /* ignore */
        }
    }
    if (t && !t.startsWith('<')) return t.slice(0, 400);
    return `Failed to fetch customers (HTTP ${status}). Run FastAPI from oil-erp-backend: uvicorn app.main:app --reload --port 8000`;
}

async function fetchCustomersRows(primaryUrl: string): Promise<Customer[]> {
    const response = await fetch(primaryUrl, { cache: 'no-store' });
    const text = await response.text().catch(() => '');
    const ct = (response.headers.get('content-type') || '').toLowerCase();

    if (!response.ok) {
        throw new Error(formatCustomersHttpError(response.status, text));
    }

    // SPA fallback / proxy miss often returns index.html — old code treated that as "no rows".
    if (!ct.includes('json')) {
        const sniff = text.trim().slice(0, 80).toLowerCase();
        if (sniff.startsWith('<!') || sniff.includes('<html')) {
            throw new Error(
                'Cannot connect to server. Please check your connection.'
            );
        }
        throw new Error(`Customers API returned ${ct || 'unknown type'}, expected JSON.`);
    }

    let payload: unknown;
    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        throw new Error('Customers API returned invalid JSON.');
    }

    const rows = parseCustomersJson(payload);
    return rows.map(normalizeCustomerFromApi);
}

export async function getCustomers(): Promise<Customer[]> {
    if (USE_MOCK) {
        await delay(400);
        initializeMockData();
        return getStorage<Customer>('customers');
    }

    const primary = apiUrl('customers/');

    try {
        return await fetchCustomersRows(primary);
    } catch (firstErr) {
        // Dev fallback: same-origin /api failed but backend may still be up on :8000 (CORS allows *).
        if (import.meta.env.DEV) {
            try {
                const rows = await fetchCustomersRows(directCustomersUrl());
                if (rows.length > 0) {
                    console.warn(
                        '[customers] Loaded via direct http://127.0.0.1:8000 — fix Vite proxy or API base so /api works from this origin.'
                    );
                    return rows;
                }
            } catch {
                /* fall through */
            }
        }
        throw firstErr;
    }
}

// CLEANUP-2 — Removed customerBalancesFromNotes. The BETTANO 'Owes:'
// notes format is written by DataMigration.tsx during one-shot CSV
// import but the live runtime never reads it — backend's customer.balance
// is the trusted source (per CustomerList.tsx:33-36 and the PHASE-3
// consistency check). Function had no callers in the codebase.

export async function getCustomer(id: string): Promise<Customer> {
    if (USE_MOCK) {
        await delay(300);
        const customers = getStorage<Customer>('customers');
        const customer = customers.find(c => c.id === id);
        if (!customer) throw new Error('Customer not found');
        return customer;
    }

    const response = await fetch(apiUrl(`customers/${id}`));
    if (!response.ok) throw new Error('Failed to fetch customer');
    const row = (await response.json()) as Record<string, unknown>;
    return normalizeCustomerFromApi(row);
}

export async function createCustomer(data: Partial<Customer>): Promise<Customer> {
    if (USE_MOCK) {
        await delay(500);
        const customers = getStorage<Customer>('customers');
        const newCustomer: Customer = {
            id: crypto.randomUUID(),
            name: data.name || '',
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            state: data.state,
            country: data.country,
            postal_code: data.postal_code,
            category: data.category || 'Retail',
            balance: data.opening_balance || 0,
            credit_limit: data.credit_limit || 0,
            opening_balance: data.opening_balance,
            gps_location: data.gps_location,
            notes: data.notes,
            tax_id: data.tax_id,
            payment_terms: data.payment_terms || 'Net 30',
            status: data.status || 'Active',
            created_at: new Date().toISOString(),
            code: data.code
        };
        setStorage('customers', [newCustomer, ...customers]);

        // Create opening balance ledger entry if applicable
        if (data.opening_balance && data.opening_balance !== 0) {
            const ledger = getStorage<LedgerEntry>('customer_ledger');
            const openingEntry: LedgerEntry = {
                id: crypto.randomUUID(),
                customer_id: newCustomer.id,
                date: new Date().toISOString(),
                type: 'opening_balance',
                amount: data.opening_balance,
                balance: data.opening_balance,
                description: 'Opening Balance',
                reference: 'OPENING'
            };
            setStorage('customer_ledger', [openingEntry, ...ledger]);
        }

        return newCustomer;
    }

    // Trailing slash required: POST /api/customers 307-redirects; Chrome fetch often surfaces that as "Failed to fetch".
    const body = {
        name: data.name ?? '',
        email: data.email?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        address: data.address?.trim() || undefined,
        category: (data.category ?? 'retail').toLowerCase(),
        credit_limit: data.credit_limit ?? 0,
        opening_balance: data.opening_balance ?? 0,
        gps_location: data.gps_location?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
    };
    const response = await fetch(apiUrl('customers/'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
    });
    if (!response.ok) {
        const text = await response.text();
        let detail = `HTTP ${response.status}`;
        try {
            const err = JSON.parse(text) as { detail?: unknown };
            if (typeof err?.detail === 'string') detail = err.detail;
            else if (Array.isArray(err?.detail))
                detail = err.detail.map((x: { msg?: string }) => x.msg || JSON.stringify(x)).join('; ');
        } catch {
            if (text) detail = text.slice(0, 300);
        }
        throw new Error(detail);
    }
    const row = (await response.json()) as Record<string, unknown>;
    return normalizeCustomerFromApi(row);
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    if (USE_MOCK) {
        await delay(500);
        const customers = getStorage<Customer>('customers');
        const updatedCustomers = customers.map(c =>
            c.id === id ? { ...c, ...data } : c
        );
        setStorage('customers', updatedCustomers);
        const updated = updatedCustomers.find(c => c.id === id);
        if (!updated) throw new Error('Customer not found');
        return updated;
    }

    const { status, ...rest } = data;
    const body: Record<string, unknown> = { ...rest };
    if (status !== undefined) {
        body.is_active = status === 'Active';
    }

    const response = await fetch(apiUrl(`customers/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Failed to update customer');
    const row = (await response.json()) as Record<string, unknown>;
    return normalizeCustomerFromApi(row);
}

export async function deleteCustomer(id: string): Promise<void> {
    if (USE_MOCK) {
        await delay(400);
        const customers = getStorage<Customer>('customers');
        const filtered = customers.filter(c => c.id !== id);
        setStorage('customers', filtered);
        return;
    }

    const response = await fetch(apiUrl(`customers/${id}`), {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete customer');
}

// ============================================
// LEDGER OPERATIONS
// ============================================

function ledgerEntryTime(date: string | undefined): number {
    const t = new Date(date ?? 0).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/** Oldest first — for running-balance accumulation. Tie-break: id ascending. */
export function compareLedgerByDateAsc(
    a: { date?: string; id?: string | number },
    b: { date?: string; id?: string | number },
): number {
    const byDate = ledgerEntryTime(a.date) - ledgerEntryTime(b.date);
    if (byDate !== 0) return byDate;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''), undefined, { numeric: true });
}

/** Newest first — for display. Tie-break: id descending. */
export function compareLedgerByDateDesc(
    a: { date?: string; id?: string | number },
    b: { date?: string; id?: string | number },
): number {
    const byDate = ledgerEntryTime(b.date) - ledgerEntryTime(a.date);
    if (byDate !== 0) return byDate;
    return String(b.id ?? '').localeCompare(String(a.id ?? ''), undefined, { numeric: true });
}

export async function getCustomerLedger(customerId: string): Promise<LedgerEntry[]> {
    if (USE_MOCK) {
        await delay(400);
        const ledger = getStorage<LedgerEntry>('customer_ledger');
        return ledger
            .filter(entry => entry.customer_id === customerId)
            .sort(compareLedgerByDateDesc);
    }
    const response = await fetch(
        apiUrl(`customers/${customerId}/ledger`)
    );
    if (!response.ok)
        throw new Error('Failed to fetch customer ledger');

    const raw = await response.json();
    const chronological = [...raw].sort((a: { date?: string; id?: string | number }, b: { date?: string; id?: string | number }) =>
        compareLedgerByDateAsc(
            { date: a.date, id: a.id },
            { date: b.date, id: b.id },
        ),
    );

    let runningBalance = 0;
    const entries: LedgerEntry[] = chronological.map((entry: any) => {
        const debit = Number(entry.debit) || 0;
        const credit = Number(entry.credit) || 0;
        const isCreditType =
            entry.type === 'payment' ||
            entry.type === 'credit' ||
            entry.type === 'credit_note' ||
            entry.type === 'return_credit' ||
            entry.type === 'credit_adjustment';
        runningBalance = runningBalance + debit - credit;
        return {
            id: String(entry.id),
            customer_id: String(customerId),
            date: entry.date,
            description: entry.description || '',
            type: entry.type || 'transaction',
            amount: isCreditType ? credit : debit,
            debit: debit,
            credit: credit,
            balance: runningBalance,
            reference: entry.reference || '',
            invoice_number: entry.reference || '',
            van_number: entry.van_number || '',
            salesman_name: entry.salesman_name || '',
            mode: entry.mode || '',
            invoice_id:
                entry.invoice_id != null && entry.invoice_id !== ''
                    ? String(entry.invoice_id)
                    : undefined,
        };
    });

    return [...entries].sort(compareLedgerByDateDesc);
}

export async function addLedgerEntry(entry: Omit<LedgerEntry, 'id'>): Promise<LedgerEntry> {
    if (USE_MOCK) {
        await delay(400);
        const ledger = getStorage<LedgerEntry>('customer_ledger');

        // Calculate new balance
        const customerLedger = ledger.filter(e => e.customer_id === entry.customer_id);
        const lastBalance = customerLedger.length > 0
            ? customerLedger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].balance
            : 0;

        const newBalance = entry.type === 'payment' || entry.type === 'credit'
            ? lastBalance - entry.amount
            : lastBalance + entry.amount;

        const newEntry: LedgerEntry = {
            ...entry,
            id: crypto.randomUUID(),
            balance: newBalance
        };

        setStorage('customer_ledger', [newEntry, ...ledger]);

        // Update customer balance
        const customers = getStorage<Customer>('customers');
        const updatedCustomers = customers.map(c =>
            c.id === entry.customer_id ? { ...c, balance: newBalance } : c
        );
        setStorage('customers', updatedCustomers);

        return newEntry;
    }

    const response = await fetch(apiUrl(`customers/${entry.customer_id}/ledger`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
    });
    if (!response.ok) throw new Error('Failed to add ledger entry');
    return response.json();
}

// ============================================
// PAYMENT OPERATIONS
// ============================================

export async function getCustomerPayments(customerId: string): Promise<Payment[]> {
    if (USE_MOCK) {
        await delay(400);
        const payments = getStorage<Payment>('payments');
        return payments
            .filter(p => p.customer_id === customerId)
            .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
    }

    const response = await fetch(apiUrl(`customers/${customerId}/payments`));
    if (!response.ok) throw new Error('Failed to fetch customer payments');
    const raw = await response.json();
    // The backend returns numeric ids; the Payment type (and downstream code that
    // does `.slice(-4)` on the id) expects strings. Normalize here so every caller
    // sees a stable string id. Without this the customer profile loadAllData
    // throws TypeError mid-flight and stats stay at the initial zeros.
    return (Array.isArray(raw) ? raw : []).map((p: any) => ({
        ...p,
        id: String(p?.id ?? ''),
        customer_id: String(p?.customer_id ?? ''),
    }));
}

export async function createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    if (USE_MOCK) {
        await delay(500);
        const payments = getStorage<Payment>('payments');
        const newPayment: Payment = {
            ...payment,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
        };
        setStorage('payments', [newPayment, ...payments]);

        // Add ledger entry
        await addLedgerEntry({
            customer_id: payment.customer_id,
            date: payment.payment_date,
            type: 'payment',
            amount: payment.amount,
            balance: 0, // Will be calculated
            description: `Payment received - ${payment.payment_method}`,
            reference: payment.reference,
            payment_method: payment.payment_method
        });

        return newPayment;
    }

    const response = await fetch(apiUrl(`customers/${payment.customer_id}/payments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment)
    });
    if (!response.ok) throw new Error('Failed to create payment');
    return response.json();
}

// ============================================
// ANALYTICS & REPORTS
// ============================================

export async function getOverdueCustomers(): Promise<Customer[]> {
    if (USE_MOCK) {
        await delay(400);
        const customers = getStorage<Customer>('customers');
        return customers.filter(c => (c.balance || 0) < 0);
    }

    const response = await fetch(apiUrl('customers/overdue'));
    if (!response.ok) throw new Error('Failed to fetch overdue customers');
    const payload = await response.json().catch(() => null);
    return parseCustomersJson(payload).map(normalizeCustomerFromApi);
}

export async function getCustomerStats(): Promise<CustomerStats> {
    if (USE_MOCK) {
        await delay(400);
        const customers = getStorage<Customer>('customers');

        const total_customers = customers.length;
        const active_customers = customers.filter(c => c.status === 'Active').length;
        const total_receivables = customers.reduce((sum, c) => sum + Math.abs(Math.min(c.balance || 0, 0)), 0);
        const overdue_amount = customers.filter(c => (c.balance || 0) < 0).reduce((sum, c) => sum + Math.abs(c.balance || 0), 0);

        return {
            total_customers,
            active_customers,
            total_receivables,
            overdue_amount,
            total_sales: total_receivables * 1.5, // Mock calculation
            average_order_value: total_receivables / Math.max(total_customers, 1)
        };
    }

    const response = await fetch(apiUrl('customers/stats'));
    if (!response.ok) throw new Error('Failed to fetch customer stats');
    return response.json();
}

export async function searchCustomers(query: string): Promise<Customer[]> {
    if (USE_MOCK) {
        await delay(300);
        const customers = getStorage<Customer>('customers');
        const lowerQuery = query.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.email?.toLowerCase().includes(lowerQuery) ||
            c.phone?.includes(query) ||
            c.address?.toLowerCase().includes(lowerQuery) ||
            c.code?.toLowerCase().includes(lowerQuery)
        );
    }

    const response = await fetch(`${apiUrl('customers/search')}?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search customers');
    const payload = await response.json().catch(() => null);
    return parseCustomersJson(payload).map(normalizeCustomerFromApi);
}

/**
 * Route-Navigator → Customers sync is disabled.
 * The backend endpoint creates duplicate zero-balance customers (it doesn't dedupe by name),
 * which clobbered the real BETTANO data. Returns an empty result so callers no-op gracefully.
 */
export async function syncRoutePriorityToCustomers(): Promise<
    import('./routeService').SyncRoutePriorityResult
> {
    return { created: 0, skipped_existing: 0, total_priority_stops: 0 };
}

// ============================================
// EXPORTS
// ============================================

export default {
    // CRUD
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,

    // Ledger
    getCustomerLedger,
    addLedgerEntry,

    // Payments
    getCustomerPayments,
    createPayment,

    // Analytics
    getOverdueCustomers,
    getCustomerStats,
    searchCustomers,

    syncRoutePriorityToCustomers,
};
