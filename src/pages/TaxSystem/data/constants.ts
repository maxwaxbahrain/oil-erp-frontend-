// Tax Engine — constants.

export const TAX_ENGINE_VERSION = '1.0.0-session-1C';

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
