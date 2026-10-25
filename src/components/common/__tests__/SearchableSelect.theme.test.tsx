import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SearchableSelect from '../SearchableSelect';

const options = [
    { id: 'sup-1', name: 'Acme Fuel', sku: 'AC-1' },
    { id: 'sup-2', name: 'Beta Oil', sku: 'BE-2' },
];

const DARK = {
    '--ss-bg': '#0a1726',
    '--ss-fg': '#EEF2FF',
    '--ss-muted': '#8BA3C7',
    '--ss-border': 'rgba(255,255,255,.08)',
    '--ss-hover-bg': 'rgba(255,255,255,.06)',
    '--ss-selected-bg': 'rgba(79,142,247,.18)',
    '--ss-input-bg': '#060f1c',
};

const LIGHT = {
    '--ss-bg': '#ffffff',
    '--ss-fg': '#111827',
    '--ss-muted': '#6b7280',
    '--ss-border': '#d1d5db',
    '--ss-hover-bg': '#eff6ff',
    '--ss-selected-bg': 'transparent',
    '--ss-input-bg': '#ffffff',
};

function renderSelect(props: Partial<ComponentProps<typeof SearchableSelect>> = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(
            <SearchableSelect
                options={options}
                value=""
                onChange={() => undefined}
                placeholder="Search supplier..."
                {...props}
            />,
        );
    });
    return { container, root };
}

function openPanel(container: HTMLElement) {
    const trigger = container.querySelector('button');
    if (!trigger) throw new Error('trigger missing');
    act(() => {
        trigger.click();
    });
}

function cssVar(el: Element, name: string) {
    return (el as HTMLElement).style.getPropertyValue(name).trim();
}

describe('SearchableSelect theme', () => {
    const mounted: Root[] = [];

    afterEach(() => {
        mounted.splice(0).forEach((root) => {
            act(() => root.unmount());
        });
        document.body.innerHTML = '';
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    it('renders variant="dark" with dark panel and input variables', () => {
        const { container, root } = renderSelect({ variant: 'dark' });
        mounted.push(root);

        const host = container.firstElementChild as HTMLElement;
        expect(host.getAttribute('data-variant')).toBe('dark');
        for (const [name, value] of Object.entries(DARK)) {
            expect(cssVar(host, name)).toBe(value);
        }

        openPanel(container);
        const panel = document.querySelector('[data-testid="searchable-select-panel"]') as HTMLElement;
        const input = document.querySelector('[data-testid="searchable-select-input"]') as HTMLInputElement;
        expect(panel).toBeTruthy();
        expect(input).toBeTruthy();
        expect(panel.getAttribute('data-variant')).toBe('dark');
        expect(input.getAttribute('data-variant')).toBe('dark');
        for (const [name, value] of Object.entries(DARK)) {
            expect(cssVar(panel, name)).toBe(value);
            expect(cssVar(input, name)).toBe(value);
        }
        expect(panel.style.background).toBe('var(--ss-bg)');
        expect(input.style.background).toBe('var(--ss-input-bg)');
        expect(input.style.color).toBe('var(--ss-fg)');
    });

    it('keeps the light variable defaults when variant is omitted', () => {
        const { container, root } = renderSelect();
        mounted.push(root);

        const host = container.firstElementChild as HTMLElement;
        expect(host.getAttribute('data-variant')).toBe('light');
        for (const [name, value] of Object.entries(LIGHT)) {
            expect(cssVar(host, name)).toBe(value);
        }

        openPanel(container);
        const panel = document.querySelector('[data-testid="searchable-select-panel"]') as HTMLElement;
        const input = document.querySelector('[data-testid="searchable-select-input"]') as HTMLInputElement;
        expect(panel.getAttribute('data-variant')).toBe('light');
        expect(input.getAttribute('data-variant')).toBe('light');
        for (const [name, value] of Object.entries(LIGHT)) {
            expect(cssVar(panel, name)).toBe(value);
            expect(cssVar(input, name)).toBe(value);
        }
        expect(panel.style.background).toBe('var(--ss-bg)');
        expect(input.style.background).toBe('var(--ss-input-bg)');
    });

    it('calls onChange with the selected option id', () => {
        const onChange = vi.fn();
        const { container, root } = renderSelect({ onChange });
        mounted.push(root);

        openPanel(container);
        const panel = document.querySelector('[data-testid="searchable-select-panel"]') as HTMLElement;
        const option = Array.from(panel.querySelectorAll('button')).find((button) =>
            button.textContent?.includes('Acme Fuel'),
        );
        expect(option).toBeTruthy();
        act(() => {
            option!.click();
        });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('sup-1');
    });
});
