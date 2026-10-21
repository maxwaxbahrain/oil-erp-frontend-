import { describe, expect, it } from 'vitest';

import {
  applyLeaderMessage,
  createLeaderState,
  isLeader,
  notePeer,
  pruneStale,
} from './leaderTab';

describe('hands-free leader tab', () => {
  it('elects the lowest tabId as leader', () => {
    let state = createLeaderState('tab-b');
    state = notePeer(state, 'tab-a', Date.now());
    expect(isLeader(state)).toBe(false);

    state = createLeaderState('tab-a');
    state = notePeer(state, 'tab-b', Date.now());
    expect(isLeader(state)).toBe(true);
  });

  it('drops stale peers so a surviving tab becomes leader', () => {
    const now = 1_000_000;
    let state = createLeaderState('tab-b');
    state = notePeer(state, 'tab-a', now - 60_000);
    state = pruneStale(state, now);
    expect(isLeader(state, now)).toBe(true);
  });

  it('applies hello / bye messages', () => {
    let state = createLeaderState('mine');
    state = applyLeaderMessage(state, { type: 'hello', tabId: 'other', ts: Date.now() });
    expect(state.peers.has('other')).toBe(true);
    state = applyLeaderMessage(state, { type: 'bye', tabId: 'other', ts: Date.now() });
    expect(state.peers.has('other')).toBe(false);
  });
});
