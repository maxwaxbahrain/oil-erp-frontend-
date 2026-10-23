/**
 * Shared top-bar / Nexus attention math.
 * App.tsx alert strip and Zava Nexus must call this — do not copy.
 */

import { isCustomerPayment } from '../services/api';
import type { ArSummary } from '../services/customerService';
import { calculateReceivables, capReceivablesByLedger } from './arMetrics';
import { outstandingTotals } from './outstandingTotals';
import { formatLowStockShort, summarizeLowStock } from './lowStock';

export type ShellLoadState = 'loading' | 'ok' | 'failed';

/** @deprecated Use ShellLoadState */
export type ProductsLoadState = ShellLoadState;

export type AlertCountsInput = {
  invoices?: unknown[] | null;
  payments?: unknown[] | null;
  products?: unknown[] | null;
  arSummary?: ArSummary | null;
  productsLoad?: ShellLoadState | string | null;
  invoicesLoad?: ShellLoadState | string | null;
  paymentsLoad?: ShellLoadState | string | null;
  arLoad?: ShellLoadState | string | null;
  /** Defaults to now; inject in tests for stable buckets. */
  asOf?: Date;
};

export type AlertCounts = {
  unpaid: number;
  unpaidTotal: number;
  creditTotal: number;
  netTotal: number;
  overdue: number;
  /** alertCount when products ok; else 0 (never fake "0 out of stock" on failure). */
  lowStock: number;
  lowStockLabel: string;
  outOfStock: number;
  productsLoadFailed: boolean;
  invoicesLoadFailed: boolean;
  paymentsLoadFailed: boolean;
  arLoadFailed: boolean;
  /** True until App's shell fetch settles. */
  productsLoading: boolean;
  shellLoading: boolean;
};

export type AttentionFact = {
  id: 'overdue' | 'owed' | 'out_of_stock';
  label: string;
};

function normLoad(raw: string | null | undefined): ShellLoadState {
  const s = String(raw || 'loading');
  if (s === 'ok' || s === 'failed') return s;
  return 'loading';
}

function settled(raw: string | null | undefined): boolean {
  const s = normLoad(raw);
  return s === 'ok' || s === 'failed';
}

/**
 * Same formulas as the App header alert strip.
 * Load flags do not change the numeric math (bar stays visually the same).
 */
export function computeAlertCounts(input: AlertCountsInput): AlertCounts {
  const invs = (input.invoices as any[]) || [];
  const pays = ((input.payments as any[]) || []).filter(isCustomerPayment);
  const prods = (input.products as any[]) || [];
  const asOf = input.asOf ?? new Date();
  const receivables = calculateReceivables(invs, pays, asOf);
  const ar = input.arSummary ?? null;
  const ledgerByCustomer =
    ar && Array.isArray(ar.per_customer)
      ? new Map(ar.per_customer.map((c) => [String(c.id), c.balance]))
      : null;
  const capped = capReceivablesByLedger(receivables, ledgerByCustomer);
  const headline = outstandingTotals(ar);
  const unpaid = capped.invoices.length;
  const unpaidTotal = headline ? headline.owedToUs : capped.total;
  const creditTotal = headline ? Math.abs(headline.customerCredits) : 0;
  const netTotal = headline ? headline.netReceivable : unpaidTotal;
  const overdue = capped.invoices.filter((r) => r.bucket !== 'current').length;
  const productsLoad = normLoad(input.productsLoad);
  const invoicesLoad = normLoad(input.invoicesLoad);
  const paymentsLoad = normLoad(input.paymentsLoad);
  const arLoad = normLoad(input.arLoad);
  const productsOk = productsLoad === 'ok';
  const lowStockSummary = summarizeLowStock(prods);
  return {
    unpaid,
    unpaidTotal,
    creditTotal,
    netTotal,
    overdue,
    lowStock: productsOk ? lowStockSummary.alertCount : 0,
    lowStockLabel: productsOk ? formatLowStockShort(lowStockSummary) : '',
    outOfStock: productsOk ? lowStockSummary.outOfStock : 0,
    productsLoadFailed: productsLoad === 'failed',
    invoicesLoadFailed: invoicesLoad === 'failed',
    paymentsLoadFailed: paymentsLoad === 'failed',
    arLoadFailed: arLoad === 'failed',
    productsLoading: productsLoad === 'loading',
    shellLoading:
      productsLoad === 'loading'
      || invoicesLoad === 'loading'
      || paymentsLoad === 'loading'
      || arLoad === 'loading',
  };
}

/** Shell ready when invoices, payments, AR, and products have all settled. */
export function alertShellReady(
  input: Pick<AlertCountsInput, 'productsLoad' | 'invoicesLoad' | 'paymentsLoad' | 'arLoad'>,
): boolean {
  return (
    settled(input.invoicesLoad)
    && settled(input.paymentsLoad)
    && settled(input.arLoad)
    && settled(input.productsLoad)
  );
}

/** Spoken / UI failure lines — never treat a failed source as all-clear. */
export function shellLoadFailureLines(
  input: Pick<AlertCountsInput, 'productsLoad' | 'invoicesLoad' | 'paymentsLoad' | 'arLoad'> | AlertCounts,
): string[] {
  const lines: string[] = [];
  const inv =
    'invoicesLoadFailed' in input
      ? input.invoicesLoadFailed
      : normLoad((input as AlertCountsInput).invoicesLoad) === 'failed';
  const pay =
    'paymentsLoadFailed' in input
      ? input.paymentsLoadFailed
      : normLoad((input as AlertCountsInput).paymentsLoad) === 'failed';
  const ar =
    'arLoadFailed' in input
      ? input.arLoadFailed
      : normLoad((input as AlertCountsInput).arLoad) === 'failed';
  const prod =
    'productsLoadFailed' in input
      ? input.productsLoadFailed
      : normLoad((input as AlertCountsInput).productsLoad) === 'failed';
  if (inv) lines.push("I couldn't load invoices right now.");
  if (pay) lines.push("I couldn't load payments right now.");
  if (ar) lines.push("I couldn't load receivables right now.");
  if (prod) lines.push("I couldn't load stock right now.");
  return lines;
}

/**
 * Plain facts for "Needs you" / welcome — aligned with the alert bar.
 * Empty while shell still loading. Skip facts that depend on a failed source.
 */
export function attentionFactsFromAlerts(counts: AlertCounts): AttentionFact[] {
  if (counts.shellLoading) return [];
  const facts: AttentionFact[] = [];
  // Skip overdue when invoices failed (empty [] would look like "0 overdue").
  if (!counts.invoicesLoadFailed && counts.overdue > 0) {
    facts.push({
      id: 'overdue',
      label: `${counts.overdue} overdue invoice${counts.overdue === 1 ? '' : 's'}`,
    });
  }
  // Owed from AR headline and/or invoice math — only when a source produced a real total.
  if (counts.unpaidTotal > 0.005) {
    facts.push({
      id: 'owed',
      label: `$${Math.round(counts.unpaidTotal).toLocaleString('en-US')} owed`,
    });
  }
  if (!counts.productsLoadFailed) {
    if (counts.outOfStock > 0) {
      facts.push({
        id: 'out_of_stock',
        label: `${counts.outOfStock} product${counts.outOfStock === 1 ? '' : 's'} out of stock`,
      });
    } else if (counts.lowStock > 0 && counts.lowStockLabel) {
      facts.push({
        id: 'out_of_stock',
        label: counts.lowStockLabel,
      });
    }
  }
  return facts;
}

export function formatAttentionWelcome(opts: {
  firstName: string;
  shellReady: boolean;
  facts: AttentionFact[];
  /** e.g. "I couldn't load invoices right now." */
  loadFailures?: string[];
}): string {
  if (!opts.shellReady) {
    return "I couldn't load your updates right now.";
  }
  const failures = (opts.loadFailures || []).filter(Boolean);
  const factLabels = opts.facts.map((f) => f.label);
  if (factLabels.length === 0 && failures.length === 0) {
    return `Welcome back, ${opts.firstName}. Nothing needs you right now.`;
  }
  // Never say "Nothing needs you" when something failed to load.
  if (factLabels.length === 0) {
    return `Welcome back, ${opts.firstName}. ${failures.join(' ')}`;
  }
  if (failures.length > 0) {
    return `Welcome back, ${opts.firstName}. ${factLabels.join(', ')}. ${failures.join(' ')}`;
  }
  const n = factLabels.length;
  return `Welcome back, ${opts.firstName}. ${n} thing${n === 1 ? '' : 's'} need you: ${factLabels.join(', ')}.`;
}
