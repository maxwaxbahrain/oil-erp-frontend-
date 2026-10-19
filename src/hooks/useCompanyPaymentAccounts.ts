import { useEffect, useMemo, useState } from 'react';
import { getBankingAccounts, getGLAccounts, type BankingAccount, type GLAccount } from '../services/glService';
import {
  companyPaymentAccounts,
  splitBankingAccounts,
} from '../utils/bankingAccounts';

/**
 * Shared bank/asset picker list for Deposit to / Paid from / Pay from / refund.
 * Uses the one company-payment rule (not marked-bank-only).
 */
export function useCompanyPaymentAccounts() {
  const [chartAccounts, setChartAccounts] = useState<GLAccount[]>([]);
  const [markedBanks, setMarkedBanks] = useState<BankingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [chart, banks] = await Promise.all([
          getGLAccounts().catch(() => [] as GLAccount[]),
          getBankingAccounts(),
        ]);
        if (cancelled) return;
        setChartAccounts(Array.isArray(chart) ? chart : []);
        setMarkedBanks(Array.isArray(banks) ? banks : []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.warn('Could not load company payment accounts', err);
        setChartAccounts([]);
        setMarkedBanks([]);
        setError(err instanceof Error ? err.message : 'Could not load payment accounts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accounts = useMemo(
    () => companyPaymentAccounts(chartAccounts, markedBanks),
    [chartAccounts, markedBanks],
  );
  const split = useMemo(() => splitBankingAccounts(accounts), [accounts]);

  return {
    accounts,
    cash: split.cash,
    banks: split.banks,
    defaultBank: split.defaultBank,
    loading,
    error,
  };
}
