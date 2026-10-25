import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { FollowUps, ZavaPanel, type SpatialBlock } from '../spatial';

const blocks: SpatialBlock[] = [
    {
        type: 'metrics',
        tiles: [
            { label: 'Sales', value: '$100.00', href: '/sales/dashboard' },
            { label: 'Invoices', value: '1', href: '/sales/dashboard' },
        ],
    },
    {
        type: 'ranked_list',
        items: [{ name: 'Harbour Market', value: '$100.00', share: 100, href: '/customers/7' }],
    },
    {
        type: 'ageing',
        value: '$100.00',
        invoice_count: 1,
        href: '/reports/aged-receivable',
        buckets: [
            { key: '0_30', label: '0–30 days', amount: 0, count: 0 },
            { key: '31_60', label: '31–60 days', amount: 0, count: 0 },
            { key: '61_90', label: '61–90 days', amount: 0, count: 0 },
            { key: '90_plus', label: '90+ days', amount: 100, count: 1 },
        ],
        debtors: [{ name: 'Harbour Market', value: '$100.00', href: '/customers/7' }],
    },
    {
        type: 'table',
        columns: ['Product', 'Stock'],
        rows: [{ cells: ['Soap', '2'], href: '/products' }],
        view_all: { label: 'View all', href: '/products' },
    },
    {
        type: 'approvals',
        groups: [{ type: 'Expenses', count: 2, href: '/finance/expenses/approvals' }],
    },
    { type: 'made_up', headline: '<script>alert(1)</script>' },
];

function mount(node: ReactNode) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
        root.render(<MemoryRouter>{node}</MemoryRouter>);
    });
    return {
        host,
        unmount() {
            act(() => root.unmount());
            host.remove();
        },
    };
}

describe('spatial blocks', () => {
    it('renders each block from sample data and ignores unknown types and raw HTML', () => {
        const sent: string[] = [];
        const view = mount(
            <ZavaPanel headline="Harbour Market is the top customer." note="One invoice." blocks={blocks} onAsk={(question) => sent.push(question)} />,
        );
        const text = view.host.textContent || '';
        expect(text).toContain('Sales');
        expect(text).toContain('$100.00');
        expect(text).toContain('Harbour Market');
        expect(text).toContain('90+ days');
        expect(text).toContain('Soap');
        expect(text).toContain('Expenses');
        expect(text).toContain('View all');
        expect(view.host.querySelector('script')).toBeNull();
        expect(view.host.innerHTML).not.toContain('<script>');
        const customer = view.host.querySelector('a[href="/customers/7"]');
        expect(customer?.textContent).toContain('Harbour Market');
        expect(customer?.textContent).not.toContain('Open');
        view.unmount();

        const source = readFileSync(resolve(process.cwd(), 'src/pages/Agent/spatial.tsx'), 'utf8');
        expect(source).not.toContain('dangerouslySetInnerHTML');
    });

    it('shows an empty answer once, then the reason and a pill that sends its question', () => {
        const sent: string[] = [];
        const view = mount(
            <ZavaPanel
                headline="No invoices this month."
                blocks={[{
                    type: 'empty',
                    headline: 'SECOND TITLE',
                    reason: 'Nothing has been invoiced in this range.',
                    actions: ["Show last month's top customers"],
                }]}
                onAsk={(question) => sent.push(question)}
            />,
        );
        const text = view.host.textContent || '';
        expect(text.split('No invoices this month.').length - 1).toBe(1);
        expect(text).not.toContain('SECOND TITLE');
        expect(text).toContain('Nothing has been invoiced in this range.');
        const button = [...view.host.querySelectorAll('button')].find((node) => node.textContent?.includes('last month'));
        act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        expect(sent).toEqual(["Show last month's top customers"]);
        view.unmount();
    });

    it('sends a follow-up question when its pill is clicked', () => {
        const sent: string[] = [];
        const view = mount(<FollowUps questions={['Who owes money?']} onAsk={(question) => sent.push(question)} />);
        const button = view.host.querySelector('button');
        act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        expect(sent).toEqual(['Who owes money?']);
        view.unmount();
    });
});
