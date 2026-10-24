import { describe, expect, it } from 'vitest';
import {
    jvAccountPreview,
    resolveAccountsReceivableAccount,
    resolveBadDebtExpenseAccount,
} from '../badDebtAccounts';

describe('badDebtAccounts', () => {
    const tenantCoa = [
        { code: '6070', name: 'Bad Debt Write-Off', type: 'expense', system_key: 'bad_debt_expense' },
        { code: '1100', name: 'Trade Receivable', type: 'asset', system_key: 'accounts_receivable' },
    ];

    it('resolves accounts by system_key', () => {
        expect(resolveBadDebtExpenseAccount(tenantCoa)?.code).toBe('6070');
        expect(resolveAccountsReceivableAccount(tenantCoa)?.code).toBe('1100');
    });

    it('builds preview labels with tenant codes when COA is loaded', () => {
        const preview = jvAccountPreview(
            true,
            resolveBadDebtExpenseAccount(tenantCoa),
            resolveAccountsReceivableAccount(tenantCoa),
        );
        expect(preview.drLabel).toBe('Dr 6070 Bad Debt Write-Off');
        expect(preview.crLabel).toBe('Cr 1100 Trade Receivable');
    });

    it('omits numeric codes when COA is empty', () => {
        const preview = jvAccountPreview(true, undefined, undefined);
        expect(preview.drLabel).toBe('Dr Bad Debt Expense');
        expect(preview.crLabel).toBe('Cr Accounts Receivable');
        expect(preview.drCode).toBeNull();
        expect(preview.crCode).toBeNull();
    });
});
