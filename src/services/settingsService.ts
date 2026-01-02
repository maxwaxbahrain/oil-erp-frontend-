
export interface SystemSettings {
    defaultCurrencyCode: string;
    defaultCurrencySymbol: string;
    currencyFormat: 'comma_dot' | 'dot_comma' | 'space_dot';
    currencyPosition: 'before' | 'after';
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
}

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
    defaultCurrencyCode: 'PKR',
    defaultCurrencySymbol: 'PKR',
    currencyFormat: 'comma_dot',
    currencyPosition: 'after',
};

const DEFAULT_PROFILE: CompanyProfile = {
    name: 'BETTANO INTERNATIONAL',
    address1: 'Industrial Area Phase 2',
    city: 'Karachi',
    state: 'Sindh',
    postalCode: '75500',
    country: 'Pakistan',
    phone: '+92 21 3456789',
    email: 'ops@bettano.com',
    website: 'www.bettano.com',
};

const DEFAULT_SIGNATURE: DocumentSignature = {
    signatoryName: 'AHMED KHAN',
    signatoryTitle: 'OPERATIONS MANAGER',
    showOnInvoices: true,
    showOnPurchaseOrders: true,
    showOnLedgers: false,
    showOnQuotations: true,
    showOnReports: true,
};

const SETTINGS_KEY = 'zavi_system_settings';
const PROFILE_KEY = 'zavi_company_profile';
const SIGNATURE_KEY = 'zavi_document_signature';

export const getSystemSettings = (): SystemSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
};

export const updateSystemSettings = (settings: Partial<SystemSettings>): SystemSettings => {
    const current = getSystemSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('system-settings-updated'));
    return updated;
};

export const getCompanyProfile = (): CompanyProfile => {
    const data = localStorage.getItem(PROFILE_KEY);
    return data ? JSON.parse(data) : DEFAULT_PROFILE;
};

export const saveCompanyProfile = (profile: CompanyProfile): void => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

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
