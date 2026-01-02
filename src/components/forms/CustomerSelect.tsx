import { useState, useEffect, useRef } from 'react';
import { Search, User, DollarSign, CreditCard, MapPin, Phone, Mail, ChevronDown } from 'lucide-react';

interface Customer {
    id: string;
    name: string;
    code?: string;
    phone?: string;
    email?: string;
    address?: string;
    credit_limit?: number;
    current_balance?: number;
    payment_terms?: string;
}

interface CustomerSelectProps {
    customers: Customer[];
    selectedCustomer: Customer | null;
    onSelect: (customer: Customer | null) => void;
    required?: boolean;
    disabled?: boolean;
}

export default function CustomerSelect({
    customers,
    selectedCustomer,
    onSelect,
    required = false,
    disabled = false
}: CustomerSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filter customers based on search
    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm)
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectCustomer = (customer: Customer) => {
        onSelect(customer);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClearSelection = () => {
        onSelect(null);
        setSearchTerm('');
    };

    return (
        <div className="space-y-3">
            {/* Label */}
            <label className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <User size={14} />
                Select Customer
                {required && <span className="text-[#800020]">*</span>}
            </label>

            {/* Selected Customer Display */}
            {selectedCustomer && (
                <div className="bg-gradient-to-r from-[#F4E4E6] to-[#E8D5D8] border-2 border-[#A0522D] rounded-xl p-6 mb-4">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase flex items-center gap-2">
                                <User className="text-[#800020]" size={24} />
                                {selectedCustomer.name}
                            </h3>
                            {selectedCustomer.code && (
                                <p className="text-sm font-bold text-gray-600 mt-1">Code: {selectedCustomer.code}</p>
                            )}
                        </div>
                        <button
                            onClick={handleClearSelection}
                            className="px-4 py-2 bg-white border-2 border-gray-300 text-xs font-bold text-gray-700 uppercase rounded-lg hover:bg-gray-50 transition-all"
                            disabled={disabled}
                        >
                            Change
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Contact Info */}
                        <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Contact</div>
                            {selectedCustomer.phone && (
                                <div className="flex items-center gap-2 mb-2">
                                    <Phone size={14} className="text-[#800020]" />
                                    <span className="text-sm font-bold text-gray-900">{selectedCustomer.phone}</span>
                                </div>
                            )}
                            {selectedCustomer.email && (
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-[#800020]" />
                                    <span className="text-sm font-bold text-gray-900">{selectedCustomer.email}</span>
                                </div>
                            )}
                            {selectedCustomer.address && (
                                <div className="flex items-start gap-2 mt-2">
                                    <MapPin size={14} className="text-[#800020] mt-0.5" />
                                    <span className="text-xs font-medium text-gray-700">{selectedCustomer.address}</span>
                                </div>
                            )}
                        </div>

                        {/* Financial Info */}
                        <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Financial</div>
                            {selectedCustomer.credit_limit !== undefined && (
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <CreditCard size={14} className="text-[#800020]" />
                                        <span className="text-xs font-bold text-gray-600">Credit Limit</span>
                                    </div>
                                    <span className="text-sm font-black text-gray-900">
                                        ${selectedCustomer.credit_limit.toLocaleString()}
                                    </span>
                                </div>
                            )}
                            {selectedCustomer.current_balance !== undefined && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <DollarSign size={14} className="text-[#800020]" />
                                        <span className="text-xs font-bold text-gray-600">Balance</span>
                                    </div>
                                    <span className={`text-sm font-black ${selectedCustomer.current_balance > 0
                                        ? 'text-rose-600'
                                        : 'text-emerald-600'
                                        }`}>
                                        ${Math.abs(selectedCustomer.current_balance).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Payment Terms */}
                        {selectedCustomer.payment_terms && (
                            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                <div className="text-xs font-bold text-gray-500 uppercase mb-2">Payment Terms</div>
                                <div className="text-sm font-black text-gray-900">
                                    {selectedCustomer.payment_terms}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Credit Warning */}
                    {selectedCustomer.credit_limit !== undefined &&
                        selectedCustomer.current_balance !== undefined &&
                        selectedCustomer.current_balance >= selectedCustomer.credit_limit && (
                            <div className="mt-4 bg-rose-100 border-2 border-rose-400 rounded-lg p-4 flex items-start gap-3">
                                <div className="bg-rose-200 p-2 rounded-lg">
                                    <CreditCard className="text-rose-700" size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-rose-900 uppercase">Credit Limit Exceeded</h4>
                                    <p className="text-xs font-medium text-rose-700 mt-1">
                                        This customer has reached their credit limit. Please collect payment before processing new orders.
                                    </p>
                                </div>
                            </div>
                        )}
                </div>
            )}

            {/* Customer Selection Dropdown */}
            {!selectedCustomer && (
                <div ref={dropdownRef} className="relative">
                    {/* Dropdown Button */}
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        disabled={disabled}
                        className="w-full px-4 py-4 bg-white border-2 border-[#A0522D] rounded-xl text-left font-bold text-gray-900 hover:border-[#800020] focus:border-[#800020] focus:ring-2 focus:ring-[#F4E4E6] outline-none transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="flex items-center gap-3">
                            <User size={20} className="text-[#800020]" />
                            <span className="text-base">
                                {selectedCustomer ? (selectedCustomer as Customer).name : 'Select a customer...'}
                            </span>
                        </span>
                        <ChevronDown
                            size={20}
                            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-[#A0522D] rounded-xl shadow-2xl max-h-96 overflow-hidden">
                            {/* Search Box */}
                            <div className="p-4 border-b-2 border-gray-200 bg-gray-50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by name, code, or phone..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-[#800020] focus:ring-2 focus:ring-[#F4E4E6] outline-none"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Customer List */}
                            <div className="overflow-y-auto max-h-80">
                                {filteredCustomers.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <User size={48} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-sm font-bold text-gray-500">No customers found</p>
                                        <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                                    </div>
                                ) : (
                                    <div className="p-2">
                                        {filteredCustomers.map((customer) => (
                                            <button
                                                key={customer.id}
                                                type="button"
                                                onClick={() => handleSelectCustomer(customer)}
                                                className="w-full p-4 text-left hover:bg-[#F4E4E6] rounded-lg transition-colors group border-2 border-transparent hover:border-[#A0522D] mb-2"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <h4 className="text-base font-black text-gray-900 group-hover:text-[#800020] transition-colors">
                                                            {customer.name}
                                                        </h4>
                                                        {customer.code && (
                                                            <p className="text-xs font-bold text-gray-500 mt-0.5">
                                                                Code: {customer.code}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {customer.current_balance !== undefined && (
                                                        <div className={`px-3 py-1 rounded-lg text-xs font-black ${customer.current_balance > 0
                                                            ? 'bg-rose-100 text-rose-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                            }`}>
                                                            ${Math.abs(customer.current_balance).toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-4 text-xs text-gray-600">
                                                    {customer.phone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone size={12} />
                                                            {customer.phone}
                                                        </span>
                                                    )}
                                                    {customer.credit_limit !== undefined && (
                                                        <span className="flex items-center gap-1">
                                                            <CreditCard size={12} />
                                                            Limit: ${customer.credit_limit.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
