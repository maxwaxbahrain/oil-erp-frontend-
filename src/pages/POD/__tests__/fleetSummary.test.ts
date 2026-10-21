import { describe, expect, it } from 'vitest';
import type { Van } from '../../../services/api';
import { computeFleetSummary, pluralize } from '../DriverApp';

function van(id: string, status: Van['status']): Van {
  return {
    id,
    van_number: id,
    driver_name: 'Driver',
    status,
  };
}

/** Same stops formula vanDisplayStats uses: 3 + (sum of char codes % 5). */
function stopsFor(id: string): number {
  const seed = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return 3 + (seed % 5);
}

describe('computeFleetSummary', () => {
  it('returns zeros for an empty van list', () => {
    expect(computeFleetSummary([])).toEqual({
      deliveries: 0,
      zones: 0,
      activeVans: 0,
    });
  });

  it('counts one active van as one zone and the existing stops sum', () => {
    const id = 'van-01';
    const summary = computeFleetSummary([van(id, 'active')]);
    expect(summary.zones).toBe(1);
    expect(summary.activeVans).toBe(1);
    expect(summary.deliveries).toBe(stopsFor(id));
  });

  it('caps zones at 3 for four vans', () => {
    const ids = ['van-a', 'van-b', 'van-c', 'van-d'];
    const summary = computeFleetSummary(ids.map((id) => van(id, 'active')));
    expect(summary.zones).toBe(3);
    expect(summary.deliveries).toBe(ids.reduce((sum, id) => sum + stopsFor(id), 0));
  });
});

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
