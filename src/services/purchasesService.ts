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

export const getSuppliers = async (): Promise<Supplier[]> => {
    let suppliers = getStorage<Supplier>('suppliers');
    if (suppliers.length === 0) {
        setStorage('suppliers', INITIAL_SUPPLIERS);
        suppliers = INITIAL_SUPPLIERS;
    }
    return suppliers;
};

export const getSupplierById = async (id: string): Promise<Supplier | null> => {
    const suppliers = await getSuppliers();
    return suppliers.find(s => s.id === id) || null;
};

export const createSupplier = async (supplier: Partial<Supplier>): Promise<Supplier> => {
    const suppliers = await getSuppliers();
    const newSupplier = {
        ...supplier,
        id: `SUP-${Date.now()}`,
        status: (supplier.status || 'Active') as 'Active' | 'Blocked'
    } as Supplier;
    setStorage('suppliers', [newSupplier, ...suppliers]);
    return newSupplier;
};

export const updateSupplier = async (id: string, data: Partial<Supplier>): Promise<Supplier> => {
    const suppliers = await getSuppliers();
    const updated = suppliers.map(s => s.id === id ? { ...s, ...data } : s);
    setStorage('suppliers', updated);
    return updated.find(s => s.id === id) as Supplier;
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

    // Increase warehouse stock for each line item via backend API
    for (const item of po.items) {
        if (!item.productId) continue;
        try {
            const res = await fetch(`${API_HOST}/products/${item.productId}`);
            if (!res.ok) continue;
            const product = await res.json();
            const newStock = (product.current_stock || 0) + item.quantity;
            await fetch(`${API_HOST}/products/${item.productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...product, current_stock: newStock })
            });
        } catch (e) {
            console.warn(`Stock update failed for ${item.productId}`, e);
        }
    }

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
