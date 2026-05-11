/**
 * Global Formatters for SOLTOL ONE
 * Standardizing display across enterprise nodes.
 */

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(amount);
};

export const formatDate = (dateString: string | Date): string => {
    if (!dateString) return '';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(dateString)).toUpperCase();
};

export const formatSKU = (sku: string): string => {
    return sku.toUpperCase().replace(/\s+/g, '-');
};

export const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
};
