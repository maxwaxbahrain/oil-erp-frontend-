import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  attentionFactsFromAlerts,
  computeAlertCounts,
  formatAttentionWelcome,
} from '../../../utils/alertCounts';
import { buildPlanets, type SourceResult } from './nexusModel';

const ok = <T>(value: T): SourceResult<T> => ({ state: 'ok', value });
const none = <T = never>(): SourceResult<T> => ({ state: 'unavailable' });

describe('Nexus alert parity', () => {
  it('same count as alert bar helper', () => {
    const input = {
      productsLoad: 'ok' as const,
      invoices: [
        {
          id: 'inv-1',
          customerId: '1',
          invoiceDate: '2020-01-01',
          dueDate: '2020-01-15',
          grandTotal: 200,
        },
      ],
      payments: [],
      products: [{ id: 1, is_active: true, current_stock: 0, min_stock: 1 }],
      arSummary: {
        owed_to_us: 200,
        customer_credits: 0,
        net_receivable: 200,
        per_customer: [{ id: 1, balance: 200 }],
      } as any,
      asOf: new Date('2026-10-23T12:00:00'),
    };
    const counts = computeAlertCounts(input);
    const facts = attentionFactsFromAlerts(counts);
    expect(facts.length).toBe(3);
    expect(formatAttentionWelcome({ firstName: 'Zohaib', shellReady: true, facts })).toContain(
      '3 things need you',
    );
  });

  it('failed load is never spoken as 0 updates', () => {
    const line = formatAttentionWelcome({
      firstName: 'Zohaib',
      shellReady: true,
      shellFailed: true,
      facts: [],
    });
    expect(line).toBe("I couldn't load your updates right now.");
    expect(line).not.toMatch(/0 update/i);
  });

  it('hides tiles with no source', () => {
    const planets = buildPlanets({
      cards: [],
      cardsLoadOk: true,
      cardsLoad: ok(true),
      owedToUs: ok(0),
      openPoCount: ok(0),
      lowStockCount: ok({ alertCount: 0, outOfStock: 0, belowMin: 0 }),
      vansOnline: ok(0),
      vansTotal: ok(0),
      pendingExpenses: ok(0),
      invoiceCountToday: none(),
    });
    expect(planets.filter((p) => p.id === 'payroll' || p.id === 'ai_team' || p.id === 'sales').every((p) => !p.visible)).toBe(
      true,
    );
  });

  it('Nexus page does not render Business health score', () => {
    const src = readFileSync(join(__dirname, 'NexusPage.tsx'), 'utf8');
    expect(src).not.toMatch(/Business health/i);
    expect(src).not.toMatch(/businessHealthScore/);
  });
});
