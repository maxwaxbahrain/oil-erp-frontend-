import { useCompanyPaymentAccounts } from './useCompanyPaymentAccounts';

/**
 * @deprecated Prefer useCompanyPaymentAccounts. Kept so older call sites get the
 * shared company-payment list (not marked-bank-only options).
 */
export function useBankingAccountOptions() {
  const state = useCompanyPaymentAccounts();
  return {
    cash: state.cash,
    banks: state.banks,
    defaultBank: state.defaultBank,
    collectionsBankId: null as number | null,
    loading: state.loading,
    error: state.error,
  };
}
