import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/axios', () => ({
  authFetch: vi.fn(),
}));

function http(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

describe('getSupplierBalance return totals', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('returns the API balance unchanged when totalReturns and totalRefunds are also present', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http({ balance: 100, totalReturns: 40, totalRefunds: 10 }));
    const { getSupplierBalance } = await import('../purchasesService');
    await expect(getSupplierBalance('9')).resolves.toBe(100);
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  it('fallback is opening + purchases − payments when return totals are absent', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.endsWith('/balance')) return http({}, false);
      if (u.endsWith('/purchases')) return http([{ grandTotal: 80 }]);
      if (u.endsWith('/payments')) return http([{ amount: 30 }]);
      return http({ id: 9, name: 'Acme', opening_balance: 20 });
    });
    const { getSupplierBalance } = await import('../purchasesService');
    await expect(getSupplierBalance('9')).resolves.toBe(70);
  });

  it('fallback subtracts totalReturns and adds totalRefunds when present', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.endsWith('/balance')) return http({}, false);
      if (u.endsWith('/purchases')) return http([{ grandTotal: 80 }]);
      if (u.endsWith('/payments')) return http([{ amount: 30 }]);
      return http({
        id: 9,
        name: 'Acme',
        opening_balance: 20,
        totalReturns: 15,
        totalRefunds: 5,
      });
    });
    const { getSupplierBalance } = await import('../purchasesService');
    await expect(getSupplierBalance('9')).resolves.toBe(60);
  });
});
