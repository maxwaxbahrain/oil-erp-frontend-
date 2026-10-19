import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getBankingAccounts, getGLAccounts } = vi.hoisted(() => ({
  getBankingAccounts: vi.fn(),
  getGLAccounts: vi.fn(),
}));

vi.mock('../../services/glService', () => ({
  getBankingAccounts,
  getGLAccounts,
}));

import { useBankingAccountOptions } from '../useBankingAccountOptions';

const chart = [
  { id: 1, code: '1010', name: 'Main Bank', type: 'asset', system_key: 'bank', is_active: true },
  { id: 2, code: '1011', name: 'Operating', type: 'asset', is_active: true },
  { id: 3, code: '1000', name: 'Cash on Hand', type: 'asset', system_key: 'cash_on_hand', is_active: true },
  { id: 4, code: '1001', name: 'MCB', type: 'asset', is_active: true },
];

const banks = [
  { id: 1, code: '1010', name: 'Main Bank', type: 'asset', system_key: 'bank', role: 'bank', is_default: true, is_active: true, balance: 0 },
  { id: 2, code: '1011', name: 'Operating', type: 'asset', role: 'bank', is_default: false, is_active: true, balance: 0 },
  { id: 3, code: '1000', name: 'Cash on Hand', type: 'asset', system_key: 'cash_on_hand', role: 'cash', is_default: false, is_active: true, balance: 0 },
  { id: 4, code: '1001', name: 'MCB', type: 'asset', role: 'bank', is_default: false, is_active: true, balance: 0 },
];

function Probe() {
  const state = useBankingAccountOptions();
  return (
    <div>
      <span data-testid="banks">{state.banks.map((bank) => bank.code).join(',')}</span>
      <span data-testid="cash">{state.cash.map((account) => account.code).join(',')}</span>
      <span data-testid="default">{state.defaultBank?.code ?? ''}</span>
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
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
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

describe('useBankingAccountOptions', () => {
  beforeEach(() => {
    getBankingAccounts.mockReset();
    getGLAccounts.mockReset();
  });

  it('splits cash from banks including unmarked assets via the shared rule', async () => {
    getBankingAccounts.mockResolvedValue(banks);
    getGLAccounts.mockResolvedValue(chart);
    const view = await mount();
    expect(view.host.querySelector('[data-testid="banks"]')?.textContent).toContain('1010');
    expect(view.host.querySelector('[data-testid="banks"]')?.textContent).toContain('1001');
    expect(view.host.querySelector('[data-testid="cash"]')?.textContent).toBe('1000');
    expect(view.host.querySelector('[data-testid="default"]')?.textContent).toBe('1010');
    view.cleanup();
  });

  it('returns empty lists on error without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getBankingAccounts.mockRejectedValue(new Error('403'));
    getGLAccounts.mockResolvedValue([]);
    const view = await mount();
    expect(view.host.querySelector('[data-testid="banks"]')?.textContent).toBe('');
    expect(view.host.querySelector('[data-testid="cash"]')?.textContent).toBe('');
    expect(view.host.querySelector('[data-testid="error"]')?.textContent).toBe('403');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    view.cleanup();
  });
});
