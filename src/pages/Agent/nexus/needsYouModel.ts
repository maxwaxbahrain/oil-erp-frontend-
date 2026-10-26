/**
 * Needs-you ranking for Nexus left panel.
 * Money impact first (biggest amount), then load errors, then watch — never invent.
 */

import type { AttentionFact, AlertCounts } from '../../../utils/alertCounts';
import { signalWhy } from '../signalCards';
import type { NexusSignalCard, SourceResult } from './nexusModel';
import { normalizePriority } from './nexusModel';

export type NeedsYouKind = 'money' | 'error' | 'watch';

export type NeedsYouNav = { label: string; href: string };

export type NeedsYouItem = {
  id: string;
  kind: NeedsYouKind;
  /** Large focus value, e.g. "$65,800 owed" or "Books check" — never "$ -203,775.10". */
  valueLabel: string;
  /** Short row text for NEXT UP. */
  rowText: string;
  sentences: string[];
  /** Amount shown on NEXT UP row; null → "—". Never a number on error. */
  amount: number | null;
  /** Sort key for money tier (0 for non-money). */
  moneyScore: number;
  primary: NeedsYouNav;
  secondary?: NeedsYouNav;
  rowLink: NeedsYouNav;
  /** When true, primary is Retry (caller handles onRetry). */
  retry?: boolean;
  /** Optional badge under eyebrow (e.g. Books check). */
  badge?: string;
};

/** Whole dollars, absolute — never a signed "$ -203,775.10". */
export function formatNeedsMoney(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

function moneyLabel(n: number): string {
  return formatNeedsMoney(n);
}

/** Drop generic status fluff from titles/why. */
export function cleanNeedsCopy(raw: string): string {
  return String(raw || '')
    .replace(/\bStatus\s+attention\b/gi, '')
    .replace(/^\s*[·|]\s*/g, '')
    .replace(/\s*[·|]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function isBooksHealthCard(card: NexusSignalCard): boolean {
  const blob = `${card.module || ''} ${card.title || ''} ${card.why || ''} ${card.watcher_id || ''}`.toLowerCase();
  return /books|inventory.*match|stock records|data.?health|doesn't match|do not match|valuation|trial.?balance|\bgl\b|ledger/.test(
    blob,
  );
}

/** Signed amount for sentence meaning (`-$33,075` / `$48,381`). Labels still use formatNeedsMoney. */
function formatNeedsMoneySigned(n: number): string {
  const abs = formatNeedsMoney(n);
  return n < -0.005 ? `-${abs}` : abs;
}

function isMismatchCopy(text: string): boolean {
  return /difference|doesn't match|do not match|mismatch/i.test(text);
}

/** Plain sentence from real title/why. "difference" only for real mismatches — never guess direction. */
export function booksOrMoneySentence(opts: {
  title: string;
  why: string;
  money: number;
  books: boolean;
}): string {
  void opts.books;
  const title = cleanNeedsCopy(opts.title);
  const why = cleanNeedsCopy(opts.why);
  const core = why || title;
  const absAmt = formatNeedsMoney(opts.money);
  const signedAmt = formatNeedsMoneySigned(opts.money);
  if (!core) {
    return Math.abs(opts.money) > 0.005 ? signedAmt : '';
  }
  const trimmed = core.replace(/[.\s]+$/, '');
  if (isMismatchCopy(core)) {
    return /\$[\d,]/.test(core) ? core : `${trimmed} — ${absAmt} difference.`;
  }
  if (Math.abs(opts.money) > 0.005) {
    return `${trimmed} — ${signedAmt}.`;
  }
  return core;
}

/** Pure ranking: money (desc) → errors → watch. */
export function rankNeedsYouItems(items: NeedsYouItem[]): NeedsYouItem[] {
  const money = items
    .filter((i) => i.kind === 'money')
    .sort((a, b) => b.moneyScore - a.moneyScore || a.id.localeCompare(b.id));
  const errors = items.filter((i) => i.kind === 'error');
  const watch = items
    .filter((i) => i.kind === 'watch')
    .sort((a, b) => b.moneyScore - a.moneyScore || a.id.localeCompare(b.id));
  return [...money, ...errors, ...watch];
}

export function buildNeedsYouItems(input: {
  alertCounts: AlertCounts;
  attentionFacts: AttentionFact[];
  loadFailures: string[];
  cards: NexusSignalCard[];
  cardsLoad: SourceResult<true>;
  dismissed?: Set<string>;
}): NeedsYouItem[] {
  const { alertCounts, loadFailures, cards, cardsLoad } = input;
  const dismissed = input.dismissed || new Set<string>();
  const items: NeedsYouItem[] = [];

  const overdue = !alertCounts.invoicesLoadFailed ? alertCounts.overdue : 0;
  const unpaid = alertCounts.unpaidTotal;

  // Collections / AR — one money card when we have a real owed or overdue count.
  if (!alertCounts.shellLoading && !alertCounts.arLoadFailed && unpaid > 0.005) {
    const sentences: string[] = [];
    if (overdue > 0) {
      sentences.push(
        `${overdue} invoice${overdue === 1 ? '' : 's'} overdue — open the list to collect.`,
      );
    } else {
      sentences.push('Outstanding receivables need a look today.');
    }
    items.push({
      id: 'alert-owed',
      kind: 'money',
      valueLabel: `${moneyLabel(unpaid)} owed`,
      rowText: overdue > 0 ? `${overdue} overdue invoices` : `${moneyLabel(unpaid)} owed`,
      sentences,
      amount: unpaid,
      moneyScore: unpaid,
      primary: { label: 'Open overdue list', href: '/finance/collections' },
      secondary: { label: 'Open customers', href: '/customers' },
      rowLink: { label: 'Review ›', href: '/finance/collections' },
    });
  } else if (!alertCounts.shellLoading && !alertCounts.invoicesLoadFailed && overdue > 0 && unpaid <= 0.005) {
    // Overdue count without a positive unpaid total (edge) — still surface as watch/money with score 0+count.
    items.push({
      id: 'alert-overdue',
      kind: 'money',
      valueLabel: `${overdue} overdue`,
      rowText: `${overdue} overdue invoices`,
      sentences: ['Open collections to review overdue invoices.'],
      amount: null,
      moneyScore: overdue, // count as weak money signal so it still beats $10 watch cards when unpaid missing
      primary: { label: 'Open overdue list', href: '/finance/collections' },
      rowLink: { label: 'Review ›', href: '/finance/collections' },
    });
  }

  if (!alertCounts.shellLoading && !alertCounts.productsLoadFailed && alertCounts.outOfStock > 0) {
    const n = alertCounts.outOfStock;
    items.push({
      id: 'alert-stock',
      kind: 'watch',
      valueLabel: `${n} out of stock`,
      rowText: `${n} product${n === 1 ? '' : 's'} out of stock`,
      sentences: ['Products that cannot be sold until restocked.'],
      amount: null,
      moneyScore: 0,
      primary: { label: 'Open products', href: '/products' },
      rowLink: { label: 'Review ›', href: '/products' },
    });
  } else if (
    !alertCounts.shellLoading &&
    !alertCounts.productsLoadFailed &&
    alertCounts.lowStock > 0 &&
    alertCounts.lowStockLabel
  ) {
    items.push({
      id: 'alert-low-stock',
      kind: 'watch',
      valueLabel: alertCounts.lowStockLabel,
      rowText: alertCounts.lowStockLabel,
      sentences: ['Stock is below minimum on some products.'],
      amount: null,
      moneyScore: 0,
      primary: { label: 'Open products', href: '/products' },
      rowLink: { label: 'Review ›', href: '/products' },
    });
  }

  // Load failures — error tier (Retry).
  for (const line of loadFailures) {
    if (!line) continue;
    items.push({
      id: `fail-${line}`,
      kind: 'error',
      valueLabel: "Couldn't load",
      rowText: line,
      sentences: [line],
      amount: null,
      moneyScore: 0,
      primary: { label: 'Retry', href: '#' },
      rowLink: { label: 'Retry ›', href: '#' },
      retry: true,
    });
  }

  if (cardsLoad.state === 'error') {
    items.push({
      id: 'fail-signals',
      kind: 'error',
      valueLabel: "Couldn't load",
      rowText: "Signal updates couldn't load",
      sentences: ["Signal and data-health cards couldn't load."],
      amount: null,
      moneyScore: 0,
      primary: { label: 'Retry', href: '#' },
      rowLink: { label: 'Retry ›', href: '#' },
      retry: true,
    });
  }

  // Agent signal + data-health cards (real titles/why/money only).
  if (cardsLoad.state === 'ok') {
    for (const card of cards) {
      if (dismissed.has(card.id)) continue;
      const money = Number(card.money) || 0;
      const title = cleanNeedsCopy(card.title || '');
      const why = cleanNeedsCopy(signalWhy(card.why || ''));
      const isFail = card.watcher_id === 'check_failed';
      const books = isBooksHealthCard(card);
      const priority = normalizePriority(card.priority);
      let kind: NeedsYouKind = 'watch';
      if (isFail) kind = 'error';
      else if (Math.abs(money) > 0.005) kind = 'money';
      else if (priority === 'urgent' || priority === 'today') kind = 'watch';

      const href = card.href || '/agent/nexus';
      const openLabel = card.action
        ? String(card.action).match(/send|post|approve|create/i)
          ? `Open ${card.module || 'update'}`
          : card.action
        : 'Open';

      const sentence = isFail
        ? why || title || "Couldn't load this check."
        : booksOrMoneySentence({ title, why, money, books });

      items.push({
        id: `card-${card.id}`,
        kind,
        valueLabel: isFail
          ? "Couldn't load"
          : books
            ? 'Books check'
            : Math.abs(money) > 0.005
              ? formatNeedsMoney(money)
              : title || 'Update',
        rowText: books ? 'Books check' : title || 'Update',
        sentences: [sentence].filter(Boolean),
        amount: isFail ? null : Math.abs(money) > 0.005 ? Math.abs(money) : null,
        moneyScore: isFail ? 0 : Math.abs(money),
        primary: isFail
          ? { label: 'Retry', href: '#' }
          : { label: openLabel.startsWith('Open') ? openLabel : `Open · ${openLabel}`, href },
        rowLink: isFail
          ? { label: 'Retry ›', href: '#' }
          : { label: 'Review ›', href },
        retry: isFail,
        badge: books ? 'Books check' : undefined,
      });
    }
  }

  return rankNeedsYouItems(items);
}

export function countUrgentNeeds(items: NeedsYouItem[]): number {
  return items.filter((i) => i.kind === 'money' || i.kind === 'error').length;
}

/** Hero line counts — same source as the left Needs-you list. */
export function formatNeedsHeroLine(total: number, urgent: number): string {
  if (total <= 0) return 'Nothing needs you right now.';
  if (urgent > 0 && urgent < total) {
    return `${urgent} urgent · ${total} total`;
  }
  return `${total} thing${total === 1 ? '' : 's'} need you.`;
}

/** Focus card is always the top-ranked item. */
export function focusNeedsYouItem(ranked: NeedsYouItem[]): NeedsYouItem | null {
  return ranked[0] || null;
}

export function nextUpItems(ranked: NeedsYouItem[], limit = 4): NeedsYouItem[] {
  return ranked.slice(1, 1 + limit);
}

export function moreCount(ranked: NeedsYouItem[], shownNext = 4): number {
  return Math.max(0, ranked.length - 1 - shownNext);
}
