import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { BankingAccount } from '../../../services/glService';
import { DepositAccountField } from '../PaymentReceipt';

const cash: BankingAccount = {
  id: 3, code: '1000', name: 'Cash on Hand', type: 'asset', system_key: 'cash_on_hand', role: 'cash', is_active: true, is_default: false, balance: 10,
};
const mainBank: BankingAccount = {
  id: 1, code: '1010', name: 'Main Bank', type: 'asset', system_key: 'bank', role: 'bank', is_active: true, is_default: true, balance: 20,
};
const operating: BankingAccount = {
  id: 2, code: '1011', name: 'Operating', type: 'asset', system_key: null, role: 'bank', is_active: true, is_default: false, balance: 30,
};

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

describe('PaymentReceipt deposit account', () => {
  it('shows only Cash on Hand, disabled, when the method is Cash', () => {
    const view = mount(
      <DepositAccountField method="Cash" cash={[cash]} banks={[mainBank, operating]} value="3" onChange={() => undefined} errored={false} />,
    );
    const select = view.host.querySelector('select');
    expect(select?.disabled).toBe(true);
    expect(Array.from(select?.options ?? []).map((option) => option.textContent)).toEqual(['1000 — Cash on Hand']);
    expect(view.host.textContent).toContain('Cash and petty cash receipts post to Cash on Hand');
    view.cleanup();
  });

  it('lists banks only and can show a second bank for Bank Transfer', () => {
    const view = mount(
      <DepositAccountField method="Bank Transfer" cash={[cash]} banks={[mainBank, operating]} value="1" onChange={() => undefined} errored={false} />,
    );
    const select = view.host.querySelector('select');
    expect(select?.disabled).toBe(false);
    const labels = Array.from(select?.options ?? []).map((option) => option.textContent);
    expect(labels).toEqual(['1010 — Main Bank', '1011 — Operating']);
    expect(select?.value).toBe('1');
    view.cleanup();
  });
});
