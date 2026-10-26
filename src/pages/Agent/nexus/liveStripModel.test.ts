import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TimelineEvent } from './nexusModel';
import {
  formatLoadLine,
  liveEventsFromTimeline,
  summarizeLoadSlots,
} from './liveStripModel';

describe('liveEventsFromTimeline', () => {
  it('keeps only payments + deliveries, newest first, no leave/team', () => {
    const events: TimelineEvent[] = [
      { id: 'pay-1', lane: 'money', label: 'Payment · Acme', minuteOfDay: 600, href: '/finance/collections' },
      { id: 'dn-1', lane: 'goods', label: 'Delivery DN-9', minuteOfDay: 900, href: '/logistics/tracking' },
      { id: 'leave-1', lane: 'team', label: 'Leave · Sam', minuteOfDay: null, timeNotRecorded: true },
    ];
    const live = liveEventsFromTimeline(events);
    expect(live.map((e) => e.id)).toEqual(['dn-1', 'pay-1']);
    expect(live.every((e) => e.href)).toBe(true);
    expect(live.find((e) => e.id === 'leave-1')).toBeUndefined();
  });
});

describe('summarizeLoadSlots', () => {
  it('reports N of M loaded and failed count', () => {
    const summary = summarizeLoadSlots([
      { id: 'a', state: 'ok' },
      { id: 'b', state: 'ok' },
      { id: 'c', state: 'error' },
      { id: 'd', state: 'unavailable' },
      { id: 'e', state: 'loading' },
    ]);
    expect(summary).toEqual({ loaded: 2, total: 4, failed: 1 });
    expect(formatLoadLine(summary)).toBe('2 of 4 loaded · 1 failed');
  });
});

describe('NexusLiveStrip refresh + page cleanup', () => {
  it('stops refresh when tab hidden', () => {
    const src = readFileSync(join(__dirname, 'NexusLiveStrip.tsx'), 'utf8');
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/visibilityState === 'hidden'/);
    expect(src).toMatch(/60_000|refreshMs/);
  });

  it('old Voice link / Coming up / timeline axis removed from NexusPage', () => {
    const page = readFileSync(join(__dirname, 'NexusPage.tsx'), 'utf8');
    expect(page).toMatch(/<NexusLiveStrip/);
    expect(page).toMatch(/<NexusNeedsYou/);
    expect(page).toMatch(/<NexusAsk/);
    expect(page).not.toMatch(/Voice link/);
    expect(page).not.toMatch(/Coming up/);
    expect(page).not.toMatch(/Today · 6 AM to 6 PM/);
    expect(page).not.toMatch(/getAllLeaveRequests/);
  });
});
