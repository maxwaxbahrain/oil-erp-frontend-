/**
 * Typed client for GET /api/agent/home-summary.
 * Until the backend exists (404), build the same shape from ErpShell + alertCounts.
 * Owner rule: if arLoad failed → owed_to_us.state = "error" (never invoice-math as owed).
 */

import api from '../../../api/axios';
import type { ErpShellData } from '../../../contexts/ErpShellContext';
import { getExpenseStats } from '../../../services/expenseService';
import {
  alertShellReady,
  attentionFactsFromAlerts,
  computeAlertCounts,
  shellLoadFailureLines,
  type AlertCounts,
} from '../../../utils/alertCounts';
import { summarizeLowStock } from '../../../utils/lowStock';
import { owedToUsFromArSummary } from './nexusModel';

export type BlockState = 'ok' | 'error' | 'unavailable';
export type MetricSeverity = 'action' | 'watch' | 'good';

export type HomeMetricBlock = {
  state: BlockState;
  /** Numeric or display value when state === 'ok'. Never a number when state === 'error'. */
  value?: number | string | null;
  sentence?: string;
  severity?: MetricSeverity;
};

/** Orbit module status tag (UI). */
export type ModuleTag = 'OK' | 'WATCH' | 'ACTION' | 'ERROR' | 'IDLE';

export type HomeModuleBlock = {
  state: BlockState;
  /** Primary value — never a number when state is error/unavailable. */
  value?: number | string | null;
  sub_line?: string;
  tag?: ModuleTag;
};

export type HomeModuleId =
  | 'sales'
  | 'customers'
  | 'collections'
  | 'purchase'
  | 'inventory'
  | 'warehouse'
  | 'delivery'
  | 'finance'
  | 'expenses'
  | 'payroll';

export type HomeModules = Record<HomeModuleId, HomeModuleBlock>;

export type HomeSummary = {
  generated_at: string;
  needs_you_count: number;
  biggest_line: string;
  load_failures: string[];
  owed_to_us: HomeMetricBlock & { overdue_count?: number };
  expenses_to_approve: HomeMetricBlock & { pending_count?: number };
  stock: HomeMetricBlock & { out_of_stock?: number };
  cash_and_bank: HomeMetricBlock;
  sales_today: HomeMetricBlock;
  profit_month: HomeMetricBlock;
  modules: HomeModules;
};

const CACHE_PREFIX = 'soltol:nexus:home-summary:v2:';

export const HOME_MODULE_IDS: HomeModuleId[] = [
  'sales',
  'customers',
  'collections',
  'purchase',
  'inventory',
  'warehouse',
  'delivery',
  'finance',
  'expenses',
  'payroll',
];

export function emptyHomeModules(): HomeModules {
  return {
    sales: { state: 'unavailable' },
    customers: { state: 'unavailable' },
    collections: { state: 'unavailable' },
    purchase: { state: 'unavailable' },
    inventory: { state: 'unavailable' },
    warehouse: { state: 'unavailable' },
    delivery: { state: 'unavailable' },
    finance: { state: 'unavailable' },
    expenses: { state: 'unavailable' },
    payroll: { state: 'unavailable' },
  };
}

export function homeSummaryCacheKey(tenantId: string | number | null | undefined, userId: string | number | null | undefined): string {
  return `${CACHE_PREFIX}${tenantId ?? 't'}:${userId ?? 'u'}`;
}

/** Tab-session only — business numbers must not persist on a shared computer. */
export function readHomeSummaryCache(key: string): HomeSummary | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeSummary;
    if (!parsed?.generated_at || !parsed.modules) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeHomeSummaryCache(key: string, summary: HomeSummary): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(summary));
  } catch {
    /* ignore quota */
  }
}

export function clearHomeSummaryCache(key?: string): void {
  try {
    if (key) {
      sessionStorage.removeItem(key);
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function formatUpdatedAgo(generatedAt: string, now = new Date()): string {
  const then = new Date(generatedAt).getTime();
  if (!Number.isFinite(then)) return 'Updated just now';
  const mins = Math.max(0, Math.floor((now.getTime() - then) / 60_000));
  if (mins <= 0) return 'Updated just now';
  if (mins === 1) return 'Updated 1 min ago';
  return `Updated ${mins} min ago`;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function tagForOwed(overdue: number, owed: number): MetricSeverity {
  if (overdue > 0 || owed > 0.005) return 'action';
  return 'good';
}

function tagForStock(out: number): MetricSeverity {
  if (out > 0) return 'watch';
  return 'good';
}

function tagForExpenses(pending: number): MetricSeverity {
  if (pending > 0) return 'watch';
  return 'good';
}

export type ModuleSourceExtras = {
  /** Van locations already loaded by Nexus — never invent. */
  vans?: { state: BlockState; online?: number; total?: number };
  /** True only when a real trial-balance / books-balanced check ran successfully. */
  financeBalanced?: { state: BlockState; balanced?: boolean; reviewCount?: number };
  /** True only when a real payroll API settled. */
  payroll?: { state: BlockState; value?: string | number; sub_line?: string };
  /** Warehouse sites/transfers — only when a real warehouse source loaded. */
  warehouse?: { state: BlockState; value?: string | number; sub_line?: string };
};

function moduleError(): HomeModuleBlock {
  return { state: 'error', sub_line: 'Tap to retry', tag: 'ERROR' };
}

function moduleUnavailable(): HomeModuleBlock {
  return { state: 'unavailable', sub_line: 'Not set up yet', tag: 'IDLE' };
}

/** Pure: shell + known Nexus sources → per-module orbit cards. Never invent numbers. */
export function buildHomeModules(opts: {
  shell: ErpShellData;
  pendingExpenses?: { state: BlockState; count?: number };
  extras?: ModuleSourceExtras;
}): HomeModules {
  const { shell, extras } = opts;
  const counts: AlertCounts = computeAlertCounts({
    invoices: shell.invoices,
    payments: shell.payments,
    products: shell.products,
    arSummary: shell.arSummary,
    productsLoad: shell.productsLoad,
    invoicesLoad: shell.invoicesLoad,
    paymentsLoad: shell.paymentsLoad,
    arLoad: shell.arLoad,
  });

  // Sales today: no date-filtered invoice source → unavailable (do not invent).
  const sales: HomeModuleBlock = moduleUnavailable();

  // Customers: shell list is loaded with the ERP shell.
  let customers: HomeModuleBlock;
  if (!alertShellReady(shell)) {
    customers = moduleUnavailable();
  } else {
    const n = Array.isArray(shell.customers) ? shell.customers.length : 0;
    customers = {
      state: 'ok',
      value: n,
      sub_line: n === 1 ? '1 customer on file' : `${n} customers on file`,
      tag: 'OK',
    };
  }

  let collections: HomeModuleBlock;
  if (shell.arLoad === 'loading') {
    collections = moduleUnavailable();
  } else if (shell.arLoad === 'failed') {
    collections = moduleError();
  } else {
    const owed = owedToUsFromArSummary(shell.arSummary) ?? 0;
    const overdue = !counts.invoicesLoadFailed ? counts.overdue : 0;
    collections = {
      state: 'ok',
      value: owed,
      sub_line:
        overdue > 0
          ? `${overdue} overdue`
          : owed > 0.005
            ? 'Outstanding receivables'
            : 'Nothing overdue',
      tag: overdue > 0 || owed > 0.005 ? 'ACTION' : 'OK',
    };
  }

  let purchase: HomeModuleBlock;
  if (!alertShellReady(shell)) {
    purchase = moduleUnavailable();
  } else {
    const open = countOpenPurchaseOrdersLocal(shell.purchaseOrders as Array<{ status?: string | null }>);
    purchase = {
      state: 'ok',
      value: open,
      sub_line: open === 1 ? '1 open PO' : `${open} open POs`,
      tag: open > 0 ? 'WATCH' : 'OK',
    };
  }

  let inventory: HomeModuleBlock;
  if (shell.productsLoad === 'loading') {
    inventory = moduleUnavailable();
  } else if (shell.productsLoad === 'failed') {
    inventory = moduleError();
  } else {
    const s = summarizeLowStock(shell.products as any[]);
    inventory = {
      state: 'ok',
      value: s.outOfStock,
      sub_line:
        s.outOfStock > 0
          ? `${s.outOfStock} out · ${s.alertCount} alerts`
          : s.alertCount > 0
            ? `${s.alertCount} stock alerts`
            : 'Stock levels OK',
      tag: s.outOfStock > 0 || s.alertCount > 0 ? 'WATCH' : 'OK',
    };
  }

  let warehouse: HomeModuleBlock;
  const wh = extras?.warehouse;
  if (!wh || wh.state === 'unavailable') {
    warehouse = moduleUnavailable();
  } else if (wh.state === 'error') {
    warehouse = moduleError();
  } else {
    warehouse = {
      state: 'ok',
      value: wh.value ?? null,
      sub_line: wh.sub_line,
      tag: 'OK',
    };
  }

  let delivery: HomeModuleBlock;
  const vans = extras?.vans;
  if (!vans || vans.state === 'unavailable') {
    delivery = moduleUnavailable();
  } else if (vans.state === 'error') {
    delivery = moduleError();
  } else {
    const online = vans.online ?? 0;
    const total = vans.total ?? 0;
    delivery = {
      state: 'ok',
      value: `${online}/${total}`,
      sub_line: total === 0 ? 'No vans on file' : `${online} of ${total} vans live`,
      tag: total === 0 ? 'IDLE' : online === 0 ? 'IDLE' : 'OK',
    };
  }

  // Finance "Balanced" only from a real check — otherwise unavailable.
  let finance: HomeModuleBlock;
  const fin = extras?.financeBalanced;
  if (!fin || fin.state === 'unavailable') {
    finance = moduleUnavailable();
  } else if (fin.state === 'error') {
    finance = moduleError();
  } else if (fin.balanced === true) {
    const review = fin.reviewCount ?? 0;
    finance = {
      state: 'ok',
      value: 'Balanced',
      sub_line: review > 0 ? `${review} to review` : 'Books balanced',
      tag: review > 0 ? 'WATCH' : 'OK',
    };
  } else {
    finance = moduleUnavailable();
  }

  let expenses: HomeModuleBlock;
  const pe = opts.pendingExpenses;
  if (!pe || pe.state === 'unavailable') {
    expenses = moduleUnavailable();
  } else if (pe.state === 'error') {
    expenses = moduleError();
  } else {
    const n = pe.count ?? 0;
    expenses = {
      state: 'ok',
      value: n,
      sub_line: n > 0 ? `${n} waiting for approval` : 'Nothing pending',
      tag: n > 0 ? 'WATCH' : 'OK',
    };
  }

  // Payroll: unavailable unless a real payroll source loaded.
  let payroll: HomeModuleBlock;
  const pay = extras?.payroll;
  if (!pay || pay.state === 'unavailable') {
    payroll = moduleUnavailable();
  } else if (pay.state === 'error') {
    payroll = moduleError();
  } else {
    payroll = {
      state: 'ok',
      value: pay.value ?? null,
      sub_line: pay.sub_line,
      tag: 'OK',
    };
  }

  return {
    sales,
    customers,
    collections,
    purchase,
    inventory,
    warehouse,
    delivery,
    finance,
    expenses,
    payroll,
  };
}

const CLOSED_PO = new Set(['draft', 'rejected', 'completed', 'cancelled', 'canceled', 'paid']);

function countOpenPurchaseOrdersLocal(orders: Array<{ status?: string | null }>): number {
  return orders.filter((po) => !CLOSED_PO.has(String(po.status || '').trim().toLowerCase())).length;
}

/** Pure adapter: shell + optional expense stats → HomeSummary. */
export function homeSummaryFromShell(opts: {
  shell: ErpShellData;
  pendingExpenses?: { state: BlockState; count?: number };
  extras?: ModuleSourceExtras;
  generatedAt?: string;
}): HomeSummary {
  const { shell } = opts;
  const counts: AlertCounts = computeAlertCounts({
    invoices: shell.invoices,
    payments: shell.payments,
    products: shell.products,
    arSummary: shell.arSummary,
    productsLoad: shell.productsLoad,
    invoicesLoad: shell.invoicesLoad,
    paymentsLoad: shell.paymentsLoad,
    arLoad: shell.arLoad,
  });
  const failures = shellLoadFailureLines(counts);
  const facts = attentionFactsFromAlerts(counts);

  // --- owed_to_us: AR only; never invoice-math when AR failed ---
  let owed_to_us: HomeSummary['owed_to_us'];
  if (shell.arLoad === 'loading') {
    owed_to_us = { state: 'unavailable' };
  } else if (shell.arLoad === 'failed') {
    owed_to_us = { state: 'error', sentence: "Couldn't load" };
  } else {
    const owed = owedToUsFromArSummary(shell.arSummary) ?? 0;
    const overdue = !counts.invoicesLoadFailed ? counts.overdue : 0;
    const sentence =
      overdue > 0
        ? `${overdue} invoice${overdue === 1 ? '' : 's'} overdue — act today`
        : owed > 0.005
          ? 'Outstanding receivables'
          : 'Nothing overdue';
    owed_to_us = {
      state: 'ok',
      value: owed,
      overdue_count: overdue,
      sentence,
      severity: tagForOwed(overdue, owed),
    };
  }

  // --- stock ---
  let stock: HomeSummary['stock'];
  if (shell.productsLoad === 'loading') {
    stock = { state: 'unavailable' };
  } else if (shell.productsLoad === 'failed') {
    stock = { state: 'error', sentence: "Couldn't load" };
  } else {
    const s = summarizeLowStock(shell.products as any[]);
    stock = {
      state: 'ok',
      value: s.outOfStock,
      out_of_stock: s.outOfStock,
      sentence:
        s.outOfStock > 0
          ? `${s.outOfStock} product${s.outOfStock === 1 ? '' : 's'} can't be sold now`
          : s.alertCount > 0
            ? counts.lowStockLabel || 'Stock alerts'
            : 'Stock levels OK',
      severity: tagForStock(s.outOfStock),
    };
  }

  // --- expenses ---
  let expenses_to_approve: HomeSummary['expenses_to_approve'];
  const pe = opts.pendingExpenses;
  if (!pe || pe.state === 'unavailable') {
    expenses_to_approve = { state: 'unavailable' };
  } else if (pe.state === 'error') {
    expenses_to_approve = { state: 'error', sentence: "Couldn't load" };
  } else {
    const n = pe.count ?? 0;
    expenses_to_approve = {
      state: 'ok',
      value: n,
      pending_count: n,
      sentence: n > 0 ? `${n} waiting for approval` : 'Nothing pending',
      severity: tagForExpenses(n),
    };
  }

  // Real API not wired yet — hide these tiles.
  const cash_and_bank: HomeMetricBlock = { state: 'unavailable' };
  const sales_today: HomeMetricBlock = { state: 'unavailable' };
  const profit_month: HomeMetricBlock = { state: 'unavailable' };

  const needs = facts.length;

  const failLine: string[] = [];
  if (counts.arLoadFailed) failLine.push("Receivables couldn't load");
  if (counts.invoicesLoadFailed) failLine.push("Invoices couldn't load");
  if (counts.paymentsLoadFailed) failLine.push("Payments couldn't load");
  if (counts.productsLoadFailed) failLine.push("Stock data couldn't load");

  const biggestCore: string[] = [];
  if (owed_to_us.state === 'ok' && typeof owed_to_us.value === 'number' && owed_to_us.value > 0.005) {
    biggestCore.push(`${money(owed_to_us.value)} owed`);
  }
  if (owed_to_us.state === 'ok' && (owed_to_us.overdue_count ?? 0) > 0) {
    biggestCore.push(`${owed_to_us.overdue_count} invoices overdue`);
  }
  const biggest_line =
    biggestCore.length || failLine.length
      ? `Biggest: ${[...biggestCore, ...failLine].join(' · ')}`
      : needs > 0
        ? facts.map((f) => f.label).join(' · ')
        : 'All clear';

  const modules = buildHomeModules({
    shell,
    pendingExpenses: opts.pendingExpenses,
    extras: opts.extras,
  });

  return {
    generated_at: opts.generatedAt ?? new Date().toISOString(),
    needs_you_count: needs,
    biggest_line,
    load_failures: failures,
    owed_to_us,
    expenses_to_approve,
    stock,
    cash_and_bank,
    sales_today,
    profit_month,
    modules,
  };
}

export async function fetchHomeSummaryFromApi(): Promise<HomeSummary | null> {
  try {
    const res = await api.get<HomeSummary>('/api/agent/home-summary');
    if (res.data?.generated_at) return res.data;
    return null;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
}

/** Prefer API; on 404 fall back to shell adapter (+ expenses fetch). */
export async function loadHomeSummary(
  shell: ErpShellData,
  extras?: ModuleSourceExtras,
): Promise<HomeSummary> {
  try {
    const fromApi = await fetchHomeSummaryFromApi();
    if (fromApi?.modules) return fromApi;
  } catch {
    /* fall through to shell */
  }

  let pendingExpenses: { state: BlockState; count?: number } = { state: 'unavailable' };
  try {
    const stats = await getExpenseStats();
    pendingExpenses = {
      state: 'ok',
      count: Number(stats.pending_approval_count || 0),
    };
  } catch {
    pendingExpenses = { state: 'error' };
  }

  return homeSummaryFromShell({ shell, pendingExpenses, extras });
}

/** Open the existing global CommandBar (same as Ctrl+K). */
export function openGlobalCommandBar(): void {
  const ev = new KeyboardEvent('keydown', {
    key: 'k',
    code: 'KeyK',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(ev);
}
