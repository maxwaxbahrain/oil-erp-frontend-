/**
 * General Ledger report API — profit/loss, balance sheet, cash flow, accounts.
 */
import { ACCESS_TOKEN_KEY } from '../api/axios';
import { API_BASE_URL } from './api';

export const GL_EMPTY_MESSAGE =
  'Your General Ledger has no entries yet. Enter opening balances to see your financial position.';

export const OPENING_BALANCES_PATH = '/finance/opening-balances';

export interface GLAccountLine {
  account_id: number;
  code: string;
  name: string;
  type: string;
  system_key: string | null;
  normal_balance: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface GLProfitLoss {
  start: string;
  end: string;
  revenue: number;
  revenue_lines: GLAccountLine[];
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  expense_lines: GLAccountLine[];
  net_income: number;
}

export interface GLBalanceSheet {
  as_of: string;
  assets: GLAccountLine[];
  total_assets: number;
  liabilities: GLAccountLine[];
  total_liabilities: number;
  equity: GLAccountLine[];
  equity_accounts_total: number;
  net_income: number;
  total_equity: number;
  is_balanced: boolean;
}

export interface GLCashFlowLineItem {
  label: string;
  inflow: number;
  outflow: number;
}

export interface GLCashFlowSection {
  line_items: GLCashFlowLineItem[];
  total_inflows: number;
  total_outflows: number;
}

export interface GLCashFlow {
  start: string;
  end: string;
  opening_cash: number;
  sections: {
    operating: GLCashFlowSection;
    financing: GLCashFlowSection;
    investing: GLCashFlowSection;
  };
  net_operating: number;
  net_financing: number;
  net_investing: number;
  net_change: number;
  closing_cash: number;
  actual_closing: number;
  is_reconciled: boolean;
}

export interface GLAccount {
  id: number;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  parent_id: number | null;
  system_key: string | null;
  is_active: boolean;
  tenant_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const error = await response.json();
      if (error?.detail) {
        detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
      }
    } catch {
      /* ignore malformed error payloads */
    }
    throw new Error(detail);
  }
  return response.json();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function yearStartISO(): string {
  const y = new Date().getFullYear();
  return `${y}-01-01`;
}

/** First day of the current month, YYYY-MM-DD (for MTD GL ranges). */
export function monthStartISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function isGLEmpty(bs: GLBalanceSheet): boolean {
  return bs.total_assets === 0 && bs.net_income === 0 && bs.total_liabilities === 0;
}

export function getGLProfitLoss(start: string, end: string): Promise<GLProfitLoss> {
  const params = new URLSearchParams({ start, end });
  return apiRequest<GLProfitLoss>(`/gl/profit-loss?${params.toString()}`);
}

export function getGLBalanceSheet(asOf: string): Promise<GLBalanceSheet> {
  const params = new URLSearchParams({ as_of: asOf });
  return apiRequest<GLBalanceSheet>(`/gl/balance-sheet?${params.toString()}`);
}

export function getGLCashFlow(start: string, end: string): Promise<GLCashFlow> {
  const params = new URLSearchParams({ start, end });
  return apiRequest<GLCashFlow>(`/gl/cash-flow?${params.toString()}`);
}

export function getGLAccounts(options?: { includeInactive?: boolean }): Promise<GLAccount[]> {
  const params = new URLSearchParams();
  if (options?.includeInactive) {
    params.set('include_inactive', 'true');
  }
  const qs = params.toString();
  return apiRequest<GLAccount[]>(`/accounts/${qs ? `?${qs}` : ''}`);
}

export type GLAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface CreateAccountPayload {
  code: string;
  name: string;
  type: GLAccountType;
  normal_balance: 'debit' | 'credit';
  parent_id?: number | null;
  is_active?: boolean;
}

export interface PatchAccountPayload {
  code?: string;
  name?: string;
  type?: GLAccountType;
  normal_balance?: 'debit' | 'credit';
  parent_id?: number | null;
  is_active?: boolean;
}

export function createAccount(payload: CreateAccountPayload): Promise<GLAccount> {
  return apiRequest<GLAccount>('/accounts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function patchAccount(id: number, payload: PatchAccountPayload): Promise<GLAccount> {
  return apiRequest<GLAccount>(`/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export interface GLTrialBalanceRow {
  account_id: number;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface GLTrialBalance {
  as_of: string;
  accounts: GLTrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export interface GLJournalEntryLine {
  id: number;
  account_id: number;
  account_code: string | null;
  account_name: string | null;
  debit: number;
  credit: number;
  memo: string | null;
}

export interface GLJournalEntry {
  id: number;
  entry_number: string;
  entry_date: string | null;
  memo: string | null;
  source_type: string | null;
  source_id: string | null;
  status: string;
  lines: GLJournalEntryLine[];
}

export interface OpeningBalancePayloadEntry {
  account_name: string;
  amount: number;
}

export interface PostOpeningBalancesResult {
  success: boolean;
  journal_entry_id: number;
  entries_count: number;
}

export function getGLTrialBalance(asOf?: string): Promise<GLTrialBalance> {
  const params = new URLSearchParams();
  if (asOf) params.set('as_of', asOf);
  const qs = params.toString();
  return apiRequest<GLTrialBalance>(`/gl/trial-balance${qs ? `?${qs}` : ''}`);
}

export function getGLJournalEntries(): Promise<GLJournalEntry[]> {
  return apiRequest<GLJournalEntry[]>('/gl/journal-entries');
}

export function postOpeningBalances(
  entries: OpeningBalancePayloadEntry[],
  asOfDate: string,
): Promise<PostOpeningBalancesResult> {
  return apiRequest<PostOpeningBalancesResult>('/gl/opening-balances', {
    method: 'POST',
    body: JSON.stringify({ entries, as_of_date: asOfDate }),
  });
}
