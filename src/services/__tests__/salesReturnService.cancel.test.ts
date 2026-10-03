import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/axios', () => ({
  authFetch: vi.fn(),
}));

const cancelledRow = {
  id: 42,
  return_number: 'RTN-42',
  original_invoice_id: 1,
  original_invoice_number: 'INV-1',
  customer_id: 1,
  customer_name: 'Acme',
  return_date: '2026-07-01',
  reason: 'other',
  items: [],
  subtotal: 0,
  tax: 0,
  total_return_amount: 0,
  notes: '',
  status: 'cancelled',
  created_at: '2026-07-01T00:00:00.000Z',
};

describe('cancelSalesReturn', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('PATCHes sales-returns/42 with status cancelled and maps the row', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => cancelledRow,
    } as Response);

    const { cancelSalesReturn } = await import('../salesReturnService');
    const result = await cancelSalesReturn('42');

    expect(result.status).toBe('cancelled');
    expect(result.id).toBe('42');
    expect(authFetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(authFetch).mock.calls[0];
    expect(String(url)).toMatch(/\/sales-returns\/42$/);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'cancelled' });
  });
});
