import { getPurchaseOrders, updatePurchaseOrder, type PurchaseOrder } from './purchasesService';
import { getProducts, saveProduct as updateProduct } from './productService';

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

// Post GRN (Update Inventory and PO Status)
export const postGRN = async (grnId: string): Promise<GRN> => {
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

    // Update inventory for each accepted item
    const products = await getProducts();

    for (const item of grn.items) {
        if (item.acceptedQty > 0) {
            const product = products.find(p => p.id === item.productId || p.name === item.productName);

            if (product) {
                // Find the warehouse location or create it
                let locations = product.locations || [];
                const locationIndex = locations.findIndex(loc => loc.name === grn.warehouse);

                if (locationIndex >= 0) {
                    const loc = locations[locationIndex];
                    if (loc) {
                        loc.currentStock = (loc.currentStock ?? 0) + item.acceptedQty;
                    }
                } else {
                    // Add new location
                    locations.push({
                        id: `LOC-GRN-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                        name: grn.warehouse,
                        type: 'Warehouse',
                        currentStock: item.acceptedQty,
                        reorderPoint: 10,
                        maxStock: 1000
                    });
                }

                // Update product with new stock levels
                await updateProduct({
                    ...product,
                    locations,
                    // Update landed cost if available
                    pricing: {
                        ...product.pricing,
                        landedCost: item.unitCost
                    }
                });
            }
        }
    }

    // Update Purchase Order status to Received
    await updatePurchaseOrder(grn.poId, { status: 'Received' });

    // Update GRN status to Posted
    grn.status = 'Posted';
    grn.postedAt = new Date().toISOString();
    grns[grnIndex] = grn;
    setStorage('grns', grns);

    return grn;
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
