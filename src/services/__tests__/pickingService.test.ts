import { afterEach, describe, expect, it, vi } from 'vitest';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../api/axios', () => ({ authFetch }));
vi.mock('../api', () => ({ API_BASE_URL: 'https://api.test/api' }));

import { getPickList, recordPick } from '../pickingService';

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

/** Line object shape from app/api/picking.py `_detail` (POST pick and GET detail). */
function backendPickListDetail() {
  return {
    id: 4,
    number: 'PK-000099',
    source_kind: 'invoice',
    route_id: null,
    route_date: null,
    van_id: null,
    status: 'picking',
    assigned_to: null,
    created_by: 1,
    created_at: '2026-10-28T12:00:00',
    released_at: '2026-10-28T12:05:00',
    picked_at: null,
    dispatched_at: null,
    dispatched_by: null,
    driver_id: null,
    manifest_number: null,
    delivered_at: null,
    has_failed_delivery: false,
    notes: null,
    lines: [
      {
        id: 55,
        invoice_id: 12,
        invoice_line_index: 0,
        invoice_number: 'INV-12',
        customer_id: 3,
        customer_name: 'Tenant Co',
        product_id: 88,
        sku: 'WH-PLAIN',
        name: 'Plain oil',
        location_id: 1,
        location_code: 'MAIN',
        location_path: 'MAIN',
        sequence: 1,
        qty_required: 10,
        qty_picked: 10,
        picked_location_id: 1,
        status: 'picked',
        picked_by: 2,
        picked_at: '2026-10-28T12:10:00',
        note: null,
        lots: [],
        lots_picked: null,
      },
    ],
  };
}

describe('pickingService maps app/api/picking.py pick list detail', () => {
  afterEach(() => authFetch.mockReset());

  it('maps qty_required, qty_picked, status, and location from backend snake_case lines', async () => {
    authFetch.mockImplementation(() => ok(backendPickListDetail()));
    const detail = await getPickList(4);
    expect(detail.lines).toHaveLength(1);
    const line = detail.lines[0];
    expect(line.qtyRequired).toBe(10);
    expect(line.qtyPicked).toBe(10);
    expect(line.status).toBe('picked');
    expect(line.locationCode).toBe('MAIN');
    expect(line.productName).toBe('Plain oil');
    expect(line.sku).toBe('WH-PLAIN');
  });

  it('recordPick returns the same mapped pick list detail as GET', async () => {
    authFetch.mockImplementation(() => ok(backendPickListDetail()));
    const detail = await recordPick(4, 55, { qty: 10 });
    expect(detail.number).toBe('PK-000099');
    expect(detail.lines[0].qtyPicked).toBe(10);
    expect(detail.lines[0].qtyRequired).toBe(10);
  });
});
