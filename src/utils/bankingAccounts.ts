import type { BankingAccount, GLAccount } from '../services/glService';

export function splitBankingAccounts(rows: BankingAccount[]): {
  cash: BankingAccount[];
  banks: BankingAccount[];
  defaultBank: BankingAccount | null;
} {
  const cash = rows.filter((row) => row.role === 'cash');
  const banks = rows
    .filter((row) => row.role === 'bank')
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      return a.code.localeCompare(b.code);
    });
  const defaultBank = banks.find((row) => row.is_default) ?? banks[0] ?? null;
  return { cash, banks, defaultBank };
}

export function methodIsCashReceipt(method: string): boolean {
  return expenseMethodIsCash(method);
}

export const MANUAL_TX_SUSPENSE_HINT =
  'Leave empty to post to Suspense. That does not reduce Cash on Hand. Pick the other Bank or Cash account to record a transfer.';

export function cashDepositToBankPayload(input: {
  bankAccountId: number;
  cashAccountId: number;
  amount: number;
  date: string;
  memo?: string;
  reference?: string;
}): Record<string, unknown> {
  const memo = (input.memo || '').trim();
  return {
    date: input.date,
    description: memo || 'Cash deposited to bank',
    type: 'Credit',
    amount: input.amount,
    reference: input.reference || '',
    category: 'Cash deposit',
    account_id: input.bankAccountId,
    contra_account_id: input.cashAccountId,
  };
}

export function expenseMethodIsCash(method: string): boolean {
  const normalized = method.trim().toLowerCase();
  return normalized === 'cash' || normalized === 'petty cash';
}

export function depositPickerForMethod(
  method: string,
  cash: BankingAccount[],
  banks: BankingAccount[],
): { options: BankingAccount[]; disabled: boolean; helper: string | null } {
  if (methodIsCashReceipt(method)) {
    return {
      options: cash,
      disabled: true,
      helper: 'Cash and petty cash receipts post to Cash on Hand',
    };
  }
  return { options: banks, disabled: false, helper: null };
}

const CONTROL_SYSTEM_KEYS = new Set([
  'accounts_receivable',
  'inventory',
  'accounts_payable',
  'tax_payable',
  'owner_capital',
  'retained_earnings',
  'opening_balance_equity',
  'sales_revenue',
  'sales_returns',
  'cogs',
  'operating_expenses',
  'general_expenses',
  'inventory_adjustment_gain',
  'inventory_adjustment_loss',
  'bad_debt_expense',
  'suspense',
]);

/** Bank or asset account, excluding system control accounts such as AR and Inventory. */
export function isCompanyPaymentAccount(account: {
  is_active?: boolean;
  type?: string | null;
  system_key?: string | null;
  role?: string | null;
  account_role?: string | null;
}): boolean {
  if (account.is_active === false) return false;
  const systemKey = (account.system_key || '').trim().toLowerCase();
  if (CONTROL_SYSTEM_KEYS.has(systemKey)) return false;
  if (systemKey === 'bank' || systemKey === 'cash_on_hand') return true;
  const role = (account.account_role || account.role || '').trim().toLowerCase();
  if (role === 'bank' || role === 'cash') return true;
  const type = (account.type || '').trim().toLowerCase();
  return type === 'asset';
}

function chartAccountIsPaidFromBank(account: GLAccount): boolean {
  return isCompanyPaymentAccount(account);
}

function chartAccountAsPaidFrom(account: GLAccount): BankingAccount {
  const systemKey = (account.system_key || '').trim().toLowerCase();
  // Match GET /api/banking/accounts: cash_on_hand → cash; every other payment account → bank.
  const role = systemKey === 'cash_on_hand' ? 'cash' : 'bank';
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    system_key: account.system_key,
    role,
    is_active: account.is_active,
    is_default: systemKey === 'bank',
    balance: 0,
  };
}

/**
 * One shared company payment list: banks and every asset on this company's chart,
 * excluding system control accounts (AR, Inventory, …). Marked banks fill any gap.
 */
export function companyPaymentAccounts(
  chartAccounts: GLAccount[],
  markedBanks: BankingAccount[] = [],
): BankingAccount[] {
  const byId = new Map<number, BankingAccount>();
  for (const account of chartAccounts) {
    if (chartAccountIsPaidFromBank(account)) byId.set(account.id, chartAccountAsPaidFrom(account));
  }
  for (const bank of markedBanks) {
    if (!isCompanyPaymentAccount(bank)) continue;
    if (!byId.has(bank.id)) byId.set(bank.id, bank);
  }
  return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

/** @deprecated Use companyPaymentAccounts — same shared rule. */
export const expensePaidFromAccounts = companyPaymentAccounts;

/** Filter an already-loaded banking/options list through the shared rule. */
export function companyPaymentAccountsFromList(rows: BankingAccount[]): BankingAccount[] {
  return rows
    .filter((row) => isCompanyPaymentAccount(row))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

/** Omit the field when posted, cash, or unset. Cash must not send a bank id. */
export function expensePaymentAccountIdForSave(
  method: string,
  paymentAccountId: string,
  posted: boolean,
): number | undefined {
  if (posted || expenseMethodIsCash(method)) return undefined;
  const trimmed = paymentAccountId.trim();
  if (!trimmed) return undefined;
  const id = Number(trimmed);
  return Number.isFinite(id) ? id : undefined;
}

export function chequeBankAccountEditable(status: string): boolean {
  return status === 'Pending';
}

export function pdcListUrl(base: string, bankAccountId: string): string {
  const id = bankAccountId.trim();
  if (!id) return `${base}/`;
  return `${base}/?bank_account_id=${encodeURIComponent(id)}`;
}

export function pdcCreateBody(form: {
  date: string;
  chequeNo: string;
  bankName: string;
  payee: string;
  amount: string;
  type: string;
  description: string;
  customerId: number | null;
  bankAccountId: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    date: form.date,
    chequeNo: form.chequeNo,
    bankName: form.bankName,
    payee: form.payee,
    amount: parseFloat(form.amount) || 0,
    type: form.type,
    description: form.description,
  };
  if (form.type === 'Received' && form.customerId != null) {
    payload.customerId = form.customerId;
  }
  const bankId = form.bankAccountId.trim();
  if (bankId) payload.bank_account_id = Number(bankId);
  return payload;
}
