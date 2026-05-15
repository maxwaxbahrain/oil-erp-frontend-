// Tax Engine — shared types (Session 1A foundation).
// Keep this file small and stable; richer types come in 1B+.

export type TaxType = 'sales' | 'vat' | 'gst';

export interface TaxRule {
    id: string;
    jurisdiction: string;       // e.g. "US-NY", "BH"
    name: string;
    rate: number;               // percent
    taxType: TaxType;
    productCategory?: string;
    isActive: boolean;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TaxEngineHealth {
    status: 'ok' | 'down';
    timestamp: string;
    version: string;
    ruleCount: number;
}
