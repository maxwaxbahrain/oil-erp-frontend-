import { useState, useEffect } from 'react';
import {
    Save,
    CheckCircle,
    FileText,
    Truck,
    Plus,
    User,
    Calendar,
    Package,
    DollarSign,
    X,
    ShoppingCart
} from 'lucide-react';
import FormInput from '../../components/forms/FormInput';
import CustomerSelect from '../../components/forms/CustomerSelect';
import ProductSelect from '../../components/forms/ProductSelect';
import { getCustomers, getProducts, type Customer, type Product } from '../../services/api';

interface OrderLine {
    id: string;
    product: Product | null;
    qty_cases: number;
    unit_price: string;
    discount: string;
    tax_rate: number;
    line_total: number;
}

export default function SalesOrderFormPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Header fields
    const [orderNo] = useState('SO-' + Date.now());
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [salesman, setSalesman] = useState('');
    const [van, setVan] = useState('');
    const [orderStatus, setOrderStatus] = useState<'draft' | 'confirmed'>('draft');
    console.log(orderStatus);

    // Customer fields
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [paymentTerms] = useState('30 Days');
    console.log(paymentTerms);

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
            product: null,
            qty_cases: 1,
            unit_price: '',
            discount: '',
            tax_rate: 17,
            line_total: 0
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
            if (field === 'product' && value) {
                updated.unit_price = value.unit_price.toString();
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

        setOrderStatus('confirmed');
        console.log('Confirming order...', { orderNo, orderDate, selectedCustomer, lines, grandTotal });
        alert('Order confirmed successfully!');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#800020] mx-auto mb-4"></div>
                    <p className="text-lg font-bold text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Page Header */}
                <div className="bg-gradient-to-r from-[#800020] to-[#A0522D] rounded-xl shadow-2xl p-8 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-black uppercase tracking-wide mb-2 flex items-center gap-3">
                                <ShoppingCart size={40} />
                                New Sales Order
                            </h1>
                            <p className="text-lg font-medium opacity-90">Create a new order for your customer</p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold opacity-80 uppercase">Order Number</div>
                            <div className="text-3xl font-black font-mono mt-1">{orderNo}</div>
                        </div>
                    </div>
                </div>

                {/* Order Header */}
                <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-300">
                    <h2 className="text-2xl font-black text-gray-900 mb-6 uppercase tracking-wide flex items-center gap-2">
                        <FileText size={24} className="text-[#800020]" /> Order Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormInput
                            label="Order Date"
                            type="date"
                            value={orderDate}
                            onChange={(e) => setOrderDate(e.target.value)}
                            icon={<Calendar size={18} />}
                            required
                        />
                        <FormInput
                            label="Salesman"
                            type="text"
                            value={salesman}
                            onChange={(e) => setSalesman(e.target.value)}
                            icon={<User size={18} />}
                            placeholder="Enter salesman name"
                        />
                        <FormInput
                            label="Van Number"
                            type="text"
                            value={van}
                            onChange={(e) => setVan(e.target.value)}
                            icon={<Truck size={18} />}
                            placeholder="Enter van number"
                        />
                    </div>
                </div>

                {/* Customer Selection - NEW COMPONENT */}
                <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-300">
                    <h2 className="text-2xl font-black text-gray-900 mb-6 uppercase tracking-wide flex items-center gap-2">
                        <User size={24} className="text-[#800020]" /> Customer Information
                    </h2>
                    <CustomerSelect
                        customers={customers}
                        selectedCustomer={selectedCustomer}
                        onSelect={setSelectedCustomer}
                        required
                    />
                </div>

                {/* Line Items */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-gray-300 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#F4E4E6] to-[#E8D5D8] p-6 border-b-2 border-[#A0522D] flex items-center justify-between">
                        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
                            <Package size={24} className="text-[#800020]" /> Order Items
                        </h2>
                        <button
                            type="button"
                            onClick={addLine}
                            className="px-6 py-3 bg-[#800020] text-white text-sm font-black uppercase rounded-lg hover:bg-[#600018] transition-all flex items-center gap-2 shadow-lg"
                        >
                            <Plus size={18} /> Add Line
                        </button>
                    </div>

                    {lines.length === 0 ? (
                        <div className="p-20 text-center bg-gray-50">
                            <Package size={64} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-xl font-bold text-gray-400 uppercase tracking-wide mb-2">No Line Items</h3>
                            <p className="text-sm text-gray-500 font-semibold">Click "Add Line" button above to start adding products</p>
                        </div>
                    ) : (
                        <div className="p-6 space-y-6">
                            {lines.map((line, index) => (
                                <div key={line.id} className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 hover:border-[#A0522D] transition-all">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-[#800020] rounded-lg flex items-center justify-center text-white font-black text-xl">
                                                {index + 1}
                                            </div>
                                            <h3 className="text-lg font-black text-gray-900 uppercase">Line Item #{index + 1}</h3>
                                        </div>
                                        <button
                                            onClick={() => removeLine(line.id)}
                                            className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>

                                    {/* Product Selection - NEW COMPONENT */}
                                    <div className="mb-6">
                                        <ProductSelect
                                            products={products}
                                            selectedProduct={line.product}
                                            onSelect={(product) => updateLine(line.id, 'product', product)}
                                            quantity={line.qty_cases}
                                            required
                                            showStockWarning
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        {/* Quantity */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase">Qty (Cases) *</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={line.qty_cases}
                                                onChange={(e) => updateLine(line.id, 'qty_cases', parseInt(e.target.value) || 0)}
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base font-bold text-center text-gray-900 focus:border-[#800020] focus:ring-2 focus:ring-[#F4E4E6] outline-none"
                                            />
                                        </div>

                                        {/* Unit Price */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase">Unit Price</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={line.unit_price}
                                                onChange={(e) => updateLine(line.id, 'unit_price', e.target.value)}
                                                placeholder="0.00"
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base font-bold text-right text-gray-900 focus:border-[#800020] outline-none"
                                            />
                                        </div>

                                        {/* Discount */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase">Discount %</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={line.discount}
                                                onChange={(e) => updateLine(line.id, 'discount', e.target.value)}
                                                placeholder="0"
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base font-bold text-center text-gray-900 focus:border-[#800020] outline-none"
                                            />
                                        </div>

                                        {/* Line Total */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase">Line Total</label>
                                            <div className="w-full px-4 py-3 bg-emerald-100 border-2 border-emerald-400 rounded-lg text-lg font-black text-emerald-700 text-right">
                                                ${line.line_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Order Summary */}
                <div className="bg-gradient-to-br from-[#F4E4E6] to-[#E8D5D8] rounded-xl shadow-lg p-8 border-2 border-[#A0522D]">
                    <h2 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-wide flex items-center gap-2">
                        <DollarSign size={24} className="text-[#800020]" /> Order Summary
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl border-2 border-gray-300 text-center">
                            <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Subtotal</div>
                            <div className="text-3xl font-black text-gray-900">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border-2 border-[#A0522D] text-center">
                            <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Total Tax</div>
                            <div className="text-3xl font-black text-[#800020]">${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="bg-[#800020] p-6 rounded-xl shadow-xl text-center">
                            <div className="text-xs font-bold text-white/80 uppercase tracking-wide mb-2">Grand Total</div>
                            <div className="text-4xl font-black text-white">${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 sticky bottom-6 bg-white p-6 rounded-xl shadow-2xl border-2 border-gray-300">
                    <button
                        onClick={handleSaveDraft}
                        className="px-10 py-4 bg-white border-2 border-gray-400 text-base font-black text-gray-700 uppercase tracking-wide rounded-xl hover:bg-gray-100 transition-all flex items-center gap-3 shadow-md"
                    >
                        <Save size={20} /> Save Draft
                    </button>
                    <button
                        onClick={handleConfirmOrder}
                        className="px-12 py-4 bg-[#800020] text-white text-base font-black uppercase tracking-wide rounded-xl hover:bg-[#600018] transition-all flex items-center gap-3 shadow-xl"
                    >
                        <CheckCircle size={20} /> Confirm Order
                    </button>
                </div>
            </div>
        </div>
    );
}
