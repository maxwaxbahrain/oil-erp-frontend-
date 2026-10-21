/** BroadcastChannel single-leader election for hands-free listening. */

export const HANDS_FREE_CHANNEL = 'zava-hands-free-v1';

export type LeaderMessage =
  | { type: 'hello'; tabId: string; ts: number }
  | { type: 'heartbeat'; tabId: string; ts: number }
  | { type: 'bye'; tabId: string; ts: number };

const STALE_MS = 8_000;

export type LeaderState = {
  tabId: string;
  peers: Map<string, number>;
};

export function createLeaderState(tabId: string = crypto.randomUUID()): LeaderState {
  return { tabId, peers: new Map([[tabId, Date.now()]]) };
}

export function notePeer(state: LeaderState, tabId: string, ts: number = Date.now()): LeaderState {
  const peers = new Map(state.peers);
  peers.set(tabId, ts);
  return { ...state, peers };
}

export function dropPeer(state: LeaderState, tabId: string): LeaderState {
  const peers = new Map(state.peers);
  peers.delete(tabId);
  return { ...state, peers };
}

export function pruneStale(state: LeaderState, now: number = Date.now()): LeaderState {
  const peers = new Map<string, number>();
  for (const [id, ts] of state.peers) {
    if (now - ts <= STALE_MS || id === state.tabId) peers.set(id, ts);
  }
  if (!peers.has(state.tabId)) peers.set(state.tabId, now);
  return { ...state, peers };
}

/** Deterministic: lowest tabId among live peers is the leader. */
export function isLeader(state: LeaderState, now: number = Date.now()): boolean {
  const live = pruneStale(state, now);
  const ids = [...live.peers.keys()].sort();
  return ids[0] === state.tabId;
}

export function applyLeaderMessage(state: LeaderState, msg: LeaderMessage, now: number = Date.now()): LeaderState {
  if (msg.type === 'bye') return pruneStale(dropPeer(state, msg.tabId), now);
  return pruneStale(notePeer(state, msg.tabId, msg.ts || now), now);
}
