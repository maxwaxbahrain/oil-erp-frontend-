import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBankingAccounts, type BankingAccount } from '../services/glService';
import { splitBankingAccounts } from '../utils/bankingAccounts';

export function useBankingAccounts() {
  const [rows, setRows] = useState<BankingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBankingAccounts();
      setRows(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.warn('Could not load banking accounts', err);
      setRows([]);
      setError(err instanceof Error ? err.message : 'Could not load banking accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const split = useMemo(() => splitBankingAccounts(rows), [rows]);

  return { ...split, loading, error, reload };
}
