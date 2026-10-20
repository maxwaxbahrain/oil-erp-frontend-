import { describe, expect, it, beforeEach } from 'vitest';

import { buildOpsVans } from '../opsMap/opsMapModel';
import {
  clearWelcomeSpoken,
  countVanStatuses,
  customerBalanceSpeech,
  formatCustomerBalanceSpeech,
  formatVanSummary,
  formatVoiceMoney,
  formatWelcomeLine,
  hasSpokenWelcome,
  markWelcomeSpoken,
  nameContainsQueryWords,
  normalizeVoicePhrase,
  parseVoiceIntent,
  resolveCustomerMatches,
  stripVoiceDecorations,
  WELCOME_SESSION_KEY,
} from './voiceIntent';

describe('voiceIntent router', () => {
  it('maps supported phrases to intents (including small wording variations)', () => {
    expect(parseVoiceIntent('what are the updates').type).toBe('updates');
    expect(parseVoiceIntent("what's the update").type).toBe('updates');
    expect(parseVoiceIntent("what's the updates").type).toBe('updates');
    expect(parseVoiceIntent("what's updates").type).toBe('updates');
    expect(parseVoiceIntent('what are updates').type).toBe('updates');
    expect(parseVoiceIntent('updates').type).toBe('updates');
    expect(parseVoiceIntent('show me the updates').type).toBe('updates');

    expect(parseVoiceIntent('next').type).toBe('next');
    expect(parseVoiceIntent('skip').type).toBe('next');
    expect(parseVoiceIntent('repeat').type).toBe('repeat');
    expect(parseVoiceIntent('stop').type).toBe('stop');
    expect(parseVoiceIntent('mute').type).toBe('stop');

    expect(parseVoiceIntent('what are the vans doing').type).toBe('vans');
    expect(parseVoiceIntent('vans').type).toBe('vans');
    expect(parseVoiceIntent('show me the vans').type).toBe('vans');

    expect(parseVoiceIntent('go back').type).toBe('go_nexus');
    expect(parseVoiceIntent('nexus').type).toBe('go_nexus');
    expect(parseVoiceIntent('home').type).toBe('go_nexus');

    const openSales = parseVoiceIntent('open Sales');
    expect(openSales).toEqual({
      type: 'open_module',
      module: 'sales',
      href: '/sales/dashboard',
      label: 'Sales',
    });
    expect(parseVoiceIntent('open collections').type).toBe('open_module');
    expect(parseVoiceIntent('open Delivery')).toMatchObject({
      type: 'open_module',
      href: '/agent/ops-map',
    });
    expect(parseVoiceIntent('go to inventory')).toMatchObject({
      type: 'open_module',
      module: 'inventory',
    });

    const about = parseVoiceIntent('tell me about Gamma Garage');
    expect(about).toEqual({ type: 'customer', query: 'gamma garage' });
    expect(normalizeVoicePhrase('Tell me about Gamma Garage')).toContain('gamma garage');
  });

  it('strips wake / polite prefixes and trailing please', () => {
    expect(parseVoiceIntent('Zava, what are the updates?').type).toBe('updates');
    expect(parseVoiceIntent("Please, what's the updates?").type).toBe('updates');
    expect(parseVoiceIntent('Hey Zava, what are the vans doing?').type).toBe('vans');
    expect(parseVoiceIntent('Zava open collections please')).toMatchObject({
      type: 'open_module',
      module: 'collections',
    });
    expect(parseVoiceIntent('Can you tell me about Gamma Garage?')).toEqual({
      type: 'customer',
      query: 'gamma garage',
    });
    expect(stripVoiceDecorations('um uh Zava please open sales please')).toBe('open sales');
  });

  it('customer intent keeps the name after "tell me about"', () => {
    const intent = parseVoiceIntent('tell me about Acme Motors');
    expect(intent.type).toBe('customer');
    if (intent.type === 'customer') {
      expect(intent.query).toBe('acme motors');
    }
  });

  it('unknown phrase → fallback (never invents a write action)', () => {
    expect(parseVoiceIntent('approve that expense').type).toBe('unknown');
    expect(parseVoiceIntent('send a message to the driver').type).toBe('unknown');
    expect(parseVoiceIntent('create an invoice').type).toBe('unknown');
    expect(parseVoiceIntent('blorp zorp').type).toBe('unknown');
  });
});

describe('resolveCustomerMatches', () => {
  const rows = [
    { id: 1, name: 'Gamma Garage' },
    { id: 2, name: 'Gamma Supply' },
    { id: 3, name: 'Acme Motors' },
  ];

  it('1 exact match', () => {
    expect(resolveCustomerMatches(rows, 'Acme Motors')).toEqual({
      kind: 'one',
      id: 3,
      name: 'Acme Motors',
    });
  });

  it('0 matches', () => {
    expect(resolveCustomerMatches([], 'Nobody')).toEqual({ kind: 'none', query: 'Nobody' });
    expect(resolveCustomerMatches(rows, 'Zzz')).toEqual({ kind: 'none', query: 'Zzz' });
  });

  it('2+ matches → many (never guess)', () => {
    const many = resolveCustomerMatches(rows, 'Gamma');
    expect(many.kind).toBe('many');
    if (many.kind === 'many') {
      expect(many.matches).toHaveLength(2);
      expect(many.matches.map((m) => m.name).sort()).toEqual(['Gamma Garage', 'Gamma Supply']);
    }
  });

  it('single fuzzy hit without query words → confirm (grandma vs Gamma Garage)', () => {
    expect(nameContainsQueryWords('Gamma Garage', 'grandma')).toBe(false);
    const confirm = resolveCustomerMatches([{ id: 1, name: 'Gamma Garage' }], 'grandma');
    expect(confirm).toEqual({
      kind: 'confirm',
      id: 1,
      name: 'Gamma Garage',
      query: 'grandma',
    });
  });
});

describe('customer balance wording', () => {
  it('formats >0 / =0 / <0', () => {
    expect(formatCustomerBalanceSpeech('Acme', 7118)).toBe('Acme owes $7,118.');
    expect(formatCustomerBalanceSpeech('Acme', 42.5)).toBe('Acme owes $42.50.');
    expect(formatCustomerBalanceSpeech('Acme', 0)).toBe('Acme owes nothing right now.');
    expect(formatCustomerBalanceSpeech('Acme', -25)).toBe('Acme has a credit of $25.00.');
    expect(formatCustomerBalanceSpeech('Acme', -250)).toBe('Acme has a credit of $250.');
  });

  it('AR loaded OK + missing from per_customer → $0; AR failed → could not load', () => {
    const map = new Map<number, number>([[1, 100]]);
    expect(
      customerBalanceSpeech({ name: 'Zero Co', customerId: 99, arLoadedOk: true, balanceById: map }),
    ).toBe('Zero Co owes nothing right now.');
    expect(
      customerBalanceSpeech({ name: 'Acme', customerId: 1, arLoadedOk: true, balanceById: map }),
    ).toBe('Acme owes $100.');
    expect(
      customerBalanceSpeech({ name: 'Acme', customerId: 1, arLoadedOk: false, balanceById: map }),
    ).toBe("I couldn't load the balance.");
    expect(formatVoiceMoney(7.1)).toBe('$7.10');
    expect(formatVoiceMoney(100)).toBe('$100');
  });
});

describe('welcome once per session', () => {
  const mem = (() => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    } as Storage;
  })();

  beforeEach(() => {
    clearWelcomeSpoken(mem);
  });

  it('speaks once per session, not on every visit', () => {
    expect(hasSpokenWelcome(mem)).toBe(false);
    markWelcomeSpoken(mem);
    expect(hasSpokenWelcome(mem)).toBe(true);
    expect(mem.getItem(WELCOME_SESSION_KEY)).toBe('1');
    markWelcomeSpoken(mem);
    expect(hasSpokenWelcome(mem)).toBe(true);
  });

  it('welcome line wording', () => {
    expect(
      formatWelcomeLine({ firstName: 'Zohaib', cardsLoadOk: true, updateCount: 3, needsYou: 2 }),
    ).toBe('Welcome back, Zohaib. I have 3 updates. 2 need you.');
    expect(
      formatWelcomeLine({ firstName: 'Zohaib', cardsLoadOk: false, updateCount: 0, needsYou: 0 }),
    ).toBe("I couldn't load your updates right now.");
  });
});

describe('vans summary matches Ops Map status counts', () => {
  it('counts moving / stopped / offline from the same derive path as Ops Map', () => {
    const now = new Date('2026-10-20T12:00:00');
    const rows = buildOpsVans(
      [
        {
          van_id: '1',
          van_number: 'V1',
          latitude: 26,
          longitude: 50,
          speed: 5,
          recorded_at: '2026-10-20T11:55:00',
        },
        {
          van_id: '2',
          van_number: 'V2',
          latitude: 26,
          longitude: 50,
          speed: 0,
          recorded_at: '2026-10-20T11:58:00',
        },
        {
          van_id: '3',
          van_number: 'V3',
          latitude: 26,
          longitude: 50,
          speed: 0,
          recorded_at: '2026-10-20T10:00:00',
        },
      ],
      [
        { id: '1', van_number: 'V1', driver_name: 'A' },
        { id: '2', van_number: 'V2', driver_name: 'B' },
        { id: '3', van_number: 'V3', driver_name: 'C' },
      ],
      now,
    );
    const counts = countVanStatuses(rows.map((r) => r.status));
    expect(counts).toEqual({ moving: 1, stopped: 1, offline: 1 });
    expect(formatVanSummary(counts)).toBe('1 van moving, 1 stopped, 1 offline.');
  });
});
