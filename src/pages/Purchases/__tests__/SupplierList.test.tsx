import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getOilErpApiBase } from '../../../config/apiBase';
import SupplierList from '../SupplierList';

const authFetch = vi.fn();

vi.mock('../../../api/axios', () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
  ACCESS_TOKEN_KEY: 'access_token',
}));

vi.mock('../../../services/purchasesService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/purchasesService')>();
  return {
    ...actual,
    deleteSupplier: vi.fn(),
  };
});

function jsonResponse(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

function textHtmlResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new SyntaxError("Unexpected token '<'")),
  };
}

describe('SupplierList empty vs failed', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authFetch.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <SupplierList />
        </MemoryRouter>,
      );
    });
    // settle async load
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function text() {
    return container.textContent || '';
  }

  it('failed load → error + Retry (not "No suppliers found")', async () => {
    authFetch.mockResolvedValue(jsonResponse(false, 502, { detail: 'bad gateway' }));
    await renderPage();

    expect(text()).toContain('HTTP 502');
    expect(text()).toContain('Retry');
    expect(text()).not.toContain('No suppliers found');
    expect(authFetch.mock.calls[0][0]).toBe(`${getOilErpApiBase()}/suppliers/`);
  });

  it('HTML/json parse failure → error banner, not empty catalogue copy', async () => {
    authFetch.mockResolvedValue(textHtmlResponse(200));
    await renderPage();

    expect(text()).toMatch(/web page instead of supplier data|Unexpected token/i);
    expect(text()).toContain('Retry');
    expect(text()).not.toContain('No suppliers found');
  });

  it('200 [] → "No suppliers found"', async () => {
    authFetch.mockResolvedValue(jsonResponse(true, 200, []));
    await renderPage();

    expect(text()).toContain('No suppliers found');
    expect(text()).not.toContain('Retry');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('list → rows shown', async () => {
    authFetch.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.endsWith('/suppliers/') || u.endsWith('/suppliers')) {
        return jsonResponse(true, 200, [
          {
            id: 42,
            name: 'ABC Co.',
            code: 'SUP-42',
            contact_person: 'Ann',
            email: 'a@b.co',
            phone: '555',
            status: 'Active',
            payment_terms: 'Net 30',
            currency: 'USD',
          },
        ]);
      }
      if (u.includes('/balance')) return jsonResponse(true, 200, { balance: 0 });
      if (u.includes('/purchases')) return jsonResponse(true, 200, []);
      return jsonResponse(false, 404, {});
    });

    await renderPage();

    expect(text()).toContain('ABC Co.');
    expect(text()).toContain('SUP-42');
    expect(text()).not.toContain('No suppliers found');
  });

  it('opening Supplier Master clears suppliers, supplier_payments, and purchase_orders', async () => {
    localStorage.setItem('suppliers', JSON.stringify([{ id: 'SUP-LEGACY', name: 'Old Co' }]));
    localStorage.setItem('supplier_payments', JSON.stringify([{ id: 'pay-1', amount: 10 }]));
    localStorage.setItem('purchase_orders', JSON.stringify([{ id: 'po-1', poNumber: 'PO-1' }]));
    authFetch.mockResolvedValue(jsonResponse(true, 200, []));

    await renderPage();

    expect(localStorage.getItem('suppliers')).toBeNull();
    expect(localStorage.getItem('supplier_payments')).toBeNull();
    expect(localStorage.getItem('purchase_orders')).toBeNull();
  });
});
