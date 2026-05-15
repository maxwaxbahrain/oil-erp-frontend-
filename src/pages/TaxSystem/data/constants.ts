// Tax Engine — constants.

export const TAX_ENGINE_VERSION = '1.0.0-session-1E';

// US state default combined sales tax rates (avg, used when no API or
// nexus-specific override is available). Mirrors the lookup in
// TaxSettings.tsx so any consumer of the engine sees the same defaults.
export const US_STATE_RATES: Record<string, number> = {
    AL: 9.00, AK: 1.76, AZ: 8.37, AR: 9.47, CA: 10.25, CO: 7.72, CT: 6.35,
    DE: 0.00, FL: 7.02, GA: 7.35, HI: 4.44, ID: 6.02, IL: 10.00, IN: 7.00,
    IA: 6.94, KS: 8.68, KY: 6.00, LA: 9.55, ME: 5.50, MD: 6.00, MA: 6.25,
    MI: 6.00, MN: 7.46, MS: 7.07, MO: 8.18, MT: 0.00, NE: 6.94, NV: 8.23,
    NH: 0.00, NJ: 6.63, NM: 7.83, NY: 8.88, NC: 6.98, ND: 6.96, OH: 7.24,
    OK: 8.95, OR: 0.00, PA: 6.34, RI: 7.00, SC: 7.43, SD: 6.40, TN: 9.55,
    TX: 8.25, UT: 7.19, VT: 6.18, VA: 5.75, WA: 10.23, WV: 6.60, WI: 5.43,
    WY: 5.36, DC: 6.00,
};

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
