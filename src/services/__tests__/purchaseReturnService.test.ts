import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/axios', () => ({
  authFetch: vi.fn(),
}));

const draftRow = {
  id: 7,
  number: 'PR-7',
  supplier_id: 3,
  supplier_name: 'Acme Supply',
  date: '2026-10-06',
  status: 'draft',
  reason: 'damaged',
  notes: '',
  total: null,
  refund_mode: 'none',
  refund_amount: null,
  refund_account_id: null,
  journal_entry_id: null,
  refund_journal_entry_id: null,
  posted_at: null,
  cancelled_at: null,
  created_at: '2026-10-06T00:00:00Z',
  lines: [{ id: 1, product_id: 9, quantity: 2, unit_cost: null, amount: null, reason: 'damaged' }],
};

const writeBody = {
  supplier_id: 3,
  date: '2026-10-06',
  reason: 'damaged',
  notes: '',
  refund_mode: 'none' as const,
  refund_amount: null,
  refund_account_id: null,
  lines: [{ product_id: 9, quantity: 2, reason: 'damaged' }],
};

function http(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('purchaseReturnService', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('GETs the list with supplier_id and status', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http([draftRow]));
    const { list } = await import('../purchaseReturnService');
    const rows = await list({ supplier_id: 3, status: 'draft' });
    expect(rows).toHaveLength(1);
    expect(rows[0].number).toBe('PR-7');
    expect(rows[0].status).toBe('draft');
    const [url, init] = vi.mocked(authFetch).mock.calls[0];
    expect(String(url)).toMatch(/\/purchase-returns\/\?/);
    expect(String(url)).toContain('supplier_id=3');
    expect(String(url)).toContain('status=draft');
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('GETs one purchase return', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http(draftRow));
    const { get } = await import('../purchaseReturnService');
    const row = await get(7);
    expect(row.id).toBe(7);
    expect(row.lines?.[0].unit_cost).toBeNull();
    const [url, init] = vi.mocked(authFetch).mock.calls[0];
    expect(String(url)).toMatch(/\/purchase-returns\/7$/);
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('POSTs a draft body', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http(draftRow, 201));
    const { create } = await import('../purchaseReturnService');
    await create(writeBody);
    const [url, init] = vi.mocked(authFetch).mock.calls[0];
    expect(String(url)).toMatch(/\/purchase-returns\/$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(writeBody);
  });

  it('PUTs a draft body', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http(draftRow));
    const { update } = await import('../purchaseReturnService');
    await update(7, writeBody);
    const [url, init] = vi.mocked(authFetch).mock.calls[0];
    expect(String(url)).toMatch(/\/purchase-returns\/7$/);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual(writeBody);
  });

  it('POSTs /post', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http({ ...draftRow, status: 'posted', total: 5, lines: [{ ...draftRow.lines[0], unit_cost: 2.5, amount: 5 }] }));
    const { post } = await import('../purchaseReturnService');
    const row = await post(7);
    expect(row.status).toBe('posted');
    const [url, init] = vi.mocked(authFetch).mock.calls[0];
    expect(String(url)).toMatch(/\/purchase-returns\/7\/post$/);
    expect(init?.method).toBe('POST');
  });

  it('POSTs /cancel', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http({ ...draftRow, status: 'cancelled' }));
    const { cancel } = await import('../purchaseReturnService');
    const row = await cancel(7);
    expect(row.status).toBe('cancelled');
    const [url, init] = vi.mocked(authFetch).mock.calls[0];
    expect(String(url)).toMatch(/\/purchase-returns\/7\/cancel$/);
    expect(init?.method).toBe('POST');
  });

  it('surfaces backend detail text', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http({ detail: 'Insufficient stock' }, 400));
    const { post } = await import('../purchaseReturnService');
    await expect(post(7)).rejects.toThrow('Insufficient stock');
  });
});
