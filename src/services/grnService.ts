import { getPurchaseOrders, updatePurchaseOrder, type PurchaseOrder } from './purchasesService';
import { getOilErpApiBase } from '../config/apiBase';
import { authFetch } from '../api/axios';

// FIX W3-1 — Path B (this module) now writes stock to the SAME backend
// endpoint that Path A uses (PurchasesDashboard's Confirm GRN button).
// Previously Path B mutated product.locations in localStorage only, which
// meant Inventory Dashboard never saw the stock and the two paths produced
// divergent state. This constant mirrors the one in purchasesService.ts.
function apiUrl(path: string): string {
    const base = getOilErpApiBase().replace(/\/$/, '');
    const p = path.replace(/^\//, '');
    return `${base}/${p}`;
}

export interface GRNItem {
    productId: string;
    productName: string;
    sku: string;
    uom: string;
    orderedQty: number;
    receivedQty: number;
    acceptedQty: number;
    rejectedQty: number;
    unitCost: number;
    totalCost: number;
}

export interface GRN {
    id: string;
    grnNumber: string;
    poReference: string;
    poId: string;
    warehouse: string;
    receivedBy: string;
    receivedDate: string;
    status: 'Draft' | 'Posted' | 'Cancelled';
    items: GRNItem[];
    goodsValue: number;
    freightCost: number;
    landedCost: number;
    notes?: string;
    createdAt: string;
    postedAt?: string;
}

// Helper functions
const getStorage = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

const setStorage = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// Generate GRN Number
export const generateGRNNumber = (): string => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `GRN-${year}-${random}`;
};

// Get all GRNs
export const getGRNs = async (): Promise<GRN[]> => {
    return getStorage<GRN>('grns');
};

// Get GRN by ID
export const getGRNById = async (id: string): Promise<GRN | null> => {
    const grns = await getGRNs();
    return grns.find(g => g.id === id) || null;
};

// Get GRNs by PO
export const getGRNsByPO = async (poId: string): Promise<GRN[]> => {
    const grns = await getGRNs();
    return grns.filter(g => g.poId === poId);
};

// Create GRN from Purchase Order
export const createGRNFromPO = async (poId: string, warehouse: string = 'Main Warehouse'): Promise<GRN> => {
    const purchaseOrders = await getPurchaseOrders();
    const po = purchaseOrders.find(p => p.id === poId);

    if (!po) {
        throw new Error('Purchase Order not found');
    }

    // Map PO items to GRN items — default to full ordered qty (normal case);
    // lines stay editable afterward for partial receipts.
    const grnItems: GRNItem[] = po.items.map(item => {
        const orderedQty = item.quantity;
        return {
            productId: item.productId,
            productName: item.productName,
            sku: item.productId, // Using productId as SKU for now
            uom: item.uom,
            orderedQty,
            receivedQty: orderedQty,
            acceptedQty: orderedQty,
            rejectedQty: 0,
            unitCost: item.unitPrice,
            totalCost: orderedQty * item.unitPrice,
        };
    });

    const newGRN: GRN = {
        id: `GRN-${Date.now()}`,
        grnNumber: generateGRNNumber(),
        poReference: po.poNumber,
        poId: po.id,
        warehouse,
        receivedBy: 'Current User', // Should be replaced with actual user
        receivedDate: new Date().toISOString().split('T')[0],
        status: 'Draft',
        items: grnItems,
        goodsValue: 0,
        freightCost: 0,
        landedCost: 0,
        createdAt: new Date().toISOString()
    };

    const grns = await getGRNs();
    setStorage('grns', [newGRN, ...grns]);

    return newGRN;
};

// Save GRN (Draft)
export const saveGRN = async (grn: Partial<GRN> & { id: string }): Promise<GRN> => {
    const grns = await getGRNs();
    const index = grns.findIndex(g => g.id === grn.id);

    if (index === -1) {
        throw new Error('GRN not found');
    }

    // Calculate totals
    const goodsValue = grn.items?.reduce((sum, item) => sum + (item.acceptedQty * item.unitCost), 0) || 0;
    const freightCost = grn.freightCost || 0;
    const landedCost = goodsValue + freightCost;

    const updatedGRN = {
        ...grns[index],
        ...grn,
        goodsValue,
        landedCost
    };

    grns[index] = updatedGRN;
    setStorage('grns', grns);

    return updatedGRN;
};

// FIX W3-2 — Aggregate result for postGRN, mirroring GRNResult in
// purchasesService. Lets GoodsReceivedForm show a precise success /
// partial / failure banner instead of an unconditional success alert.
export interface PostGRNResult {
    grn: GRN;
    attempted: number;
    succeeded: number;
    failures: Array<{
        productId: string;
        productName?: string;
        reason: string;
    }>;
    skipped: Array<{
        productName?: string;
        reason: 'no-productId' | 'zero-accepted';
    }>;
}

// Post GRN (Update Inventory and PO Status)
export const postGRN = async (grnId: string): Promise<PostGRNResult> => {
    const grns = await getGRNs();
    const grnIndex = grns.findIndex(g => g.id === grnId);

    if (grnIndex === -1) {
        throw new Error('GRN not found');
    }

    const grn = grns[grnIndex];

    if (grn.status === 'Posted') {
        throw new Error('GRN already posted');
    }

    // Validate that at least some items are received
    const totalReceived = grn.items.reduce((sum, item) => sum + item.acceptedQty, 0);
    if (totalReceived === 0) {
        throw new Error('Cannot post GRN with zero accepted quantity');
    }

    // FIX W3-4 — Idempotency guard on the underlying PO. Path B has
    // historically supported posting against both Pending and Approved
    // POs (its workflow is "draft GRN → post" which can precede formal
    // approval). We only block when the PO has already moved past the
    // receive window — already-GRN'd, Paid, Rejected, or Completed.
    const purchaseOrders = await getPurchaseOrders();
    const linkedPO = purchaseOrders.find(p => p.id === grn.poId);
    if (linkedPO && linkedPO.status !== 'Approved') {
        throw new Error(
            `Cannot post GRN — the underlying PO ${linkedPO.poNumber} is in status "${linkedPO.status}". ` +
            `Only Approved POs can be received. ` +
            `Refresh the receiving list to see the current state.`
        );
    }

    let attempted = 0;
    let succeeded = 0;
    const failures: PostGRNResult['failures'] = [];
    const skipped: PostGRNResult['skipped'] = [];

    // Batch goods receipt — one backend call updates stock/cost and posts GL once.
    const receiptLines: Array<{ productId: number; productName?: string; quantity: number; unitCost: number }> = [];

    for (const item of grn.items) {
        if (item.acceptedQty <= 0) {
            skipped.push({ productName: item.productName, reason: 'zero-accepted' });
            continue;
        }
        if (!item.productId) {
            skipped.push({ productName: item.productName, reason: 'no-productId' });
            continue;
        }
        const productId = parseInt(String(item.productId), 10);
        if (!Number.isFinite(productId)) {
            skipped.push({ productName: item.productName, reason: 'no-productId' });
            continue;
        }
        const unitCost = Number(item.unitCost);
        if (!Number.isFinite(unitCost) || unitCost <= 0) {
            failures.push({
                productId: String(item.productId),
                productName: item.productName,
                reason: 'unit cost must be greater than zero for GL receipt posting',
            });
            continue;
        }
        receiptLines.push({
            productId,
            productName: item.productName,
            quantity: item.acceptedQty,
            unitCost,
        });
    }

    attempted = receiptLines.length;

    if (attempted === 0) {
        const failSummary = failures.length
            ? failures.map((f) => f.productName || f.productId).join(', ')
            : skipped.filter((s) => s.reason === 'no-productId').map((s) => s.productName || 'unnamed line').join(', ');
        throw new Error(
            failures.length
                ? `No stock was updated — all ${failures.length} item(s) failed: ${failSummary}`
                : `No stock was updated — no line items had a linked product. Link products on the PO before receiving.`,
        );
    }

    const supplierIdRaw = linkedPO?.supplierId;
    let supplierId: number | undefined;
    if (supplierIdRaw != null && /^\d+$/.test(String(supplierIdRaw))) {
        supplierId = parseInt(String(supplierIdRaw), 10);
    }

    try {
        const res = await authFetch(apiUrl('products/grn-receive'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grnSourceId: grn.id,
                supplierId,
                receiptDate: grn.receivedDate,
                reference: `${grn.grnNumber} @ ${grn.warehouse}`,
                lines: receiptLines.map((line) => ({
                    productId: line.productId,
                    quantity: line.quantity,
                    unitCost: line.unitCost,
                })),
            }),
        });
        if (res.ok) {
            succeeded = attempted;
        } else {
            const text = await res.text().catch(() => '');
            const reason = `HTTP ${res.status} ${text}`.trim();
            for (const line of receiptLines) {
                failures.push({
                    productId: String(line.productId),
                    productName: line.productName,
                    reason,
                });
            }
        }
    } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        for (const line of receiptLines) {
            failures.push({
                productId: String(line.productId),
                productName: line.productName,
                reason,
            });
        }
    }

    if (succeeded === 0) {
        const failSummary = failures.length
            ? failures.map((f) => f.productName || f.productId).join(', ')
            : skipped.filter((s) => s.reason === 'no-productId').map((s) => s.productName || 'unnamed line').join(', ');
        throw new Error(
            failures.length
                ? `No stock was updated — all ${failures.length} item(s) failed: ${failSummary}`
                : `No stock was updated — no line items had a linked product. Link products on the PO before receiving.`,
        );
    }

    // Only mark PO received when at least one stock add succeeded.
    await updatePurchaseOrder(grn.poId, {
        status: 'GRN',
        grn_date: new Date().toISOString(),
    } as any);

    // Update GRN status to Posted
    grn.status = 'Posted';
    grn.postedAt = new Date().toISOString();
    grns[grnIndex] = grn;
    setStorage('grns', grns);

    return { grn, attempted, succeeded, failures, skipped };
};

// Delete GRN (only if Draft)
export const deleteGRN = async (grnId: string): Promise<void> => {
    const grns = await getGRNs();
    const grn = grns.find(g => g.id === grnId);

    if (!grn) {
        throw new Error('GRN not found');
    }

    if (grn.status === 'Posted') {
        throw new Error('Cannot delete posted GRN');
    }

    const filtered = grns.filter(g => g.id !== grnId);
    setStorage('grns', filtered);
};

// Get pending Purchase Orders (not yet received)
export const getPendingPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    const purchaseOrders = await getPurchaseOrders();
    return purchaseOrders.filter(po => po.status === 'Approved');
};

// Calculate GRN statistics
export interface GRNStats {
    totalGRNs: number;
    draftGRNs: number;
    postedGRNs: number;
    totalValue: number;
    pendingPOs: number;
}

export const getGRNStats = async (): Promise<GRNStats> => {
    const grns = await getGRNs();
    const pendingPOs = await getPendingPurchaseOrders();

    return {
        totalGRNs: grns.length,
        draftGRNs: grns.filter(g => g.status === 'Draft').length,
        postedGRNs: grns.filter(g => g.status === 'Posted').length,
        totalValue: grns
            .filter(g => g.status === 'Posted')
            .reduce((sum, g) => sum + g.landedCost, 0),
        pendingPOs: pendingPOs.length
    };
};
