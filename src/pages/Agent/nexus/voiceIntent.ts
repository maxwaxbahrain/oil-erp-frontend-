/**
 * Zava Phase 3 — deterministic voice intent router.
 * No LLM. Voice may only open pages, read data, and speak.
 */

import type { PlanetId } from './nexusModel';
import { moduleToPlanet } from './nexusModel';
import type { VanLiveStatus } from '../../../lib/vanLiveStatus';

export type VoiceIntent =
  | { type: 'updates' }
  | { type: 'next' }
  | { type: 'repeat' }
  | { type: 'stop' }
  | { type: 'vans' }
  | { type: 'open_module'; module: PlanetId; href: string; label: string }
  | { type: 'go_nexus' }
  | { type: 'customer'; query: string }
  | { type: 'unknown' };

/** Shown when the phrase is unknown — never sent to an LLM in Phase 3. */
export const VOICE_FALLBACK_CHIPS = [
  'What are the updates?',
  'What are the vans doing?',
  'Open Collections',
  'Go back',
] as const;

export const MODULE_OPEN: Array<{
  aliases: string[];
  module: PlanetId;
  href: string;
  label: string;
}> = [
  { aliases: ['sales'], module: 'sales', href: '/sales/dashboard', label: 'Sales' },
  {
    aliases: ['collections', 'collection'],
    module: 'collections',
    href: '/finance/collections',
    label: 'Collections',
  },
  { aliases: ['purchase', 'purchases'], module: 'purchase', href: '/purchases', label: 'Purchase' },
  {
    aliases: ['inventory', 'stock', 'products'],
    module: 'inventory',
    href: '/products',
    label: 'Inventory',
  },
  {
    aliases: ['delivery', 'deliveries', 'ops map', 'ops-map', 'logistics'],
    module: 'delivery',
    href: '/agent/ops-map',
    label: 'Delivery',
  },
  { aliases: ['finance'], module: 'finance', href: '/finance/dashboard', label: 'Finance' },
  {
    aliases: ['expenses', 'expense'],
    module: 'expenses',
    href: '/finance/expenses',
    label: 'Expenses',
  },
  { aliases: ['payroll'], module: 'payroll', href: '/finance/payroll', label: 'Payroll' },
  {
    aliases: ['reports', 'report'],
    module: 'reports',
    href: '/finance/financial-statement',
    label: 'Reports',
  },
  {
    aliases: ['ai', 'ai team', 'team'],
    module: 'ai_team',
    href: '/ai/hub',
    label: 'AI & Team',
  },
];

/** Normalize transcript for matching — lowercase, strip punctuation, collapse spaces. */
export function normalizeVoicePhrase(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchOpenModule(rest: string): VoiceIntent | null {
  const q = rest.trim();
  if (!q) return null;
  for (const row of MODULE_OPEN) {
    for (const alias of row.aliases) {
      if (q === alias || q === `the ${alias}` || q.startsWith(`${alias} `)) {
        return {
          type: 'open_module',
          module: row.module,
          href: row.href,
          label: row.label,
        };
      }
    }
  }
  return null;
}

/**
 * Deterministic intent parse. Small wording variations accepted; unknown → fallback.
 * Never invents write/approve/send actions.
 */
export function parseVoiceIntent(raw: string): VoiceIntent {
  const t = normalizeVoicePhrase(raw);
  if (!t) return { type: 'unknown' };

  if (t === 'stop' || t === 'mute' || t === 'be quiet' || t === 'quiet') {
    return { type: 'stop' };
  }
  if (t === 'next' || t === 'skip' || t === 'next update' || t === 'next one') {
    return { type: 'next' };
  }
  if (t === 'repeat' || t === 'say that again' || t === 'again') {
    return { type: 'repeat' };
  }

  if (
    t === 'updates' ||
    t === 'update' ||
    t === 'what are the updates' ||
    t === "what's the update" ||
    t === "what's the updates" ||
    t === 'what is the update' ||
    t === 'what is the updates' ||
    t === 'show me the updates' ||
    t === 'read the updates' ||
    t === 'tell me the updates'
  ) {
    return { type: 'updates' };
  }

  if (
    t === 'vans' ||
    t === 'what are the vans doing' ||
    t === "what's the vans doing" ||
    t === 'show me the vans' ||
    t === 'how are the vans' ||
    t === 'van status' ||
    t === 'vans status'
  ) {
    return { type: 'vans' };
  }

  if (t === 'go back' || t === 'nexus' || t === 'home' || t === 'go home' || t === 'back to nexus') {
    return { type: 'go_nexus' };
  }

  const openPrefix = t.match(/^open\s+(.+)$/);
  if (openPrefix) {
    const hit = matchOpenModule(openPrefix[1]);
    if (hit) return hit;
    return { type: 'unknown' };
  }

  // "go to sales" / "take me to collections"
  const goTo = t.match(/^(?:go to|take me to|open up)\s+(.+)$/);
  if (goTo) {
    const hit = matchOpenModule(goTo[1]);
    if (hit) return hit;
  }

  const about = t.match(/^(?:tell me about|about|who is|what's the balance for|what is the balance for)\s+(.+)$/);
  if (about) {
    const query = about[1].replace(/^(customer|the)\s+/, '').trim();
    if (query) return { type: 'customer', query };
  }

  return { type: 'unknown' };
}

export type CustomerMatchResult =
  | { kind: 'one'; id: number; name: string }
  | { kind: 'none'; query: string }
  | { kind: 'many'; query: string; matches: Array<{ id: number; name: string }> };

/**
 * Resolve customer name from search results. Never guesses when 0 or 2+ remain.
 * Prefers exact (case-insensitive) name equality, then unique substring match.
 */
export function resolveCustomerMatches(
  results: Array<{ id: number; name: string }>,
  query: string,
): CustomerMatchResult {
  const q = query.trim().toLowerCase();
  if (!q) return { kind: 'none', query };

  const exact = results.filter((c) => c.name.trim().toLowerCase() === q);
  if (exact.length === 1) return { kind: 'one', id: exact[0].id, name: exact[0].name };
  if (exact.length > 1) {
    return { kind: 'many', query, matches: exact.map((c) => ({ id: c.id, name: c.name })) };
  }

  const partial = results.filter((c) => c.name.toLowerCase().includes(q));
  if (partial.length === 1) return { kind: 'one', id: partial[0].id, name: partial[0].name };
  if (partial.length > 1) {
    return { kind: 'many', query, matches: partial.map((c) => ({ id: c.id, name: c.name })) };
  }

  // Search API may already have filtered to the query with no local name match —
  // only accept a single API hit (never guess among several).
  if (results.length === 1) {
    return { kind: 'one', id: results[0].id, name: results[0].name };
  }
  return { kind: 'none', query };
}

export type VanStatusCounts = { moving: number; stopped: number; offline: number };

/** Same status model as Ops Map — moving / stopped / offline only. */
export function countVanStatuses(statuses: VanLiveStatus[]): VanStatusCounts {
  const out: VanStatusCounts = { moving: 0, stopped: 0, offline: 0 };
  for (const s of statuses) {
    if (s === 'moving') out.moving += 1;
    else if (s === 'stopped') out.stopped += 1;
    else out.offline += 1;
  }
  return out;
}

export function formatVanSummary(counts: VanStatusCounts): string {
  return `${counts.moving} van${counts.moving === 1 ? '' : 's'} moving, ${counts.stopped} stopped, ${counts.offline} offline.`;
}

export function formatWelcomeLine(opts: {
  firstName: string;
  cardsLoadOk: boolean;
  updateCount: number;
  needsYou: number;
}): string {
  if (!opts.cardsLoadOk) {
    return "I couldn't load your updates right now.";
  }
  const n = opts.updateCount;
  const updates = `I have ${n} update${n === 1 ? '' : 's'}.`;
  if (opts.needsYou <= 0) {
    return `Welcome back, ${opts.firstName}. ${updates}`;
  }
  const x = opts.needsYou;
  return `Welcome back, ${opts.firstName}. ${updates} ${x} need${x === 1 ? 's' : ''} you.`;
}

export function formatCardSpeech(card: {
  title: string;
  money?: number;
  why?: string;
  figure?: string;
}): string {
  const parts = [card.title];
  if (card.figure) parts.push(card.figure);
  else if (card.money != null && Number.isFinite(card.money) && Math.abs(card.money) > 0.005) {
    parts.push(`$${Math.round(card.money).toLocaleString('en-US')}`);
  }
  const why = (card.why || '').trim();
  if (why) parts.push(why);
  return parts.join('. ');
}

export function planetIdForCardModule(module: string | undefined): PlanetId | null {
  return moduleToPlanet(module);
}

export const WELCOME_SESSION_KEY = 'zava_nexus_welcome_spoken';

/** Once per browser tab session (login session proxy). */
export function hasSpokenWelcome(session: Storage = sessionStorage): boolean {
  try {
    return session.getItem(WELCOME_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSpoken(session: Storage = sessionStorage): void {
  try {
    session.setItem(WELCOME_SESSION_KEY, '1');
  } catch {
    /* ignore quota */
  }
}

/** Test helper — clear welcome flag. */
export function clearWelcomeSpoken(session: Storage = sessionStorage): void {
  try {
    session.removeItem(WELCOME_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
