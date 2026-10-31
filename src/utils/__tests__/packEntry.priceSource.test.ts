import { describe, expect, it } from 'vitest';

import { apiProductBaseUnitPrice, catalogProductBaseUnitPrice } from '../packEntry';

describe('line price source helpers', () => {
  it('apiProductBaseUnitPrice uses cost for purchase and sell for sales', () => {
    const row = { unit_price: 9, cost_price: 4 };
    expect(apiProductBaseUnitPrice(row, 'cost')).toBe(4);
    expect(apiProductBaseUnitPrice(row, 'sell')).toBe(9);
  });

  it('apiProductBaseUnitPrice returns null when cost is zero', () => {
    expect(apiProductBaseUnitPrice({ unit_price: 9, cost_price: 0 }, 'cost')).toBeNull();
  });

  it('catalogProductBaseUnitPrice uses purchasePriceExWorks for cost', () => {
    expect(catalogProductBaseUnitPrice({ pricing: { sellingPrice: 9, purchasePriceExWorks: 4 } }, 'cost')).toBe(4);
    expect(catalogProductBaseUnitPrice({ pricing: { sellingPrice: 9, purchasePriceExWorks: 4 } }, 'sell')).toBe(9);
  });
});
