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

        return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            category: product.category || 'Uncategorized',
            openingStock: totalStock + sales - purchases,
            purchases,
            sales,
            adjustments: 0, // Can be enhanced with adjustment tracking
            closingStock: totalStock,
            velocity: product.velocityStatus || 'Medium',
            turnoverRate
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

export async function calculateFIFOValuation(): Promise<CostMethodValuation> {
    const products = await getProducts();
    const pos = await getPurchaseOrders();

    let totalValue = 0;
    let totalUnits = 0;

    const items = products.map(product => {
        const stock = product.locations?.reduce((s, l) => s + (l.currentStock || 0), 0) || 0;
        // Get PO receipts for this product sorted oldest first (FIFO = use oldest cost)
        const productPOs = pos
            .filter(po => po.items?.some((i: any) => i.productId === product.id || i.name === product.name))
            .sort((a, b) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime());

        // Build cost layers (oldest first)
        const layers: { qty: number; cost: number; date: string }[] = [];
        productPOs.forEach(po => {
            const item = po.items?.find((i: any) => i.productId === product.id || i.name === product.name);
            if (item && item.quantity > 0) {
                layers.push({
                    qty: Number(item.quantity) || 0,
                    cost: Number((item as any).unitPrice || (item as any).rate || product.pricing?.purchasePriceExWorks || product.pricing?.landedCost || 0),
                    date: po.date || ''
                });
            }
        });

        // If no PO history, use current cost
        if (layers.length === 0) {
            layers.push({
                qty: stock,
                cost: product.pricing?.purchasePriceExWorks || product.pricing?.landedCost || 0,
                date: new Date().toISOString().slice(0, 10)
            });
        }

        // FIFO: use oldest layers first for current stock
        let remaining = stock;
        let fifoValue = 0;
        for (const layer of layers) {
            if (remaining <= 0) break;
            const use = Math.min(remaining, layer.qty);
            fifoValue += use * layer.cost;
            remaining -= use;
        }
        // Any remaining stock not covered by PO layers - use latest cost
        if (remaining > 0) {
            const latestCost = layers[layers.length - 1]?.cost || 0;
            fifoValue += remaining * latestCost;
        }

        const unitCost = stock > 0 ? fifoValue / stock : 0;
        totalValue += fifoValue;
        totalUnits += stock;

        return {
            name: product.name || 'Unknown',
            sku: product.sku || '',
            units: stock,
            unitCost: Math.round(unitCost * 100) / 100,
            totalValue: Math.round(fifoValue * 100) / 100,
            costLayers: layers.slice(0, 5)
        };
    });

    return {
        method: 'FIFO',
        totalValue: Math.round(totalValue * 100) / 100,
        totalUnits,
        unitCost: totalUnits > 0 ? Math.round((totalValue / totalUnits) * 100) / 100 : 0,
        items
    };
}

export async function calculateLIFOValuation(): Promise<CostMethodValuation> {
    const products = await getProducts();
    const pos = await getPurchaseOrders();

    let totalValue = 0;
    let totalUnits = 0;

    const items = products.map(product => {
        const stock = product.locations?.reduce((s, l) => s + (l.currentStock || 0), 0) || 0;
        // LIFO: newest purchases first
        const productPOs = pos
            .filter(po => po.items?.some((i: any) => i.productId === product.id || i.name === product.name))
            .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime()); // newest first

        const layers: { qty: number; cost: number; date: string }[] = [];
        productPOs.forEach(po => {
            const item = po.items?.find((i: any) => i.productId === product.id || i.name === product.name);
            if (item) {
                layers.push({
                    qty: Number(item.quantity) || 0,
                    cost: Number((item as any).unitPrice || (item as any).rate || product.pricing?.purchasePriceExWorks || product.pricing?.landedCost || 0),
                    date: po.date || ''
                });
            }
        });

        if (layers.length === 0) {
            layers.push({
                qty: stock,
                cost: product.pricing?.purchasePriceExWorks || product.pricing?.landedCost || 0,
                date: new Date().toISOString().slice(0, 10)
            });
        }

        let remaining = stock;
        let lifoValue = 0;
        for (const layer of layers) {
            if (remaining <= 0) break;
            const use = Math.min(remaining, layer.qty);
            lifoValue += use * layer.cost;
            remaining -= use;
        }
        if (remaining > 0) {
            lifoValue += remaining * (layers[layers.length - 1]?.cost || 0);
        }

        const unitCost = stock > 0 ? lifoValue / stock : 0;
        totalValue += lifoValue;
        totalUnits += stock;

        return {
            name: product.name || 'Unknown',
            sku: product.sku || '',
            units: stock,
            unitCost: Math.round(unitCost * 100) / 100,
            totalValue: Math.round(lifoValue * 100) / 100,
            costLayers: layers.slice(0, 5)
        };
    });

    return {
        method: 'LIFO',
        totalValue: Math.round(totalValue * 100) / 100,
        totalUnits,
        unitCost: totalUnits > 0 ? Math.round((totalValue / totalUnits) * 100) / 100 : 0,
        items
    };
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
