// Expense Management Service

export interface ExpenseCategory {
    id: string;
    name: string;
    parentCategory: string;
    type: 'Operating' | 'Employee' | 'Marketing' | 'Administrative' | 'Inventory' | 'Asset' | 'Financial' | 'Miscellaneous';
    description?: string;
    isRecurring?: boolean;
    taxTreatment?: string;
    accountCode?: string;
    createdAt: string;
}

export interface Expense {
    id: string;
    category: string;
    amount: number;
    currency: string;
    date: string;
    vendor: string;
    description: string;
    paymentMethod: 'Cash' | 'Card' | 'Bank Transfer' | 'Check' | 'Other';
    receiptUrl?: string;
    taxAmount?: number;
    status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Paid';
    isRecurring: boolean;
    recurringFrequency?: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
    approvedBy?: string;
    approvedAt?: string;
    createdBy: string;
    createdAt: string;
    aiExtracted?: boolean;
    aiConfidence?: number;
}

export interface AIExtractedData {
    vendor: string;
    amount: number;
    date: string;
    items: string[];
    taxAmount: number;
    suggestedCategory: string;
    confidence: number;
    currency: string;
}

const EXPENSES_KEY = 'zavi_expenses';
const EXPENSE_CATEGORIES_KEY = 'zavi_expense_categories';

// Default comprehensive expense categories
const getInitialExpenseCategories = (): ExpenseCategory[] => {
    const stored = localStorage.getItem(EXPENSE_CATEGORIES_KEY);
    if (stored) return JSON.parse(stored);

    const categories: ExpenseCategory[] = [
        // Operating Expenses
        { id: 'EXP-001', name: 'Rent & Utilities', parentCategory: 'Operating Expenses', type: 'Operating', description: 'Office rent and building costs', createdAt: new Date().toISOString() },
        { id: 'EXP-002', name: 'Electricity', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },
        { id: 'EXP-003', name: 'Water', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },
        { id: 'EXP-004', name: 'Internet & Phone', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },
        { id: 'EXP-005', name: 'Office Supplies', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },
        { id: 'EXP-006', name: 'Maintenance & Repairs', parentCategory: 'Operating Expenses', type: 'Operating', createdAt: new Date().toISOString() },

        // Employee Expenses
        { id: 'EXP-007', name: 'Salaries & Wages', parentCategory: 'Employee Expenses', type: 'Employee', isRecurring: true, createdAt: new Date().toISOString() },
        { id: 'EXP-008', name: 'Benefits & Insurance', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },
        { id: 'EXP-009', name: 'Travel & Accommodation', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },
        { id: 'EXP-010', name: 'Meals & Entertainment', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },
        { id: 'EXP-011', name: 'Training & Development', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },
        { id: 'EXP-012', name: 'Fuel & Transportation', parentCategory: 'Employee Expenses', type: 'Employee', createdAt: new Date().toISOString() },

        // Marketing & Sales
        { id: 'EXP-013', name: 'Advertising', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },
        { id: 'EXP-014', name: 'Social Media Marketing', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },
        { id: 'EXP-015', name: 'Promotional Materials', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },
        { id: 'EXP-016', name: 'Events & Exhibitions', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },
        { id: 'EXP-017', name: 'Commission & Incentives', parentCategory: 'Marketing & Sales', type: 'Marketing', createdAt: new Date().toISOString() },

        // Administrative
        { id: 'EXP-018', name: 'Legal & Professional Fees', parentCategory: 'Administrative', type: 'Administrative', createdAt: new Date().toISOString() },
        { id: 'EXP-019', name: 'Accounting Services', parentCategory: 'Administrative', type: 'Administrative', createdAt: new Date().toISOString() },
        { id: 'EXP-020', name: 'Bank Charges', parentCategory: 'Administrative', type: 'Administrative', createdAt: new Date().toISOString() },
        { id: 'EXP-021', name: 'Software Subscriptions', parentCategory: 'Administrative', type: 'Administrative', isRecurring: true, createdAt: new Date().toISOString() },
        { id: 'EXP-022', name: 'Licenses & Permits', parentCategory: 'Administrative', type: 'Administrative', createdAt: new Date().toISOString() },

        // Inventory & Purchasing
        { id: 'EXP-023', name: 'Raw Materials', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },
        { id: 'EXP-024', name: 'Finished Goods', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },
        { id: 'EXP-025', name: 'Packaging Materials', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },
        { id: 'EXP-026', name: 'Shipping & Freight', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },
        { id: 'EXP-027', name: 'Import Duties', parentCategory: 'Inventory & Purchasing', type: 'Inventory', createdAt: new Date().toISOString() },

        // Asset Related
        { id: 'EXP-028', name: 'Equipment Purchase', parentCategory: 'Asset Related', type: 'Asset', createdAt: new Date().toISOString() },
        { id: 'EXP-029', name: 'Vehicle Expenses', parentCategory: 'Asset Related', type: 'Asset', createdAt: new Date().toISOString() },
        { id: 'EXP-030', name: 'Depreciation', parentCategory: 'Asset Related', type: 'Asset', createdAt: new Date().toISOString() },
        { id: 'EXP-031', name: 'Asset Maintenance', parentCategory: 'Asset Related', type: 'Asset', createdAt: new Date().toISOString() },

        // Financial
        { id: 'EXP-032', name: 'Loan Interest', parentCategory: 'Financial', type: 'Financial', createdAt: new Date().toISOString() },
        { id: 'EXP-033', name: 'Credit Card Fees', parentCategory: 'Financial', type: 'Financial', createdAt: new Date().toISOString() },
        { id: 'EXP-034', name: 'Investment Costs', parentCategory: 'Financial', type: 'Financial', createdAt: new Date().toISOString() },
        { id: 'EXP-035', name: 'Insurance Premiums', parentCategory: 'Financial', type: 'Financial', createdAt: new Date().toISOString() },

        // Miscellaneous
        { id: 'EXP-036', name: 'Donations', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
        { id: 'EXP-037', name: 'Penalties & Fines', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
        { id: 'EXP-038', name: 'Refunds & Returns', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
        { id: 'EXP-039', name: 'Petty Cash', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
        { id: 'EXP-040', name: 'Other Expenses', parentCategory: 'Miscellaneous', type: 'Miscellaneous', createdAt: new Date().toISOString() },
    ];

    localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(categories));
    return categories;
};

const getInitialExpenses = (): Expense[] => {
    const stored = localStorage.getItem(EXPENSES_KEY);
    if (stored) return JSON.parse(stored);

    // Sample expenses
    const expenses: Expense[] = [
        {
            id: 'E-001',
            category: 'Electricity',
            amount: 450,
            currency: 'USD',
            date: '2024-12-28',
            vendor: 'Power Company',
            description: 'Monthly electricity bill',
            paymentMethod: 'Bank Transfer',
            status: 'Approved',
            isRecurring: true,
            recurringFrequency: 'Monthly',
            createdBy: 'Admin',
            createdAt: new Date().toISOString()
        },
        {
            id: 'E-002',
            category: 'Rent & Utilities',
            amount: 2000,
            currency: 'USD',
            date: '2024-12-01',
            vendor: 'Property Management LLC',
            description: 'Office rent - December',
            paymentMethod: 'Bank Transfer',
            status: 'Paid',
            isRecurring: true,
            recurringFrequency: 'Monthly',
            createdBy: 'Admin',
            createdAt: new Date().toISOString()
        }
    ];

    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
    return expenses;
};

// Expense CRUD operations
export async function getExpenses(): Promise<Expense[]> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(getInitialExpenses()), 100);
    });
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(getInitialExpenseCategories()), 100);
    });
}

export async function saveExpense(expense: Partial<Expense>): Promise<Expense> {
    return new Promise((resolve) => {
        const expenses = getInitialExpenses();
        let savedExpense: Expense;

        if (expense.id) {
            const index = expenses.findIndex(e => e.id === expense.id);
            if (index !== -1) {
                expenses[index] = { ...expenses[index], ...expense } as Expense;
                savedExpense = expenses[index];
            } else {
                savedExpense = { ...expense, id: expense.id } as Expense;
                expenses.push(savedExpense);
            }
        } else {
            savedExpense = {
                ...expense,
                id: `E-${Date.now()}`,
                createdAt: new Date().toISOString(),
                status: expense.status || 'Draft',
                currency: expense.currency || 'USD',
                createdBy: 'Current User'
            } as Expense;
            expenses.push(savedExpense);
        }

        localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
        setTimeout(() => resolve(savedExpense), 100);
    });
}

export async function saveExpenseCategory(category: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    return new Promise((resolve) => {
        const categories = getInitialExpenseCategories();
        let savedCategory: ExpenseCategory;

        if (category.id) {
            const index = categories.findIndex(c => c.id === category.id);
            if (index !== -1) {
                categories[index] = { ...categories[index], ...category } as ExpenseCategory;
                savedCategory = categories[index];
            } else {
                savedCategory = { ...category, id: category.id } as ExpenseCategory;
                categories.push(savedCategory);
            }
        } else {
            savedCategory = {
                ...category,
                id: `EXP-${Date.now()}`,
                createdAt: new Date().toISOString()
            } as ExpenseCategory;
            categories.push(savedCategory);
        }

        localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(categories));
        setTimeout(() => resolve(savedCategory), 100);
    });
}

export async function deleteExpense(id: string): Promise<void> {
    return new Promise((resolve) => {
        const expenses = getInitialExpenses();
        const filtered = expenses.filter(e => e.id !== id);
        localStorage.setItem(EXPENSES_KEY, JSON.stringify(filtered));
        setTimeout(() => resolve(), 300);
    });
}

// AI-powered expense extraction (simulated)
export async function extractExpenseFromReceipt(_file: File): Promise<AIExtractedData> {
    return new Promise((resolve) => {
        // Simulate AI processing delay
        setTimeout(() => {
            // Mock AI extraction - in real implementation, this would call OCR/AI service
            const mockData: AIExtractedData = {
                vendor: 'Amazon Web Services',
                amount: 156.75,
                date: new Date().toISOString().split('T')[0],
                items: ['Cloud Storage', 'EC2 Instance', 'Data Transfer'],
                taxAmount: 6.75,
                suggestedCategory: 'Software Subscriptions',
                confidence: 95,
                currency: 'USD'
            };
            resolve(mockData);
        }, 2000);
    });
}

// LLM-powered custom expense head creator (simulated)
export async function generateExpenseHeadWithAI(_description: string): Promise<{
    name: string;
    parentCategory: string;
    type: string;
    isRecurring: boolean;
    taxTreatment: string;
    accountCode: string;
    similarCategories: string[];
}> {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Mock LLM response - in real implementation, this would call GPT-4/Claude
            const mockResponse = {
                name: 'Email Marketing Tools',
                parentCategory: 'Software Subscriptions',
                type: 'Administrative',
                isRecurring: true,
                taxTreatment: 'Digital Services',
                accountCode: 'ACC-' + Math.floor(1000 + Math.random() * 9000),
                similarCategories: ['Marketing Software', 'Cloud Services', 'SaaS Subscriptions']
            };
            resolve(mockResponse);
        }, 1500);
    });
}
