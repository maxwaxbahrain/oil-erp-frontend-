import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InventoryAdjustment, { buildProductStockPutPayload } from '../InventoryAdjustment';
import * as productService from '../../../services/productService';
import * as inventoryAdjustmentService from '../../../services/inventoryAdjustmentService';
import { authFetch } from '../../../api/axios';

vi.mock('../../../api/axios', () => ({
    authFetch: vi.fn(),
    ACCESS_TOKEN_KEY: 'token',
}));

vi.mock('../../../services/productService', () => ({
    getProducts: vi.fn(),
}));

vi.mock('../../../services/inventoryAdjustmentService', () => ({
    getAdjustmentHistory: vi.fn(),
    reverseAdjustment: vi.fn(),
}));

vi.mock('../../../store/authStore', () => ({
    getCurrentUser: () => ({ id: 1, name: 'Tester' }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return { ...actual, useNavigate: () => navigateMock };
});

const productsFixture = [
    {
        id: '42',
        name: 'Test Oil',
        sku: 'TO-42',
        stock: 10,
        current_stock: 10,
        cost: 5,
        category: 'Lubricants',
        unit: 'ea',
    },
    {
        id: '43',
        name: 'Bulk A',
        sku: 'BA-1',
        stock: 5,
        current_stock: 5,
        cost: 2,
        category: 'Lubricants',
        unit: 'ea',
    },
    {
        id: '44',
        name: 'Bulk B',
        sku: 'BB-1',
        stock: 8,
        current_stock: 8,
        cost: 3,
        category: 'Lubricants',
        unit: 'ea',
    },
];

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

function clickButtonWithText(container: HTMLElement, text: string) {
    const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes(text),
    );
    expect(btn).toBeTruthy();
    act(() => {
        btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

describe('InventoryAdjustment save payloads', () => {
    let container: HTMLDivElement;
    let root: Root;
    const authFetchMock = vi.mocked(authFetch);
    const getProductsMock = vi.mocked(productService.getProducts);
    const getAdjustmentHistoryMock = vi.mocked(inventoryAdjustmentService.getAdjustmentHistory);

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        vi.stubGlobal('alert', vi.fn());
        vi.stubGlobal('confirm', vi.fn(() => true));
        getProductsMock.mockResolvedValue(productsFixture as never);
        getAdjustmentHistoryMock.mockResolvedValue([]);
        authFetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
            const href = String(url);
            if (href.includes('/api/products/') && (!init || init.method === undefined || init.method === 'GET')) {
                return new Response(
                    JSON.stringify([{ id: 42, name: 'Test Oil', stock: 10 }]),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );
            }
            if (init?.method === 'PUT' && href.includes('/api/products/42')) {
                return new Response(JSON.stringify({ id: 42, stock: 8 }), { status: 200 });
            }
            return new Response('{}', { status: 200 });
        });
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.clearAllMocks();
    });

    function renderPage() {
        act(() => {
            root.render(
                <MemoryRouter>
                    <InventoryAdjustment />
                </MemoryRouter>,
            );
        });
    }

    it('single reduce sends reason and note on product PUT', async () => {
        renderPage();
        await act(async () => {
            await Promise.resolve();
        });

        const search = container.querySelector('input[placeholder="Search product name or SKU..."]') as HTMLInputElement;
        act(() => {
            setInputValue(search, 'Test');
        });
        await act(async () => {
            await Promise.resolve();
        });

        clickButtonWithText(container, 'Test Oil');

        clickButtonWithText(container, 'Reduce stock');
        clickButtonWithText(container, 'Damage/write-off');

        const noteInput = container.querySelector(
            'input[placeholder="Add context for audit trail..."]',
        ) as HTMLInputElement;
        act(() => {
            setInputValue(noteInput, 'dropped pallet');
        });

        const qtyInput = container.querySelector('input[type="number"][min="1"]') as HTMLInputElement;
        act(() => {
            setInputValue(qtyInput, '2');
        });

        const putsBefore = authFetchMock.mock.calls.filter(
            ([url, init]) => String(url).includes('/api/products/42') && init?.method === 'PUT',
        ).length;

        clickButtonWithText(container, 'Save adjustment');

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        const putCalls = authFetchMock.mock.calls.filter(
            ([url, init]) => String(url).includes('/api/products/42') && init?.method === 'PUT',
        );
        expect(putCalls.length - putsBefore).toBe(1);
        const body = JSON.parse(String(putCalls[putCalls.length - 1][1]?.body));
        expect(body).toEqual({
            stock: 8,
            adjustment_reason: 'Damage/write-off',
            adjustment_note: 'dropped pallet',
        });
    });

    it('add stock with no reason uses Other and omits adjustment_note', () => {
        const body = buildProductStockPutPayload(11, '', undefined);
        expect(body.adjustment_reason).toBe('Other');
        expect(body).not.toHaveProperty('adjustment_note');
        expect(body.stock).toBe(11);
    });

    it('bulk save sends Bulk entry on each PUT and refreshes adjustment history once', async () => {
        authFetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
            const href = String(url);
            if (init?.method === 'PUT' && href.includes('/api/products/')) {
                return new Response(JSON.stringify({ ok: true }), { status: 200 });
            }
            return new Response('{}', { status: 200 });
        });

        renderPage();
        await act(async () => {
            await Promise.resolve();
        });

        expect(getAdjustmentHistoryMock).toHaveBeenCalledTimes(1);
        getAdjustmentHistoryMock.mockClear();

        clickButtonWithText(container, 'Bulk entry');
        await act(async () => {
            await Promise.resolve();
        });

        const stockInputs = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
        const bulkInputs = stockInputs.filter((el) => el.placeholder === '—');
        expect(bulkInputs.length).toBeGreaterThanOrEqual(2);
        act(() => {
            setInputValue(bulkInputs[0], '12');
            setInputValue(bulkInputs[1], '3');
        });

        clickButtonWithText(container, 'Save all');

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        const putCalls = authFetchMock.mock.calls.filter(
            ([, init]) => init?.method === 'PUT' && String(init.body).includes('Bulk entry'),
        );
        expect(putCalls).toHaveLength(2);
        for (const [, init] of putCalls) {
            const parsed = JSON.parse(String(init?.body));
            expect(parsed.adjustment_reason).toBe('Bulk entry');
            expect(parsed).not.toHaveProperty('adjustment_note');
        }

        expect(getAdjustmentHistoryMock).toHaveBeenCalledTimes(1);
    });
});
