import type { BankingAccount } from '../../services/glService';
import { expenseMethodIsCash } from '../../utils/bankingAccounts';

export const PAID_FROM_LOAD_FAILED_MESSAGE =
    'Could not load bank accounts — choose Cash or try again';

export function PaidFromBankPicker({
    method,
    banks,
    value,
    onChange,
    posted,
    loading = false,
    error = null,
    onRetry,
}: {
    method: string;
    banks: BankingAccount[];
    value: string;
    onChange: (id: string) => void;
    posted: boolean;
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
}) {
    if (expenseMethodIsCash(method)) return null;

    if (loading) {
        return (
            <div className="expense-field">
                <label className="expense-label" htmlFor="expense-paid-from-bank">Paid from bank</label>
                <select
                    id="expense-paid-from-bank"
                    aria-label="Paid from bank"
                    value=""
                    disabled
                    className="expense-input"
                    onChange={() => undefined}
                >
                    <option value="">Select a bank</option>
                </select>
                <p className="expense-hint">Loading bank accounts…</p>
            </div>
        );
    }

    if (error || banks.length === 0) {
        return (
            <div className="expense-field" id="expense-paid-from-bank">
                <span className="expense-label">Paid from bank</span>
                <p
                    className="expense-error"
                    role="alert"
                    style={{ color: '#dc2626' }}
                >
                    {PAID_FROM_LOAD_FAILED_MESSAGE}
                    {error ? ` (${error})` : ''}
                </p>
                {onRetry && (
                    <button
                        type="button"
                        className="expense-button expense-button-secondary"
                        onClick={onRetry}
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }

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
