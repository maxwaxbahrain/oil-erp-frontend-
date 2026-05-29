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

export function getGLAccounts(): Promise<GLAccount[]> {
  return apiRequest<GLAccount[]>('/accounts/');
}
