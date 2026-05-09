import { useState, useEffect } from 'react';
import { Tag, Plus, Save, Search, Trash2, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import {
    getCustomers, getProducts, type Customer, type Product
} from '../../services/api';
import {
    getCustomerPriceLists, saveCustomerPriceList, type CustomerPriceList
} from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

export default function CustomerPriceLists() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [priceLists, setPriceLists] = useState<CustomerPriceList[]>([]);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<CustomerPriceList | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
            setCustomers(c);
            setProducts(p);
            setPriceLists(getCustomerPriceLists());
        });
    }, []);

    const customersWithList = new Set(priceLists.map(l => l.customerId));
    const filtered = priceLists.filter(l =>
        !search || l.customerName.toLowerCase().includes(search.toLowerCase())
    );

    const startEdit = (list: CustomerPriceList) => {
        setEditingId(list.customerId);
        setEditForm(JSON.parse(JSON.stringify(list)));
    };

    const saveEdit = () => {
        if (!editForm) return;
        setSaving(true);
        editForm.updatedAt = new Date().toISOString();
        saveCustomerPriceList(editForm);
        setPriceLists(getCustomerPriceLists());
        setEditingId(null);
        setEditForm(null);
        setSaving(false);
        setSuccessMsg('Price list saved!');
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const createNewList = () => {
        if (!selectedCustomer) return;
        const customer = customers.find(c => c.id === selectedCustomer);
        if (!customer) return;
        const newList: CustomerPriceList = {
            customerId: customer.id,
            customerName: customer.name,
            prices: products.map(p => ({
                productId: p.id,
                productName: p.name,
                customPrice: 0,
                discountPct: 0
            })),
            updatedAt: new Date().toISOString()
        };
        saveCustomerPriceList(newList);
        setPriceLists(getCustomerPriceLists());
        setShowAdd(false);
        setSelectedCustomer('');
        startEdit(newList);
        setExpanded(newList.customerId);
    };

    const updatePrice = (productId: string, field: 'customPrice' | 'discountPct', value: number) => {
        if (!editForm) return;
        setEditForm({
            ...editForm,
            prices: editForm.prices.map(p =>
                p.productId === productId ? { ...p, [field]: value } : p
            )
        });
    };

    const deleteList = (customerId: string) => {
        if (!confirm('Remove this customer\'s price list?')) return;
        const lists = getCustomerPriceLists().filter(l => l.customerId !== customerId);
        localStorage.setItem('customer_price_lists', JSON.stringify(lists));
        setPriceLists(getCustomerPriceLists());
    };

    const availableCustomers = customers.filter(c => !customersWithList.has(c.id));

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                        <Tag size={24} className="text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Customer Price Lists</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Set custom prices per customer — overrides standard product price</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-all"
                >
                    <Plus size={14} /> Add Customer Price List
                </button>
            </div>

            {/* Success */}
            {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-bold text-emerald-700">
                    ✅ {successMsg}
                </div>
            )}

            {/* Add new */}
            {showAdd && (
                <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-wide mb-3">Select Customer</p>
                    <div className="flex gap-3">
                        <select
                            value={selectedCustomer}
                            onChange={e => setSelectedCustomer(e.target.value)}
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
                        >
                            <option value="">-- Select a customer --</option>
                            {availableCustomers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <button onClick={createNewList} disabled={!selectedCustomer}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-40 hover:bg-blue-700 transition-all">
                            Create
                        </button>
                        <button onClick={() => setShowAdd(false)}
                            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-black hover:bg-gray-50 transition-all">
                            Cancel
                        </button>
                    </div>
                    {availableCustomers.length === 0 && (
                        <p className="text-xs text-gray-400 mt-2">All customers already have price lists.</p>
                    )}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search customer..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Customers with custom prices', value: priceLists.length },
                    { label: 'Standard price customers', value: customers.length - priceLists.length },
                    { label: 'Products with pricing', value: products.length },
                ].map((s, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                        <p className="text-2xl font-black text-gray-900">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Price Lists */}
            {filtered.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
                    <Tag size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-bold">No customer price lists yet</p>
                    <p className="text-gray-300 text-sm mt-1">Click "Add Customer Price List" to set custom pricing for a customer</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(list => {
                        const isExpanded = expanded === list.customerId;
                        const isEditing = editingId === list.customerId;
                        const displayList = isEditing && editForm ? editForm : list;
                        const customPrices = list.prices.filter(p => p.customPrice > 0 || p.discountPct > 0).length;

                        return (
                            <div key={list.customerId} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                                {/* Header row */}
                                <div
                                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-all"
                                    onClick={() => setExpanded(isExpanded ? null : list.customerId)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                                            <span className="text-sm font-black text-blue-700">{list.customerName.slice(0, 2).toUpperCase()}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-900">{list.customerName}</p>
                                            <p className="text-xs text-gray-400">
                                                {customPrices > 0
                                                    ? `${customPrices} custom price${customPrices !== 1 ? 's' : ''} set`
                                                    : 'No custom prices set yet'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={e => { e.stopPropagation(); startEdit(list); setExpanded(list.customerId); }}
                                            className="p-2 hover:bg-blue-50 rounded-lg transition-all"
                                        >
                                            <Edit2 size={14} className="text-blue-600" />
                                        </button>
                                        <button
                                            onClick={e => { e.stopPropagation(); deleteList(list.customerId); }}
                                            className="p-2 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={14} className="text-red-400" />
                                        </button>
                                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                    </div>
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        {['Product', 'Standard Price', 'Custom Price', 'Discount %', 'Effective Price'].map(h => (
                                                            <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {displayList.prices.map(entry => {
                                                        const product = products.find(p => p.id === entry.productId);
                                                        const stdPrice = product?.unit_price || 0;
                                                        const effective = entry.customPrice > 0
                                                            ? entry.customPrice
                                                            : entry.discountPct > 0
                                                                ? stdPrice * (1 - entry.discountPct / 100)
                                                                : stdPrice;
                                                        const hasCustom = entry.customPrice > 0 || entry.discountPct > 0;

                                                        return (
                                                            <tr key={entry.productId} className={hasCustom ? 'bg-blue-50/30' : ''}>
                                                                <td className="px-5 py-3">
                                                                    <p className="text-sm font-bold text-gray-900">{entry.productName}</p>
                                                                    <p className="text-xs text-gray-400">{product?.sku}</p>
                                                                </td>
                                                                <td className="px-5 py-3 text-sm font-mono text-gray-500">{formatCurrency(stdPrice)}</td>
                                                                <td className="px-5 py-3">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="number"
                                                                            value={entry.customPrice || ''}
                                                                            onChange={e => updatePrice(entry.productId, 'customPrice', parseFloat(e.target.value) || 0)}
                                                                            placeholder="0.00"
                                                                            className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-blue-400"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-sm font-mono text-gray-700">
                                                                            {entry.customPrice > 0 ? formatCurrency(entry.customPrice) : '—'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    {isEditing ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <input
                                                                                type="number"
                                                                                value={entry.discountPct || ''}
                                                                                onChange={e => updatePrice(entry.productId, 'discountPct', parseFloat(e.target.value) || 0)}
                                                                                placeholder="0"
                                                                                min="0" max="100"
                                                                                className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-blue-400"
                                                                            />
                                                                            <span className="text-xs text-gray-400">%</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-sm font-mono text-gray-700">
                                                                            {entry.discountPct > 0 ? `${entry.discountPct}%` : '—'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <span className={`text-sm font-black font-mono ${hasCustom ? 'text-blue-700' : 'text-gray-400'}`}>
                                                                        {formatCurrency(effective)}
                                                                        {hasCustom && stdPrice > 0 && (
                                                                            <span className="ml-1 text-[10px] font-bold text-emerald-600">
                                                                                {((1 - effective / stdPrice) * 100).toFixed(1)}% off
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {isEditing && (
                                            <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-t border-gray-100">
                                                <button onClick={saveEdit} disabled={saving}
                                                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all disabled:opacity-40">
                                                    <Save size={14} /> Save Price List
                                                </button>
                                                <button onClick={() => { setEditingId(null); setEditForm(null); }}
                                                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-black hover:bg-gray-100 transition-all">
                                                    Cancel
                                                </button>
                                                <p className="text-xs text-gray-400 ml-2">Custom price takes priority over discount %. Leave both 0 to use standard price.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
