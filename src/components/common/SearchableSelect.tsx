import { useState, useMemo, useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

type SearchableSelectTheme = 'light' | 'dark';

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder,
    displayKey = 'name',
    disabled = false,
    theme = 'light',
}: {
    options: any[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    displayKey?: string;
    disabled?: boolean;
    theme?: SearchableSelectTheme;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState({});
    const buttonRef = useRef<HTMLButtonElement>(null);
    const isDark = theme === 'dark';

    const selectedOption = options.find(
        opt => String(opt.id) === String(value)
    );

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        return options.filter(opt =>
            opt[displayKey]?.toLowerCase().includes(search.toLowerCase()) ||
            opt.code?.toLowerCase().includes(search.toLowerCase()) ||
            opt.sku?.toLowerCase().includes(search.toLowerCase())
        );
    }, [options, search, displayKey]);

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

    const handleSelect = (optionId: string) => {
        onChange(optionId);
        setIsOpen(false);
        setSearch('');
    };

    const buttonClass = isDark
        ? 'w-full rounded-lg px-4 py-3 text-sm font-bold text-left flex items-center justify-between disabled:opacity-50 transition-colors focus:outline-none'
        : 'w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold text-left hover:border-gray-400 focus:border-[#800020] focus:outline-none flex items-center justify-between disabled:bg-gray-100 transition-colors';

    const buttonStyle = isDark
        ? {
              border: '0.5px solid var(--color-border-tertiary)',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
          }
        : undefined;

    const selectedTextStyle = isDark
        ? { color: selectedOption ? 'var(--color-text-primary)' : '#8BA3C7' }
        : undefined;

    const selectedTextClass = isDark
        ? undefined
        : selectedOption
          ? 'text-gray-900'
          : 'text-gray-400';

    const panelClass = isDark
        ? 'rounded-lg shadow-xl max-h-80 overflow-hidden'
        : 'bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-80 overflow-hidden';

    const panelStyle = isDark
        ? {
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
          }
        : undefined;

    const searchWrapClass = isDark
        ? 'p-3'
        : 'p-3 border-b border-gray-200 bg-gray-50';

    const searchWrapStyle = isDark
        ? { borderBottom: '0.5px solid var(--color-border-tertiary)' }
        : undefined;

    const searchInputClass = isDark
        ? 'w-full rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none placeholder:text-[#8BA3C7]'
        : 'w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 focus:outline-none';

    const searchInputStyle = isDark
        ? {
              border: '0.5px solid var(--color-border-tertiary)',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
          }
        : undefined;

    const emptyClass = isDark
        ? 'px-4 py-8 text-sm text-center'
        : 'px-4 py-8 text-sm text-gray-500 text-center';

    const emptyStyle = isDark ? { color: 'var(--color-text-secondary)' } : undefined;

    const optionClass = isDark
        ? 'w-full px-4 py-3 text-left transition-colors'
        : 'w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100';

    const optionStyle = (isLast: boolean): CSSProperties | undefined =>
        isDark
            ? {
                  borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary)',
                  color: 'var(--color-text-primary)',
              }
            : undefined;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={buttonClass}
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
                    <div
                        className={panelClass}
                        style={{ ...dropdownStyle, ...panelStyle }}
                    >
                        <div className={searchWrapClass} style={searchWrapStyle}>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Type to search..."
                                className={searchInputClass}
                                style={searchInputStyle}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {filteredOptions.length === 0 ? (
                                <div className={emptyClass} style={emptyStyle}>
                                    No results found
                                </div>
                            ) : (
                                filteredOptions.map((option, index) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(String(option.id));
                                        }}
                                        className={optionClass}
                                        style={optionStyle(index === filteredOptions.length - 1)}
                                        onMouseEnter={(e) => {
                                            if (isDark) {
                                                e.currentTarget.style.background = 'rgba(79,142,247,.12)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (isDark) {
                                                e.currentTarget.style.background = 'transparent';
                                            }
                                        }}
                                    >
                                        <div
                                            className={isDark ? 'font-bold' : 'font-bold text-gray-900'}
                                            style={isDark ? { color: 'var(--color-text-primary)' } : undefined}
                                        >
                                            {option[displayKey]}
                                        </div>
                                        {option.sku && (
                                            <div
                                                className={isDark ? 'text-xs mt-1' : 'text-xs text-gray-500 mt-1'}
                                                style={isDark ? { color: '#8BA3C7' } : undefined}
                                            >
                                                SKU: {option.sku}
                                            </div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
