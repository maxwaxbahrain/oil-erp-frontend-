/**
 * Van Sales Type Definitions
 * Defines interfaces for van-based direct sales operations
 */

// Payment method types matching ERP accounting rules
export type PaymentMethodType =
    | 'cash'                    // Full cash payment
    | 'card'                    // Full card payment
    | 'digital'                 // Full digital payment
    | 'credit_no_advance'       // Full credit - no advance
    | 'credit_with_advance'     // Partial advance + credit
    | 'cash_credit_split';      // Cash + Credit split

export interface VanSaleItem {
    product_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    line_total: number;
}

export interface VanSale {
    id: string;
    receipt_number: string;          // Format: VS-YYYYMMDD-XXXX
    van_id: string;                  // Van 1-10
    driver_id?: string;              // From van assignment
    driver_name?: string;            // Display name
    customer_id: string;
    customer_name?: string;          // Display name
    sale_date: string;               // ISO datetime

    // Line Items
    items: VanSaleItem[];

    // Financials
    subtotal: number;
    tax_rate: number;                // e.g., 0.05 for 5%
    tax_amount: number;
    total_amount: number;

    // Payment - Enhanced for ERP accounting
    payment_method: PaymentMethodType;
    amount_received: number;
    change_given: number;
    accounts_receivable: number;     // Credit balance
    payment_status: 'paid' | 'partial' | 'unpaid';
    outstanding_balance: number;

    // Metadata
    status: 'completed' | 'cancelled' | 'refunded';
    created_by?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface VanSaleFormData {
    van_id: string;
    customer_id: string;
    items: VanSaleItem[];
    payment_method: PaymentMethodType;
    amount_received: number;
    tax_rate: number;
    notes?: string;
}

export interface VanSalesStats {
    total_sales: number;
    total_amount: number;
    cash_sales: number;
    card_sales: number;
    digital_sales: number;
    credit_sales: number;
    average_sale: number;
}

export interface VanDailySummary {
    van_id: string;
    van_name: string;
    driver_name?: string;
    date: string;
    total_sales: number;
    total_amount: number;
    cash_collected: number;
    card_collected: number;
    digital_collected: number;
    credit_extended: number;
    sales: VanSale[];
}

export interface ReceiptData {
    receipt_number: string;
    sale: VanSale;
    company_info?: {
        name: string;
        address: string;
        phone: string;
        email: string;
        tax_id?: string;
    };
    print_date: string;
}
