import type { BankingAccount } from '../../services/glService';
import { expenseMethodIsCash } from '../../utils/bankingAccounts';

export function PaidFromBankPicker({
    method,
    banks,
    value,
    onChange,
    posted,
}: {
    method: string;
    banks: BankingAccount[];
    value: string;
    onChange: (id: string) => void;
    posted: boolean;
}) {
    if (expenseMethodIsCash(method) || banks.length === 0) return null;
    return (
        <div className="expense-field">
            <label className="expense-label" htmlFor="expense-paid-from-bank">Paid from bank</label>
            <select
                id="expense-paid-from-bank"
                aria-label="Paid from bank"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={posted}
                className="expense-input"
            >
                <option value="">Select a bank</option>
                {banks.map((bank) => (
                    <option key={bank.id} value={String(bank.id)}>{bank.code} — {bank.name}</option>
                ))}
            </select>
            {posted && (
                <p className="expense-hint">Bank is locked after posting</p>
            )}
        </div>
    );
}
