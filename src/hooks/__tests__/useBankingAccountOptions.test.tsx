import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getBankingAccountOptions } = vi.hoisted(() => ({
  getBankingAccountOptions: vi.fn(),
}));

vi.mock('../../services/glService', () => ({
  getBankingAccountOptions,
}));

import { useBankingAccountOptions } from '../useBankingAccountOptions';

const payload = {
  accounts: [
    { id: 2, code: '1011', name: 'Operating', role: 'bank', is_default: false },
    { id: 3, code: '1000', name: 'Cash on Hand', role: 'cash', is_default: false },
    { id: 1, code: '1010', name: 'Main Bank', role: 'bank', is_default: true },
  ],
  collections_bank_account_id: 2,
};

function Probe() {
  const state = useBankingAccountOptions();
  return (
    <div>
      <span data-testid="banks">{state.banks.map((bank) => bank.code).join(',')}</span>
      <span data-testid="cash">{state.cash.map((account) => account.code).join(',')}</span>
      <span data-testid="default">{state.defaultBank?.code ?? ''}</span>
      <span data-testid="collections">{state.collectionsBankId ?? ''}</span>
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

describe('useBankingAccountOptions', () => {
  beforeEach(() => {
    getBankingAccountOptions.mockReset();
  });

  it('splits cash from banks and exposes collectionsBankId', async () => {
    getBankingAccountOptions.mockResolvedValue(payload);
    const view = await mount();
    expect(view.host.querySelector('[data-testid="banks"]')?.textContent).toBe('1010,1011');
    expect(view.host.querySelector('[data-testid="cash"]')?.textContent).toBe('1000');
    expect(view.host.querySelector('[data-testid="default"]')?.textContent).toBe('1010');
    expect(view.host.querySelector('[data-testid="collections"]')?.textContent).toBe('2');
    view.cleanup();
  });

  it('returns empty lists on error without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getBankingAccountOptions.mockRejectedValue(new Error('403'));
    const view = await mount();
    expect(view.host.querySelector('[data-testid="banks"]')?.textContent).toBe('');
    expect(view.host.querySelector('[data-testid="cash"]')?.textContent).toBe('');
    expect(view.host.querySelector('[data-testid="collections"]')?.textContent).toBe('');
    expect(view.host.querySelector('[data-testid="error"]')?.textContent).toBe('403');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    view.cleanup();
  });
});
