import { describe, expect, it } from 'vitest';
import { pluralize } from '../DriverApp';

describe('pluralize', () => {
  it('uses the plural for 0, the singular for 1, and the plural for 2', () => {
    expect(pluralize(0, 'delivery', 'deliveries')).toBe('0 deliveries');
    expect(pluralize(1, 'delivery', 'deliveries')).toBe('1 delivery');
    expect(pluralize(2, 'delivery', 'deliveries')).toBe('2 deliveries');
    expect(pluralize(0, 'zone', 'zones')).toBe('0 zones');
    expect(pluralize(1, 'zone', 'zones')).toBe('1 zone');
    expect(pluralize(2, 'zone', 'zones')).toBe('2 zones');
  });
});
