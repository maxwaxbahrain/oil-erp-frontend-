import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface CustomerComboboxOption {
    id: string | number;
    name: string;
    phone?: string;
    code?: string;
    address?: string;
    /** Absent means active. Inactive customers stay out of the search list. */
    is_active?: boolean;
}

const MAX_MATCHES = 50;

function matchesQuery(customer: CustomerComboboxOption, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [customer.name, customer.phone, customer.code].some((part) =>
        (part || '').toLowerCase().includes(q),
    );
}

function highlight(text: string, query: string) {
    const q = query.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark>{text.slice(idx, idx + q.length)}</mark>
            {text.slice(idx + q.length)}
        </>
    );
}

function secondaryLine(customer: CustomerComboboxOption): string {
    return [customer.code, customer.phone, customer.address].filter(Boolean).join(' · ');
}

export default function CustomerCombobox({
    customers,
    value,
    onChange,
    placeholder = 'Search customer',
}: {
    customers: CustomerComboboxOption[];
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
}) {
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const suppressFocusOpen = useRef(false);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    const selected = customers.find((customer) => String(customer.id) === String(value)) ?? null;
    const inactiveSelected = Boolean(selected && selected.is_active === false);

    const matches = useMemo(() => {
        return customers
            .filter((customer) => customer.is_active !== false)
            .filter((customer) => matchesQuery(customer, query))
            .slice(0, MAX_MATCHES);
    }, [customers, query]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query, open]);

    useEffect(() => {
        if (!open) return;
        const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
        node?.scrollIntoView?.({ block: 'nearest' });
    }, [activeIndex, open, matches.length]);

    const selectCustomer = (id: string) => {
        onChange(id);
        setQuery('');
        setOpen(false);
        const input = inputRef.current;
        if (input && document.activeElement !== input) {
            suppressFocusOpen.current = true;
            input.focus();
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) {
                setOpen(true);
                return;
            }
            setActiveIndex((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) return;
            setActiveIndex((index) => Math.max(index - 1, 0));
            return;
        }
        if (event.key === 'Enter' && open) {
            event.preventDefault();
            const pick = matches[activeIndex];
            if (pick) selectCustomer(String(pick.id));
            return;
        }
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            return;
        }
        if (event.key === 'Tab') setOpen(false);
    };

    const shownQuery = open ? query : '';
    const inputValue = open ? query : (selected?.name ?? '');

    return (
        <div className="customer-combobox">
            <div className="customer-combobox-field">
                <input
                    ref={inputRef}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={open && matches[activeIndex] ? `${listId}-${matches[activeIndex].id}` : undefined}
                    value={inputValue}
                    placeholder={placeholder}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        if (suppressFocusOpen.current) {
                            suppressFocusOpen.current = false;
                            return;
                        }
                        setQuery('');
                        setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                />
                {inactiveSelected && !open && <span className="customer-combobox-tag">Inactive</span>}
                {value && (
                    <button
                        type="button"
                        className="customer-combobox-clear"
                        aria-label="Clear customer"
                        onClick={() => {
                            onChange('');
                            setQuery('');
                            setOpen(false);
                            inputRef.current?.focus();
                        }}
                    >
                        ×
                    </button>
                )}
            </div>
            {open && (
                <div
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    className="customer-combobox-list"
                >
                    {matches.length === 0 ? (
                        <div className="customer-combobox-empty" role="status">No customers match</div>
                    ) : (
                        matches.map((customer, index) => {
                            const meta = secondaryLine(customer);
                            const active = index === activeIndex;
                            return (
                                <button
                                    key={customer.id}
                                    id={`${listId}-${customer.id}`}
                                    type="button"
                                    role="option"
                                    aria-selected={String(customer.id) === String(value)}
                                    data-active={active ? 'true' : 'false'}
                                    className={active ? 'is-active' : undefined}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => selectCustomer(String(customer.id))}
                                >
                                    <span className="customer-combobox-name">{highlight(customer.name, shownQuery)}</span>
                                    {meta && <span className="customer-combobox-meta">{highlight(meta, shownQuery)}</span>}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
