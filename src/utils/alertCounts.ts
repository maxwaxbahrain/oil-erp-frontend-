/**
 * Shared top-bar / Nexus attention math.
 * App.tsx alert strip and Zava Nexus must call this — do not copy.
 */

import { isCustomerPayment } from '../services/api';
import type { ArSummary } from '../services/customerService';
import { calculateReceivables, capReceivablesByLedger } from './arMetrics';
import { outstandingTotals } from './outstandingTotals';
import { formatLowStockShort, summarizeLowStock } from './lowStock';

export type ProductsLoadState = 'loading' | 'ok' | 'failed';

export type AlertCountsInput = {
  invoices?: unknown[] | null;
  payments?: unknown[] | null;
  products?: unknown[] | null;
  arSummary?: ArSummary | null;
  productsLoad?: ProductsLoadState | string | null;
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
  /** True until App's shell fetch settles. */
  productsLoading: boolean;
};

export type AttentionFact = {
  id: 'overdue' | 'owed' | 'out_of_stock';
  label: string;
};

/**
 * Same formulas as the App header alert strip.
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
  const productsLoad = String(input.productsLoad || 'loading');
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
    productsLoading: productsLoad === 'loading' || productsLoad === '',
  };
}

/** Shell data is ready for welcome / Nexus counts (App finished its Promise.all). */
export function alertShellReady(input: Pick<AlertCountsInput, 'productsLoad'>): boolean {
  const s = String(input.productsLoad || 'loading');
  return s === 'ok' || s === 'failed';
}

/**
 * Plain facts for "Needs you" / welcome — aligned with the alert bar.
 * Empty when shell still loading.
 */
export function attentionFactsFromAlerts(counts: AlertCounts): AttentionFact[] {
  if (counts.productsLoading) return [];
  const facts: AttentionFact[] = [];
  if (counts.overdue > 0) {
    facts.push({
      id: 'overdue',
      label: `${counts.overdue} overdue invoice${counts.overdue === 1 ? '' : 's'}`,
    });
  }
  if (counts.unpaidTotal > 0.005) {
    facts.push({
      id: 'owed',
      label: `$${Math.round(counts.unpaidTotal).toLocaleString('en-US')} owed`,
    });
  }
  if (counts.productsLoadFailed) {
    // Don't invent stock; surface failure elsewhere. Owed/overdue still count.
  } else if (counts.outOfStock > 0) {
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
  return facts;
}

export function formatAttentionWelcome(opts: {
  firstName: string;
  shellReady: boolean;
  shellFailed?: boolean;
  facts: AttentionFact[];
}): string {
  if (!opts.shellReady || opts.shellFailed) {
    return "I couldn't load your updates right now.";
  }
  const n = opts.facts.length;
  if (n <= 0) {
    return `Welcome back, ${opts.firstName}. Nothing needs you right now.`;
  }
  const list = opts.facts.map((f) => f.label).join(', ');
  return `Welcome back, ${opts.firstName}. ${n} thing${n === 1 ? '' : 's'} need you: ${list}.`;
}
