import { useEffect, useMemo, useState } from 'react';
import { getBankingAccountOptions, type BankingAccountOption } from '../services/glService';

function splitOptions(accounts: BankingAccountOption[]) {
  const cash = accounts.filter((row) => row.role === 'cash');
  const banks = accounts
    .filter((row) => row.role === 'bank')
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      return a.code.localeCompare(b.code);
    });
  const defaultBank = banks.find((row) => row.is_default) ?? banks[0] ?? null;
  return { cash, banks, defaultBank };
}

export function useBankingAccountOptions() {
  const [accounts, setAccounts] = useState<BankingAccountOption[]>([]);
  const [collectionsBankId, setCollectionsBankId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getBankingAccountOptions();
        if (cancelled) return;
        setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
        setCollectionsBankId(data?.collections_bank_account_id ?? null);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.warn('Could not load banking account options', err);
        setAccounts([]);
        setCollectionsBankId(null);
        setError(err instanceof Error ? err.message : 'Could not load banking account options');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const split = useMemo(() => splitOptions(accounts), [accounts]);

  return { ...split, collectionsBankId, loading, error };
}
