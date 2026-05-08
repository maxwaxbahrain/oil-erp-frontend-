import { getSalesOrders } from './salesService';
import { getInvoices } from './api';
import { getPurchaseOrders } from './purchasesService';
import { getExpenses } from './expenseService';
import { getProducts } from './productService';
import { getCustomers } from './customerService';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProfitLossStatement {
    period: {
        startDate: string;
        endDate: string;
        label: string;
    };
    revenue: {
        productSales: number;
        serviceRevenue: number;
        otherRevenue: number;
        totalRevenue: number;
    };
    cogs: {
        rawMaterials: number;
        directLabor: number;
        freight: number;
        totalCOGS: number;
    };
    grossProfit: {
        amount: number;
        margin: number; // percentage
    };
    operatingExpenses: {
        salariesWages: number;
        marketing: number;
        rentUtilities: number;
        transportation: number;
        administrative: number;
        depreciation: number;
        other: number;
        totalOpEx: number;
    };
    operatingProfit: {
        amount: number;
        margin: number;
    };
    otherIncomeExpenses: {
        interestIncome: number;
        interestExpense: number;
        otherIncome: number;
        otherExpenses: number;
        netOther: number;
    };
    netProfit: {
        beforeTax: number;
        taxExpense: number;
        afterTax: number;
        margin: number;
    };
}

export interface CashFlowStatement {
    period: {
        startDate: string;
        endDate: string;
    };
    operating: {
        cashFromCustomers: number;
        cashToSuppliers: number;
        payroll: number;
        operatingExpenses: number;
        netOperating: number;
    };
    investing: {
        equipmentPurchases: number;
        assetSales: number;
        netInvesting: number;
    };
    financing: {
        loans: number;
        repayments: number;
        dividends: number;
        netFinancing: number;
    };
    openingBalance: number;
    closingBalance: number;
    netChange: number;
}

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

export interface DimensionalAnalysis {
    byCustomer: Array<{
        customerId: string;
        customerName: string;
        revenue: number;
        profit: number;
        margin: number;
        costToServe: number;
    }>;
    byProduct: Array<{
        productId: string;
        productName: string;
        revenue: number;
        cogs: number;
        profit: number;
        margin: number;
        unitsSold: number;
    }>;
    bySalesman: Array<{
        employeeId: string;
        employeeName: string;
        revenue: number;
        profit: number;
        margin: number;
        ordersCount: number;
    }>;
    byChannel: Array<{
        channel: string;
        revenue: number;
        profit: number;
        margin: number;
    }>;
}

export interface FinancialRatios {
    profitability: {
        grossMargin: number;
        operatingMargin: number;
        netMargin: number;
        roa: number;
        roe: number;
        roce: number;
    };
    efficiency: {
        operatingExpenseRatio: number;
        payrollCostRatio: number;
        revenuePerEmployee: number;
        inventoryTurnover: number;
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDateRange(months: number = 1): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    return { startDate, endDate };
}

function isWithinPeriod(date: string, startDate: Date, endDate: Date): boolean {
    const d = new Date(date);
    return d >= startDate && d <= endDate;
}

// ============================================================================
// PROFIT & LOSS CALCULATION
// ============================================================================

export async function calculateProfitLoss(months: number = 1): Promise<ProfitLossStatement> {
    const { startDate, endDate } = getDateRange(months);

    // Get all data
    const salesOrders = await getSalesOrders();
    const invoices = await getInvoices();
    const purchaseOrders = await getPurchaseOrders();
    const expenses = await getExpenses();
    const products = await getProducts();

    // Filter by period
    const periodSales = salesOrders.filter(so =>
        isWithinPeriod(so.order_date, startDate, endDate) &&
        (so.status === 'delivered' || so.status === 'confirmed')
    );

    const periodInvoices = invoices.filter(inv =>
        isWithinPeriod(inv.invoiceDate, startDate, endDate)
    );

    const periodPurchases = purchaseOrders.filter(po =>
        isWithinPeriod(po.date, startDate, endDate) &&
        (po.status === 'Received' || po.status === 'Completed')
    );

    const periodExpenses = expenses.filter(exp =>
        isWithinPeriod(exp.date, startDate, endDate) &&
        exp.status === 'Paid'
    );

    // ========== REVENUE CALCULATION ==========
    // Product sales from invoices (most accurate)
    const productSales = periodInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

    // Service revenue (if any service items exist)
    const serviceRevenue = 0; // Can be enhanced if you have service items

    // Other revenue
    const otherRevenue = 0;

    const totalRevenue = productSales + serviceRevenue + otherRevenue;

    // ========== COGS CALCULATION ==========
    // Calculate COGS based on products sold
    let rawMaterials = 0;

    periodSales.forEach(sale => {
        sale.items.forEach(item => {
            const product = products.find(p => p.id === item.product_id || p.name === item.product_name);
            if (product && product.pricing) {
                // Use landed cost as COGS
                const unitCost = product.pricing.landedCost || product.pricing.sellingPrice || 0;
                rawMaterials += unitCost * item.quantity;
            }
        });
    });

    // Direct labor from purchase orders (if applicable)
    const directLabor = periodPurchases
        .filter(po => po.items.some(item => item.productName?.toLowerCase().includes('labor')))
        .reduce((sum, po) => sum + po.grandTotal, 0);

    // Freight/shipping costs from expenses
    const freight = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('freight') ||
            exp.category?.toLowerCase().includes('shipping'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const totalCOGS = rawMaterials + directLabor + freight;

    // ========== GROSS PROFIT ==========
    const grossProfitAmount = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? (grossProfitAmount / totalRevenue) * 100 : 0;

    // ========== OPERATING EXPENSES ==========
    // Salaries & Wages from expenses (payroll expenses)
    const salariesWages = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('salary') ||
            exp.category?.toLowerCase().includes('payroll') ||
            exp.category?.toLowerCase().includes('wage'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    // Categorize expenses
    const marketing = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('marketing') ||
            exp.category?.toLowerCase().includes('advertising'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const rentUtilities = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('rent') ||
            exp.category?.toLowerCase().includes('utilities') ||
            exp.category?.toLowerCase().includes('electricity'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const transportation = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('transport') ||
            exp.category?.toLowerCase().includes('fuel') ||
            exp.category?.toLowerCase().includes('vehicle'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const administrative = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('admin') ||
            exp.category?.toLowerCase().includes('office') ||
            exp.category?.toLowerCase().includes('supplies'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const depreciation = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('depreciation'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    // Other expenses (not categorized above)
    const categorizedExpenseAmount = marketing + rentUtilities + transportation + administrative + depreciation + freight + salariesWages;
    const totalExpenseAmount = periodExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const other = totalExpenseAmount - categorizedExpenseAmount;

    const totalOpEx = salariesWages + marketing + rentUtilities + transportation + administrative + depreciation + other;

    // ========== OPERATING PROFIT ==========
    const operatingProfitAmount = grossProfitAmount - totalOpEx;
    const operatingMargin = totalRevenue > 0 ? (operatingProfitAmount / totalRevenue) * 100 : 0;

    // ========== OTHER INCOME/EXPENSES ==========
    const interestIncome = 0; // Can be enhanced
    const interestExpense = 0; // Can be enhanced
    const otherIncome = 0;
    const otherExpenses = 0;
    const netOther = interestIncome - interestExpense + otherIncome - otherExpenses;

    // ========== NET PROFIT ==========
    const netProfitBeforeTax = operatingProfitAmount + netOther;

    // Tax calculation (if tax expenses exist)
    const taxExpense = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('tax'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const netProfitAfterTax = netProfitBeforeTax - taxExpense;
    const netMargin = totalRevenue > 0 ? (netProfitAfterTax / totalRevenue) * 100 : 0;

    return {
        period: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            label: months === 1 ? 'Current Month' : `Last ${months} Months`
        },
        revenue: {
            productSales,
            serviceRevenue,
            otherRevenue,
            totalRevenue
        },
        cogs: {
            rawMaterials,
            directLabor,
            freight,
            totalCOGS
        },
        grossProfit: {
            amount: grossProfitAmount,
            margin: grossMargin
        },
        operatingExpenses: {
            salariesWages,
            marketing,
            rentUtilities,
            transportation,
            administrative,
            depreciation,
            other,
            totalOpEx
        },
        operatingProfit: {
            amount: operatingProfitAmount,
            margin: operatingMargin
        },
        otherIncomeExpenses: {
            interestIncome,
            interestExpense,
            otherIncome,
            otherExpenses,
            netOther
        },
        netProfit: {
            beforeTax: netProfitBeforeTax,
            taxExpense,
            afterTax: netProfitAfterTax,
            margin: netMargin
        }
    };
}

// ============================================================================
// CASH FLOW CALCULATION
// ============================================================================

export async function calculateCashFlow(months: number = 1): Promise<CashFlowStatement> {
    const { startDate, endDate } = getDateRange(months);

    const invoices = await getInvoices();
    const purchaseOrders = await getPurchaseOrders();
    const expenses = await getExpenses();

    // ========== CALCULATE OPENING BALANCE ==========
    // Opening balance = All cash received - All cash paid BEFORE the start date
    const historicalInvoices = invoices.filter(inv =>
        new Date(inv.invoiceDate) < startDate && inv.payment_status === 'Paid'
    );
    const historicalPurchases = purchaseOrders.filter(po =>
        new Date(po.date) < startDate && po.payment_status === 'Paid'
    );
    const historicalExpenses = expenses.filter(exp =>
        new Date(exp.date) < startDate && exp.status === 'Paid'
    );

    const totalHistoricalInflows = historicalInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalHistoricalOutflows =
        historicalPurchases.reduce((sum, po) => sum + po.grandTotal, 0) +
        historicalExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Get initial capital from financial settings
    const { getFinancialSettings } = await import('./financialSettingsService');
    const financialSettings = getFinancialSettings();
    const initialCapital = financialSettings.initialCashBalance;
    const openingBalance = initialCapital + totalHistoricalInflows - totalHistoricalOutflows;

    // Filter by period
    const periodInvoices = invoices.filter(inv => isWithinPeriod(inv.invoiceDate, startDate, endDate));
    const periodPurchases = purchaseOrders.filter(po => isWithinPeriod(po.date, startDate, endDate));
    const periodExpenses = expenses.filter(exp => isWithinPeriod(exp.date, startDate, endDate) && exp.status === 'Paid');

    // Operating Activities
    const cashFromCustomers = periodInvoices
        .filter(inv => inv.payment_status === 'Paid')
        .reduce((sum, inv) => sum + inv.grandTotal, 0);

    const cashToSuppliers = periodPurchases
        .filter(po => po.payment_status === 'Paid')
        .reduce((sum, po) => sum + po.grandTotal, 0);

    const payroll = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('salary') ||
            exp.category?.toLowerCase().includes('payroll'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const operatingExpenses = periodExpenses
        .filter(exp => !exp.category?.toLowerCase().includes('salary') &&
            !exp.category?.toLowerCase().includes('payroll') &&
            !exp.category?.toLowerCase().includes('equipment') &&
            !exp.category?.toLowerCase().includes('asset'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const netOperating = cashFromCustomers - cashToSuppliers - payroll - operatingExpenses;

    // Investing Activities
    const equipmentPurchases = periodExpenses
        .filter(exp => exp.category?.toLowerCase().includes('equipment') ||
            exp.category?.toLowerCase().includes('asset'))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const assetSales = 0; // Can be enhanced
    const netInvesting = assetSales - equipmentPurchases;

    // Financing Activities
    const loans = 0; // Can be enhanced
    const repayments = 0; // Can be enhanced
    const dividends = 0; // Can be enhanced
    const netFinancing = loans - repayments - dividends;

    // Calculate balances
    const netChange = netOperating + netInvesting + netFinancing;
    const closingBalance = openingBalance + netChange;

    return {
        period: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        },
        operating: {
            cashFromCustomers,
            cashToSuppliers: -cashToSuppliers,
            payroll: -payroll,
            operatingExpenses: -operatingExpenses,
            netOperating
        },
        investing: {
            equipmentPurchases: -equipmentPurchases,
            assetSales,
            netInvesting
        },
        financing: {
            loans,
            repayments: -repayments,
            dividends: -dividends,
            netFinancing
        },
        openingBalance,
        closingBalance,
        netChange
    };
}

// ============================================================================
// DIMENSIONAL ANALYSIS
// ============================================================================

export async function calculateDimensionalAnalysis(months: number = 1): Promise<DimensionalAnalysis> {
    const { startDate, endDate } = getDateRange(months);

    const salesOrders = await getSalesOrders();
    const products = await getProducts();
    const customers = await getCustomers();

    const periodSales = salesOrders.filter(so =>
        isWithinPeriod(so.order_date, startDate, endDate) &&
        (so.status === 'delivered' || so.status === 'confirmed')
    );

    // BY CUSTOMER
    const customerMap = new Map<string, { revenue: number; profit: number; orders: number }>();

    periodSales.forEach(sale => {
        const customerId = sale.customer_id || 'unknown';
        const data = customerMap.get(customerId) || { revenue: 0, profit: 0, orders: 0 };

        let saleRevenue = 0;
        let saleProfit = 0;

        sale.items.forEach(item => {
            const product = products.find(p => p.id === item.product_id || p.name === item.product_name);
            const itemRevenue = item.unit_price * item.quantity;
            const itemCost = product?.pricing?.landedCost || product?.pricing?.sellingPrice || 0;
            const itemProfit = itemRevenue - (itemCost * item.quantity);

            saleRevenue += itemRevenue;
            saleProfit += itemProfit;
        });

        data.revenue += saleRevenue;
        data.profit += saleProfit;
        data.orders += 1;
        customerMap.set(customerId, data);
    });

    const byCustomer = Array.from(customerMap.entries()).map(([customerId, data]) => {
        const customer = customers.find(c => c.id === customerId);
        return {
            customerId,
            customerName: customer?.name || 'Unknown Customer',
            revenue: data.revenue,
            profit: data.profit,
            margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
            costToServe: data.orders * 500 // Simplified estimate
        };
    }).sort((a, b) => b.profit - a.profit);

    // BY PRODUCT
    const productMap = new Map<string, { revenue: number; cogs: number; units: number }>();

    periodSales.forEach(sale => {
        sale.items.forEach(item => {
            const productId = item.product_id || item.product_name;
            const product = products.find(p => p.id === item.product_id || p.name === item.product_name);
            const data = productMap.get(productId) || { revenue: 0, cogs: 0, units: 0 };

            const itemRevenue = item.unit_price * item.quantity;
            const itemCost = (product?.pricing?.landedCost || product?.pricing?.sellingPrice || 0) * item.quantity;

            data.revenue += itemRevenue;
            data.cogs += itemCost;
            data.units += item.quantity;
            productMap.set(productId, data);
        });
    });

    const byProduct = Array.from(productMap.entries()).map(([productId, data]) => {
        const product = products.find(p => p.id === productId || p.name === productId);
        return {
            productId,
            productName: product?.name || productId,
            revenue: data.revenue,
            cogs: data.cogs,
            profit: data.revenue - data.cogs,
            margin: data.revenue > 0 ? ((data.revenue - data.cogs) / data.revenue) * 100 : 0,
            unitsSold: data.units
        };
    }).sort((a, b) => b.profit - a.profit);

    // BY SALESMAN
    const salesmanMap = new Map<string, { revenue: number; profit: number; orders: number }>();

    periodSales.forEach(sale => {
        const salesmanId = (sale as any).salesman || 'unknown';
        const data = salesmanMap.get(salesmanId) || { revenue: 0, profit: 0, orders: 0 };

        let saleRevenue = 0;
        let saleProfit = 0;

        sale.items.forEach(item => {
            const product = products.find(p => p.id === item.product_id || p.name === item.product_name);
            const itemRevenue = item.unit_price * item.quantity;
            const itemCost = product?.pricing?.landedCost || product?.pricing?.sellingPrice || 0;
            const itemProfit = itemRevenue - (itemCost * item.quantity);

            saleRevenue += itemRevenue;
            saleProfit += itemProfit;
        });

        data.revenue += saleRevenue;
        data.profit += saleProfit;
        data.orders += 1;
        salesmanMap.set(salesmanId, data);
    });

    const bySalesman = Array.from(salesmanMap.entries()).map(([employeeId, data]) => {
        return {
            employeeId,
            employeeName: employeeId === 'unknown' ? 'Unknown Salesman' : employeeId,
            revenue: data.revenue,
            profit: data.profit,
            margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
            ordersCount: data.orders
        };
    }).sort((a, b) => b.profit - a.profit);

    // BY CHANNEL
    const channelMap = new Map<string, { revenue: number; profit: number }>();

    periodSales.forEach(sale => {
        const channel = (sale as any).van_id ? 'Van Sales' : 'Direct Sales';
        const data = channelMap.get(channel) || { revenue: 0, profit: 0 };

        let saleRevenue = 0;
        let saleProfit = 0;

        sale.items.forEach(item => {
            const product = products.find(p => p.id === item.product_id || p.name === item.product_name);
            const itemRevenue = item.unit_price * item.quantity;
            const itemCost = product?.pricing?.landedCost || product?.pricing?.sellingPrice || 0;
            const itemProfit = itemRevenue - (itemCost * item.quantity);

            saleRevenue += itemRevenue;
            saleProfit += itemProfit;
        });

        data.revenue += saleRevenue;
        data.profit += saleProfit;
        channelMap.set(channel, data);
    });

    const byChannel = Array.from(channelMap.entries()).map(([channel, data]) => ({
        channel,
        revenue: data.revenue,
        profit: data.profit,
        margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0
    })).sort((a, b) => b.profit - a.profit);

    return {
        byCustomer,
        byProduct,
        bySalesman,
        byChannel
    };
}

// ============================================================================
// FINANCIAL RATIOS
// ============================================================================

export async function calculateFinancialRatios(): Promise<FinancialRatios> {
    const pl = await calculateProfitLoss(1);
    const products = await getProducts();

    // Import balance sheet calculation to get real values
    const { calculateBalanceSheet } = await import('./balanceSheetService');
    const balanceSheet = await calculateBalanceSheet();

    // Calculate inventory value
    const inventoryValue = products.reduce((sum, p) => {
        const stock = p.locations?.reduce((s, loc) => s + (loc.currentStock ?? 0), 0) || 0;
        const cost = p.pricing?.landedCost || p.pricing?.sellingPrice || 0;
        return sum + (stock * cost);
    }, 0);

    // Use real balance sheet values
    const totalAssets = balanceSheet.assets.totalAssets;
    const totalEquity = balanceSheet.equity.totalEquity;
    const capitalEmployed = totalAssets - balanceSheet.liabilities.currentLiabilities.totalCurrent;

    // Estimate employee count from localStorage
    const employeeCount = 40; // Placeholder - can be enhanced

    return {
        profitability: {
            grossMargin: pl.grossProfit.margin,
            operatingMargin: pl.operatingProfit.margin,
            netMargin: pl.netProfit.margin,
            roa: totalAssets > 0 ? (pl.netProfit.afterTax / totalAssets) * 100 : 0,
            roe: totalEquity > 0 ? (pl.netProfit.afterTax / totalEquity) * 100 : 0,
            roce: capitalEmployed > 0 ? (pl.operatingProfit.amount / capitalEmployed) * 100 : 0
        },
        efficiency: {
            operatingExpenseRatio: pl.revenue.totalRevenue > 0 ? (pl.operatingExpenses.totalOpEx / pl.revenue.totalRevenue) * 100 : 0,
            payrollCostRatio: pl.revenue.totalRevenue > 0 ? (pl.operatingExpenses.salariesWages / pl.revenue.totalRevenue) * 100 : 0,
            revenuePerEmployee: employeeCount > 0 ? pl.revenue.totalRevenue / employeeCount : 0,
            inventoryTurnover: inventoryValue > 0 ? pl.cogs.totalCOGS / inventoryValue : 0
        }
    };
}
