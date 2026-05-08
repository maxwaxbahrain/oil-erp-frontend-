// Test Data Generator for Inventory Reports
// This script generates realistic test data for sales orders, purchase orders, and products
// Run this in the browser console to populate data

import { saveProduct } from '../services/productService';
import { createSalesOrder } from '../services/salesService';
import { createPurchaseOrder } from '../services/purchasesService';

export async function generateTestData() {
    console.log('🚀 Generating test data for Inventory Reports...');

    // Add more products
    const products = [
        {
            name: 'Shell Helix 10W40',
            sku: 'SHL-1040',
            barcode: '987654321098',
            category: 'Lubricants',
            subCategory: 'Motor Oil',
            brand: 'Shell',
            status: 'Active' as const,
            description: 'Premium synthetic motor oil for gasoline engines',
            shortDescription: 'Synthetic motor oil',
            uom: 'Liters',
            quantityPerUnit: 1,
            velocityStatus: 'Fast' as const,
            salesVelocity: 380,
            salesTrend: 12,
            revenueContribution: 18.5,
            grossMarginPercent: 28,
            netProfitPerUnit: 320,
            avgDailySales: 12,
            daysStockRemaining: 25,
            reorderLevel: 120,
            overstockRisk: 'Low' as const,
            pricing: {
                purchasePriceExWorks: 880,
                freightShipping: 30,
                importDuty: 22,
                otherDirectCosts: 8,
                landedCost: 940,
                operatingExpenseAllocation: 110,
                sellingPrice: 1350,
                taxRate: 17,
                taxIncluded: false
            },
            priceHistory: [
                { date: '2023-10-01', cost: 880, selling: 1300 },
                { date: '2023-11-01', cost: 900, selling: 1300 },
                { date: '2023-12-01', cost: 940, selling: 1350 }
            ],
            images: [
                { id: 'img-2', url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop', isPrimary: true }
            ],
            aiEnabled: true,
            aiDemandPrediction: 450,
            aiConfidenceLevel: 82,
            aiPricingSuggestion: 1380,
            locations: [
                { id: 'LOC-001', name: 'Main Warehouse', type: 'Warehouse' as const, currentStock: 220, reorderPoint: 120, maxStock: 800, physicalLocation: 'Aisle B-5', avgDailySales: 7 },
                { id: 'LOC-002', name: 'Van 1 - Downtown', type: 'Van' as const, currentStock: 65, reorderPoint: 30, maxStock: 120, assignedTo: 'Ahmed Khan', avgDailySales: 10 },
                { id: 'LOC-003', name: 'Main Store', type: 'Store' as const, currentStock: 45, reorderPoint: 25, maxStock: 150, avgDailySales: 2 }
            ],
            leadTimeDays: 5,
            minOrderQty: 150,
            specifications: [
                { key: 'Weight', value: '0.85kg' },
                { key: 'Color', value: 'Golden' }
            ],
            primarySupplierName: 'Shell Trading International',
            supplierProductCode: 'SH-1040-PRO',
            supplierReliabilityScore: 4.9,
            tags: ['Premium', 'Synthetic', 'Shell'],
            seo: {
                metaTitle: 'Shell Helix 10W40 Synthetic Oil | Premium Quality',
                metaDescription: 'Buy Shell Helix 10W40 synthetic motor oil. High performance protection.',
                keywords: 'shell helix, synthetic oil, 10w40, motor oil'
            },
            leakageRate: 2.5,
            returnRate: 0.3
        },
        {
            name: 'Mobil Super 5W30',
            sku: 'MOB-530',
            barcode: '456789012345',
            category: 'Lubricants',
            subCategory: 'Motor Oil',
            brand: 'Mobil',
            status: 'Active' as const,
            description: 'Advanced full synthetic motor oil',
            shortDescription: 'Full synthetic oil',
            uom: 'Liters',
            quantityPerUnit: 1,
            velocityStatus: 'Medium' as const,
            salesVelocity: 220,
            salesTrend: 8,
            revenueContribution: 12.3,
            grossMarginPercent: 30,
            netProfitPerUnit: 380,
            avgDailySales: 7,
            daysStockRemaining: 35,
            reorderLevel: 80,
            overstockRisk: 'Low' as const,
            pricing: {
                purchasePriceExWorks: 1050,
                freightShipping: 38,
                importDuty: 28,
                otherDirectCosts: 12,
                landedCost: 1128,
                operatingExpenseAllocation: 142,
                sellingPrice: 1650,
                taxRate: 17,
                taxIncluded: false
            },
            priceHistory: [],
            images: [],
            aiEnabled: true,
            aiDemandPrediction: 250,
            aiConfidenceLevel: 78,
            locations: [
                { id: 'LOC-001', name: 'Main Warehouse', type: 'Warehouse' as const, currentStock: 180, reorderPoint: 80, maxStock: 600, physicalLocation: 'Aisle C-2', avgDailySales: 5 },
                { id: 'LOC-002', name: 'Van 1 - Downtown', type: 'Van' as const, currentStock: 40, reorderPoint: 20, maxStock: 100, assignedTo: 'Ahmed Khan', avgDailySales: 6 }
            ],
            leadTimeDays: 6,
            minOrderQty: 100,
            specifications: [],
            primarySupplierName: 'Mobil Oil Corporation',
            supplierReliabilityScore: 4.7,
            tags: ['Synthetic', 'Mobil'],
            seo: {
                metaTitle: 'Mobil Super 5W30 Full Synthetic',
                metaDescription: 'Premium Mobil Super 5W30 synthetic motor oil',
                keywords: 'mobil super, 5w30, synthetic'
            },
            leakageRate: 1.8,
            returnRate: 0.2
        },
        {
            name: 'Oil Filter OF-2000',
            sku: 'FLT-2000',
            barcode: '789012345678',
            category: 'Filters',
            subCategory: 'Oil Filters',
            brand: 'Generic',
            status: 'Active' as const,
            description: 'Universal oil filter for most vehicles',
            shortDescription: 'Universal oil filter',
            uom: 'Pieces',
            quantityPerUnit: 1,
            velocityStatus: 'Fast' as const,
            salesVelocity: 520,
            salesTrend: 18,
            revenueContribution: 8.2,
            grossMarginPercent: 45,
            netProfitPerUnit: 180,
            avgDailySales: 17,
            daysStockRemaining: 20,
            reorderLevel: 200,
            overstockRisk: 'Low' as const,
            pricing: {
                purchasePriceExWorks: 220,
                freightShipping: 15,
                importDuty: 8,
                otherDirectCosts: 5,
                landedCost: 248,
                operatingExpenseAllocation: 52,
                sellingPrice: 550,
                taxRate: 17,
                taxIncluded: false
            },
            priceHistory: [],
            images: [],
            aiEnabled: true,
            aiDemandPrediction: 600,
            aiConfidenceLevel: 91,
            locations: [
                { id: 'LOC-001', name: 'Main Warehouse', type: 'Warehouse' as const, currentStock: 450, reorderPoint: 200, maxStock: 1500, physicalLocation: 'Aisle D-8', avgDailySales: 12 },
                { id: 'LOC-002', name: 'Van 1 - Downtown', type: 'Van' as const, currentStock: 120, reorderPoint: 50, maxStock: 200, assignedTo: 'Ahmed Khan', avgDailySales: 15 },
                { id: 'LOC-003', name: 'Main Store', type: 'Store' as const, currentStock: 80, reorderPoint: 40, maxStock: 250, avgDailySales: 5 }
            ],
            leadTimeDays: 3,
            minOrderQty: 300,
            specifications: [],
            primarySupplierName: 'Auto Parts Supplier Ltd',
            supplierReliabilityScore: 4.5,
            tags: ['Filter', 'Fast Moving'],
            seo: {
                metaTitle: 'Universal Oil Filter OF-2000',
                metaDescription: 'High quality oil filter for all vehicles',
                keywords: 'oil filter, universal filter'
            },
            leakageRate: 0.5,
            returnRate: 1.2
        }
    ];

    // Save products
    for (const product of products) {
        await saveProduct(product);
        console.log(`✅ Added product: ${product.name}`);
    }

    // Generate sales orders (last 90 days)
    const salesOrders = [
        {
            customer_id: '1',
            van_id: 'VAN-001',
            order_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: [
                { product_id: '1', product_name: 'Bettano 15W40', quantity: 25, unit_price: 1500, total: 37500 }
            ],
            subtotal: 37500,
            tax: 0,
            total: 37500,
            status: 'delivered' as const,
            payment_status: 'paid' as const,
            notes: 'seed',
        },
        {
            customer_id: '1',
            van_id: 'VAN-001',
            order_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: [
                { product_id: '1', product_name: 'Bettano 15W40', quantity: 30, unit_price: 1500, total: 45000 }
            ],
            subtotal: 45000,
            tax: 0,
            total: 45000,
            status: 'delivered' as const,
            payment_status: 'paid' as const,
            notes: 'seed',
        },
        {
            customer_id: '1',
            van_id: 'VAN-002',
            order_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: [
                { product_id: '1', product_name: 'Bettano 15W40', quantity: 18, unit_price: 1500, total: 27000 }
            ],
            subtotal: 27000,
            tax: 0,
            total: 27000,
            status: 'delivered' as const,
            payment_status: 'paid' as const,
            notes: 'seed',
        }
    ];

    for (const order of salesOrders) {
        await createSalesOrder({
            ...order,
            items: order.items as unknown as Array<Record<string, unknown>>,
        });
        console.log(`✅ Added sales order for ${order.total}`);
    }

    // Generate purchase orders
    const purchaseOrders = [
        {
            poNumber: 'PO-2024-001',
            supplierId: 'SUP-001',
            supplierName: 'Bettano International Trading LLC',
            date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            expectedDate: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'Received' as const,
            items: [
                {
                    productId: '1',
                    productName: 'Bettano 15W40',
                    uom: 'Liters',
                    quantity: 500,
                    unitPrice: 1020,
                    taxRate: 17,
                    discount: 0,
                    total: 510000
                }
            ],
            subtotal: 510000,
            taxTotal: 86700,
            grandTotal: 596700,
            payment_status: 'Paid' as const
        },
        {
            poNumber: 'PO-2024-002',
            supplierId: 'SUP-002',
            supplierName: 'Shell Trading International',
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            expectedDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'Received' as const,
            items: [
                {
                    productId: 'P-shell',
                    productName: 'Shell Helix 10W40',
                    uom: 'Liters',
                    quantity: 400,
                    unitPrice: 940,
                    taxRate: 17,
                    discount: 0,
                    total: 376000
                }
            ],
            subtotal: 376000,
            taxTotal: 63920,
            grandTotal: 439920,
            payment_status: 'Paid' as const
        }
    ];

    for (const po of purchaseOrders) {
        await createPurchaseOrder(po);
        console.log(`✅ Added purchase order: ${po.poNumber}`);
    }

    console.log('✨ Test data generation complete!');
    console.log('📊 Refresh the Inventory Reports page to see updated metrics.');
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
    (window as any).generateTestData = generateTestData;
    console.log('💡 Run generateTestData() in console to populate test data');
}
