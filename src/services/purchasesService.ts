export interface PurchaseOrderItem {
    productId: string;
    productName: string;
    uom: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discount: number;
    total: number;
}

export type POStatus = 'Pending' | 'Approved' | 'GRN' | 'Paid' | 'Received' | 'Completed' | 'Draft' | 'Rejected';

export interface PurchaseOrder {
    id: string;
    poNumber: string;
    supplierId: string;
    supplierName: string;
    date: string;
    expectedDate: string;
    status: POStatus;
    approved_date?: string;
    grn_date?: string;
    paid_date?: string;
    items: PurchaseOrderItem[];
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
    notes?: string;
    payment_status?: 'Paid' | 'Unpaid' | 'Advance Paid';
    payment_method?: string;
    amount_paid?: number;
    remaining_balance?: number;
    salesman?: string;
    van?: string;
}

export interface Supplier {
    id: string;
    name: string;
    code: string;
    contactPerson: string;
    email: string;
    phone: string;
    address?: string;
    taxId: string;
    status: 'Active' | 'Blocked';
    paymentTerms: string;
    currency: string;
    rating?: 'A' | 'B' | 'C';
    creditLimit?: number;
    notes?: string;
    openingBalance?: number;
}

export interface SupplierPayment {
    id: string;
    supplierId: string;
    amount: number;
    date: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
}

export interface SupplierLedgerEntry {
    id: string;
    date: string;
    type: 'Purchase' | 'Payment' | 'Return' | 'Adjustment';
    referenceNumber: string;
    description: string;
    debit: number; // For payments/returns? Actually normally Debit is increase in asset or decrease in liability.
    // For Supplier Ledger (Accounts Payable):
    // Credit = Increase in Liability (Purchase)
    // Debit = Decrease in Liability (Payment)
    credit: number;
    balance: number;
    relatedId?: string;
}

// Helpers
const getStorage = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

// setStorage was removed alongside the localStorage write paths. All writes
// now go to the backend. getStorage stays for read-only offline fallbacks.

// NOTE: The old INITIAL_SUPPLIERS seed (Global Foods Ltd / Valley Farms) was
// removed when suppliers moved to the backend. Those rows were leaking into
// the live list whenever a stale bundle ran. Backend is now the single source
// of truth.

// ─────────────────────────────────────────────────────────────────────────────
// Supplier persistence: backend-first with a one-time localStorage migration.
//
// Suppliers used to live in browser localStorage only — invisible from other
// devices, no shared source of truth, vulnerable to id collisions (two
// suppliers ending up with the same id, sending you to the wrong detail page).
// They now persist via the FastAPI `/api/suppliers` endpoints. On first load,
// if the backend returns an empty list AND there are leftover localStorage
// suppliers, we POST each one up so legacy data isn't lost. After that,
// localStorage acts only as an offline fallback when the API is unreachable.
// ─────────────────────────────────────────────────────────────────────────────

const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
const SUPPLIERS_API = `${API_HOST}/api/suppliers`;
const MIGRATION_FLAG = 'suppliers_migrated_to_api';

// Backend → frontend translation (snake_case + integer id → camelCase + string id).
const fromApi = (r: any): Supplier => ({
    id: String(r.id),
    name: r.name || '',
    code: r.code || '',
    contactPerson: r.contact_person || '',
    email: r.email || '',
    phone: r.phone || '',
    address: r.address || '',
    taxId: r.tax_id || '',
    status: (r.status === 'Blocked' ? 'Blocked' : 'Active'),
    paymentTerms: r.payment_terms || 'Net 30',
    currency: r.currency || 'USD',
    rating: r.rating || undefined,
    creditLimit: typeof r.credit_limit === 'number' ? r.credit_limit : 0,
    openingBalance: typeof r.opening_balance === 'number' ? r.opening_balance : 0,
    notes: r.notes || '',
});

// Frontend → backend translation. Omits id; backend assigns it.
const toApi = (s: Partial<Supplier>): Record<string, any> => ({
    name: s.name,
    code: s.code,
    contact_person: s.contactPerson,
    email: s.email,
    phone: s.phone,
    address: s.address,
    tax_id: s.taxId,
    status: s.status || 'Active',
    payment_terms: s.paymentTerms || 'Net 30',
    currency: s.currency || 'USD',
    rating: s.rating,
    credit_limit: s.creditLimit ?? 0,
    opening_balance: s.openingBalance ?? 0,
    notes: s.notes,
});

const migrateLocalStorageOnce = async (): Promise<void> => {
    if (localStorage.getItem(MIGRATION_FLAG) === '1') return;
    const local = getStorage<Supplier>('suppliers');
    // Don't migrate the seed-data placeholders.
    const meaningful = local.filter(s => s.id !== 'SUP-001' && s.id !== 'SUP-002');
    if (meaningful.length === 0) {
        localStorage.setItem(MIGRATION_FLAG, '1');
        return;
    }
    try {
        for (const s of meaningful) {
            await fetch(`${SUPPLIERS_API}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toApi(s)),
            });
        }
        localStorage.setItem(MIGRATION_FLAG, '1');
    } catch {
        // Network blip — try again next call. Don't crash the page.
    }
};

export const getSuppliers = async (): Promise<Supplier[]> => {
    try {
        const res = await fetch(`${SUPPLIERS_API}/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length === 0) {
            await migrateLocalStorageOnce();
            // Re-fetch in case migration uploaded rows.
            const res2 = await fetch(`${SUPPLIERS_API}/`);
            if (res2.ok) {
                const after = await res2.json();
                return Array.isArray(after) ? after.map(fromApi) : [];
            }
        }
        return Array.isArray(rows) ? rows.map(fromApi) : [];
    } catch {
        // Offline / API unreachable — fall back to localStorage so the user
        // can keep working until the network returns.
        return getStorage<Supplier>('suppliers');
    }
};

export const getSupplierById = async (id: string): Promise<Supplier | null> => {
    try {
        const res = await fetch(`${SUPPLIERS_API}/${encodeURIComponent(id)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return fromApi(await res.json());
    } catch {
        const all = await getSuppliers();
        return all.find(s => s.id === id) || null;
    }
};

export const createSupplier = async (supplier: Partial<Supplier>): Promise<Supplier> => {
    const res = await fetch(`${SUPPLIERS_API}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toApi(supplier)),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to create supplier: ${res.status} ${text}`);
    }
    return fromApi(await res.json());
};

export const updateSupplier = async (id: string, data: Partial<Supplier>): Promise<Supplier> => {
    const res = await fetch(`${SUPPLIERS_API}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toApi(data)),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to update supplier: ${res.status} ${text}`);
    }
    return fromApi(await res.json());
};

export const deleteSupplier = async (id: string): Promise<void> => {
    const res = await fetch(`${SUPPLIERS_API}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to delete supplier: ${res.status} ${text}`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Purchase orders + supplier payments: backend persistence.
//
// Both used to live in localStorage. They now persist on the server via
// /api/suppliers/{id}/purchases and /api/suppliers/{id}/payments so the
// Supplier Detail "profile" page sees the same data from every device, and
// Aged Payable can compute the correct balance.
//
// All API POSTs are idempotent (PO by poNumber, payment by reference) so
// re-running the BETTANO migration doesn't duplicate rows.
// Network-fail fallback returns whatever's in localStorage so the UI keeps
// working when the API is unreachable.
// ─────────────────────────────────────────────────────────────────────────────

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    // Fetch POs across all suppliers. Used by Aged Payable to compute totals.
    try {
        const sRes = await fetch(`${SUPPLIERS_API}/`);
        if (!sRes.ok) throw new Error(`HTTP ${sRes.status}`);
        const sList = await sRes.json();
        if (!Array.isArray(sList)) return [];
        const all: PurchaseOrder[] = [];
        await Promise.all(
            sList.map(async (s: any) => {
                try {
                    const r = await fetch(`${SUPPLIERS_API}/${s.id}/purchases`);
                    if (!r.ok) return;
                    const rows = await r.json();
                    if (Array.isArray(rows)) all.push(...rows);
                } catch { /* ignore one supplier */ }
            }),
        );
        return all;
    } catch {
        return getStorage<PurchaseOrder>('purchase_orders');
    }
};

export const getSupplierPurchases = async (supplierId: string): Promise<PurchaseOrder[]> => {
    try {
        const r = await fetch(`${SUPPLIERS_API}/${encodeURIComponent(supplierId)}/purchases`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch {
        const all = getStorage<PurchaseOrder>('purchase_orders');
        return all.filter(po => po.supplierId === supplierId);
    }
};

export const createPurchaseOrder = async (po: Omit<PurchaseOrder, 'id'>): Promise<PurchaseOrder> => {
    const supplierId = String(po.supplierId || '');
    if (!supplierId) throw new Error('createPurchaseOrder: supplierId is required');
    const r = await fetch(`${SUPPLIERS_API}/${encodeURIComponent(supplierId)}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            poNumber: po.poNumber,
            date: po.date,
            expectedDate: po.expectedDate,
            status: po.status,
            payment_status: po.payment_status,
            payment_method: po.payment_method,
            subtotal: po.subtotal,
            taxTotal: po.taxTotal,
            grandTotal: po.grandTotal,
            amount_paid: po.amount_paid,
            notes: po.notes,
            items: (po.items || []).map(it => ({
                productId: it.productId,
                productName: it.productName,
                uom: it.uom,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                taxRate: it.taxRate,
                discount: it.discount,
                total: it.total,
            })),
        }),
    });
    if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`Failed to create PO: ${r.status} ${text}`);
    }
    return await r.json();
};

export const updatePurchaseOrder = async (id: string, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
    // Calls the backend PATCH /api/purchase-orders/{id} so procurement-flow
    // transitions (approve, GRN, mark paid) actually persist instead of
    // silently writing to localStorage.
    const res = await fetch(`${API_HOST}/api/purchase-orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: data.status,
            payment_status: data.payment_status,
            payment_method: data.payment_method,
            amount_paid: data.amount_paid,
            remaining_balance: data.remaining_balance,
            notes: data.notes,
            // The backend ignores these but we forward them so the payload
            // matches the existing caller signatures without churn.
            approved_date: (data as any).approved_date,
            grn_date: (data as any).grn_date,
            paid_date: (data as any).paid_date,
        }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to update PO: ${res.status} ${text}`);
    }
    return await res.json();
};

// FIX W2-4 — Hard-delete a purchase order. Backend is expected to
// reject when the PO has linked GRN/payment activity; the call site
// already hard-gates the button to Draft status, but we still surface
// any backend rejection as a friendly error rather than swallowing it.
export const deletePurchaseOrder = async (id: string): Promise<void> => {
    const res = await fetch(`${API_HOST}/api/purchase-orders/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to delete PO: ${res.status} ${text}`);
    }
};

export const getSupplierPayments = async (supplierId: string): Promise<SupplierPayment[]> => {
    try {
        const r = await fetch(`${SUPPLIERS_API}/${encodeURIComponent(supplierId)}/payments`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch {
        const all = getStorage<SupplierPayment>('supplier_payments');
        return all.filter(p => p.supplierId === supplierId);
    }
};

export const createSupplierPayment = async (payment: Omit<SupplierPayment, 'id'>): Promise<SupplierPayment> => {
    const supplierId = String(payment.supplierId || '');
    if (!supplierId) throw new Error('createSupplierPayment: supplierId is required');
    const r = await fetch(`${SUPPLIERS_API}/${encodeURIComponent(supplierId)}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount: payment.amount,
            date: payment.date,
            paymentMethod: payment.paymentMethod,
            reference: payment.reference,
            notes: payment.notes,
        }),
    });
    if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`Failed to create supplier payment: ${r.status} ${text}`);
    }
    return await r.json();
};

export const getSupplierBalance = async (supplierId: string): Promise<number> => {
    // Backend computes it: opening + purchases − payments.
    try {
        const r = await fetch(`${SUPPLIERS_API}/${encodeURIComponent(supplierId)}/balance`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        return Number(j.balance) || 0;
    } catch {
        // Fallback to local math.
        const allPurchases = await getSupplierPurchases(supplierId);
        const allPayments = await getSupplierPayments(supplierId);
        const supplier = await getSupplierById(supplierId);
        const openingBalance = supplier?.openingBalance || 0;
        const totalPurchases = allPurchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
        const totalPayments = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        return openingBalance + totalPurchases - totalPayments;
    }
};

// ── Procurement Flow Actions ─────────────────────────────────────────────────
// (API_HOST is already declared at the top of the file for SUPPLIERS_API.)

export const approvePurchaseOrder = async (id: string): Promise<PurchaseOrder> => {
    return updatePurchaseOrder(id, {
        status: 'Approved',
        approved_date: new Date().toISOString()
    });
};

// Reject a pending PO. Keeps the row in the table for audit but locks it
// out of the procurement flow (no GRN, no payment, no resurrection).
export const rejectPurchaseOrder = async (id: string, reason?: string): Promise<PurchaseOrder> => {
    return updatePurchaseOrder(id, {
        status: 'Rejected',
        notes: reason ? `Rejected: ${reason}` : 'Rejected',
    });
};

// FIX W3-2 — Aggregate result so the UI can show a precise success /
// partial / failure banner instead of an unconditional "GRN Confirmed!".
// Shared by Path A (`confirmGRN`) and Path B (`postGRN` in grnService).
export interface GRNResult {
    po: PurchaseOrder;
    attempted: number;          // items with a productId we tried to update
    succeeded: number;          // items where add-stock returned 2xx
    failures: Array<{
        productId: string;
        productName?: string;
        reason: string;         // HTTP status + body, or thrown error message
    }>;
    skipped: Array<{
        productName?: string;
        reason: 'no-productId'; // free-text PO lines — FIX W3-3 will warn upfront
    }>;
}

export const confirmGRN = async (id: string): Promise<GRNResult> => {
    const orders = await getPurchaseOrders();
    const po = orders.find(o => o.id === id);
    if (!po) throw new Error('PO not found');

    // FIX W3-4 — Idempotency guard. Only Approved POs can transition to
    // GRN; without this a double-click race (or any programmatic re-call)
    // would double-count stock on the backend. The UI button is also
    // status-gated, but this is defense-in-depth.
    if (po.status !== 'Approved') {
        throw new Error(
            `Cannot confirm GRN — this PO is in status "${po.status}". ` +
            `Only Approved POs can be received. ` +
            `Refresh the page to see the current status.`
        );
    }

    // FIX W3-2 — Per-item attempt/success/failure tracking.
    let attempted = 0;
    let succeeded = 0;
    const failures: GRNResult['failures'] = [];
    const skipped: GRNResult['skipped'] = [];

    for (const item of po.items) {
        if (!item.productId) {
            skipped.push({ productName: item.productName, reason: 'no-productId' });
            continue;
        }
        attempted++;
        try {
            const res = await fetch(`${API_HOST}/products/${item.productId}/add-stock`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity: item.quantity,
                    reference: po.poNumber,
                }),
            });
            if (res.ok) {
                succeeded++;
            } else {
                const text = await res.text().catch(() => '');
                failures.push({
                    productId: String(item.productId),
                    productName: item.productName,
                    reason: `HTTP ${res.status} ${text}`.trim(),
                });
            }
        } catch (e) {
            failures.push({
                productId: String(item.productId),
                productName: item.productName,
                reason: e instanceof Error ? e.message : String(e),
            });
        }
    }

    // CLEANUP — removed dev console.log; W3-2 banner surfaces the same
    // counts (succeeded/attempted/failed/skipped) to the UI now.

    const updatedPO = await updatePurchaseOrder(id, {
        status: 'GRN',
        grn_date: new Date().toISOString(),
    } as any);

    return { po: updatedPO, attempted, succeeded, failures, skipped };
};

export const markPOPaid = async (id: string, paymentMethod: string): Promise<PurchaseOrder> => {
    const orders = await getPurchaseOrders();
    const po = orders.find(o => o.id === id);
    if (!po) throw new Error('PO not found');

    // Record supplier payment ledger entry
    await createSupplierPayment({
        supplierId: po.supplierId,
        amount: po.remaining_balance ?? po.grandTotal,
        date: new Date().toISOString().split('T')[0],
        paymentMethod,
        reference: po.poNumber,
        notes: `Payment for PO ${po.poNumber}`
    });

    return updatePurchaseOrder(id, {
        status: 'Paid',
        paid_date: new Date().toISOString(),
        payment_status: 'Paid',
        amount_paid: po.grandTotal,
        remaining_balance: 0
    });
};
