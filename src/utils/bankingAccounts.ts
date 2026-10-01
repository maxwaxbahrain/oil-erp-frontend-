import type { BankingAccount } from '../services/glService';

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
  return method.trim().toLowerCase() === 'cash';
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
      helper: 'Cash receipts post to Cash on Hand',
    };
  }
  return { options: banks, disabled: false, helper: null };
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
