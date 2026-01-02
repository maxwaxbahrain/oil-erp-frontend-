// ============================================
// CUSTOMER SERVICE
// Centralized customer management with mock data support
// ============================================

const API_BASE_URL = 'http://localhost:8000/api';
const USE_MOCK = true; // Enable mock mode by default

// ============================================
// INTERFACES
// ============================================

export interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    balance?: number;
    credit_limit?: number;
    category?: string;
    opening_balance?: number;
    gps_location?: string;
    notes?: string;
    created_at?: string;
    code?: string;
    // Additional fields
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    tax_id?: string;
    payment_terms?: string;
    status?: 'Active' | 'Inactive' | 'Suspended';
}

export interface LedgerEntry {
    id: string;
    customer_id: string;
    date: string;
    type: 'invoice' | 'payment' | 'credit' | 'debit' | 'opening_balance';
    amount: number;
    balance: number;
    description?: string;
    reference?: string;
    invoice_number?: string;
    payment_method?: string;
}

export interface Payment {
    id: string;
    customer_id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference?: string;
    notes?: string;
    created_at?: string;
}

export interface CustomerStats {
    total_customers: number;
    active_customers: number;
    total_receivables: number;
    overdue_amount: number;
    total_sales: number;
    average_order_value: number;
}

// ============================================
// MOCK DATA HELPERS
// ============================================

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getStorage = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

const setStorage = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// Initialize with sample data if empty
const initializeMockData = () => {
    const customers = getStorage<Customer>('customers');
    if (customers.length === 0) {
        const sampleCustomers: Customer[] = [
            {
                id: crypto.randomUUID(),
                name: 'Al-Khaleej Trading Co.',
                email: 'info@alkhaleej.com',
                phone: '+971-4-1234567',
                address: 'Sheikh Zayed Road, Dubai',
                city: 'Dubai',
                country: 'UAE',
                category: 'Wholesale',
                balance: -15000,
                credit_limit: 50000,
                status: 'Active',
                created_at: new Date('2024-01-15').toISOString()
            },
            {
                id: crypto.randomUUID(),
                name: 'Pakistan Motors Ltd.',
                email: 'sales@pakmotors.pk',
                phone: '+92-21-35678901',
                address: 'I.I. Chundrigar Road, Karachi',
                city: 'Karachi',
                country: 'Pakistan',
                category: 'Retail',
                balance: -8500,
                credit_limit: 25000,
                status: 'Active',
                created_at: new Date('2024-02-20').toISOString()
            },
            {
                id: crypto.randomUUID(),
                name: 'Gulf Petroleum Services',
                email: 'contact@gulfpetro.com',
                phone: '+966-11-4567890',
                address: 'King Fahd Road, Riyadh',
                city: 'Riyadh',
                country: 'Saudi Arabia',
                category: 'Wholesale',
                balance: 0,
                credit_limit: 100000,
                status: 'Active',
                created_at: new Date('2024-03-10').toISOString()
            }
        ];
        setStorage('customers', sampleCustomers);
    }
};

// ============================================
// CUSTOMER CRUD OPERATIONS
// ============================================

export async function getCustomers(): Promise<Customer[]> {
    if (USE_MOCK) {
        await delay(400);
        initializeMockData();
        return getStorage<Customer>('customers');
    }

    const response = await fetch(`${API_BASE_URL}/customers`);
    if (!response.ok) throw new Error('Failed to fetch customers');
    return response.json();
}

export async function getCustomer(id: string): Promise<Customer> {
    if (USE_MOCK) {
        await delay(300);
        const customers = getStorage<Customer>('customers');
        const customer = customers.find(c => c.id === id);
        if (!customer) throw new Error('Customer not found');
        return customer;
    }

    const response = await fetch(`${API_BASE_URL}/customers/${id}`);
    if (!response.ok) throw new Error('Failed to fetch customer');
    return response.json();
}

export async function createCustomer(data: Partial<Customer>): Promise<Customer> {
    if (USE_MOCK) {
        await delay(500);
        const customers = getStorage<Customer>('customers');
        const newCustomer: Customer = {
            id: crypto.randomUUID(),
            name: data.name || '',
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            state: data.state,
            country: data.country,
            postal_code: data.postal_code,
            category: data.category || 'Retail',
            balance: data.opening_balance || 0,
            credit_limit: data.credit_limit || 0,
            opening_balance: data.opening_balance,
            gps_location: data.gps_location,
            notes: data.notes,
            tax_id: data.tax_id,
            payment_terms: data.payment_terms || 'Net 30',
            status: data.status || 'Active',
            created_at: new Date().toISOString(),
            code: data.code
        };
        setStorage('customers', [newCustomer, ...customers]);

        // Create opening balance ledger entry if applicable
        if (data.opening_balance && data.opening_balance !== 0) {
            const ledger = getStorage<LedgerEntry>('customer_ledger');
            const openingEntry: LedgerEntry = {
                id: crypto.randomUUID(),
                customer_id: newCustomer.id,
                date: new Date().toISOString(),
                type: 'opening_balance',
                amount: data.opening_balance,
                balance: data.opening_balance,
                description: 'Opening Balance',
                reference: 'OPENING'
            };
            setStorage('customer_ledger', [openingEntry, ...ledger]);
        }

        return newCustomer;
    }

    const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create customer');
    return response.json();
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    if (USE_MOCK) {
        await delay(500);
        const customers = getStorage<Customer>('customers');
        const updatedCustomers = customers.map(c =>
            c.id === id ? { ...c, ...data } : c
        );
        setStorage('customers', updatedCustomers);
        const updated = updatedCustomers.find(c => c.id === id);
        if (!updated) throw new Error('Customer not found');
        return updated;
    }

    const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update customer');
    return response.json();
}

export async function deleteCustomer(id: string): Promise<void> {
    if (USE_MOCK) {
        await delay(400);
        const customers = getStorage<Customer>('customers');
        const filtered = customers.filter(c => c.id !== id);
        setStorage('customers', filtered);
        return;
    }

    const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete customer');
}

// ============================================
// LEDGER OPERATIONS
// ============================================

export async function getCustomerLedger(customerId: string): Promise<LedgerEntry[]> {
    if (USE_MOCK) {
        await delay(400);
        const ledger = getStorage<LedgerEntry>('customer_ledger');
        return ledger
            .filter(entry => entry.customer_id === customerId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const response = await fetch(`${API_BASE_URL}/customers/${customerId}/ledger`);
    if (!response.ok) throw new Error('Failed to fetch customer ledger');
    return response.json();
}

export async function addLedgerEntry(entry: Omit<LedgerEntry, 'id'>): Promise<LedgerEntry> {
    if (USE_MOCK) {
        await delay(400);
        const ledger = getStorage<LedgerEntry>('customer_ledger');

        // Calculate new balance
        const customerLedger = ledger.filter(e => e.customer_id === entry.customer_id);
        const lastBalance = customerLedger.length > 0
            ? customerLedger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].balance
            : 0;

        const newBalance = entry.type === 'payment' || entry.type === 'credit'
            ? lastBalance - entry.amount
            : lastBalance + entry.amount;

        const newEntry: LedgerEntry = {
            ...entry,
            id: crypto.randomUUID(),
            balance: newBalance
        };

        setStorage('customer_ledger', [newEntry, ...ledger]);

        // Update customer balance
        const customers = getStorage<Customer>('customers');
        const updatedCustomers = customers.map(c =>
            c.id === entry.customer_id ? { ...c, balance: newBalance } : c
        );
        setStorage('customers', updatedCustomers);

        return newEntry;
    }

    const response = await fetch(`${API_BASE_URL}/customers/${entry.customer_id}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
    });
    if (!response.ok) throw new Error('Failed to add ledger entry');
    return response.json();
}

// ============================================
// PAYMENT OPERATIONS
// ============================================

export async function getCustomerPayments(customerId: string): Promise<Payment[]> {
    if (USE_MOCK) {
        await delay(400);
        const payments = getStorage<Payment>('payments');
        return payments
            .filter(p => p.customer_id === customerId)
            .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
    }

    const response = await fetch(`${API_BASE_URL}/customers/${customerId}/payments`);
    if (!response.ok) throw new Error('Failed to fetch customer payments');
    return response.json();
}

export async function createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    if (USE_MOCK) {
        await delay(500);
        const payments = getStorage<Payment>('payments');
        const newPayment: Payment = {
            ...payment,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
        };
        setStorage('payments', [newPayment, ...payments]);

        // Add ledger entry
        await addLedgerEntry({
            customer_id: payment.customer_id,
            date: payment.payment_date,
            type: 'payment',
            amount: payment.amount,
            balance: 0, // Will be calculated
            description: `Payment received - ${payment.payment_method}`,
            reference: payment.reference,
            payment_method: payment.payment_method
        });

        return newPayment;
    }

    const response = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment)
    });
    if (!response.ok) throw new Error('Failed to create payment');
    return response.json();
}

// ============================================
// ANALYTICS & REPORTS
// ============================================

export async function getOverdueCustomers(): Promise<Customer[]> {
    if (USE_MOCK) {
        await delay(400);
        const customers = getStorage<Customer>('customers');
        return customers.filter(c => (c.balance || 0) < 0);
    }

    const response = await fetch(`${API_BASE_URL}/customers/overdue`);
    if (!response.ok) throw new Error('Failed to fetch overdue customers');
    return response.json();
}

export async function getCustomerStats(): Promise<CustomerStats> {
    if (USE_MOCK) {
        await delay(400);
        const customers = getStorage<Customer>('customers');

        const total_customers = customers.length;
        const active_customers = customers.filter(c => c.status === 'Active').length;
        const total_receivables = customers.reduce((sum, c) => sum + Math.abs(Math.min(c.balance || 0, 0)), 0);
        const overdue_amount = customers.filter(c => (c.balance || 0) < 0).reduce((sum, c) => sum + Math.abs(c.balance || 0), 0);

        return {
            total_customers,
            active_customers,
            total_receivables,
            overdue_amount,
            total_sales: total_receivables * 1.5, // Mock calculation
            average_order_value: total_receivables / Math.max(total_customers, 1)
        };
    }

    const response = await fetch(`${API_BASE_URL}/customers/stats`);
    if (!response.ok) throw new Error('Failed to fetch customer stats');
    return response.json();
}

export async function searchCustomers(query: string): Promise<Customer[]> {
    if (USE_MOCK) {
        await delay(300);
        const customers = getStorage<Customer>('customers');
        const lowerQuery = query.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.email?.toLowerCase().includes(lowerQuery) ||
            c.phone?.includes(query) ||
            c.address?.toLowerCase().includes(lowerQuery) ||
            c.code?.toLowerCase().includes(lowerQuery)
        );
    }

    const response = await fetch(`${API_BASE_URL}/customers/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search customers');
    return response.json();
}

// ============================================
// EXPORTS
// ============================================

export default {
    // CRUD
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,

    // Ledger
    getCustomerLedger,
    addLedgerEntry,

    // Payments
    getCustomerPayments,
    createPayment,

    // Analytics
    getOverdueCustomers,
    getCustomerStats,
    searchCustomers
};
