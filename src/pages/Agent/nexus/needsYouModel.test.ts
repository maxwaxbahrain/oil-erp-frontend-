import { describe, expect, it } from 'vitest';
import type { AlertCounts } from '../../../utils/alertCounts';
import type { NexusSignalCard, SourceResult } from './nexusModel';
import {
  buildNeedsYouItems,
  focusNeedsYouItem,
  moreCount,
  nextUpItems,
  rankNeedsYouItems,
  type NeedsYouItem,
} from './needsYouModel';

function counts(partial: Partial<AlertCounts>): AlertCounts {
  return {
    unpaid: 0,
    unpaidTotal: 0,
    creditTotal: 0,
    netTotal: 0,
    overdue: 0,
    lowStock: 0,
    lowStockLabel: '',
    outOfStock: 0,
    productsLoadFailed: false,
    invoicesLoadFailed: false,
    paymentsLoadFailed: false,
    arLoadFailed: false,
    productsLoading: false,
    shellLoading: false,
    ...partial,
  };
}

const okLoad: SourceResult<true> = { state: 'ok', value: true };

function card(partial: Partial<NexusSignalCard> & Pick<NexusSignalCard, 'id' | 'title'>): NexusSignalCard {
  return {
    why: '',
    action: 'Open',
    money: 0,
    priority: 'today',
    href: '/agent',
    module: 'sales',
    ...partial,
  };
}

describe('rankNeedsYouItems', () => {
  it('money impact first — $10 credit never outranks large overdue AR', () => {
    const items: NeedsYouItem[] = [
      {
        id: 'credit',
        kind: 'money',
        valueLabel: '$10',
        rowText: 'Near credit limit',
        sentences: [],
        amount: 10,
        moneyScore: 10,
        primary: { label: 'Open', href: '/customers/1' },
        rowLink: { label: 'Review ›', href: '/customers/1' },
      },
      {
        id: 'owed',
        kind: 'money',
        valueLabel: '$65,800 owed',
        rowText: '131 overdue',
        sentences: [],
        amount: 65800,
        moneyScore: 65800,
        primary: { label: 'Open overdue list', href: '/finance/collections' },
        rowLink: { label: 'Review ›', href: '/finance/collections' },
      },
      {
        id: 'fail',
        kind: 'error',
        valueLabel: "Couldn't load",
        rowText: 'Payroll failed',
        sentences: [],
        amount: null,
        moneyScore: 0,
        primary: { label: 'Retry', href: '#' },
        rowLink: { label: 'Retry ›', href: '#' },
        retry: true,
      },
      {
        id: 'stock',
        kind: 'watch',
        valueLabel: '11 out',
        rowText: 'Out of stock',
        sentences: [],
        amount: null,
        moneyScore: 0,
        primary: { label: 'Open products', href: '/products' },
        rowLink: { label: 'Review ›', href: '/products' },
      },
    ];
    const ranked = rankNeedsYouItems(items);
    expect(ranked.map((i) => i.id)).toEqual(['owed', 'credit', 'fail', 'stock']);
    expect(focusNeedsYouItem(ranked)?.id).toBe('owed');
  });
});

describe('buildNeedsYouItems', () => {
  it('focus is top money item; error has no amount number', () => {
    const ranked = buildNeedsYouItems({
      alertCounts: counts({ unpaidTotal: 65800, overdue: 131 }),
      attentionFacts: [
        { id: 'overdue', label: '131 overdue invoices' },
        { id: 'owed', label: '$65,800 owed' },
      ],
      loadFailures: ["Payroll data couldn't load."],
      cards: [
        card({
          id: 'c1',
          title: 'Near credit limit',
          money: 10,
          href: '/customers/9',
          watcher_id: 'near_credit_limit',
          priority: 'urgent',
        }),
      ],
      cardsLoad: okLoad,
    });
    expect(focusNeedsYouItem(ranked)?.id).toBe('alert-owed');
    expect(focusNeedsYouItem(ranked)?.primary.href).toBe('/finance/collections');
    expect(focusNeedsYouItem(ranked)?.primary.label).toMatch(/Open overdue/i);
    const err = ranked.find((i) => i.kind === 'error');
    expect(err?.valueLabel).toBe("Couldn't load");
    expect(err?.amount).toBeNull();
    expect(nextUpItems(ranked, 4).length).toBeLessThanOrEqual(4);
    expect(moreCount(ranked, 4)).toBeGreaterThanOrEqual(0);
  });

  it('buttons navigate to real module routes', () => {
    const ranked = buildNeedsYouItems({
      alertCounts: counts({ outOfStock: 3, unpaidTotal: 0 }),
      attentionFacts: [{ id: 'out_of_stock', label: '3 products out of stock' }],
      loadFailures: [],
      cards: [],
      cardsLoad: okLoad,
    });
    expect(ranked[0]?.primary.href).toBe('/products');
  });
});
