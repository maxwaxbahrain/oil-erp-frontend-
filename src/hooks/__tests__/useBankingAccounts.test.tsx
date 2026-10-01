import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getBankingAccounts } = vi.hoisted(() => ({
  getBankingAccounts: vi.fn(),
}));

vi.mock('../../services/glService', () => ({
  getBankingAccounts,
}));

import { useBankingAccounts } from '../useBankingAccounts';

const rows = [
  { id: 2, code: '1011', name: 'Operating', type: 'asset', system_key: null, role: 'bank', is_active: true, is_default: false, balance: 30 },
  { id: 3, code: '1000', name: 'Cash on Hand', type: 'asset', system_key: 'cash_on_hand', role: 'cash', is_active: true, is_default: false, balance: 10 },
  { id: 1, code: '1010', name: 'Main Bank', type: 'asset', system_key: 'bank', role: 'bank', is_active: true, is_default: true, balance: 20 },
];

function Probe() {
  const state = useBankingAccounts();
  return (
    <div>
      <span data-testid="banks">{state.banks.map((bank) => bank.code).join(',')}</span>
      <span data-testid="cash">{state.cash.map((account) => account.code).join(',')}</span>
      <span data-testid="error">{state.error ?? ''}</span>
    </div>
  );
}

async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: Root;
  await act(async () => {
    root = createRoot(host);
    root.render(<Probe />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return {
    host,
    cleanup() {
      act(() => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('useBankingAccounts', () => {
  beforeEach(() => {
    getBankingAccounts.mockReset();
  });

  it('sorts the default bank first and splits cash from banks', async () => {
    getBankingAccounts.mockResolvedValue(rows);
    const view = await mount();
    expect(view.host.querySelector('[data-testid="banks"]')?.textContent).toBe('1010,1011');
    expect(view.host.querySelector('[data-testid="cash"]')?.textContent).toBe('1000');
    view.cleanup();
  });

  it('returns empty lists on error without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getBankingAccounts.mockRejectedValue(new Error('403'));
    const view = await mount();
    expect(view.host.querySelector('[data-testid="banks"]')?.textContent).toBe('');
    expect(view.host.querySelector('[data-testid="cash"]')?.textContent).toBe('');
    expect(view.host.querySelector('[data-testid="error"]')?.textContent).toBe('403');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    view.cleanup();
  });
});
