import { describe, expect, it } from 'vitest';
import type { AlertCounts } from '../../../utils/alertCounts';
import type { NexusSignalCard, SourceResult } from './nexusModel';
import {
  booksOrMoneySentence,
  buildNeedsYouItems,
  cleanNeedsCopy,
  countUrgentNeeds,
  focusNeedsYouItem,
  formatNeedsHeroLine,
  formatNeedsMoney,
  moreCount,
  nextUpItems,
  rankNeedsYouItems,
  stripRawMoneyFigures,
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

  it('never shows signed money or Status attention; books use Books check', () => {
    expect(formatNeedsMoney(-203775.1)).toBe('$203,775');
    expect(cleanNeedsCopy('Status attention · bad')).toBe('bad');
    const sentence = booksOrMoneySentence({
      title: 'Inventory mismatch',
      why: "Inventory in the books doesn't match stock records.",
      money: -203775.1,
      books: true,
    });
    expect(sentence).toContain('$203,775');
    expect(sentence).not.toMatch(/\$\s*-/);
    expect(sentence).toMatch(/difference/i);

    const ranked = buildNeedsYouItems({
      alertCounts: counts({ unpaidTotal: 0 }),
      attentionFacts: [],
      loadFailures: [],
      cards: [
        card({
          id: 'books-1',
          title: 'Status attention',
          why: "Inventory in the books doesn't match stock records.",
          money: -203775.1,
          module: 'finance',
          watcher_id: 'inventory_valuation',
          priority: 'urgent',
        }),
      ],
      cardsLoad: okLoad,
    });
    const focus = focusNeedsYouItem(ranked);
    expect(focus?.valueLabel).toBe('Books check');
    expect(focus?.valueLabel).not.toMatch(/-/);
    // Badge OR title — never both "Books check"
    expect(focus?.badge).toBeUndefined();
    expect(focus?.sentences[0]).toContain('$203,775');
  });

  it('focus wording: strip leading punct, one formatted money, no raw signed figure', () => {
    expect(cleanNeedsCopy('. Inventory mismatch')).toBe('Inventory mismatch');
    expect(stripRawMoneyFigures('Gap is -203,775.10 vs stock')).toBe('Gap is vs stock');
    const sentence = booksOrMoneySentence({
      title: '. Status attention',
      why: "Inventory doesn't match stock — -203,775.10",
      money: -203775.1,
      books: true,
    });
    expect(sentence).toMatch(/difference/i);
    expect(sentence).toContain('$203,775');
    expect(sentence).not.toMatch(/-203,?775\.10/);
    expect((sentence.match(/\$203,775/g) || []).length).toBe(1);
  });

  it('difference only on real mismatches; other money keeps sign; no direction guess', () => {
    const mismatch = booksOrMoneySentence({
      title: 'Inventory mismatch',
      why: "Inventory in the books doesn't match stock records.",
      money: -203775.1,
      books: true,
    });
    expect(mismatch).toMatch(/difference/i);
    expect(mismatch).toContain('$203,775');

    const negCash = booksOrMoneySentence({
      title: 'Cash on hand is negative',
      why: '',
      money: -33075,
      books: false,
    });
    expect(negCash).not.toMatch(/difference/i);
    expect(negCash).toBe('Cash on hand is negative — -$33,075.');
    expect(negCash).not.toMatch(/books below stock/i);

    const testInvoices = booksOrMoneySentence({
      title: '41 test invoices are still in this company',
      why: '',
      money: 48381,
      books: false,
    });
    expect(testInvoices).not.toMatch(/difference/i);
    expect(testInvoices).toBe('41 test invoices are still in this company — $48,381.');

    const bareNeg = booksOrMoneySentence({
      title: '',
      why: '',
      money: -33075,
      books: true,
    });
    expect(bareNeg).toBe('-$33,075');
    expect(bareNeg).not.toMatch(/difference|books below stock|needs attention/i);

    const barePos = booksOrMoneySentence({
      title: '',
      why: '',
      money: 48381,
      books: false,
    });
    expect(barePos).toBe('$48,381');
    expect(barePos).not.toMatch(/difference|needs attention/i);
  });

  it('hero line matches needs-you list counts', () => {
    const ranked = buildNeedsYouItems({
      alertCounts: counts({ unpaidTotal: 50000, overdue: 10, outOfStock: 2 }),
      attentionFacts: [],
      loadFailures: ['AR failed'],
      cards: [
        card({ id: 'c1', title: 'Near limit', money: 10, priority: 'urgent' }),
        card({ id: 'c2', title: 'Watch me', money: 0, priority: 'today' }),
      ],
      cardsLoad: okLoad,
    });
    const urgent = countUrgentNeeds(ranked);
    const line = formatNeedsHeroLine(ranked.length, urgent);
    expect(ranked.length).toBeGreaterThan(0);
    if (urgent > 0 && urgent < ranked.length) {
      expect(line).toBe(`${urgent} urgent · ${ranked.length} total`);
    } else {
      expect(line).toContain(`${ranked.length}`);
    }
  });
});
