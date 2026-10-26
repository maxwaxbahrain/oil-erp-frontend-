import api from '../../../api/axios';
import type { Customer } from '../../../services/customerService';
import { normalizeVoicePhrase } from './voiceIntent';

export const ADD_CUSTOMER_CHIP = 'Add a new customer';
export const VOICE_CONFIRM_WINDOW_MS = 30_000;
export const UNDO_WINDOW_MS = 10_000;

export const NO_PERMISSION_MSG = "You don't have permission to add customers.";
export const OPENING_BALANCE_MSG =
  'Opening balance must be entered in the full form.';

export type ExtractDuplicate = { id: number; name: string };

export type ExtractCustomerApi = {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  credit_limit: number | null;
  opening_balance: { side: string; amount: number; as_of: string | null } | null;
  notes: string | null;
  filled_fields: string[];
  warnings: string[];
  possible_duplicates: ExtractDuplicate[];
};

export type CustomerDraftFields = {
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  credit_limit: number | null;
};

export type CustomerDraftView = {
  fields: CustomerDraftFields;
  warnings: string[];
  duplicates: ExtractDuplicate[];
  openingBalanceMentioned: boolean;
  openingBalanceFromApi: boolean;
};

const CREATE_INTENT =
  /\b(add|create)\s+(a\s+)?new\s+customer\b|\b(add|create)\s+customer\b|\bnew\s+customer\b/i;

export const UNDO_FAIL_MSG = "Couldn't undo — open the customer and set it Inactive";

/** Undo deactivates only — backend PUT applies partial updates (exclude_unset). */
export function undoDeactivatePayload(): Pick<Customer, 'status'> {
  return { status: 'Inactive' };
}

const OPENING_TEXT =
  /\b(opening\s+balance|they\s+already\s+owe|already\s+owe\s+us|we\s+owe\s+them|owe\s+us\s+\d|in\s+credit|advance\s+payment)\b/i;

export function isCreateCustomerIntent(text: string): boolean {
  return CREATE_INTENT.test(String(text || '').trim());
}

export function mentionsOpeningBalance(text: string): boolean {
  return OPENING_TEXT.test(String(text || ''));
}

export function draftFromExtract(rawText: string, api: ExtractCustomerApi): CustomerDraftView {
  const openingBalanceMentioned = mentionsOpeningBalance(rawText);
  const openingBalanceFromApi = Boolean(api.opening_balance);
  const category = api.category?.trim().toLowerCase() || '';
  return {
    fields: {
      name: (api.name || '').trim(),
      email: (api.email || '').trim(),
      phone: (api.phone || '').trim(),
      address: (api.address || '').trim(),
      category: category || 'retail',
      credit_limit:
        api.credit_limit != null && !Number.isNaN(Number(api.credit_limit))
          ? Number(api.credit_limit)
          : null,
    },
    warnings: api.warnings || [],
    duplicates: api.possible_duplicates || [],
    openingBalanceMentioned,
    openingBalanceFromApi,
  };
}

/** Payload for createCustomer — never includes opening balance from Zava. */
export function createPayloadFromDraft(fields: CustomerDraftFields): Partial<Customer> {
  const name = fields.name.trim();
  if (!name) throw new Error('Customer name is required');
  return {
    name,
    email: fields.email || undefined,
    phone: fields.phone || undefined,
    address: fields.address || undefined,
    category: (fields.category || 'retail').toLowerCase(),
    credit_limit: fields.credit_limit ?? 0,
  };
}

export type DraftVoiceResult = 'confirm' | 'cancel' | 'weak_yes' | 'none';

/** Voice confirm while draft is showing (not plain yes/okay). */
export function classifyCustomerDraftVoice(raw: string): DraftVoiceResult {
  const n = normalizeVoicePhrase(raw);
  if (!n) return 'none';
  if (/^(cancel|no|stop|never mind|nevermind)$/.test(n)) return 'cancel';
  if (/^(yes|yeah|yep|okay|ok|sure|right)$/.test(n)) return 'weak_yes';
  if (n === 'confirm') return 'confirm';
  if (n === 'create' || n === 'create it' || n === 'create customer') return 'confirm';
  if (/^yes create/.test(n)) return 'confirm';
  if (/\bcreate customer\b/.test(n) && n.split(/\s+/).length <= 4) return 'confirm';
  return 'none';
}

export function draftSpeakScript(fields: CustomerDraftFields): string {
  const parts = [`New customer ${fields.name || 'draft'}.`];
  if (fields.category && fields.category !== 'retail') {
    parts.push(`Category ${fields.category}.`);
  }
  if (fields.phone) parts.push(`Phone ${fields.phone}.`);
  if (fields.credit_limit != null) {
    parts.push(`Credit limit ${Math.round(fields.credit_limit).toLocaleString('en-US')} dollars.`);
  }
  parts.push('Say confirm to create it, or cancel.');
  return parts.join(' ');
}

export function duplicateBlocksCreate(
  duplicates: ExtractDuplicate[],
  choice: 'pending' | 'create_anyway',
): boolean {
  return duplicates.length > 0 && choice !== 'create_anyway';
}

export async function fetchExtractCustomer(text: string): Promise<ExtractCustomerApi> {
  const { data } = await api.post<ExtractCustomerApi>(
    '/api/agent/extract-customer',
    { text: text.trim() },
    { timeout: 70_000 },
  );
  return data;
}

export function formatCategoryLabel(cat: string): string {
  const c = cat.toLowerCase();
  if (c === 'wholesale') return 'Wholesale';
  if (c === 'partner') return 'Partner';
  if (c === 'other') return 'Other';
  if (c === 'retail') return 'Retail';
  return cat;
}
