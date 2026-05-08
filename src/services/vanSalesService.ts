/**
 * Van Sales Service
 * Handles CRUD operations for van-based direct sales
 */

import type { VanSale, VanSaleFormData, VanSalesStats, VanDailySummary } from '../types/vanSales';
import { getCustomers } from './api';
import { vanService } from './vanService';
import { addLedgerEntry } from './customerService';

const STORAGE_KEY = 'van_sales';
const COUNTER_KEY = 'van_sales_counter';

// Helper: Delay for mock API
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Get from localStorage
const getStorage = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

// Helper: Set to localStorage
const setStorage = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

/**
 * Generate unique receipt number
 * Format: VS-YYYYMMDD-XXXX
 */
export const generateReceiptNumber = (): string => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // Get today's counter
    const counterData = localStorage.getItem(COUNTER_KEY);
    const counters: Record<string, number> = counterData ? JSON.parse(counterData) : {};

    // Increment counter for today
    const currentCount = (counters[dateStr] || 0) + 1;
    counters[dateStr] = currentCount;

    // Save updated counter
    localStorage.setItem(COUNTER_KEY, JSON.stringify(counters));

    // Format: VS-20260110-0001
    const sequenceNum = currentCount.toString().padStart(4, '0');
    return `VS-${dateStr}-${sequenceNum}`;
};

/**
 * Calculate sale totals
 */
export const calculateSaleTotals = (
    items: VanSaleFormData['items'],
    taxRate: number
): { subtotal: number; taxAmount: number; total: number } => {
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    return {
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        total: Number(total.toFixed(2))
    };
};

/**
 * Create a new van sale with ERP-grade payment logic
 */
export const createVanSale = async (formData: VanSaleFormData): Promise<VanSale> => {
    await delay(500);

    // Calculate totals
    const { subtotal, taxAmount, total } = calculateSaleTotals(formData.items, formData.tax_rate);

    // Calculate payment details based on payment method
    let changeGiven = 0;
    let accountsReceivable = 0;
    let paymentStatus: VanSale['payment_status'] = 'paid';

    switch (formData.payment_method) {
        case 'cash':
            // Cash can have change
            changeGiven = Math.max(0, formData.amount_received - total);
            accountsReceivable = 0;
            paymentStatus = 'paid';
            break;

        case 'card':
        case 'digital':
            // Card/Digital must be exact amount
            changeGiven = 0;
            accountsReceivable = 0;
            paymentStatus = 'paid';
            break;

        case 'credit_no_advance':
            // Full credit - no payment received
            changeGiven = 0;
            accountsReceivable = total;
            paymentStatus = 'unpaid';
            break;

        case 'credit_with_advance':
            // Partial advance + credit
            changeGiven = 0;
            accountsReceivable = total - formData.amount_received;
            paymentStatus = 'partial';
            break;

        case 'cash_credit_split':
            // Cash + Credit split
            changeGiven = 0;
            accountsReceivable = total - formData.amount_received;
            paymentStatus = formData.amount_received > 0 ? 'partial' : 'unpaid';
            break;

        default:
            throw new Error('Invalid payment method');
    }

    const outstandingBalance = accountsReceivable;

    // Get customer and van details for display
    const customers = await getCustomers();
    const customer = customers.find(c => c.id === formData.customer_id);

    const vans = await vanService.getAll();
    const van = vans.find(v => v.id === formData.van_id);

    // Create sale record
    const newSale: VanSale = {
        id: crypto.randomUUID(),
        receipt_number: generateReceiptNumber(),
        van_id: formData.van_id,
        driver_name: van?.driver_name,
        customer_id: formData.customer_id,
        customer_name: customer?.name,
        sale_date: new Date().toISOString(),
        items: formData.items,
        subtotal,
        tax_rate: formData.tax_rate,
        tax_amount: taxAmount,
        total_amount: total,
        payment_method: formData.payment_method,
        amount_received: formData.amount_received,
        change_given: changeGiven,
        accounts_receivable: accountsReceivable,
        payment_status: paymentStatus,
        outstanding_balance: outstandingBalance,
        status: 'completed',
        notes: formData.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    // Save to storage
    const sales = getStorage<VanSale>(STORAGE_KEY);
    setStorage(STORAGE_KEY, [newSale, ...sales]);

    // Update product inventory (decrease stock)
    await updateProductInventory(formData.items);

    // Update customer balance if credit is involved
    if (accountsReceivable > 0) {
        await updateCustomerBalance(formData.customer_id, accountsReceivable);
    }

    // Create ledger entry for this van sale
    await addLedgerEntry({
        customer_id: formData.customer_id,
        date: newSale.sale_date,
        type: 'van_sale',
        amount: total,
        balance: 0, // Will be calculated by addLedgerEntry
        description: `Van Sale - ${newSale.receipt_number}`,
        reference: newSale.receipt_number,
        invoice_number: newSale.receipt_number,
        payment_method: formData.payment_method,
        van_number: van?.van_number || `Van ${formData.van_id}`,
        salesman_name: van?.driver_name || 'Unknown'
    });

    return newSale;
};

/**
 * Update product inventory after sale
 */
const updateProductInventory = async (items: VanSaleFormData['items']): Promise<void> => {
    const products = getStorage<any>('products');

    items.forEach(item => {
        const productIndex = products.findIndex(p => p.id === item.product_id);
        if (productIndex !== -1) {
            // Decrease stock quantity
            if (products[productIndex].stock_quantity !== undefined) {
                products[productIndex].stock_quantity -= item.quantity;
            }

            // Update last sold date
            products[productIndex].last_sold_date = new Date().toISOString();
        }
    });

    setStorage('products', products);
};

/**
 * Update customer balance for credit sales
 */
const updateCustomerBalance = async (customerId: string, creditAmount: number): Promise<void> => {
    const customers = getStorage<any>('customers');

    const customerIndex = customers.findIndex(c => c.id === customerId);
    if (customerIndex !== -1) {
        // Increase customer's balance (negative balance = they owe us)
        const currentBalance = customers[customerIndex].balance || 0;
        customers[customerIndex].balance = currentBalance - creditAmount;

        setStorage('customers', customers);
    }
};

/**
 * Get all van sales
 */
export const getVanSales = async (): Promise<VanSale[]> => {
    await delay(300);
    return getStorage<VanSale>(STORAGE_KEY);
};

/**
 * Get van sale by ID
 */
export const getVanSale = async (id: string): Promise<VanSale | null> => {
    await delay(200);
    const sales = getStorage<VanSale>(STORAGE_KEY);
    return sales.find(sale => sale.id === id) || null;
};

/**
 * Get van sale by receipt number
 */
export const getVanSaleByReceipt = async (receiptNumber: string): Promise<VanSale | null> => {
    await delay(200);
    const sales = getStorage<VanSale>(STORAGE_KEY);
    return sales.find(sale => sale.receipt_number === receiptNumber) || null;
};

/**
 * Get sales for a specific van
 */
export const getVanSalesByVan = async (vanId: string): Promise<VanSale[]> => {
    await delay(300);
    const sales = getStorage<VanSale>(STORAGE_KEY);
    return sales.filter(sale => sale.van_id === vanId);
};

/**
 * Get sales for a specific customer
 */
export const getVanSalesByCustomer = async (customerId: string): Promise<VanSale[]> => {
    await delay(300);
    const sales = getStorage<VanSale>(STORAGE_KEY);
    return sales.filter(sale => sale.customer_id === customerId);
};

/**
 * Get sales for a specific date range
 */
export const getVanSalesByDateRange = async (
    startDate: string,
    endDate: string
): Promise<VanSale[]> => {
    await delay(300);
    const sales = getStorage<VanSale>(STORAGE_KEY);
    return sales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
    });
};

/**
 * Get van sales statistics
 */
export const getVanSalesStats = async (): Promise<VanSalesStats> => {
    await delay(300);
    const sales = getStorage<VanSale>(STORAGE_KEY);

    const completedSales = sales.filter(s => s.status === 'completed');

    const stats: VanSalesStats = {
        total_sales: completedSales.length,
        total_amount: completedSales.reduce((sum, s) => sum + s.total_amount, 0),
        cash_sales: completedSales.filter(s => s.payment_method === 'cash').length,
        card_sales: completedSales.filter(s => s.payment_method === 'card').length,
        digital_sales: completedSales.filter(s => s.payment_method === 'digital').length,
        credit_sales: completedSales.filter(s =>
            s.payment_method === 'credit_no_advance' ||
            s.payment_method === 'credit_with_advance' ||
            s.payment_method === 'cash_credit_split'
        ).length,
        average_sale: 0
    };

    stats.average_sale = stats.total_sales > 0
        ? stats.total_amount / stats.total_sales
        : 0;

    return stats;
};

/**
 * Get daily summary for a specific van
 */
export const getVanDailySummary = async (
    vanId: string,
    date: string
): Promise<VanDailySummary> => {
    await delay(300);

    const sales = getStorage<VanSale>(STORAGE_KEY);
    const targetDate = new Date(date).toISOString().slice(0, 10);

    const vanSales = sales.filter(sale => {
        const saleDate = new Date(sale.sale_date).toISOString().slice(0, 10);
        return sale.van_id === vanId && saleDate === targetDate && sale.status === 'completed';
    });

    const vans = await vanService.getAll();
    const van = vans.find(v => v.id === vanId);

    const summary: VanDailySummary = {
        van_id: vanId,
        van_name: van?.van_number || `Van ${vanId}`,
        driver_name: van?.driver_name,
        date: targetDate,
        total_sales: vanSales.length,
        total_amount: vanSales.reduce((sum, s) => sum + s.total_amount, 0),
        cash_collected: vanSales
            .filter(s => s.payment_method === 'cash')
            .reduce((sum, s) => sum + s.amount_received, 0),
        card_collected: vanSales
            .filter(s => s.payment_method === 'card')
            .reduce((sum, s) => sum + s.amount_received, 0),
        digital_collected: vanSales
            .filter(s => s.payment_method === 'digital')
            .reduce((sum, s) => sum + s.amount_received, 0),
        credit_extended: vanSales
            .filter(s =>
                s.payment_method === 'credit_no_advance' ||
                s.payment_method === 'credit_with_advance' ||
                s.payment_method === 'cash_credit_split'
            )
            .reduce((sum, s) => sum + s.outstanding_balance, 0),
        sales: vanSales
    };

    return summary;
};

/**
 * Cancel a van sale
 */
export const cancelVanSale = async (id: string, reason?: string): Promise<VanSale> => {
    await delay(300);

    const sales = getStorage<VanSale>(STORAGE_KEY);
    const saleIndex = sales.findIndex(s => s.id === id);

    if (saleIndex === -1) {
        throw new Error('Sale not found');
    }

    // Update status
    sales[saleIndex].status = 'cancelled';
    sales[saleIndex].notes = reason
        ? `${sales[saleIndex].notes || ''}\nCancelled: ${reason}`
        : sales[saleIndex].notes;
    sales[saleIndex].updated_at = new Date().toISOString();

    // Restore inventory
    const products = getStorage<any>('products');
    sales[saleIndex].items.forEach(item => {
        const productIndex = products.findIndex(p => p.id === item.product_id);
        if (productIndex !== -1 && products[productIndex].stock_quantity !== undefined) {
            products[productIndex].stock_quantity += item.quantity;
        }
    });
    setStorage('products', products);

    setStorage(STORAGE_KEY, sales);

    return sales[saleIndex];
};

// Export service object
export const vanSalesService = {
    create: createVanSale,
    getAll: getVanSales,
    getById: getVanSale,
    getByReceipt: getVanSaleByReceipt,
    getByVan: getVanSalesByVan,
    getByCustomer: getVanSalesByCustomer,
    getByDateRange: getVanSalesByDateRange,
    getStats: getVanSalesStats,
    getDailySummary: getVanDailySummary,
    cancel: cancelVanSale,
    generateReceiptNumber,
    calculateTotals: calculateSaleTotals
};
