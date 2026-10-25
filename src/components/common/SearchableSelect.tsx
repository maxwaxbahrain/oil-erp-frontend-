import { useState, useMemo, useEffect, useRef, memo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

type SearchableSelectVariant = 'light' | 'dark';

const MAX_VISIBLE_OPTIONS = 50;
const SEARCH_DEBOUNCE_MS = 150;

// Light defaults reproduce the previous Tailwind classes:
// bg-white, text-gray-900, text-gray-500, border-gray-300, hover:bg-blue-50.
// Light rows had no selected fill, so --ss-selected-bg stays transparent.
const LIGHT_VARS = {
    '--ss-bg': '#ffffff',
    '--ss-fg': '#111827',
    '--ss-muted': '#6b7280',
    '--ss-border': '#d1d5db',
    '--ss-hover-bg': '#eff6ff',
    '--ss-selected-bg': 'transparent',
    '--ss-input-bg': '#ffffff',
} as const;

const DARK_VARS = {
    '--ss-bg': '#0a1726',
    '--ss-fg': '#EEF2FF',
    '--ss-muted': '#8BA3C7',
    '--ss-border': 'rgba(255,255,255,.08)',
    '--ss-hover-bg': 'rgba(255,255,255,.06)',
    '--ss-selected-bg': 'rgba(79,142,247,.18)',
    '--ss-input-bg': '#060f1c',
} as const;

function themeVars(variant: SearchableSelectVariant): CSSProperties {
    return (variant === 'dark' ? DARK_VARS : LIGHT_VARS) as unknown as CSSProperties;
}

function SearchableSelect({
    options,
    value,
    onChange,
    placeholder,
    displayKey = 'name',
    disabled = false,
    variant,
    theme,
    className,
}: {
    options: any[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    displayKey?: string;
    disabled?: boolean;
    variant?: SearchableSelectVariant;
    /** Legacy alias for `variant`. `variant` wins when both are set. */
    theme?: SearchableSelectVariant;
    /** Optional extra classes on the trigger button. Defaults unchanged for other screens. */
    className?: string;
}) {
    const resolvedVariant: SearchableSelectVariant = variant ?? theme ?? 'light';
    const isDark = resolvedVariant === 'dark';
    const vars = themeVars(resolvedVariant);

    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState({});
    const buttonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [search]);

    const selectedOption = useMemo(
        () => options.find(opt => String(opt.id) === String(value)),
        [options, value]
    );

    const filteredOptions = useMemo(() => {
        if (!debouncedSearch) return options;
        const q = debouncedSearch.toLowerCase();
        return options.filter(opt =>
            opt[displayKey]?.toLowerCase().includes(q) ||
            opt.code?.toLowerCase().includes(q) ||
            opt.sku?.toLowerCase().includes(q)
        );
    }, [options, debouncedSearch, displayKey]);

    const totalMatches = filteredOptions.length;
    const visibleOptions = filteredOptions.slice(0, MAX_VISIBLE_OPTIONS);
    const isTruncated = totalMatches > MAX_VISIBLE_OPTIONS;

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width,
                zIndex: 99999,
            });
        }
    }, [isOpen]);

    // Lock page scroll while open without shifting layout (no position:fixed on body).
    useEffect(() => {
        if (!isOpen) return;

        const prevOverflow = document.body.style.overflow;
        const prevPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        const focusFrame = requestAnimationFrame(() => {
            inputRef.current?.focus({ preventScroll: true });
        });

        return () => {
            cancelAnimationFrame(focusFrame);
            document.body.style.overflow = prevOverflow;
            document.body.style.paddingRight = prevPaddingRight;
        };
    }, [isOpen]);

    const handleSelect = (optionId: string) => {
        onChange(optionId);
        setIsOpen(false);
        setSearch('');
    };

    const buttonClass = isDark
        ? 'w-full rounded-lg px-4 py-3 text-sm font-bold text-left flex items-center justify-between disabled:opacity-50 transition-colors focus:outline-none'
        : 'w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold text-left hover:border-gray-400 focus:border-[#800020] focus:outline-none flex items-center justify-between disabled:bg-gray-100 transition-colors';

    const buttonStyle: CSSProperties | undefined = isDark
        ? {
              border: '0.5px solid var(--ss-border)',
              background: 'var(--ss-bg)',
              color: 'var(--ss-fg)',
          }
        : undefined;

    const selectedTextStyle: CSSProperties | undefined = isDark
        ? { color: selectedOption ? 'var(--ss-fg)' : 'var(--ss-muted)' }
        : undefined;

    const selectedTextClass = isDark
        ? undefined
        : selectedOption
          ? 'text-gray-900'
          : 'text-gray-400';

    const panelBorder = isDark
        ? '0.5px solid var(--ss-border)'
        : '2px solid var(--ss-border)';

    return (
        <div className="relative" data-variant={resolvedVariant} style={vars}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={[buttonClass, className].filter(Boolean).join(' ')}
                style={buttonStyle}
            >
                <span className={selectedTextClass} style={selectedTextStyle}>
                    {selectedOption ? selectedOption[displayKey] : placeholder}
                </span>
            </button>

            {isOpen && createPortal(
                <>
                    <div
                        className="fixed inset-0"
                        style={{ zIndex: 99998 }}
                        onClick={() => { setIsOpen(false); setSearch(''); }}
                    />
                    {/* Portaled to document.body, so it cannot inherit variables from the
                        wrapper above. The same variables are copied onto this panel. */}
                    <div
                        data-variant={resolvedVariant}
                        data-testid="searchable-select-panel"
                        className="rounded-lg shadow-xl max-h-80 overflow-hidden"
                        style={{
                            ...dropdownStyle,
                            ...vars,
                            background: 'var(--ss-bg)',
                            color: 'var(--ss-fg)',
                            border: panelBorder,
                        }}
                    >
                        <div
                            className="p-3"
                            style={{
                                background: 'var(--ss-bg)',
                                borderBottom: '1px solid var(--ss-border)',
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                data-variant={resolvedVariant}
                                data-testid="searchable-select-input"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Type to search..."
                                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none placeholder:text-[var(--ss-muted)]"
                                style={{
                                    ...vars,
                                    background: 'var(--ss-input-bg)',
                                    color: 'var(--ss-fg)',
                                    border: panelBorder,
                                }}
                                onFocus={(e) => {
                                    if (!isDark) e.currentTarget.style.borderColor = '#3b82f6';
                                }}
                                onBlur={(e) => {
                                    if (!isDark) e.currentTarget.style.borderColor = 'var(--ss-border)';
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {totalMatches === 0 ? (
                                <div
                                    className="px-4 py-8 text-sm text-center"
                                    style={{ color: 'var(--ss-muted)' }}
                                >
                                    No results found
                                </div>
                            ) : (
                                <>
                                {visibleOptions.map((option, index) => {
                                    const isSelected = String(option.id) === String(value);
                                    const isLastVisible = index === visibleOptions.length - 1;
                                    return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(String(option.id));
                                        }}
                                        className="w-full px-4 py-3 text-left transition-colors"
                                        style={{
                                            borderBottom: isLastVisible && !isTruncated ? 'none' : '1px solid var(--ss-border)',
                                            color: 'var(--ss-fg)',
                                            background: isSelected ? 'var(--ss-selected-bg)' : 'transparent',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--ss-hover-bg)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = isSelected
                                                ? 'var(--ss-selected-bg)'
                                                : 'transparent';
                                        }}
                                    >
                                        <div className="font-bold" style={{ color: 'var(--ss-fg)' }}>
                                            {option[displayKey]}
                                        </div>
                                        {option.sku && (
                                            <div className="text-xs mt-1" style={{ color: 'var(--ss-muted)' }}>
                                                SKU: {option.sku}
                                            </div>
                                        )}
                                    </button>
                                    );
                                })}
                                {isTruncated && (
                                    <div
                                        className="px-4 py-2 text-xs text-center"
                                        style={{
                                            color: 'var(--ss-muted)',
                                            borderTop: '1px solid var(--ss-border)',
                                        }}
                                    >
                                        Showing {MAX_VISIBLE_OPTIONS} of {totalMatches} — keep typing to narrow
                                    </div>
                                )}
                                </>
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

export default memo(SearchableSelect);
