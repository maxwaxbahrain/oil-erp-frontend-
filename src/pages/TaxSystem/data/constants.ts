// Tax Engine — constants.

export const TAX_ENGINE_VERSION = '1.0.0-session-1E-B';

// US state sales-tax reference data (Session 1B retrofit).
//
// Replaces the old flat `Record<string, number>` of combined rates with a
// richer per-state record that splits state vs avg-local, names each state
// for UI display, and flags origin- vs destination-based sourcing.
//
// The COMBINED rates here are the literal 2025-averages from the Session
// 1B prompt — they differ slightly from our prior numbers (which were
// inherited from the old TaxSettings module). The change is intentional:
// the prompt's table is internally consistent (state + local = combined)
// while the old table only had combined, which made the split unverifiable.
//
// destinationBased: which state's rate to charge when seller and buyer are
// in different states. Most US states are destination-based (use buyer's
// rate); a short list of "origin-based" states tax in-state sales at the
// SELLER's local rate. The flag is a starting reference for the eventual
// origin/destination logic — today's calculator doesn't use it yet.
// Sources differ slightly; the list below is a defensible default.
export interface USStateInfo {
    stateCode: string;
    stateName: string;
    stateRate: number;       // percent — state-level portion
    avgLocalRate: number;    // percent — average county / city / special
    combinedRate: number;    // = stateRate + avgLocalRate
    destinationBased: boolean;
}

export const US_STATES: Record<string, USStateInfo> = {
    AL: { stateCode: 'AL', stateName: 'Alabama',        stateRate: 4.000, avgLocalRate: 5.220, combinedRate: 9.220, destinationBased: true },
    AK: { stateCode: 'AK', stateName: 'Alaska',         stateRate: 0.000, avgLocalRate: 1.760, combinedRate: 1.760, destinationBased: true },
    AZ: { stateCode: 'AZ', stateName: 'Arizona',        stateRate: 5.600, avgLocalRate: 2.770, combinedRate: 8.370, destinationBased: false },
    AR: { stateCode: 'AR', stateName: 'Arkansas',       stateRate: 6.500, avgLocalRate: 2.930, combinedRate: 9.430, destinationBased: true },
    CA: { stateCode: 'CA', stateName: 'California',     stateRate: 7.250, avgLocalRate: 1.570, combinedRate: 8.820, destinationBased: true },
    CO: { stateCode: 'CO', stateName: 'Colorado',       stateRate: 2.900, avgLocalRate: 4.820, combinedRate: 7.720, destinationBased: true },
    CT: { stateCode: 'CT', stateName: 'Connecticut',    stateRate: 6.350, avgLocalRate: 0.000, combinedRate: 6.350, destinationBased: true },
    DE: { stateCode: 'DE', stateName: 'Delaware',       stateRate: 0.000, avgLocalRate: 0.000, combinedRate: 0.000, destinationBased: true },
    FL: { stateCode: 'FL', stateName: 'Florida',        stateRate: 6.000, avgLocalRate: 1.050, combinedRate: 7.050, destinationBased: true },
    GA: { stateCode: 'GA', stateName: 'Georgia',        stateRate: 4.000, avgLocalRate: 3.320, combinedRate: 7.320, destinationBased: true },
    HI: { stateCode: 'HI', stateName: 'Hawaii',         stateRate: 4.000, avgLocalRate: 0.440, combinedRate: 4.440, destinationBased: true },
    ID: { stateCode: 'ID', stateName: 'Idaho',          stateRate: 6.000, avgLocalRate: 0.030, combinedRate: 6.030, destinationBased: true },
    IL: { stateCode: 'IL', stateName: 'Illinois',       stateRate: 6.250, avgLocalRate: 2.490, combinedRate: 8.740, destinationBased: false },
    IN: { stateCode: 'IN', stateName: 'Indiana',        stateRate: 7.000, avgLocalRate: 0.000, combinedRate: 7.000, destinationBased: true },
    IA: { stateCode: 'IA', stateName: 'Iowa',           stateRate: 6.000, avgLocalRate: 0.940, combinedRate: 6.940, destinationBased: true },
    KS: { stateCode: 'KS', stateName: 'Kansas',         stateRate: 6.500, avgLocalRate: 2.220, combinedRate: 8.720, destinationBased: false },
    KY: { stateCode: 'KY', stateName: 'Kentucky',       stateRate: 6.000, avgLocalRate: 0.000, combinedRate: 6.000, destinationBased: false },
    LA: { stateCode: 'LA', stateName: 'Louisiana',      stateRate: 4.450, avgLocalRate: 5.100, combinedRate: 9.550, destinationBased: true },
    ME: { stateCode: 'ME', stateName: 'Maine',          stateRate: 5.500, avgLocalRate: 0.000, combinedRate: 5.500, destinationBased: true },
    MD: { stateCode: 'MD', stateName: 'Maryland',       stateRate: 6.000, avgLocalRate: 0.000, combinedRate: 6.000, destinationBased: true },
    MA: { stateCode: 'MA', stateName: 'Massachusetts',  stateRate: 6.250, avgLocalRate: 0.000, combinedRate: 6.250, destinationBased: true },
    MI: { stateCode: 'MI', stateName: 'Michigan',       stateRate: 6.000, avgLocalRate: 0.000, combinedRate: 6.000, destinationBased: true },
    MN: { stateCode: 'MN', stateName: 'Minnesota',      stateRate: 6.875, avgLocalRate: 0.580, combinedRate: 7.455, destinationBased: true },
    MS: { stateCode: 'MS', stateName: 'Mississippi',    stateRate: 7.000, avgLocalRate: 0.070, combinedRate: 7.070, destinationBased: true },
    MO: { stateCode: 'MO', stateName: 'Missouri',       stateRate: 4.225, avgLocalRate: 3.900, combinedRate: 8.125, destinationBased: false },
    MT: { stateCode: 'MT', stateName: 'Montana',        stateRate: 0.000, avgLocalRate: 0.000, combinedRate: 0.000, destinationBased: true },
    NE: { stateCode: 'NE', stateName: 'Nebraska',       stateRate: 5.500, avgLocalRate: 1.440, combinedRate: 6.940, destinationBased: true },
    NV: { stateCode: 'NV', stateName: 'Nevada',         stateRate: 6.850, avgLocalRate: 1.380, combinedRate: 8.230, destinationBased: true },
    NH: { stateCode: 'NH', stateName: 'New Hampshire',  stateRate: 0.000, avgLocalRate: 0.000, combinedRate: 0.000, destinationBased: true },
    NJ: { stateCode: 'NJ', stateName: 'New Jersey',     stateRate: 6.625, avgLocalRate: 0.000, combinedRate: 6.625, destinationBased: true },
    NM: { stateCode: 'NM', stateName: 'New Mexico',     stateRate: 5.000, avgLocalRate: 2.720, combinedRate: 7.720, destinationBased: false },
    NY: { stateCode: 'NY', stateName: 'New York',       stateRate: 4.000, avgLocalRate: 4.520, combinedRate: 8.520, destinationBased: true },
    NC: { stateCode: 'NC', stateName: 'North Carolina', stateRate: 4.750, avgLocalRate: 2.220, combinedRate: 6.970, destinationBased: true },
    ND: { stateCode: 'ND', stateName: 'North Dakota',   stateRate: 5.000, avgLocalRate: 1.850, combinedRate: 6.850, destinationBased: true },
    OH: { stateCode: 'OH', stateName: 'Ohio',           stateRate: 5.750, avgLocalRate: 1.480, combinedRate: 7.230, destinationBased: false },
    OK: { stateCode: 'OK', stateName: 'Oklahoma',       stateRate: 4.500, avgLocalRate: 4.450, combinedRate: 8.950, destinationBased: true },
    OR: { stateCode: 'OR', stateName: 'Oregon',         stateRate: 0.000, avgLocalRate: 0.000, combinedRate: 0.000, destinationBased: true },
    PA: { stateCode: 'PA', stateName: 'Pennsylvania',   stateRate: 6.000, avgLocalRate: 0.340, combinedRate: 6.340, destinationBased: false },
    RI: { stateCode: 'RI', stateName: 'Rhode Island',   stateRate: 7.000, avgLocalRate: 0.000, combinedRate: 7.000, destinationBased: true },
    SC: { stateCode: 'SC', stateName: 'South Carolina', stateRate: 6.000, avgLocalRate: 1.430, combinedRate: 7.430, destinationBased: true },
    SD: { stateCode: 'SD', stateName: 'South Dakota',   stateRate: 4.500, avgLocalRate: 1.900, combinedRate: 6.400, destinationBased: true },
    TN: { stateCode: 'TN', stateName: 'Tennessee',      stateRate: 7.000, avgLocalRate: 2.550, combinedRate: 9.550, destinationBased: false },
    TX: { stateCode: 'TX', stateName: 'Texas',          stateRate: 6.250, avgLocalRate: 1.950, combinedRate: 8.200, destinationBased: false },
    UT: { stateCode: 'UT', stateName: 'Utah',           stateRate: 6.100, avgLocalRate: 1.090, combinedRate: 7.190, destinationBased: false },
    VT: { stateCode: 'VT', stateName: 'Vermont',        stateRate: 6.000, avgLocalRate: 0.180, combinedRate: 6.180, destinationBased: true },
    VA: { stateCode: 'VA', stateName: 'Virginia',       stateRate: 5.300, avgLocalRate: 0.450, combinedRate: 5.750, destinationBased: false },
    WA: { stateCode: 'WA', stateName: 'Washington',     stateRate: 6.500, avgLocalRate: 2.670, combinedRate: 9.170, destinationBased: true },
    WV: { stateCode: 'WV', stateName: 'West Virginia',  stateRate: 6.000, avgLocalRate: 0.390, combinedRate: 6.390, destinationBased: true },
    WI: { stateCode: 'WI', stateName: 'Wisconsin',      stateRate: 5.000, avgLocalRate: 0.430, combinedRate: 5.430, destinationBased: true },
    WY: { stateCode: 'WY', stateName: 'Wyoming',        stateRate: 4.000, avgLocalRate: 1.420, combinedRate: 5.420, destinationBased: true },
    DC: { stateCode: 'DC', stateName: 'District of Columbia', stateRate: 6.000, avgLocalRate: 0.000, combinedRate: 6.000, destinationBased: true },
};

/** Backward-compat lookup table preserved for existing callers
 *  (calculator.ts, providerClient.ts). Truly derived from US_STATES so
 *  there's no risk of the two drifting out of sync. New code should
 *  reach for US_STATES directly to get the richer fields. */
export const US_STATE_RATES: Record<string, number> = Object.fromEntries(
    Object.entries(US_STATES).map(([code, info]) => [code, info.combinedRate]),
);

export const TAX_TYPES = ['sales', 'vat', 'gst'] as const;

// Session 1C — nexus type options for the form dropdown.
export const NEXUS_TYPES = ['physical', 'economic', 'click-through', 'affiliate'] as const;
export const NEXUS_TYPE_LABELS: Record<string, string> = {
    physical: 'Physical Presence',
    economic: 'Economic Threshold',
    'click-through': 'Click-Through',
    affiliate: 'Affiliate',
};

// Session 1D — external tax providers.
// 'internal' is always present and means "use local rules + state defaults"
// (the engine that shipped in 1A–1C). The other two are real SaaS providers
// whose live API integration is stubbed in Session 1D — the frontend handles
// config + the request/response shape, but quote() returns simulated numbers
// so a developer without TaxJar / Avalara API keys can still see the flow.
import type { ProviderId } from './types';

export interface ProviderMeta {
    id: ProviderId;
    label: string;
    blurb: string;
    accent: string;  // tailwind colour family token used by the UI chip
    /** Live integration not yet wired — quote() returns simulated rates. */
    mocked: boolean;
}

export const PROVIDERS: ProviderMeta[] = [
    {
        id: 'internal',
        label: 'Internal Engine',
        blurb: 'Local rules + US state defaults. Free, always on, what 1A–1C built.',
        accent: 'gray',
        mocked: false,
    },
    {
        id: 'taxjar',
        label: 'TaxJar',
        blurb: 'Stripe-owned SaaS. Real-time US sales tax with rooftop-accurate rates.',
        accent: 'emerald',
        mocked: true,
    },
    {
        id: 'avalara',
        label: 'Avalara AvaTax',
        blurb: 'Enterprise-grade global tax. US + 190+ countries, VAT/GST, filings.',
        accent: 'indigo',
        mocked: true,
    },
];

export const PROVIDER_BY_ID: Record<ProviderId, ProviderMeta> = Object.fromEntries(
    PROVIDERS.map(p => [p.id, p]),
) as Record<ProviderId, ProviderMeta>;

// Session 1E — exemption certificate types for the dropdown.
export const EXEMPTION_TYPES = [
    'resale',
    'nonprofit',
    'government',
    'manufacturing',
    'agricultural',
    'other',
] as const;
export const EXEMPTION_TYPE_LABELS: Record<string, string> = {
    resale: 'Resale Certificate',
    nonprofit: 'Nonprofit Organization',
    government: 'Government Entity',
    manufacturing: 'Manufacturing Exemption',
    agricultural: 'Agricultural Exemption',
    other: 'Other',
};

/** Sentinel jurisdiction value meaning "this certificate applies to ANY
 *  jurisdiction" — useful for federal-level nonprofits, multi-state
 *  resellers, etc. Stored as the literal string '*'. */
export const EXEMPTION_ANY_JURISDICTION = '*';

// ─────────────────────────────────────────────────────────────────────
// Product categories (Session 1E — frontend dropdown).
// Single source of truth so the Calculator's category dropdown and any
// future per-row category-aware code use the same list.  The CODE is
// what gets sent to the backend; the LABEL is for display.
//
// Built-in tax defaults are handled by the BACKEND's CATEGORY_EXEMPTIONS
// table (app/engine/constants.py).  Listing the categories with hints
// here gives users at-a-glance taxability information in the dropdown.
// ─────────────────────────────────────────────────────────────────────

export interface ProductCategoryMeta {
    code: string;
    label: string;
    note: string;
}

export const PRODUCT_CATEGORIES: ProductCategoryMeta[] = [
    { code: 'GENERAL',      label: 'General merchandise', note: 'Taxed at state default' },
    { code: 'ELECTRONICS',  label: 'Electronics',         note: 'Taxed at state default' },
    { code: 'CLOTHING',     label: 'Clothing',            note: 'Exempt in PA, NJ, NY, MN, VT' },
    { code: 'FOOD',         label: 'Food / groceries',    note: 'Exempt in all states' },
    { code: 'MEDICAL',      label: 'Medical',             note: 'Exempt in all states' },
    { code: 'INDUSTRIAL',   label: 'Industrial',          note: 'Taxed at state default' },
    { code: 'OFFICE',       label: 'Office supplies',     note: 'Taxed at state default' },
    { code: 'RAW_MATERIAL', label: 'Raw materials',       note: 'Exempt with valid cert only' },
    { code: 'SERVICES',     label: 'Services',            note: 'Exempt in most states' },
    { code: 'CHEMICALS',    label: 'Chemicals',           note: 'Taxed at state default' },
];

export const PRODUCT_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
    PRODUCT_CATEGORIES.map(c => [c.code, c.label]),
);
