import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder,
    displayKey = 'name',
    disabled = false
}: {
    options: any[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    displayKey?: string;
    disabled?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState({});
    const buttonRef = useRef<HTMLButtonElement>(null);

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

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold text-left hover:border-gray-400 focus:border-[#800020] focus:outline-none flex items-center justify-between disabled:bg-gray-100 transition-colors"
            >
                <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
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
                        className="bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-80 overflow-hidden"
                        style={dropdownStyle}
                    >
                        <div className="p-3 border-b border-gray-200 bg-gray-50">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Type to search..."
                                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 focus:outline-none"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-8 text-sm text-gray-500 text-center">
                                    No results found
                                </div>
                            ) : (
                                filteredOptions.map(option => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(String(option.id));
                                        }}
                                        className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100"
                                    >
                                        <div className="font-bold text-gray-900">
                                            {option[displayKey]}
                                        </div>
                                        {(option.sku) && (
                                            <div className="text-xs text-gray-500 mt-1">
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
