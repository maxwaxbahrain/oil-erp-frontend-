import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle,
    FileText,
    Plus,
    User,
    Calendar,
    Package,
    X
} from 'lucide-react';
import { getCustomers, getProducts, type Customer, type Product } from '../../services/api';
import { createSalesOrder } from '../../services/salesService';
import SearchableSelect from '../../components/common/SearchableSelect';
import { SALESMEN, VANS } from '../../constants/data';

interface OrderLine {
    id: string;
    product_id: string;
    product_name: string;
    uom: string;
    qty_cases: number;
    unit_price: string;
    discount: string;
    tax_rate: number;
    line_total: number;
    stock_available: number;
}

export default function SalesOrderFormPage() {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Header fields
    const [orderNo] = useState('SO-' + Date.now());
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [salesmanId, setSalesmanId] = useState('');
    const [vanId, setVanId] = useState('');
    const [orderStatus, setOrderStatus] = useState<'draft' | 'confirmed'>('draft');

    // Customer fields
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);


    // Line items
    const [lines, setLines] = useState<OrderLine[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [customersData, productsData] = await Promise.all([
                getCustomers(),
                getProducts()
            ]);
            setCustomers(customersData);
            setProducts(productsData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    }

    const addLine = () => {
        const newLine: OrderLine = {
            id: Date.now().toString(),
            product_id: '',
            product_name: '',
            uom: 'Cases',
            qty_cases: 1,
            unit_price: '',
            discount: '',
            tax_rate: 17,
            line_total: 0,
            stock_available: 0
        };
        setLines([...lines, newLine]);
    };

    const removeLine = (id: string) => {
        setLines(lines.filter(l => l.id !== id));
    };

    const updateLine = (id: string, field: keyof OrderLine, value: any) => {
        setLines(lines.map(line => {
            if (line.id !== id) return line;

            const updated = { ...line, [field]: value };

            // Auto-fill product details
            if (field === 'product_id') {
                const product = products.find(p => p.id === value);
                if (product) {
                    updated.product_name = product.name;
                    updated.unit_price = product.unit_price.toString();
                    updated.stock_available = (product as any).stock_quantity || 0;
                }
            }

            // Calculate line total
            const unitPrice = parseFloat(updated.unit_price) || 0;
            const discount = parseFloat(updated.discount) || 0;
            const subtotal = updated.qty_cases * unitPrice;
            const discountAmount = subtotal * (discount / 100);
            const taxableAmount = subtotal - discountAmount;
            const taxAmount = taxableAmount * (updated.tax_rate / 100);
            updated.line_total = taxableAmount + taxAmount;

            return updated;
        }));
    };

    const subtotal = lines.reduce((sum, line) => {
        const unitPrice = parseFloat(line.unit_price) || 0;
        const discount = parseFloat(line.discount) || 0;
        const lineSubtotal = line.qty_cases * unitPrice;
        return sum + lineSubtotal - (lineSubtotal * discount / 100);
    }, 0);

    const totalTax = lines.reduce((sum, line) => {
        const unitPrice = parseFloat(line.unit_price) || 0;
        const discount = parseFloat(line.discount) || 0;
        const lineSubtotal = line.qty_cases * unitPrice;
        const afterDiscount = lineSubtotal - (lineSubtotal * discount / 100);
        return sum + (afterDiscount * line.tax_rate / 100);
    }, 0);

    const grandTotal = subtotal + totalTax;

    const handleSaveDraft = async () => {
        console.log('Saving draft...', { orderNo, orderDate, selectedCustomer, lines });
        alert('Draft saved successfully!');
    };

    const handleConfirmOrder = async () => {
        if (!selectedCustomer) {
            alert('Please select a customer');
            return;
        }
        if (lines.length === 0) {
            alert('Please add at least one line item');
            return;
        }

        try {
            const orderPayload = {
                customer_id: selectedCustomer.id,
                van_id: vanId || 'VAN-001',
                order_date: orderDate,
                salesman: SALESMEN.find(s => s.id === salesmanId)?.name,
                items: lines.map(l => ({
                    product_id: l.product_id,
                    product_name: l.product_name,
                    quantity: l.qty_cases,
                    unit_price: parseFloat(l.unit_price) || 0,
                    total: l.line_total
                })),
                total_amount: grandTotal,
                status: 'confirmed' as const,
                payment_status: 'unpaid' as const
            };

            await createSalesOrder(orderPayload);
            setOrderStatus('confirmed');

            // Show professional success message
            alert(`✅ Sale order ${orderNo} created successfully for ${selectedCustomer.name}`);

            // Redirect back to customer overview
            navigate(`/customers/${selectedCustomer.id}?tab=sales`);
        } catch (err) {
            console.error(err);
            alert('Failed to save order');
        }
    };

    if (loading) {
        return <div className="p-20 text-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="max-w-[1600px] mx-auto p-6 space-y-6">
                {/* Header Bar - RED THEME */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-[#800020] p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-[#800020] rounded-xl flex items-center justify-center shadow-lg hover:rotate-3 transition-transform">
                                <FileText size={32} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-gray-900 tracking-tight">SALES ORDER FORM</h1>
                                <p className="text-sm text-[#800020] font-black mt-1 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#800020]"></span>
                                    ENTERPRISE ORDER CAPTURE
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest border-2 ${orderStatus === 'confirmed'
                                ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg'
                                : 'bg-amber-50 text-amber-700 border-amber-400'
                                }`}>
                                {orderStatus}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Header Information */}
                <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200 space-y-8">
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                        <Calendar size={20} className="text-[#800020]" />
                        <h2 className="text-sm font-black text-gray-900 uppercase tracking-[0.2em]">Header Information</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Order Reference</label>
                            <input
                                type="text"
                                value={orderNo}
                                disabled
                                className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-black text-gray-700 font-mono shadow-inner"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Order Date *</label>
                            <input
                                type="date"
                                value={orderDate}
                                onChange={(e) => setOrderDate(e.target.value)}
                                className="w-full px-5 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:border-[#800020] focus:ring-4 focus:ring-[#800020]/5 outline-none transition-all shadow-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Assign Salesman</label>
                            <SearchableSelect
                                options={SALESMEN}
                                value={salesmanId}
                                onChange={setSalesmanId}
                                placeholder="Search salesman..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Select Van / Route</label>
                            <SearchableSelect
                                options={VANS}
                                value={vanId}
                                onChange={setVanId}
                                placeholder="Search van..."
                            />
                        </div>
                    </div>
                </div>

                {/* Customer Details - RED THEME */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#800020]">
                    <div className="bg-[#800020] px-8 py-4 flex items-center gap-3">
                        <User size={20} className="text-white" />
                        <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Customer Information</h2>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-gradient-to-br from-white to-gray-50">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                Target Customer <span className="text-red-500">*</span>
                            </label>
                            <SearchableSelect
                                options={customers}
                                value={selectedCustomer?.id || ''}
                                onChange={(id) => setSelectedCustomer(customers.find(c => c.id === id) || null)}
                                placeholder="Search and select customer..."
                            />
                        </div>

                        {selectedCustomer ? (
                            <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer Code</label>
                                    <div className="px-5 py-3.5 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm font-black text-gray-700 font-mono">
                                        {selectedCustomer.id}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Credit Balance</label>
                                    <div className={`px-5 py-3.5 border-2 rounded-xl text-sm font-black font-mono shadow-sm ${(selectedCustomer.balance || 0) > 50000 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        }`}>
                                        {selectedCustomer.balance?.toLocaleString()}
                                    </div>
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Registered Address</label>
                                    <div className="px-5 py-3.5 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 line-clamp-1">
                                        {selectedCustomer.address || 'Address not listed'}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl h-[120px] bg-gray-50">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">Please select a customer to see details</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Line Items - RED THEME */}
                <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
                    <div className="px-8 py-5 bg-gray-900 flex justify-between items-center">
                        <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                            <Package size={20} className="text-blue-400" />
                            Line Items
                        </h2>
                        <button
                            onClick={addLine}
                            className="px-6 py-2.5 bg-[#800020] text-white text-[10px] font-black rounded-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-lg uppercase tracking-widest"
                        >
                            <Plus size={14} /> Add New Item
                        </button>
                    </div>

                    {lines.length === 0 ? (
                        <div className="p-24 text-center bg-gray-50/50">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Package size={40} className="text-gray-300" />
                            </div>
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">No items added</h3>
                            <p className="text-xs text-gray-500 font-bold max-w-xs mx-auto">Start your order by adding products from the inventory.</p>
                        </div>
                    ) : (
                        <div className="p-8 space-y-6">
                            {lines.map((line, index) => (
                                <div key={line.id} className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-[#800020] transition-all relative overflow-hidden shadow-sm hover:shadow-xl">
                                    <div className="absolute left-0 top-0 w-1.5 h-full bg-gray-200 group-hover:bg-[#800020] transition-colors"></div>
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-lg">
                                                {index + 1}
                                            </div>
                                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Inventory Item {index + 1}</h3>
                                        </div>
                                        <button
                                            onClick={() => removeLine(line.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                        {/* Product Selection */}
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Product *</label>
                                            <SearchableSelect
                                                options={products}
                                                value={line.product_id}
                                                onChange={(id) => updateLine(line.id, 'product_id', id)}
                                                placeholder="Search product..."
                                            />
                                        </div>

                                        {/* Quantity */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Qty (Cases)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={line.qty_cases}
                                                onChange={(e) => updateLine(line.id, 'qty_cases', parseInt(e.target.value) || 0)}
                                                className="w-full px-5 py-3 border-2 border-gray-100 rounded-xl text-sm font-black text-center text-gray-900 focus:border-blue-500 outline-none transition-all shadow-sm"
                                            />
                                        </div>

                                        {/* Unit Price */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Rate</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={line.unit_price}
                                                onChange={(e) => updateLine(line.id, 'unit_price', e.target.value)}
                                                className="w-full px-5 py-3 border-2 border-gray-100 rounded-xl text-sm font-black text-right text-gray-900 focus:border-blue-500 outline-none transition-all shadow-sm font-mono"
                                            />
                                        </div>

                                        {/* Discount */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Disc %</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={line.discount}
                                                onChange={(e) => updateLine(line.id, 'discount', e.target.value)}
                                                className="w-full px-5 py-3 border-2 border-gray-100 rounded-xl text-sm font-black text-center text-gray-900 focus:border-blue-500 outline-none shadow-sm transition-all"
                                            />
                                        </div>

                                        {/* Line Total */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total</label>
                                            <div className="w-full px-5 py-3 bg-gray-900 border-2 border-gray-900 rounded-xl text-sm font-black text-white text-right font-mono shadow-lg">
                                                {line.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stock Indicator */}
                                    {line.product_id && (
                                        <div className="mt-6 flex items-center justify-between bg-gray-50 px-5 py-3 rounded-xl border border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <Package size={14} className="text-gray-400" />
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Warehouse Level:</span>
                                            </div>
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${line.stock_available >= line.qty_cases
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-red-100 text-red-700'
                                                }`}>
                                                {line.stock_available} UNITS {line.stock_available >= line.qty_cases ? 'READY' : 'LOW STOCK'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Summary & Totals */}
                <div className="flex flex-col md:flex-row gap-8 items-end justify-between">
                    <div className="w-full md:w-1/3 bg-white p-6 rounded-2xl border-2 border-dashed border-gray-300">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Internal Comment</label>
                        <textarea
                            className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none resize-none"
                            rows={3}
                            placeholder="Add internal order notes..."
                        />
                    </div>

                    <div className="w-full md:w-2/5 bg-gray-900 rounded-3xl p-8 shadow-2xl skew-x-[-2deg]">
                        <div className="skew-x-[2deg] space-y-4">
                            <div className="flex justify-between items-center text-white/60">
                                <span className="text-[10px] font-black uppercase tracking-widest">Net Payable</span>
                                <span className="text-lg font-black font-mono">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-white/60">
                                <span className="text-[10px] font-black uppercase tracking-widest">Estimated Tax (17%)</span>
                                <span className="text-lg font-black font-mono">{totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] block">Grand Total</span>
                                    <span className="text-sm font-bold text-white/40 uppercase tracking-widest">System Calculated</span>
                                </div>
                                <span className="text-4xl font-black text-white font-mono tracking-tighter">
                                    {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-6 pt-10 border-t border-gray-200">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-8 py-4 text-sm font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleSaveDraft}
                        className="px-8 py-4 bg-white border-2 border-gray-900 text-sm font-black text-gray-900 uppercase tracking-widest rounded-xl hover:bg-gray-100 transition-all shadow-md active:translate-y-1"
                    >
                        Save as Draft
                    </button>
                    <button
                        onClick={handleConfirmOrder}
                        className="px-12 py-4 bg-[#800020] text-white text-sm font-black uppercase tracking-widest rounded-xl hover:brightness-110 shadow-2xl active:translate-y-1 transition-all flex items-center gap-3"
                    >
                        <CheckCircle size={18} />
                        Confirm & Save Order
                    </button>
                </div>
            </div>
        </div>
    );
}
