/**
 * Financial Settings Service
 * Manages configurable financial parameters for the ERP system
 */

export interface FinancialSettings {
    // Capital & Equity
    ownersCapital: number;          // Initial owner's investment
    initialCashBalance: number;     // Starting cash when business began

    // Debt & Loans
    shortTermDebt: number;          // Current short-term debt
    longTermDebt: number;           // Current long-term debt

    // Depreciation
    depreciationRate: number;       // Annual depreciation rate (e.g., 0.20 for 20%)
    depreciationMethod: 'straight-line' | 'declining-balance';

    // Other Settings
    taxRate: number;                // Default tax rate
    fiscalYearStart: string;        // Fiscal year start date (MM-DD format)
}

const FINANCIAL_SETTINGS_KEY = 'zavi_financial_settings';

const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
    ownersCapital: 150000,          // $150,000 initial investment
    initialCashBalance: 150000,     // Same as owner's capital initially
    shortTermDebt: 0,               // No short-term debt
    longTermDebt: 0,                // No long-term debt
    depreciationRate: 0.20,         // 20% annual depreciation
    depreciationMethod: 'straight-line',
    taxRate: 0.15,                  // 15% tax rate
    fiscalYearStart: '01-01',       // January 1st
};

/**
 * Get financial settings from localStorage
 */
export function getFinancialSettings(): FinancialSettings {
    const data = localStorage.getItem(FINANCIAL_SETTINGS_KEY);
    return data ? JSON.parse(data) : DEFAULT_FINANCIAL_SETTINGS;
}

/**
 * Update financial settings
 */
export function updateFinancialSettings(settings: Partial<FinancialSettings>): FinancialSettings {
    const current = getFinancialSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(FINANCIAL_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('financial-settings-updated'));
    return updated;
}

/**
 * Reset financial settings to defaults
 */
export function resetFinancialSettings(): FinancialSettings {
    localStorage.setItem(FINANCIAL_SETTINGS_KEY, JSON.stringify(DEFAULT_FINANCIAL_SETTINGS));
    window.dispatchEvent(new Event('financial-settings-updated'));
    return DEFAULT_FINANCIAL_SETTINGS;
}

/**
 * Update owner's capital
 */
export function updateOwnersCapital(amount: number): void {
    updateFinancialSettings({ ownersCapital: amount });
}

/**
 * Update debt amounts
 */
export function updateDebt(shortTerm: number, longTerm: number): void {
    updateFinancialSettings({
        shortTermDebt: shortTerm,
        longTermDebt: longTerm
    });
}

/**
 * Calculate depreciation for a given asset value and years
 */
export function calculateDepreciation(assetValue: number, years: number): number {
    const settings = getFinancialSettings();

    if (settings.depreciationMethod === 'straight-line') {
        return assetValue * settings.depreciationRate * years;
    } else {
        // Declining balance method
        let remainingValue = assetValue;
        for (let i = 0; i < years; i++) {
            remainingValue *= (1 - settings.depreciationRate);
        }
        return assetValue - remainingValue;
    }
}
