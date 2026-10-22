import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/axios', () => ({
  authFetch: vi.fn(),
}));

function http(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const pageBody = {
  total: 2,
  sum_amount: 15.5,
  items: [
    {
      id: 1,
      supplier_id: 4,
      supplier_name: 'Acme Supply',
      amount: 10,
      date: '2026-10-01',
      payment_method: 'Bank Transfer',
      reference: 'PAY-1',
      account_code: '1010',
      account_name: 'Main Bank',
      allocated_total: 6,
      unallocated: 4,
      allocations: [{ po_id: 8, po_number: 'PO-8', amount: 6 }],
    },
  ],
};

describe('getAllSupplierPayments', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('GETs /supplier-payments with only the params that are set', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http(pageBody));
    const { getAllSupplierPayments } = await import('../purchasesService');

    await getAllSupplierPayments({
      supplier_id: '4',
      date_from: '2026-01-01',
      date_to: '2026-01-31',
      account_id: 21,
      limit: 100,
      offset: 0,
    });

    const [url, init] = vi.mocked(authFetch).mock.calls[0];
    const href = String(url);
    expect(href).toMatch(/\/supplier-payments\?/);
    expect(href).not.toMatch(/\/suppliers\/supplier-payments/);
    expect(href).toContain('supplier_id=4');
    expect(href).toContain('date_from=2026-01-01');
    expect(href).toContain('date_to=2026-01-31');
    expect(href).toContain('account_id=21');
    expect(href).toContain('limit=100');
    expect(href).toContain('offset=0');
    expect(init?.method ?? 'GET').toBe('GET');

    vi.mocked(authFetch).mockResolvedValue(http({ total: 0, sum_amount: 0, items: [] }));
    await getAllSupplierPayments({
      supplier_id: '',
      date_from: '',
      date_to: undefined,
      account_id: undefined,
    });
    const [bare] = vi.mocked(authFetch).mock.calls[1];
    expect(String(bare)).toMatch(/\/supplier-payments$/);
    expect(String(bare)).not.toContain('supplier_id');
    expect(String(bare)).not.toContain('date_from');
    expect(String(bare)).not.toContain('date_to');
    expect(String(bare)).not.toContain('account_id');
    expect(String(bare)).not.toContain('limit');
    expect(String(bare)).not.toContain('offset');
  });

  it('parses the supplier payments page shape', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http(pageBody));
    const { getAllSupplierPayments } = await import('../purchasesService');

    const page = await getAllSupplierPayments({ limit: 100, offset: 0 });
    expect(page.total).toBe(2);
    expect(page.sum_amount).toBe(15.5);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].supplierId).toBe('4');
    expect(page.items[0].supplier_name).toBe('Acme Supply');
    expect(page.items[0].paymentMethod).toBe('Bank Transfer');
    expect(page.items[0].account_code).toBe('1010');
    expect(page.items[0].account_name).toBe('Main Bank');
    expect(page.items[0].allocated_total).toBe(6);
    expect(page.items[0].unallocated).toBe(4);
    expect(page.items[0].allocations).toEqual([{ po_id: 8, po_number: 'PO-8', amount: 6 }]);
  });

  it('rejects when the supplier payments request returns HTTP 500', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http({}, 500));
    const { getAllSupplierPayments } = await import('../purchasesService');

    await expect(getAllSupplierPayments({})).rejects.toThrow(/HTTP 500/);
  });
});
