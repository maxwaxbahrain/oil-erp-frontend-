import { getInvoices } from './api';
import { getPurchaseOrders } from './purchasesService';
import { getExpenses } from './expenseService';
import { getProducts } from './productService';
import { calculateCashFlow } from './profitLossService';
import { getFinancialSettings, calculateDepreciation } from './financialSettingsService';

export interface BalanceSheet {
    asOfDate: string;
    assets: {
        currentAssets: {
            cash: number;
            accountsReceivable: number;
            inventory: number;
            totalCurrent: number;
        };
        fixedAssets: {
            propertyPlantEquipment: number;
            accumulatedDepreciation: number;
            netFixedAssets: number;
        };
        otherAssets: number;
        totalAssets: number;
    };
    liabilities: {
        currentLiabilities: {
            accountsPayable: number;
            shortTermDebt: number;
            totalCurrent: number;
        };
        longTermLiabilities: {
            longTermDebt: number;
            totalLongTerm: number;
        };
        totalLiabilities: number;
    };
    equity: {
        ownersCapital: number;
        retainedEarnings: number;
        totalEquity: number;
    };
}

// ============================================================================
// BALANCE SHEET CALCULATION
// ============================================================================

export async function calculateBalanceSheet(): Promise<BalanceSheet> {
    const products = await getProducts();
    const invoices = await getInvoices();
    const purchaseOrders = await getPurchaseOrders();
    const expenses = await getExpenses();

    // Get financial settings for configurable parameters
    const financialSettings = getFinancialSettings();

    // Get cash flow to determine current cash balance
    const cashFlow = await calculateCashFlow(12); // Last 12 months
    const cash = cashFlow.closingBalance;

    // ========== CURRENT ASSETS ==========
    // Accounts Receivable = Unpaid Invoices
    const accountsReceivable = invoices
        .filter(inv => inv.payment_status === 'Unpaid')
        .reduce((sum, inv) => sum + inv.grandTotal, 0);

    // Inventory = Current stock value
    const inventory = products.reduce((sum, p) => {
        const stock = p.locations?.reduce((s, loc) => s + (loc.currentStock ?? 0), 0) || 0;
        const cost = p.pricing?.landedCost || p.pricing?.sellingPrice || 0;
        return sum + (stock * cost);
    }, 0);

    const totalCurrentAssets = cash + accountsReceivable + inventory;

    // ========== FIXED ASSETS ==========
    // Equipment purchases from expenses (all-time, not just current period)
    const equipmentPurchases = expenses
        .filter(exp => exp.category?.toLowerCase().includes('equipment') ||
            exp.category?.toLowerCase().includes('asset') ||
            exp.category?.toLowerCase().includes('property'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate years since first equipment purchase for depreciation
    const equipmentDates = expenses
        .filter(exp => exp.category?.toLowerCase().includes('equipment') ||
            exp.category?.toLowerCase().includes('asset') ||
            exp.category?.toLowerCase().includes('property'))
        .map(exp => new Date(exp.date));

    const firstPurchaseDate = equipmentDates.length > 0
        ? new Date(Math.min(...equipmentDates.map(d => d.getTime())))
        : new Date();

    const yearsSinceFirstPurchase = (new Date().getTime() - firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

    // Use financial settings for depreciation calculation
    const accumulatedDepreciation = calculateDepreciation(equipmentPurchases, yearsSinceFirstPurchase);
    const netFixedAssets = Math.max(0, equipmentPurchases - accumulatedDepreciation);

    // ========== OTHER ASSETS ==========
    const otherAssets = 0; // Can be enhanced with intangibles, investments, etc.

    const totalAssets = totalCurrentAssets + netFixedAssets + otherAssets;

    // ========== CURRENT LIABILITIES ==========
    // Accounts Payable = Unpaid Purchase Orders
    const accountsPayable = purchaseOrders
        .filter(po => po.payment_status === 'Unpaid')
        .reduce((sum, po) => sum + po.grandTotal, 0);

    // Short-term debt from financial settings
    const shortTermDebt = financialSettings.shortTermDebt;
    const totalCurrentLiabilities = accountsPayable + shortTermDebt;

    // ========== LONG-TERM LIABILITIES ==========
    // Long-term debt from financial settings
    const longTermDebt = financialSettings.longTermDebt;
    const totalLongTermLiabilities = longTermDebt;

    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

    // ========== EQUITY ==========
    // Owner's Capital from financial settings
    const ownersCapital = financialSettings.ownersCapital;

    // Retained Earnings MUST be calculated to balance the accounting equation:
    // Assets = Liabilities + Equity
    // Therefore: Retained Earnings = Assets - Liabilities - Owner's Capital
    // 
    // This ensures the balance sheet always balances and reflects the true
    // accumulated wealth/profit of the business that hasn't been distributed.
    const retainedEarnings = totalAssets - totalLiabilities - ownersCapital;

    const totalEquity = ownersCapital + retainedEarnings;

    return {
        asOfDate: new Date().toISOString().split('T')[0],
        assets: {
            currentAssets: {
                cash,
                accountsReceivable,
                inventory,
                totalCurrent: totalCurrentAssets
            },
            fixedAssets: {
                propertyPlantEquipment: equipmentPurchases,
                accumulatedDepreciation,
                netFixedAssets
            },
            otherAssets,
            totalAssets
        },
        liabilities: {
            currentLiabilities: {
                accountsPayable,
                shortTermDebt,
                totalCurrent: totalCurrentLiabilities
            },
            longTermLiabilities: {
                longTermDebt,
                totalLongTerm: totalLongTermLiabilities
            },
            totalLiabilities
        },
        equity: {
            ownersCapital,
            retainedEarnings,
            totalEquity
        }
    };
}

