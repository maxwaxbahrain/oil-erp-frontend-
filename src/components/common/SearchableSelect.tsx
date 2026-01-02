import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

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

    const selectedOption = options.find(opt => opt.id === value);

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        return options.filter(opt =>
            opt[displayKey]?.toLowerCase().includes(search.toLowerCase()) ||
            opt.code?.toLowerCase().includes(search.toLowerCase()) ||
            opt.sku?.toLowerCase().includes(search.toLowerCase())
        );
    }, [options, search, displayKey]);

    const handleSelect = (optionId: string) => {
        onChange(optionId);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold text-left hover:border-gray-400 focus:border-[#800020] focus:outline-none flex items-center justify-between disabled:bg-gray-100 transition-colors"
            >
                <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedOption ? selectedOption[displayKey] : placeholder}
                </span>
                <Search size={16} className="text-gray-400 flex-shrink-0" />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-80 overflow-hidden">
                        {/* Search Input */}
                        <div className="p-3 border-b border-gray-200 bg-gray-50">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Type to search..."
                                    className="w-full px-4 pr-10 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSearch('');
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Options List */}
                        <div className="max-h-60 overflow-y-auto">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-8 text-sm text-gray-500 text-center">
                                    <div className="text-gray-400 mb-2">
                                        <Search size={32} className="mx-auto opacity-30" />
                                    </div>
                                    No results found for "{search}"
                                </div>
                            ) : (
                                filteredOptions.map(option => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(option.id);
                                        }}
                                        className="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors border-b border-gray-100 last:border-b-0"
                                    >
                                        <div className="font-bold text-gray-900">{option[displayKey]}</div>
                                        {(option.code || option.sku) && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                Code: {option.code || option.sku}
                                            </div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                            setIsOpen(false);
                            setSearch('');
                        }}
                    />
                </>
            )}
        </div>
    );
}
