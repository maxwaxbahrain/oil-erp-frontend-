import { getProducts } from './productService';
import { getSalesOrders } from './salesService';
import { getPurchaseOrders } from './purchasesService';

export interface InventoryValuation {
    totalAssetValue: number;
    totalUnits: number;
    averageUnitCost: number;
    byCategory: {
        category: string;
        value: number;
        units: number;
        percentage: number;
    }[];
    byLocation: {
        location: string;
        value: number;
        units: number;
    }[];
}

export interface StockMovement {
    productId: string;
    productName: string;
    sku: string;
    category: string;
    openingStock: number;
    purchases: number;
    sales: number;
    adjustments: number;
    closingStock: number;
    velocity: 'Fast' | 'Medium' | 'Slow' | 'Dead';
    turnoverRate: number;
    // ITEM 9 — Value-based view: opening/closing **value** alongside the
    // unit counts. Uses landedCost (falls back to sellingPrice when there's
    // no cost) so the Inventory Summary report can show capital tied up.
    unitCost: number;
    openingValue: number;
    closingValue: number;
}

export interface DeadStock {
    productId: string;
    productName: string;
    sku: string;
    category: string;
    currentStock: number;
    lastSaleDate: string | null;
    daysSinceLastSale: number;
    lockedCapital: number;
    recommendedAction: string;
}

export interface SupplierAccuracy {
    supplierId: string;
    supplierName: string;
    totalOrders: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    qualityIssues: number;
    accuracyScore: number;
    averageLeadTime: number;
    expectedLeadTime: number;
}

export interface LossLeakage {
    productId: string;
    productName: string;
    sku: string;
    expectedStock: number;
    actualStock: number;
    variance: number;
    variancePercentage: number;
    estimatedLoss: number;
    leakageRate: number;
    returnRate: number;
}

export interface ForecastingData {
    productId: string;
    productName: string;
    sku: string;
    currentStock: number;
    avgDailySales: number;
    forecast30Days: number;
    forecast60Days: number;
    forecast90Days: number;
    recommendedReorder: number;
    confidenceLevel: number;
}

export interface InventoryMetrics {
    totalAssetValuation: number;
    avgTurnover: number;
    stockAccuracy: number;
    lockedCapital: number;
    growthRate: number;
}

// Calculate total inventory valuation
export async function calculateInventoryValuation(): Promise<InventoryValuation> {
    const products = await getProducts();

    let totalAssetValue = 0;
    let totalUnits = 0;
    const categoryMap = new Map<string, { value: number; units: number }>();
    const locationMap = new Map<string, { value: number; units: number }>();

    products.forEach(product => {
        // Handle products with or without locations array
        const totalStock = product.locations
            ? product.locations.reduce((sum, loc) => sum + (loc.currentStock ?? 0), 0)
            : 0;

        // Get unit cost - try landedCost first, then sellingPrice, then 0
        const unitCost = product.pricing?.landedCost
            || product.pricing?.sellingPrice
            || 0;

        const productValue = totalStock * unitCost;

        totalAssetValue += productValue;
        totalUnits += totalStock;

        // By category
        const categoryName = product.category || 'Uncategorized';
        const catData = categoryMap.get(categoryName) || { value: 0, units: 0 };
        catData.value += productValue;
        catData.units += totalStock;
        categoryMap.set(categoryName, catData);

        // By location
        if (product.locations && product.locations.length > 0) {
            product.locations.forEach(loc => {
                const locData = locationMap.get(loc.name) || { value: 0, units: 0 };
                const stock = loc.currentStock ?? 0;
                locData.value += stock * unitCost;
                locData.units += stock;
                locationMap.set(loc.name, locData);
            });
        }
    });

    const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        value: data.value,
        units: data.units,
        percentage: totalAssetValue > 0 ? (data.value / totalAssetValue) * 100 : 0
    }));

    const byLocation = Array.from(locationMap.entries()).map(([location, data]) => ({
        location,
        value: data.value,
        units: data.units
    }));

    return {
        totalAssetValue,
        totalUnits,
        averageUnitCost: totalUnits > 0 ? totalAssetValue / totalUnits : 0,
        byCategory,
        byLocation
    };
}

// Calculate stock movement
export async function calculateStockMovement(): Promise<StockMovement[]> {
    const products = await getProducts();
    const salesOrders = await getSalesOrders();
    const purchaseOrders = await getPurchaseOrders();

    return products.map(product => {
        const totalStock = product.locations
            ? product.locations.reduce((sum, loc) => sum + (loc.currentStock ?? 0), 0)
            : 0;

        // Calculate sales from sales orders
        const sales = salesOrders
            .filter(order => order.status === 'delivered')
            .reduce((sum, order) => {
                const item = order.items.find(i => i.product_id === product.id || i.product_name === product.name);
                return sum + (item?.quantity || 0);
            }, 0);

        // Calculate purchases from purchase orders
        const purchases = purchaseOrders
            .filter(po => po.status === 'Received' || po.status === 'Completed')
            .reduce((sum, po) => {
                const item = po.items.find(i => i.productId === product.id || i.productName === product.name);
                return sum + (item?.quantity || 0);
            }, 0);

        // Calculate turnover rate
        const turnoverRate = totalStock > 0 ? (sales / totalStock) * 12 : 0; // Annualized

        // ITEM 9 — Compute opening/closing **values** using landed cost.
        // Fall back to selling price only when no cost is recorded so we
        // never report zero capital for stock that obviously has value.
        const openingStock = totalStock + sales - purchases;
        const closingStock = totalStock;
        const unitCost = Number(product.pricing?.landedCost ?? product.pricing?.purchasePriceExWorks ?? product.pricing?.sellingPrice ?? 0) || 0;
        const openingValue = Math.round(openingStock * unitCost * 100) / 100;
        const closingValue = Math.round(closingStock * unitCost * 100) / 100;

        return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            category: product.category || 'Uncategorized',
            openingStock,
            purchases,
            sales,
            adjustments: 0, // Can be enhanced with adjustment tracking
            closingStock,
            velocity: product.velocityStatus || 'Medium',
            turnoverRate,
            unitCost,
            openingValue,
            closingValue,
        };
    });
}

// Identify dead stock
export async function identifyDeadStock(): Promise<DeadStock[]> {
    const products = await getProducts();
    const salesOrders = await getSalesOrders();
    const currentDate = new Date();

    return products
        .map(product => {
            const totalStock = product.locations
                ? product.locations.reduce((sum, loc) => sum + (loc.currentStock ?? 0), 0)
                : 0;

            // Find last sale date
            const productSales = salesOrders
                .filter(order => order.items.some(i => i.product_id === product.id || i.product_name === product.name))
                .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());

            const lastSaleDate = productSales.length > 0 ? productSales[0].order_date : null;

            // Only calculate days since last sale if there was actually a sale
            // If no sales history, don't flag as dead stock (could be new product)
            const daysSinceLastSale = lastSaleDate
                ? Math.floor((currentDate.getTime() - new Date(lastSaleDate).getTime()) / (1000 * 60 * 60 * 24))
                : -1; // -1 indicates no sales history

            const unitCost = product.pricing?.landedCost || product.pricing?.sellingPrice || 0;
            const lockedCapital = totalStock * unitCost;

            let recommendedAction = '';
            if (daysSinceLastSale > 180) {
                recommendedAction = 'LIQUIDATE: No sales in 6+ months';
            } else if (daysSinceLastSale > 90) {
                recommendedAction = 'DISCOUNT: Slow moving, consider promotion';
            } else if (daysSinceLastSale > 60) {
                recommendedAction = 'MONITOR: Watch for further decline';
            }

            return {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                category: product.category || 'Uncategorized',
                currentStock: totalStock,
                lastSaleDate,
                daysSinceLastSale: daysSinceLastSale === -1 ? 999 : daysSinceLastSale, // Keep 999 for display
                lockedCapital,
                recommendedAction
            };
        })
        // Only flag as dead stock if:
        // 1. Product has sales history AND hasn't sold in 60+ days
        // 2. Exclude products with no sales history (new products)
        .filter(item => {
            const hasSalesHistory = item.lastSaleDate !== null;
            const isStagnant = item.daysSinceLastSale > 60 && item.daysSinceLastSale < 999;
            return hasSalesHistory && isStagnant;
        })
        .sort((a, b) => b.lockedCapital - a.lockedCapital);
}

// Calculate supplier accuracy
export async function calculateSupplierAccuracy(): Promise<SupplierAccuracy[]> {
    const purchaseOrders = await getPurchaseOrders();

    const supplierMap = new Map<string, {
        name: string;
        orders: number;
        onTime: number;
        late: number;
        quality: number;
        totalLeadTime: number;
        expectedLeadTime: number;
    }>();

    purchaseOrders.forEach(po => {
        const supplier = supplierMap.get(po.supplierId) || {
            name: po.supplierName,
            orders: 0,
            onTime: 0,
            late: 0,
            quality: 0,
            totalLeadTime: 0,
            expectedLeadTime: 7
        };

        supplier.orders++;

        // Calculate lead time
        const orderDate = new Date(po.date);
        const receivedDate = new Date(po.expectedDate);
        const actualLeadTime = Math.floor((receivedDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

        supplier.totalLeadTime += actualLeadTime;

        // Check if on time (within expected date)
        if (po.status === 'Received' || po.status === 'Completed') {
            if (actualLeadTime <= supplier.expectedLeadTime) {
                supplier.onTime++;
            } else {
                supplier.late++;
            }
        }

        supplierMap.set(po.supplierId, supplier);
    });

    return Array.from(supplierMap.entries()).map(([supplierId, data]) => {
        const accuracyScore = data.orders > 0
            ? ((data.onTime / data.orders) * 100)
            : 100;

        const averageLeadTime = data.orders > 0
            ? data.totalLeadTime / data.orders
            : 0;

        return {
            supplierId,
            supplierName: data.name,
            totalOrders: data.orders,
            onTimeDeliveries: data.onTime,
            lateDeliveries: data.late,
            qualityIssues: data.quality,
            accuracyScore,
            averageLeadTime,
            expectedLeadTime: data.expectedLeadTime
        };
    }).sort((a, b) => b.totalOrders - a.totalOrders);
}

// Calculate loss and leakage
export async function calculateLossLeakage(): Promise<LossLeakage[]> {
    const products = await getProducts();
    const salesOrders = await getSalesOrders();
    const purchaseOrders = await getPurchaseOrders();

    return products.map(product => {
        const totalStock = product.locations
            ? product.locations.reduce((sum, loc) => sum + (loc.currentStock ?? 0), 0)
            : 0;

        // Calculate expected stock based on purchases and sales
        const totalPurchases = purchaseOrders
            .filter(po => po.status === 'Received' || po.status === 'Completed')
            .reduce((sum, po) => {
                const item = po.items.find(i => i.productId === product.id || i.productName === product.name);
                return sum + (item?.quantity || 0);
            }, 0);

        const totalSales = salesOrders
            .filter(order => order.status === 'delivered')
            .reduce((sum, order) => {
                const item = order.items.find(i => i.product_id === product.id || i.product_name === product.name);
                return sum + (item?.quantity || 0);
            }, 0);

        const expectedStock = totalPurchases - totalSales;
        const variance = expectedStock - totalStock;
        const variancePercentage = expectedStock > 0 ? (variance / expectedStock) * 100 : 0;
        const unitCost = product.pricing?.landedCost || product.pricing?.sellingPrice || 0;
        const estimatedLoss = variance * unitCost;

        return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            expectedStock,
            actualStock: totalStock,
            variance,
            variancePercentage,
            estimatedLoss,
            leakageRate: product.leakageRate || 0,
            returnRate: product.returnRate || 0
        };
    }).filter(item => Math.abs(item.variance) > 0)
        .sort((a, b) => Math.abs(b.estimatedLoss) - Math.abs(a.estimatedLoss));
}

// Generate forecasting data
export async function generateForecastingData(): Promise<ForecastingData[]> {
    const products = await getProducts();

    return products.map(product => {
        const totalStock = product.locations
            ? product.locations.reduce((sum, loc) => sum + (loc.currentStock ?? 0), 0)
            : 0;
        const avgDailySales = product.avgDailySales || 0;

        // Simple forecasting based on average daily sales with growth factor
        const salesTrend = product.salesTrend || 0;
        const growthFactor = 1 + (salesTrend / 100);
        const forecast30Days = Math.round(avgDailySales * 30 * growthFactor);
        const forecast60Days = Math.round(avgDailySales * 60 * growthFactor);
        const forecast90Days = Math.round(avgDailySales * 90 * growthFactor);

        // Calculate recommended reorder point
        const leadTimeDays = product.leadTimeDays || 7;
        const leadTimeDemand = avgDailySales * leadTimeDays;
        const safetyStock = avgDailySales * 7; // 7 days safety stock
        const recommendedReorder = Math.round(leadTimeDemand + safetyStock);

        return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            currentStock: totalStock,
            avgDailySales,
            forecast30Days,
            forecast60Days,
            forecast90Days,
            recommendedReorder,
            confidenceLevel: product.aiConfidenceLevel || 75
        };
    }).sort((a, b) => b.forecast30Days - a.forecast30Days);
}

// Get overall inventory metrics
export async function getInventoryMetrics(): Promise<InventoryMetrics> {
    const valuation = await calculateInventoryValuation();
    const movements = await calculateStockMovement();
    const deadStock = await identifyDeadStock();

    // Calculate average turnover
    const avgTurnover = movements.length > 0
        ? movements.reduce((sum, m) => sum + m.turnoverRate, 0) / movements.length
        : 0;

    // Calculate stock accuracy (based on variance)
    const lossLeakage = await calculateLossLeakage();
    const totalVariance = lossLeakage.reduce((sum, l) => sum + Math.abs(l.variancePercentage), 0);
    const stockAccuracy = lossLeakage.length > 0
        ? 100 - (totalVariance / lossLeakage.length)
        : 99.5;

    // Calculate locked capital in dead stock
    const lockedCapital = deadStock.reduce((sum, d) => sum + d.lockedCapital, 0);

    // Calculate growth rate (mock for now, can be enhanced with historical data)
    const growthRate = 1.2;

    return {
        totalAssetValuation: valuation.totalAssetValue,
        avgTurnover,
        stockAccuracy: Math.max(0, Math.min(100, stockAccuracy)),
        lockedCapital,
        growthRate
    };
}


// ── FIFO / LIFO / Average Cost Valuation ─────────────────────

export interface CostMethodValuation {
    method: 'FIFO' | 'LIFO' | 'Average';
    totalValue: number;
    totalUnits: number;
    unitCost: number;
    items: {
        name: string;
        sku: string;
        units: number;
        unitCost: number;
        totalValue: number;
        costLayers?: { qty: number; cost: number; date: string }[];
    }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FIFO / LIFO valuation (TC-46)
//
// Rewritten so it actually produces numbers on the live backend data:
//
//  - Old version matched PO line items via i.name === product.name and
//    i.productId === product.id. But PO items have `productName` (not `name`),
//    and our imports left `productId` blank — so nothing ever matched and
//    every product was valued at $0.
//  - Old version pulled stock from product.locations, which doesn't exist
//    on the FastAPI Product model — products only carry a single `stock`
//    field that's currently 0 because GRN doesn't write back to it yet.
//
// New approach:
//
//  - Stock-in ledger: union of every PO line item (matched by NAME via
//    normalised substring — see normaliseName below). Each line is a
//    cost layer keyed by PO date.
//  - Stock-out ledger: union of every INVOICE line item with the same
//    fuzzy-name match. We subtract sold quantity from each product's
//    layered stock-in.
//  - FIFO: consume the oldest layer first. Whatever's left after sales
//    is what we still own → valued at the cost of those remaining layers.
//  - LIFO: consume the newest layer first.
//
// This makes FIFO ≠ LIFO whenever any product has at least one sale and
// at least two POs at different unit costs.
// ─────────────────────────────────────────────────────────────────────────────

const normaliseName = (s: string): string =>
    String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const matchesProduct = (lineItemName: string, productName: string): boolean => {
    const a = normaliseName(lineItemName);
    const b = normaliseName(productName);
    if (!a || !b) return false;
    if (a === b) return true;
    // Substring match handles "MOBIL SPECIAL 5W30" (invoice) vs
    // "MOBIL SPECIAL 5W30 6X1QT" (PO) and vice versa.
    return a.includes(b) || b.includes(a);
};

interface CostLayer { qty: number; cost: number; date: string; }

async function buildLayersForProduct(productName: string, pos: any[]): Promise<CostLayer[]> {
    // Sort POs oldest-first so callers can decide FIFO (use them in order)
    // or LIFO (reverse before consuming).
    const sorted = [...pos].sort(
        (a, b) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime(),
    );
    const layers: CostLayer[] = [];
    for (const po of sorted) {
        for (const item of (po.items || [])) {
            const name = (item as any).productName || (item as any).name || '';
            if (!matchesProduct(name, productName)) continue;
            const qty = Number((item as any).quantity) || 0;
            const cost = Number((item as any).unitPrice || (item as any).rate) || 0;
            if (qty > 0) layers.push({ qty, cost, date: po.date || '' });
        }
    }
    return layers;
}

async function totalSoldForProduct(productName: string, invoices: any[]): Promise<number> {
    let qty = 0;
    for (const inv of invoices) {
        for (const item of (inv.items || inv.lineItems || [])) {
            const name = (item as any).product || (item as any).productName || (item as any).name || '';
            if (!matchesProduct(name, productName)) continue;
            qty += Number((item as any).quantity) || 0;
        }
    }
    return qty;
}

async function buildValuation(method: 'FIFO' | 'LIFO'): Promise<CostMethodValuation> {
    const products = await getProducts();
    const pos = await getPurchaseOrders();
    // Pull invoices for stock-out deduction. Imported via fetch since the
    // existing import path here doesn't include it.
    let invoices: any[] = [];
    try {
        const { getInvoices } = await import('./api');
        invoices = await getInvoices();
    } catch { /* keep empty; total purchased will be used as remaining stock */ }

    let totalValue = 0;
    let totalUnits = 0;

    const items = await Promise.all(products.map(async (product: any) => {
        const layers = await buildLayersForProduct(product.name, pos);
        // If FIFO consume oldest first (layers already oldest-first); if LIFO
        // consume newest first (reverse).
        const consumeOrder = method === 'FIFO' ? layers : [...layers].reverse();

        const totalPurchased = layers.reduce((s, l) => s + l.qty, 0);
        const sold = await totalSoldForProduct(product.name, invoices);
        // Whatever's left on the shelf after sales.
        const stockRemaining = Math.max(0, totalPurchased - sold);
        // ALSO consider product.stock if it's > 0 (some other system may
        // have written to it). Use the larger of the two — favours the
        // value the user is most likely to recognise.
        const stock = Math.max(stockRemaining, Number((product as any).stock) || 0);

        // Walk the consume order, but value the REMAINING (unconsumed) layers
        // — that's what's still in stock. So we burn `sold` units off the
        // front of consumeOrder first, then sum whatever's left.
        let toSell = Math.min(sold, totalPurchased);
        const remainingLayers: CostLayer[] = [];
        for (const layer of consumeOrder) {
            if (toSell >= layer.qty) {
                toSell -= layer.qty;
                continue;
            }
            const leftInLayer = layer.qty - toSell;
            toSell = 0;
            remainingLayers.push({ qty: leftInLayer, cost: layer.cost, date: layer.date });
        }

        const value = remainingLayers.reduce((s, l) => s + l.qty * l.cost, 0);
        // Show the layers in display order (FIFO = oldest first, LIFO = newest first).
        const displayLayers = (method === 'FIFO' ? remainingLayers : [...remainingLayers]).slice(0, 5);

        const unitCost = stock > 0 ? value / stock : 0;
        totalValue += value;
        totalUnits += stock;

        return {
            name: product.name || 'Unknown',
            sku: product.sku || '',
            units: stock,
            unitCost: Math.round(unitCost * 100) / 100,
            totalValue: Math.round(value * 100) / 100,
            costLayers: displayLayers,
        };
    }));

    return {
        method,
        totalValue: Math.round(totalValue * 100) / 100,
        totalUnits,
        unitCost: totalUnits > 0 ? Math.round((totalValue / totalUnits) * 100) / 100 : 0,
        items,
    };
}

export async function calculateFIFOValuation(): Promise<CostMethodValuation> {
    return buildValuation('FIFO');
}

export async function calculateLIFOValuation(): Promise<CostMethodValuation> {
    return buildValuation('LIFO');
}

export async function calculateAvgCostValuation(): Promise<CostMethodValuation> {
    const products = await getProducts();
    let totalValue = 0, totalUnits = 0;
    const items = products.map(product => {
        const stock = product.locations?.reduce((s, l) => s + (l.currentStock || 0), 0) || 0;
        const cost = product.pricing?.purchasePriceExWorks || product.pricing?.landedCost || product.pricing?.sellingPrice || 0;
        const value = stock * cost;
        totalValue += value;
        totalUnits += stock;
        return { name: product.name || '', sku: product.sku || '', units: stock, unitCost: cost, totalValue: Math.round(value * 100) / 100 };
    });
    return {
        method: 'Average',
        totalValue: Math.round(totalValue * 100) / 100,
        totalUnits,
        unitCost: totalUnits > 0 ? Math.round((totalValue / totalUnits) * 100) / 100 : 0,
        items
    };
}
