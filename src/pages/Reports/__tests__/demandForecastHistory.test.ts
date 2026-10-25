import { describe, expect, it } from 'vitest';

import type { Invoice } from '../../../services/api';
import {
  buildRollingMonthKeys,
  countForecastEligibleInvoices,
  DEMAND_FORECAST_HISTORY_MONTHS,
  isInvoiceStatusExcludedForForecast,
} from '../demandForecastHistory';

function isoMonthsAgo(months: number, today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth() - months, 15);
  return d.toISOString().slice(0, 10);
}

describe('demand forecast invoice history filter', () => {
  it('excludes void, cancelled, and draft statuses', () => {
    expect(isInvoiceStatusExcludedForForecast('Void')).toBe(true);
    expect(isInvoiceStatusExcludedForForecast('voided')).toBe(true);
    expect(isInvoiceStatusExcludedForForecast('Cancelled')).toBe(true);
    expect(isInvoiceStatusExcludedForForecast('draft')).toBe(true);
    expect(isInvoiceStatusExcludedForForecast('Paid')).toBe(false);
  });

  it('keeps only in-window posted invoices', () => {
    const today = new Date(2026, 9, 24); // Oct 24, 2026 local
    const monthKeys = buildRollingMonthKeys(DEMAND_FORECAST_HISTORY_MONTHS, today);

    const invoices: Array<Pick<Invoice, 'status' | 'invoiceDate' | 'createdAt'>> = [
      { status: 'Paid', invoiceDate: isoMonthsAgo(13, today), createdAt: isoMonthsAgo(13, today) },
      { status: 'Paid', invoiceDate: isoMonthsAgo(2, today), createdAt: isoMonthsAgo(2, today) },
      { status: 'Void', invoiceDate: isoMonthsAgo(1, today), createdAt: isoMonthsAgo(1, today) },
      { status: 'draft' as Invoice['status'], invoiceDate: isoMonthsAgo(0, today), createdAt: isoMonthsAgo(0, today) },
    ];

    expect(countForecastEligibleInvoices(invoices, monthKeys)).toBe(1);
  });
});
