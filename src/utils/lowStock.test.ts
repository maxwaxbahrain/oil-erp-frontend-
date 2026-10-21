import { describe, expect, it } from 'vitest';

import {
  formatLowStockHeadline,
  formatLowStockShort,
  isBelowMinimum,
  isOutOfStock,
  summarizeLowStock,
  topLowStockAlerts,
} from './lowStock';

describe('lowStock shared helper', () => {
  it('does not cap alert count (40 out of stock → 40)', () => {
    const products = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      stock: 0,
      min_stock: 0,
      is_active: true,
    }));
    const s = summarizeLowStock(products);
    expect(s.outOfStock).toBe(40);
    expect(s.belowMin).toBe(0);
    expect(s.alertCount).toBe(40);
    expect(topLowStockAlerts(s, 6)).toHaveLength(6);
  });

  it('min_stock=0 and stock 5 is not belowMin', () => {
    const p = { stock: 5, min_stock: 0, is_active: true };
    expect(isBelowMinimum(p)).toBe(false);
    expect(summarizeLowStock([p]).belowMin).toBe(0);
    expect(summarizeLowStock([p]).noMinimum).toBe(1);
  });

  it('stock 0 and min 0 is outOfStock', () => {
    const p = { stock: 0, min_stock: 0, is_active: true };
    expect(isOutOfStock(p)).toBe(true);
    expect(isBelowMinimum(p)).toBe(false);
    const s = summarizeLowStock([p]);
    expect(s.outOfStock).toBe(1);
    expect(s.belowMin).toBe(0);
    expect(s.alertCount).toBe(1);
  });

  it('stock == min (min > 0) is belowMin', () => {
    const p = { current_stock: 10, minimum_stock: 10, is_active: true };
    expect(isBelowMinimum(p)).toBe(true);
    expect(summarizeLowStock([p]).belowMin).toBe(1);
  });

  it('inactive products are excluded', () => {
    const s = summarizeLowStock([
      { stock: 0, min_stock: 5, is_active: false },
      { stock: 1, min_stock: 5, is_active: true },
    ]);
    expect(s.outOfStock).toBe(0);
    expect(s.belowMin).toBe(1);
  });

  it('formats headline and short copy for Dashboard / Nexus / strip', () => {
    expect(formatLowStockHeadline({ outOfStock: 11, belowMin: 0 })).toBe(
      '11 out of stock · 0 below minimum',
    );
    expect(formatLowStockShort({ outOfStock: 11, belowMin: 0, alertCount: 11 })).toBe(
      '11 out of stock',
    );
    expect(formatLowStockShort({ outOfStock: 2, belowMin: 3, alertCount: 5 })).toBe(
      '2 out of stock · 3 below minimum',
    );
  });

  it('Nexus short label matches Dashboard summary from the same products', () => {
    const products = [
      { stock: 0, min_stock: 0, is_active: true },
      { stock: 2, min_stock: 5, is_active: true },
      { stock: 5, min_stock: 0, is_active: true },
    ];
    const s = summarizeLowStock(products);
    expect(formatLowStockHeadline(s)).toBe('1 out of stock · 1 below minimum');
    expect(formatLowStockShort(s)).toBe('1 out of stock · 1 below minimum');
  });

  it('top list prefers out of stock then lowest stock', () => {
    const s = summarizeLowStock([
      { id: 1, name: 'A', stock: 2, min_stock: 5, is_active: true },
      { id: 2, name: 'B', stock: 0, min_stock: 0, is_active: true },
      { id: 3, name: 'C', stock: 1, min_stock: 5, is_active: true },
    ]);
    const top = topLowStockAlerts(s, 6);
    expect(top[0].kind).toBe('out_of_stock');
    expect(top.map((t) => t.product.name)).toEqual(['B', 'C', 'A']);
  });
});
