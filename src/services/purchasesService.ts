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

export type POStatus = 'Pending' | 'Approved' | 'GRN' | 'Paid' | 'Received' | 'Completed' | 'Draft';

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

const setStorage = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// Initial data if empty
const INITIAL_SUPPLIERS: Supplier[] = [
    { id: 'SUP-001', name: 'Global Foods Ltd', code: 'S-101', contactPerson: 'John Smith', email: 'john@globalfoods.com', phone: '+1 555-0101', taxId: 'TAX-8892', status: 'Active', paymentTerms: 'Net 30', currency: 'USD', rating: 'A', address: '123 Supply Ave, Industrial City' },
    { id: 'SUP-002', name: 'Valley Farms', code: 'S-102', contactPerson: 'Sarah Lee', email: 'sarah@valley.com', phone: '+1 555-0102', taxId: 'TAX-7721', status: 'Active', paymentTerms: 'Net 15', currency: 'USD', rating: 'B', address: '456 Farm Rd, Green Valley' },
];

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

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    return getStorage<PurchaseOrder>('purchase_orders');
};

export const getSupplierPurchases = async (supplierId: string): Promise<PurchaseOrder[]> => {
    const all = await getPurchaseOrders();
    return all.filter(po => po.supplierId === supplierId);
};

export const createPurchaseOrder = async (po: Omit<PurchaseOrder, 'id'>): Promise<PurchaseOrder> => {
    const orders = await getPurchaseOrders();
    const newPO = {
        ...po,
        id: `PO-${Date.now()}`
    } as PurchaseOrder;
    setStorage('purchase_orders', [newPO, ...orders]);
    return newPO;
};

export const updatePurchaseOrder = async (id: string, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
    const orders = await getPurchaseOrders();
    const updated = orders.map(o => o.id === id ? { ...o, ...data } : o);
    setStorage('purchase_orders', updated);
    return updated.find(o => o.id === id) as PurchaseOrder;
};

export const getSupplierPayments = async (supplierId: string): Promise<SupplierPayment[]> => {
    const all = getStorage<SupplierPayment>('supplier_payments');
    return all.filter(p => p.supplierId === supplierId);
};

export const createSupplierPayment = async (payment: Omit<SupplierPayment, 'id'>): Promise<SupplierPayment> => {
    const payments = getStorage<SupplierPayment>('supplier_payments');
    const newPayment = {
        ...payment,
        id: `SPAY-${Date.now()}`
    } as SupplierPayment;
    setStorage('supplier_payments', [newPayment, ...payments]);
    return newPayment;
};

export const getSupplierBalance = async (supplierId: string): Promise<number> => {
    const allPurchases = await getSupplierPurchases(supplierId);
    const allPayments = await getSupplierPayments(supplierId);

    const supplier = await getSupplierById(supplierId);
    const openingBalance = supplier?.openingBalance || 0;

    // Credit (Increases liability): Purchases (Received or Completed)
    const totalPurchases = allPurchases
        .filter(p => p.status === 'Received' || p.status === 'Completed' || p.status === 'Approved')
        .reduce((sum, p) => sum + p.grandTotal, 0);

    // Debit (Decreases liability): Payments sent to supplier
    const totalPayments = allPayments.reduce((sum, p) => sum + p.amount, 0);

    return openingBalance + totalPurchases - totalPayments;
};

// ── Procurement Flow Actions ─────────────────────────────────────────────────
const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export const approvePurchaseOrder = async (id: string): Promise<PurchaseOrder> => {
    return updatePurchaseOrder(id, {
        status: 'Approved',
        approved_date: new Date().toISOString()
    });
};

export const confirmGRN = async (id: string): Promise<PurchaseOrder> => {
    const orders = await getPurchaseOrders();
    const po = orders.find(o => o.id === id);
    if (!po) throw new Error('PO not found');

    // Increase warehouse stock for each line item via dedicated add-stock endpoint
    let stockUpdated = 0;
    for (const item of po.items) {
        if (!item.productId) continue;
        try {
            const res = await fetch(`${API_HOST}/products/${item.productId}/add-stock`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    quantity: item.quantity,
                    reference: po.poNumber
                })
            });
            if (res.ok) stockUpdated++;
            else {
                const err = await res.text();
                console.warn(`Stock update failed for ${item.productId}: ${err}`);
            }
        } catch (e) {
            console.warn(`Stock update error for ${item.productId}`, e);
        }
    }

    console.log(`GRN: ${stockUpdated}/${po.items.length} products stock updated`);

    return updatePurchaseOrder(id, {
        status: 'GRN',
        grn_date: new Date().toISOString()
    });
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
