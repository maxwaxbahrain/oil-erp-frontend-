import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { PaidFromBankPicker } from '../paidFromBankPicker';
import { companyPaymentAccounts } from '../../../utils/bankingAccounts';
import type { BankingAccount, GLAccount } from '../../../services/glService';

function chart(partial: Partial<GLAccount> & Pick<GLAccount, 'id' | 'code' | 'name' | 'type'>): GLAccount {
  return {
    normal_balance: 'debit',
    parent_id: null,
    system_key: null,
    is_active: true,
    tenant_id: 1,
    created_at: null,
    updated_at: null,
    ...partial,
  };
}

function mount(node: ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: Root;
  act(() => {
    root = createRoot(host);
    root.render(node);
  });
  return {
    host,
    cleanup() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe('expense paid-from asset accounts', () => {
  it('lists every bank and asset, and leaves out system control accounts', () => {
    const marked: BankingAccount = {
      id: 2,
      code: '1011',
      name: 'Chase Bank 6833',
      type: 'asset',
      system_key: null,
      role: 'bank',
      is_active: true,
      is_default: false,
      balance: 0,
    };
    const options = companyPaymentAccounts(
      [
        chart({ id: 1, code: '1010', name: 'Bank', type: 'asset', system_key: 'bank' }),
        chart({ id: 8, code: '1020', name: 'MCB Bank', type: 'asset' }),
        chart({ id: 4, code: '1100', name: 'Accounts Receivable', type: 'asset', system_key: 'accounts_receivable' }),
        chart({ id: 7, code: '1200', name: 'Inventory', type: 'asset', system_key: 'inventory' }),
        chart({ id: 5, code: '6100', name: 'General expenses', type: 'expense' }),
        chart({ id: 6, code: '2000', name: 'Closed asset', type: 'asset', is_active: false }),
      ],
      [marked],
    );
    const view = mount(
      <PaidFromBankPicker method="Bank Transfer" banks={options} value="" onChange={() => undefined} posted={false} />,
    );
    const labels = Array.from(view.host.querySelectorAll('option')).map((option) => option.textContent);
    expect(labels).toContain('1010 — Bank');
    expect(labels).toContain('1011 — Chase Bank 6833');
    expect(labels).toContain('1020 — MCB Bank');
    expect(labels.join(' ')).not.toContain('Accounts Receivable');
    expect(labels.join(' ')).not.toContain('Inventory');
    expect(labels.join(' ')).not.toContain('General expenses');
    expect(labels.join(' ')).not.toContain('Closed asset');
    view.cleanup();
  });
});
