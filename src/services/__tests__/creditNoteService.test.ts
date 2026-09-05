import { afterEach, describe, expect, it, vi } from 'vitest';

const mockCreditNoteRow = {
  id: 1,
  credit_note_number: 'CN-000001',
  customer_id: 10,
  customer_name: 'Acme',
  issue_date: '2026-09-04',
  reason: 'other',
  items: [],
  subtotal: 0,
  tax: 0,
  total_credit_amount: 0,
  used_amount: 0,
  remaining_credit: 0,
  status: 'draft',
};

function mockAuthFetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockCreditNoteRow,
  });
}

vi.mock('../../api/axios', () => ({
  authFetch: vi.fn(),
}));

describe('creditNoteService.toApi line-item mapping', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('(a) line mode: serializes unitPrice as rate with quantity preserved', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockImplementation(mockAuthFetchOk());

    const { createCreditNote } = await import('../creditNoteService');

    await createCreditNote({
      customerId: '10',
      issueDate: '2026-09-04',
      reason: 'other',
      items: [{ description: 'Widget', quantity: 20, unitPrice: 22, amount: 440 }],
      subtotal: 440,
      tax: 0,
      totalCreditAmount: 440,
      status: 'draft',
    });

    const body = JSON.parse(String(vi.mocked(authFetch).mock.calls[0][1]?.body));
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      description: 'Widget',
      quantity: 20,
      rate: 22,
      amount: 440,
    });
  });

  it('(b) simple amount mode: single generated line carries rate from unitPrice', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockImplementation(mockAuthFetchOk());

    const { createCreditNote } = await import('../creditNoteService');

    await createCreditNote({
      customerId: '10',
      issueDate: '2026-09-04',
      reason: 'goodwill',
      items: [
        {
          description: 'Credit adjustment',
          quantity: 1,
          unitPrice: 150,
          amount: 150,
        },
      ],
      subtotal: 150,
      tax: 0,
      totalCreditAmount: 150,
      status: 'issued',
    });

    const body = JSON.parse(String(vi.mocked(authFetch).mock.calls[0][1]?.body));
    expect(body.items[0]).toMatchObject({
      description: 'Credit adjustment',
      quantity: 1,
      rate: 150,
      amount: 150,
    });
  });

  it('(f) patch without items key must omit items from serialized body', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockImplementation(mockAuthFetchOk());

    const { updateCreditNote } = await import('../creditNoteService');

    await updateCreditNote('1', { status: 'cancelled' });

    const body = JSON.parse(String(vi.mocked(authFetch).mock.calls[0][1]?.body));
    expect(body).not.toHaveProperty('items');
  });

  it('(g) patch with items still maps unitPrice to rate', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockImplementation(mockAuthFetchOk());

    const { updateCreditNote } = await import('../creditNoteService');

    await updateCreditNote('1', {
      items: [{ description: 'Widget', quantity: 20, unitPrice: 22, amount: 440 }],
      status: 'issued',
    });

    const body = JSON.parse(String(vi.mocked(authFetch).mock.calls[0][1]?.body));
    expect(body.items[0]).toMatchObject({
      description: 'Widget',
      quantity: 20,
      rate: 22,
      amount: 440,
    });
  });
});

describe('creditNoteService.fromApi (toUi) line-item hydration', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('(c) hydrates unitPrice from stored rate when unitPrice is absent', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockCreditNoteRow,
        items: [{ description: 'Legacy line', quantity: 5, rate: 18.5, amount: 92.5 }],
      }),
    });

    const { getCreditNote } = await import('../creditNoteService');
    const note = await getCreditNote('1');

    expect(note?.items[0]).toMatchObject({
      description: 'Legacy line',
      quantity: 5,
      unitPrice: 18.5,
      amount: 92.5,
    });
  });

  it('(d) legacy draft: unitPrice wins over rate 0 on stored line', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockCreditNoteRow,
        items: [
          {
            description: 'Draft line',
            quantity: 20,
            unitPrice: 22,
            rate: 0,
            amount: 0,
          },
        ],
      }),
    });

    const { getCreditNote } = await import('../creditNoteService');
    const note = await getCreditNote('1');

    expect(note?.items[0]?.unitPrice).toBe(22);
  });

  it('(e) post-fix stored line: hydrates unitPrice from rate when unitPrice key absent', async () => {
    const { authFetch } = await import('../../api/axios');
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockCreditNoteRow,
        items: [{ description: 'Priced line', quantity: 20, rate: 22, amount: 440 }],
      }),
    });

    const { getCreditNote } = await import('../creditNoteService');
    const note = await getCreditNote('1');

    expect(note?.items[0]?.unitPrice).toBe(22);
  });
});
