/**
 * Instant Ask answers from data already on Nexus — no /api/agent/chat.
 */

import type { ArCustomerBalance, ArSummary } from '../../../services/customerService';
import type { HomeSummary } from './homeSummaryApi';
import type { NeedsYouItem } from './needsYouModel';
import {
  formatCustomerBalanceSpeech,
  formatVoiceMoney,
  parseVoiceIntent,
  resolveCustomerMatches,
  stripVoiceDecorations,
} from './voiceIntent';
import type { AskNavButton } from './nexusAskNav';

export type AskFastAnswer = {
  headline: string;
  detail: string;
  buttons: AskNavButton[];
  /** Full line for TTS */
  speak: string;
};

export type AskFastContext = {
  homeSummary: HomeSummary | null;
  needsItems: NeedsYouItem[];
  arSummary: ArSummary | null;
  arLoadedOk: boolean;
};

export const AR_NOT_LOADED_MSG = "I couldn't load receivables right now.";
const CUSTOMER_NOT_FOUND_MSG = "I couldn't find that customer.";

function normAsk(raw: string): string {
  return stripVoiceDecorations(raw);
}

function metricSentence(block: { state?: string; sentence?: string; value?: unknown } | undefined): string | null {
  if (!block || block.state !== 'ok') return null;
  if (block.sentence?.trim()) return block.sentence.trim();
  if (block.value != null && block.value !== '') return String(block.value);
  return null;
}

function isWhoOwesMostQuestion(t: string): boolean {
  return (
    t === 'who owes the most' ||
    t === 'who owes me the most' ||
    t.includes('who owes the most') ||
    t.includes('biggest debtor')
  );
}

/** Highest positive ledger balance in per_customer — never company total. */
export function topDebtorFromAr(ar: ArSummary): ArCustomerBalance | null {
  let best: ArCustomerBalance | null = null;
  for (const row of ar.per_customer || []) {
    const b = Number(row.balance);
    if (!Number.isFinite(b) || b <= 0.005) continue;
    if (!best || b > Number(best.balance)) best = row;
  }
  return best;
}

function extractCustomerBalanceQuery(t: string, rawQuestion: string): string | null {
  const voice = parseVoiceIntent(rawQuestion);
  if (voice.type === 'customer') return voice.query;

  const howMuch = t.match(/^(?:how much does|how much do)\s+(.+?)\s+owe(?:\s+us)?$/);
  if (howMuch?.[1]) return howMuch[1].replace(/^(customer|the)\s+/, '').trim();

  const balanceSuffix = t.match(/^(.+?)\s+balance$/);
  if (balanceSuffix?.[1] && !/^(what|the)\s/.test(balanceSuffix[1])) {
    return balanceSuffix[1].replace(/^(customer|the)\s+/, '').trim();
  }

  const balanceFor = t.match(/^balance for\s+(.+)$/);
  if (balanceFor?.[1]) return balanceFor[1].trim();

  return null;
}

function arCustomers(ctx: AskFastContext): Array<{ id: number; name: string }> {
  if (!ctx.arLoadedOk || !ctx.arSummary) return [];
  return (ctx.arSummary.per_customer || []).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
  }));
}

function balanceByCustomerId(ctx: AskFastContext): Map<number, number> {
  const map = new Map<number, number>();
  if (!ctx.arSummary) return map;
  for (const row of ctx.arSummary.per_customer || []) {
    map.set(Number(row.id), Number(row.balance));
  }
  return map;
}

function answerWhoOwesMost(ctx: AskFastContext): AskFastAnswer {
  if (!ctx.arLoadedOk || !ctx.arSummary) {
    return {
      headline: AR_NOT_LOADED_MSG,
      detail: '',
      buttons: [{ label: 'Open Collections', href: '/finance/collections' }],
      speak: AR_NOT_LOADED_MSG,
    };
  }
  const top = topDebtorFromAr(ctx.arSummary);
  if (!top) {
    const line = 'No customers owe you right now.';
    return { headline: line, detail: '', buttons: [], speak: line };
  }
  const headline = `${top.name} owes the most: ${formatVoiceMoney(Number(top.balance))}.`;
  return {
    headline,
    detail: '',
    buttons: [{ label: `Open ${top.name}`, href: `/customers/${top.id}` }],
    speak: headline,
  };
}

function answerCustomerBalance(query: string, ctx: AskFastContext): AskFastAnswer | null {
  const q = query.trim();
  if (!q) return null;

  if (!ctx.arLoadedOk || !ctx.arSummary) {
    return {
      headline: AR_NOT_LOADED_MSG,
      detail: '',
      buttons: [],
      speak: AR_NOT_LOADED_MSG,
    };
  }

  const customers = arCustomers(ctx);
  const resolved = resolveCustomerMatches(customers, q);
  const balances = balanceByCustomerId(ctx);

  if (resolved.kind === 'none') {
    return {
      headline: CUSTOMER_NOT_FOUND_MSG,
      detail: '',
      buttons: [],
      speak: CUSTOMER_NOT_FOUND_MSG,
    };
  }

  if (resolved.kind === 'many') {
    const names = resolved.matches.map((m) => m.name);
    const headline =
      names.length === 2
        ? `Did you mean ${names[0]} or ${names[1]}?`
        : `Did you mean ${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}?`;
    return { headline, detail: '', buttons: [], speak: headline };
  }

  const id = resolved.kind === 'one' ? resolved.id : resolved.id;
  const name = resolved.kind === 'one' ? resolved.name : resolved.name;
  const bal = balances.has(id) ? balances.get(id)! : 0;
  const headline = formatCustomerBalanceSpeech(name, bal);
  return {
    headline,
    detail: '',
    buttons: [{ label: `Open ${name}`, href: `/customers/${id}` }],
    speak: headline,
  };
}

export function tryAskFastPath(question: string, ctx: AskFastContext): AskFastAnswer | null {
  const t = normAsk(question);
  if (!t) return null;

  if (isWhoOwesMostQuestion(t)) {
    return answerWhoOwesMost(ctx);
  }

  const customerQ = extractCustomerBalanceQuery(t, question);
  if (customerQ) {
    return answerCustomerBalance(customerQ, ctx);
  }

  const voice = parseVoiceIntent(question);
  if (voice.type === 'open_module') {
    return {
      headline: `Opening ${voice.label}.`,
      detail: '',
      buttons: [{ label: `Open ${voice.label}`, href: voice.href }],
      speak: `Opening ${voice.label}.`,
    };
  }
  if (voice.type === 'vans') {
    const delivery = ctx.homeSummary?.modules?.delivery;
    const sub = delivery?.state === 'ok' && delivery.sub_line ? delivery.sub_line : null;
    const headline = sub || 'Check the ops map for live van status.';
    return {
      headline,
      detail: '',
      buttons: [{ label: 'Open Delivery', href: '/agent/ops-map' }],
      speak: headline,
    };
  }

  if (
    t.includes('overdue invoice') ||
    t === 'overdue invoices' ||
    t.includes('how many overdue')
  ) {
    const owed = ctx.homeSummary?.owed_to_us;
    const n = owed?.overdue_count;
    const headline =
      owed?.state === 'ok' && n != null
        ? `${n} overdue invoice${n === 1 ? '' : 's'}.`
        : metricSentence(owed) || "I couldn't read overdue invoices right now.";
    return {
      headline,
      detail: '',
      buttons: [{ label: 'Open Collections', href: '/finance/collections' }],
      speak: headline,
    };
  }

  if (
    t.includes('out of stock') ||
    t.includes('reorder') ||
    t === 'what should i reorder' ||
    t.includes('what to reorder')
  ) {
    const stock = ctx.homeSummary?.stock;
    const out = stock?.out_of_stock;
    const headline =
      stock?.state === 'ok' && out != null
        ? `${out} product${out === 1 ? '' : 's'} out of stock.`
        : metricSentence(stock) || "I don't have stock counts loaded.";
    return {
      headline,
      detail: '',
      buttons: [{ label: 'Open Inventory', href: '/products' }],
      speak: headline,
    };
  }

  if (
    t === "today's sales" ||
    t === 'todays sales' ||
    t.includes('sales today') ||
    t.includes("today's sales")
  ) {
    const sales = ctx.homeSummary?.sales_today;
    const headline = metricSentence(sales) || "Today's sales aren't loaded yet.";
    return {
      headline,
      detail: '',
      buttons: sales?.state === 'ok' ? [{ label: 'Open Sales', href: '/sales/dashboard' }] : [],
      speak: headline,
    };
  }

  if (t === 'what are the vans doing' || t.includes('vans doing')) {
    return tryAskFastPath('vans status', ctx);
  }

  return null;
}
