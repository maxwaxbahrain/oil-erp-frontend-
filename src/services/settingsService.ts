
// ITEM 2 — Inventory valuation method. Engines already exist in
// inventoryService (calculateFIFOValuation / LIFO / AvgCost); this
// setting marks the company's *default* method so the Inventory
// Reports page can surface it and (future) dependent calculations
// can pick the right engine without re-asking.
import type { TenantProfile } from './tenantProfileApi';
import { toCompanyProfile, toCompanySettings } from './tenantProfileApi';

export type ValuationMethod = 'FIFO' | 'LIFO' | 'Average Cost';

export interface SystemSettings {
    defaultCurrencyCode: string;
    defaultCurrencySymbol: string;
    currencyFormat: 'comma_dot' | 'dot_comma' | 'space_dot';
    currencyPosition: 'before' | 'after';
    valuationMethod: ValuationMethod;
}

export interface CompanyProfile {
    name: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
    website: string;
    logo?: string;
    taxId?: string;
    category?: string;
}

/** Flat shape for invoices / sharing (localStorage `company_settings`). */
export interface CompanySettings {
    name: string;
    address: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    phone: string;
    email: string;
    website: string;
    taxId: string;
    /** Data URL or fetchable image URL for invoices */
    logo?: string;
}

export const DEFAULT_COMPANY: CompanySettings = {
    name: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',
};

export interface DocumentSignature {
    signatoryName: string;
    signatoryTitle: string;
    signatureImage?: string;
    showOnInvoices: boolean;
    showOnPurchaseOrders: boolean;
    showOnLedgers: boolean;
    showOnQuotations: boolean;
    showOnReports: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
    defaultCurrencyCode: 'USD',
    defaultCurrencySymbol: '$',
    currencyFormat: 'comma_dot',
    currencyPosition: 'before',
    // ITEM 2 — Sensible default. Weighted-average is simplest and matches
    // the existing "Inventory Valuation (Avg)" report that's the page's
    // primary valuation report today.
    valuationMethod: 'Average Cost',
};

const DEFAULT_PROFILE: CompanyProfile = {
    name: '',
    category: '',
    address1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',
};

const DEFAULT_SIGNATURE: DocumentSignature = {
    signatoryName: '',
    signatoryTitle: '',
    showOnInvoices: false,
    showOnPurchaseOrders: false,
    showOnLedgers: false,
    showOnQuotations: false,
    showOnReports: false,
};

const SETTINGS_KEY = 'zavi_system_settings';
const PROFILE_KEY = 'zavi_company_profile';
const SIGNATURE_KEY = 'zavi_document_signature';
const COMPANY_SETTINGS_KEY = 'company_settings';

let serverProfile: CompanyProfile | null = null;
let serverSettings: CompanySettings | null = null;

export function setServerCompanyProfile(p: TenantProfile | null): void {
    if (p === null) {
        serverProfile = null;
        serverSettings = null;
        return;
    }
    serverProfile = toCompanyProfile(p);
    serverSettings = toCompanySettings(p);
}

export function clearServerCompanyProfile(): void {
    setServerCompanyProfile(null);
}

export const getSystemSettings = (): SystemSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return DEFAULT_SETTINGS;
    try {
        // ITEM 2 — Merge stored over defaults so newly-added fields
        // (e.g. valuationMethod added in this session) fall through to
        // sensible defaults for users who saved their settings before
        // those fields existed.
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
        return DEFAULT_SETTINGS;
    }
};

export const updateSystemSettings = (settings: Partial<SystemSettings>): SystemSettings => {
    const current = getSystemSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('system-settings-updated'));
    return updated;
};

export const getCompanyProfile = (): CompanyProfile => {
    if (serverProfile) return serverProfile;
    const data = localStorage.getItem(PROFILE_KEY);
    return data ? JSON.parse(data) : DEFAULT_PROFILE;
};

export const saveCompanyProfile = (profile: CompanyProfile): void => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

/** US-style city line: "Jamaica, NY 11423" — shared by settings + PDF headers. */
export function formatCityLine(
    city: string | undefined | null,
    state: string | undefined | null,
    postalCode: string | undefined | null,
): string {
    const c = (city || '').trim();
    const s = (state || '').trim();
    const p = (postalCode || '').trim();

    if (c && s && p) {
        return `${c}, ${s} ${p}`;
    }
    if (c && s) {
        return `${c}, ${s}`;
    }
    if (c && p) {
        return `${c} ${p}`;
    }
    if (c) {
        return c;
    }
    if (s && p) {
        return `${s} ${p}`;
    }
    return '';
}

export function companyProfileToSettings(profile: CompanyProfile): CompanySettings {
    return {
        name: profile.name || DEFAULT_COMPANY.name,
        address: profile.address1 || '',
        city: profile.city || '',
        state: profile.state || '',
        postalCode: profile.postalCode || '',
        country: profile.country || '',
        phone: profile.phone || '',
        email: profile.email || '',
        website: profile.website || '',
        taxId: profile.taxId || '',
        logo: profile.logo,
    };
}

export function getCompanySettings(): CompanySettings {
    if (serverSettings) return serverSettings;
    const saved = localStorage.getItem(COMPANY_SETTINGS_KEY);
    const profile = getCompanyProfile();
    if (saved) {
        try {
            const merged: CompanySettings = { ...DEFAULT_COMPANY, ...JSON.parse(saved) };
            if (!merged.logo && profile.logo) {
                merged.logo = profile.logo;
            }
            return merged;
        } catch {
            /* use profile fallback */
        }
    }
    return companyProfileToSettings(profile);
}

export function saveCompanySettings(settings: CompanySettings): void {
    localStorage.setItem(COMPANY_SETTINGS_KEY, JSON.stringify(settings));
}

export const getDocumentSignature = (): DocumentSignature => {
    const data = localStorage.getItem(SIGNATURE_KEY);
    return data ? JSON.parse(data) : DEFAULT_SIGNATURE;
};

export const saveDocumentSignature = (signature: DocumentSignature): void => {
    localStorage.setItem(SIGNATURE_KEY, JSON.stringify(signature));
};

export const formatCurrency = (amount: number): string => {
    const settings = getSystemSettings();

    let formatted = amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    if (settings.currencyFormat === 'dot_comma') {
        formatted = formatted.replace(/\./g, 'X').replace(/,/g, '.').replace(/X/g, ',');
    } else if (settings.currencyFormat === 'space_dot') {
        formatted = formatted.replace(/,/g, ' ');
    }

    if (settings.currencyPosition === 'before') {
        return `${settings.defaultCurrencySymbol} ${formatted}`;
    } else {
        return `${formatted} ${settings.defaultCurrencyCode}`;
    }
};
