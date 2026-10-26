/**
 * Instant Ask answers from data already on Nexus — no /api/agent/chat.
 */

import type { HomeSummary } from './homeSummaryApi';
import type { NeedsYouItem } from './needsYouModel';
import { parseVoiceIntent, stripVoiceDecorations } from './voiceIntent';
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
};

function normAsk(raw: string): string {
  return stripVoiceDecorations(raw);
}

function metricSentence(block: { state?: string; sentence?: string; value?: unknown } | undefined): string | null {
  if (!block || block.state !== 'ok') return null;
  if (block.sentence?.trim()) return block.sentence.trim();
  if (block.value != null && block.value !== '') return String(block.value);
  return null;
}

export function tryAskFastPath(question: string, ctx: AskFastContext): AskFastAnswer | null {
  const t = normAsk(question);
  if (!t) return null;

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
    t === 'who owes the most' ||
    t === 'who owes me the most' ||
    t.includes('who owes the most') ||
    t.includes('biggest debtor')
  ) {
    const line =
      ctx.homeSummary?.biggest_line?.trim() ||
      ctx.needsItems.find((i) => i.kind === 'money')?.sentences?.[0] ||
      metricSentence(ctx.homeSummary?.owed_to_us) ||
      "I don't have receivables loaded right now.";
    const top = ctx.needsItems.find((i) => i.kind === 'money');
    const buttons: AskNavButton[] = top?.primary?.href
      ? [{ label: top.primary.label || 'Open', href: top.primary.href }]
      : [{ label: 'Open Collections', href: '/finance/collections' }];
    return { headline: line, detail: '', buttons, speak: line };
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
