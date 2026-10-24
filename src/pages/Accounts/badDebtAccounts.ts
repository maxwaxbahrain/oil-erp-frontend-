import type { GLAccount } from '../../services/glService';
import type { Account } from './ChartOfAccounts';

export const BAD_DEBT_EXPENSE_SYSTEM_KEY = 'bad_debt_expense';
export const ACCOUNTS_RECEIVABLE_SYSTEM_KEY = 'accounts_receivable';

export type WriteOffCoaRow = {
    id?: string | number;
    code: string;
    name: string;
    type?: string;
    system_key?: string | null;
};

function normType(type: string | undefined): string {
    return String(type ?? '').trim().toLowerCase();
}

function normKey(key: string | null | undefined): string {
    return String(key ?? '').trim().toLowerCase();
}

export function resolveBadDebtExpenseAccount(rows: WriteOffCoaRow[]): WriteOffCoaRow | undefined {
    const byKey = rows.find((a) => normKey(a.system_key) === BAD_DEBT_EXPENSE_SYSTEM_KEY);
    if (byKey) return byKey;
    return rows.find(
        (a) => normType(a.type) === 'expense' && /bad debt/i.test(a.name),
    );
}

export function resolveAccountsReceivableAccount(rows: WriteOffCoaRow[]): WriteOffCoaRow | undefined {
    const byKey = rows.find((a) => normKey(a.system_key) === ACCOUNTS_RECEIVABLE_SYSTEM_KEY);
    if (byKey) return byKey;
    return rows.find(
        (a) => normType(a.type) === 'asset' && /receivable/i.test(a.name),
    );
}

export function glAccountsToWriteOffRows(accounts: GLAccount[]): WriteOffCoaRow[] {
    return accounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        system_key: a.system_key,
    }));
}

export function localAccountsToWriteOffRows(accounts: Account[]): WriteOffCoaRow[] {
    return accounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        system_key: null,
    }));
}

export type JvAccountPreview = {
    drLabel: string;
    crLabel: string;
    drCode: string | null;
    crCode: string | null;
    drName: string;
    crName: string;
};

const FALLBACK_DR_NAME = 'Bad Debt Expense';
const FALLBACK_CR_NAME = 'Accounts Receivable';

export function jvAccountPreview(
    coaLoaded: boolean,
    badDebt: WriteOffCoaRow | undefined,
    ar: WriteOffCoaRow | undefined,
): JvAccountPreview {
    const drName = coaLoaded && badDebt ? badDebt.name : FALLBACK_DR_NAME;
    const crName = coaLoaded && ar ? ar.name : FALLBACK_CR_NAME;
    const drCode = coaLoaded && badDebt ? badDebt.code : null;
    const crCode = coaLoaded && ar ? ar.code : null;
    return {
        drName,
        crName,
        drCode,
        crCode,
        drLabel: drCode ? `Dr ${drCode} ${drName}` : `Dr ${drName}`,
        crLabel: crCode ? `Cr ${crCode} ${crName}` : `Cr ${crName}`,
    };
}
