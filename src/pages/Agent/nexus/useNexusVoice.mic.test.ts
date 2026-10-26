import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatHeroSpeakLine } from './NexusHero';
import type { HomeSummary } from './homeSummaryApi';
import {
  clearWelcomeSpoken,
  hasSpokenWelcome,
  markWelcomeSpoken,
  WELCOME_SESSION_KEY,
} from './voiceIntent';

function sampleSummary(overrides: Partial<HomeSummary> = {}): HomeSummary {
  return {
    generated_at: '2026-10-25T15:00:00.000Z',
    needs_you_count: 3,
    biggest_line: 'Overdue invoices are the biggest pull.',
    load_failures: [],
    owed_to_us: { state: 'ok', value: 1 },
    expenses_to_approve: { state: 'ok', value: 0 },
    stock: { state: 'ok', value: 0 },
    cash_and_bank: { state: 'unavailable' },
    sales_today: { state: 'unavailable' },
    profit_month: { state: 'unavailable' },
    modules: {
      sales: { state: 'unavailable' },
      customers: { state: 'ok', value: 1 },
      collections: { state: 'ok', value: 1 },
      purchase: { state: 'ok', value: 0 },
      inventory: { state: 'ok', value: 0 },
      warehouse: { state: 'unavailable' },
      delivery: { state: 'unavailable' },
      finance: { state: 'unavailable' },
      expenses: { state: 'ok', value: 0 },
      payroll: { state: 'unavailable' },
    },
    ...overrides,
  };
}

describe('useNexusVoice mic-only speak', () => {
  it('does not auto-welcome on pointerdown / first click', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).not.toMatch(/addEventListener\('pointerdown'/);
    expect(src).not.toMatch(/onFirstInteraction/);
    expect(src).toMatch(/onMicTap/);
    expect(src).toMatch(/Never speak without a mic tap|never speak without a mic tap/i);
  });

  it('first mic tap speaks hero line then listens; later taps listen only', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).toMatch(/hasSpokenWelcome/);
    expect(src).toMatch(/markWelcomeSpoken/);
    expect(src).toMatch(/heroLine/);
    expect(src).toMatch(/await speakText\(line\)/);
    expect(src).toMatch(/await startListening\(\)/);
  });

  it('tap while speaking stops and does not start listening', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).toMatch(/do NOT start listening/);
    expect(src).toMatch(/micGenRef/);
    expect(src).toMatch(/gen !== micGenRef\.current/);
  });
});

describe('formatHeroSpeakLine (first mic speech)', () => {
  it('matches on-screen greeting + needs + biggest line', () => {
    const afternoon = new Date('2026-10-25T15:30:00');
    const line = formatHeroSpeakLine('Zohaib', sampleSummary(), afternoon);
    expect(line).toBe(
      'Good afternoon, Zohaib. 3 things need you. Overdue invoices are the biggest pull.',
    );
  });

  it('handles zero needs', () => {
    const morning = new Date('2026-10-25T09:00:00');
    const line = formatHeroSpeakLine(
      'Zohaib',
      sampleSummary({ needs_you_count: 0, biggest_line: '' }),
      morning,
    );
    expect(line).toBe('Good morning, Zohaib. Nothing needs you right now.');
  });
});

describe('welcome once per tab session (first mic)', () => {
  beforeEach(() => {
    clearWelcomeSpoken();
  });
  afterEach(() => {
    clearWelcomeSpoken();
  });

  it('marks spoken in sessionStorage so later taps skip hero speech', () => {
    expect(hasSpokenWelcome()).toBe(false);
    markWelcomeSpoken();
    expect(hasSpokenWelcome()).toBe(true);
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBe('1');
  });
});
