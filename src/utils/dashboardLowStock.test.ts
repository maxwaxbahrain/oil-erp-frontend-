import { describe, expect, it } from 'vitest';

import { dashboardLowStockAlertCount } from './dashboardLowStock';

describe('dashboardLowStockAlertCount', () => {
  it('matches Dashboard KPI: under-20 list (capped 6) or under-10 count', () => {
    expect(dashboardLowStockAlertCount([])).toBe(0);
    expect(
      dashboardLowStockAlertCount([
        { current_stock: 5 },
        { current_stock: 15 },
        { current_stock: 25 },
      ]),
    ).toBe(2);
    const many = Array.from({ length: 10 }, (_, i) => ({ current_stock: i }));
    expect(dashboardLowStockAlertCount(many)).toBe(6);
  });
});
