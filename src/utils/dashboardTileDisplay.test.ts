import { describe, expect, it } from 'vitest';

import {
  dashTileSub,
  formatDashCountTile,
  formatDashMoneyTile,
} from './dashboardTileDisplay';

/** Each Dashboard tile that previously turned a FAILED request into 0 / $0. */
const MONEY_TILES = [
  'Invoiced MTD',
  'Owed to us',
  'Overdue Amount',
  'Cash collected today',
] as const;

const COUNT_TILES = [
  'Orders Today',
  'Pending orders',
  'Van routes today',
  'New customers this month',
] as const;

describe('dashboardTileDisplay — no silent zeros', () => {
  it.each(MONEY_TILES)('%s: failed → Couldn\'t load, never $0', () => {
    expect(formatDashMoneyTile('failed', 0)).toBe("Couldn't load");
    expect(formatDashMoneyTile('failed', 0)).not.toMatch(/^\$0/);
    expect(formatDashMoneyTile('loading', 0)).toBe('—');
    expect(formatDashMoneyTile('ok', 0)).toBe('$0');
    expect(formatDashMoneyTile('ok', 1234)).toBe('$1,234');
  });

  it.each(COUNT_TILES)('%s: failed → Couldn\'t load, never bare 0', () => {
    expect(formatDashCountTile('failed', 0)).toBe("Couldn't load");
    expect(formatDashCountTile('failed', 0)).not.toBe('0');
    expect(formatDashCountTile('loading', 0)).toBe('—');
    expect(formatDashCountTile('ok', 0)).toBe('0');
    expect(formatDashCountTile('ok', 7)).toBe('7');
  });

  it('Retry sub only when failed', () => {
    expect(dashTileSub('failed', 'gross invoiced')).toEqual({ sub: 'Retry', onRetry: true });
    expect(dashTileSub('loading', 'gross invoiced')).toEqual({ sub: 'loading…' });
    expect(dashTileSub('ok', 'gross invoiced')).toEqual({ sub: 'gross invoiced' });
  });
});
