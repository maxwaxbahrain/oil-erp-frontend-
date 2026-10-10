import { createRoot, type Root } from 'react-dom/client';
import { act, useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import CustomerCombobox, { type CustomerComboboxOption } from '../CustomerCombobox';

const customers: CustomerComboboxOption[] = [
    { id: '1', name: 'Acme Fuel', phone: '555-0100', code: 'AC', address: '1 Main St' },
    { id: '2', name: 'Beta Shop', phone: '555-0199', code: 'BE', address: '2 Side St' },
    { id: '3', name: 'Gone LLC', phone: '555-0001', code: 'GN', address: 'Closed', is_active: false },
];

function mount(node: ReactElement) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let root: Root;
    act(() => {
        root = createRoot(host);
        root.render(node);
    });
    return {
        host,
        cleanup() {
            act(() => root.unmount());
            host.remove();
        },
    };
}

function inputOf(host: HTMLElement) {
    return host.querySelector('input') as HTMLInputElement;
}

function typeQuery(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function press(input: HTMLInputElement, key: string) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('CustomerCombobox', () => {
    it('filters by name or phone and highlights the match', () => {
        const { host, cleanup } = mount(
            <CustomerCombobox customers={customers} value="" onChange={() => undefined} />,
        );
        const input = inputOf(host);
        act(() => input.focus());
        act(() => typeQuery(input, '0199'));
        const options = Array.from(host.querySelectorAll('[role="option"]'));
        expect(options).toHaveLength(1);
        expect(options[0].textContent).toContain('Beta Shop');
        expect(options[0].textContent).toContain('555-0199');
        expect(host.querySelector('mark')?.textContent).toBe('0199');
        expect(host.textContent).not.toContain('Gone LLC');

        act(() => typeQuery(input, 'cme'));
        expect(host.querySelector('[role="option"] .customer-combobox-name mark')?.textContent).toBe('cme');
        cleanup();
    });

    it('selects the highlighted customer with ArrowDown and Enter', () => {
        function Harness() {
            const [value, setValue] = useState('');
            return <CustomerCombobox customers={customers} value={value} onChange={setValue} />;
        }
        const { host, cleanup } = mount(<Harness />);
        const input = inputOf(host);
        act(() => input.focus());
        act(() => press(input, 'ArrowDown'));
        act(() => press(input, 'Enter'));
        expect(input.value).toBe('Beta Shop');
        expect(host.querySelector('[role="listbox"]')).toBeNull();
        cleanup();
    });

    it('hides inactive customers from the list and shows an Inactive tag when one is already selected', () => {
        const { host, cleanup } = mount(
            <CustomerCombobox customers={customers} value="3" onChange={() => undefined} />,
        );
        expect(inputOf(host).value).toBe('Gone LLC');
        expect(host.textContent).toContain('Inactive');
        expect(host.querySelector('[role="listbox"]')).toBeNull();

        act(() => inputOf(host).focus());
        const names = Array.from(host.querySelectorAll('[role="option"] .customer-combobox-name')).map((node) => node.textContent);
        expect(names).toEqual(['Acme Fuel', 'Beta Shop']);
        cleanup();
    });

    it('says when nothing matches and clears the selection', () => {
        const onChange = vi.fn();
        const { host, cleanup } = mount(
            <CustomerCombobox customers={customers} value="1" onChange={onChange} />,
        );
        const input = inputOf(host);
        act(() => input.focus());
        act(() => typeQuery(input, 'zzzz'));
        expect(host.textContent).toContain('No customers match');

        act(() => {
            (host.querySelector('button[aria-label="Clear customer"]') as HTMLButtonElement).click();
        });
        expect(onChange).toHaveBeenCalledWith('');
        cleanup();
    });
});
