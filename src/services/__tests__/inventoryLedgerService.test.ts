import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/axios', () => ({
  authFetch: vi.fn(),
}));

function http(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const emptyOnHand = { total: 0, totals: { products: 0, units: 0, value_at_cost: 0 }, rows: [] };
const emptyMovements = { total: 0, rows: [] };

describe('inventoryLedgerService query strings', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('GETs /inventory/summary with no query', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http({ products_active: 0 }));
    const { getInventorySummary } = await import('../inventoryLedgerService');
    await getInventorySummary();
    const [url, init] = vi.mocked(authFetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/inventory\/summary$/);
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('builds the on-hand query and omits false filters', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http(emptyOnHand));
    const { getOnHand } = await import('../inventoryLedgerService');
    await getOnHand({ search: ' oil ', below_min: true, zero: false, limit: 50, offset: 100 });
    const url = String(vi.mocked(authFetch).mock.calls[0][0]);
    expect(url).toMatch(/\/api\/inventory\/on-hand\?/);
    expect(url).toContain('search=oil');
    expect(url).toContain('below_min=true');
    expect(url).not.toContain('zero=');
    expect(url).toContain('limit=50');
    expect(url).toContain('offset=100');
  });

  it('builds the movements query', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue(http(emptyMovements));
    const { getMovements } = await import('../inventoryLedgerService');
    await getMovements({
      product_id: 9,
      source_type: 'grn',
      date_from: '2026-01-01',
      date_to: '2026-03-31',
      limit: 50,
      offset: 0,
    });
    const url = String(vi.mocked(authFetch).mock.calls[0][0]);
    expect(url).toMatch(/\/api\/inventory\/movements\?/);
    expect(url).toContain('product_id=9');
    expect(url).toContain('source_type=grn');
    expect(url).toContain('date_from=2026-01-01');
    expect(url).toContain('date_to=2026-03-31');
    expect(url).toContain('limit=50');
    expect(url).toContain('offset=0');
  });
});
