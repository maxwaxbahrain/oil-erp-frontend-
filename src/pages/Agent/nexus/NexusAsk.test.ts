import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SpatialBlock } from '../spatial';
import { ASK_CHIPS, navButtonsFromBlocks } from './NexusAsk';

describe('navButtonsFromBlocks', () => {
  it('returns at most 2 navigate hrefs from real blocks', () => {
    const blocks: SpatialBlock[] = [
      {
        type: 'debtors',
        debtors: [{ name: 'Gamma Garage', value: '$7,118', href: '/customers/12' }],
      },
      {
        type: 'metrics',
        tiles: [
          { label: 'Sales', value: '$1', href: '/sales/invoices' },
          { label: 'Extra', value: '$2', href: '/reports/day-book' },
        ],
      },
    ];
    const btns = navButtonsFromBlocks(blocks);
    expect(btns.length).toBe(2);
    expect(btns[0].href).toBe('/customers/12');
    expect(btns.every((b) => b.href.startsWith('/'))).toBe(true);
  });

  it('skips blocks without href', () => {
    expect(navButtonsFromBlocks([{ type: 'note', headline: 'Hi' }])).toEqual([]);
  });
});

describe('Ask Zava panel contract', () => {
  it('has static try-asking chips and no Confirm/Edit/Cancel action cards', () => {
    expect(ASK_CHIPS.length).toBe(5);
    const src = readFileSync(join(__dirname, 'NexusAsk.tsx'), 'utf8');
    expect(src).toMatch(/Ask Zava/);
    expect(src).toMatch(/Thinking…/);
    expect(src).toMatch(/Couldn't get an answer/);
    expect(src).toMatch(/\/api\/agent\/chat/);
    expect(src).not.toMatch(/\bConfirm\b/);
    expect(src).not.toMatch(/\bEdit\b/);
    // Cancel/Confirm live in NexusAskCustomerDraft; NexusAsk uses onDismiss only.
    expect(src).not.toMatch(/>\s*Confirm\s*</);
    expect(src).not.toMatch(/>\s*Edit\s*</);
    expect(src).not.toMatch(/>\s*Cancel\s*</);
    expect(src).toMatch(/Try asking/);
  });

  it('NexusPage right column uses NexusAsk (Coming up removed)', () => {
    const page = readFileSync(join(__dirname, 'NexusPage.tsx'), 'utf8');
    expect(page).toMatch(/<NexusAsk/);
    expect(page).not.toMatch(/Coming up/);
  });
});

describe('askZavaChat uses agent chat', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('posts message to /api/agent/chat', async () => {
    vi.doMock('../../../api/axios', () => ({
      default: {
        post: vi.fn().mockResolvedValue({
          data: {
            headline: 'Gamma Garage owes $7,118.',
            note: 'Highest AR balance today.',
            answer: 'Gamma Garage owes $7,118.',
            blocks: [{ type: 'debtors', debtors: [{ name: 'Gamma', value: '$1', href: '/customers/3' }] }],
          },
        }),
      },
    }));
    const { askZavaChat } = await import('./NexusAsk');
    const api = (await import('../../../api/axios')).default;
    const result = await askZavaChat('Who owes the most?');
    expect(api.post).toHaveBeenCalledWith(
      '/api/agent/chat',
      { message: 'Who owes the most?' },
      expect.objectContaining({ timeout: 70_000 }),
    );
    expect(result.headline).toContain('Gamma');
    expect(result.buttons[0]?.href).toBe('/customers/3');
  });
});
