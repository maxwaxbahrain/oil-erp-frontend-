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
    nexusCount?: number;
}

// Session 1C — Nexus.
export type NexusType = 'physical' | 'economic' | 'click-through' | 'affiliate';

export interface TaxNexus {
    id: string;
    jurisdiction: string;
    nexusType: NexusType;
    establishedDate?: string;
    thresholdAmount?: number | null;
    notes?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// Session 1D — External tax providers (TaxJar / Avalara).
// 'internal' = no provider, fall back to configured rules + state defaults.
export type ProviderId = 'internal' | 'taxjar' | 'avalara';
export type ProviderEnvironment = 'sandbox' | 'production';

export interface TaxProviderConfig {
    id: ProviderId;
    apiKey: string;
    environment: ProviderEnvironment;
    /** Only one provider should be active at a time. The UI enforces this. */
    isActive: boolean;
    /** Last successful test-connection timestamp (ISO). Empty until tested. */
    lastSyncedAt?: string;
    updatedAt: string;
}

/** Result returned by a provider's `quote()` call. Shape mirrors what
 *  TaxJar / Avalara return so swapping in a real client is a drop-in. */
export interface ProviderQuote {
    rate: number;        // percent
    taxAmount: number;   // currency
    providerId: ProviderId;
    breakdown?: {        // optional jurisdiction breakdown — provider-specific
        state?: number;
        county?: number;
        city?: number;
        special?: number;
    };
}

// Session 1E — Exemption certificates.
// A certificate proves a customer doesn't owe sales tax in a jurisdiction
// (resale, nonprofit, government, manufacturing, etc.). When an active +
// non-expired certificate matches the (customer, jurisdiction) tuple, the
// calculator returns 0 and stamps source='exempt'.
export type ExemptionType =
    | 'resale'
    | 'nonprofit'
    | 'government'
    | 'manufacturing'
    | 'agricultural'
    | 'other';

export interface TaxExemption {
    id: string;
    customerId: string;           // free-form for now (customer name / ref)
    customerName?: string;        // pretty label for the row
    jurisdiction: string;         // e.g. "US-NY", or "*" for all jurisdictions
    exemptionType: ExemptionType;
    certificateNumber: string;    // free-form cert id
    issuedDate?: string;          // ISO date
    /** ISO date; when set + in the past, the cert is treated as expired
     *  regardless of isActive. */
    expiryDate?: string;
    notes?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
