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

    // Map PO items to GRN items
    const grnItems: GRNItem[] = po.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.productId, // Using productId as SKU for now
        uom: item.uom,
        orderedQty: item.quantity,
        receivedQty: 0,
        acceptedQty: 0,
        rejectedQty: 0,
        unitCost: item.unitPrice,
        totalCost: 0
    }));

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
    if (linkedPO && linkedPO.status !== 'Approved' && linkedPO.status !== 'Pending' && linkedPO.status !== 'Draft') {
        throw new Error(
            `Cannot post GRN — the underlying PO ${linkedPO.poNumber} is in status "${linkedPO.status}". ` +
            `Only Draft, Pending, or Approved POs can be received. ` +
            `Refresh the receiving list to see the current state.`
        );
    }

    // FIX W3-1 — Per-item stock add via the backend `add-stock` endpoint.
    // FIX W3-2 — Track per-item attempt/success/failure for UI surfacing.
    let attempted = 0;
    let succeeded = 0;
    const failures: PostGRNResult['failures'] = [];
    const skipped: PostGRNResult['skipped'] = [];

    for (const item of grn.items) {
        if (item.acceptedQty <= 0) {
            // Skipped rejected lines don't count as failure — they're just
            // not in scope for stock movement. We still record them so the
            // UI can explain "X of Y items processed".
            skipped.push({ productName: item.productName, reason: 'zero-accepted' });
            continue;
        }
        if (!item.productId) {
            skipped.push({ productName: item.productName, reason: 'no-productId' });
            continue;
        }
        attempted++;
        try {
            const res = await authFetch(apiUrl(`products/${item.productId}/add-stock`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity: item.acceptedQty,
                    // Reference threads BOTH the GRN number AND warehouse so
                    // Path B's audit trail (which Path A doesn't have) survives
                    // into the backend's stock movement log.
                    reference: `${grn.grnNumber} @ ${grn.warehouse}`,
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

    // FIX W3-1 — Unify with Path A: status goes to 'GRN' (not 'Received').
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
    return purchaseOrders.filter(po =>
        po.status === 'Approved' || po.status === 'Pending'
    );
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
