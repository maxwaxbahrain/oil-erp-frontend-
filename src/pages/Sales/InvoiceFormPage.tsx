import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, FileText } from 'lucide-react';
import { getCustomers, createInvoice, getProducts, type Customer, type Product } from '../../services/api';
import { SALESMEN, VANS, PAYMENT_METHODS } from '../../constants/data';
import SearchableSelect from '../../components/common/SearchableSelect';

interface InvoiceLineItem {
    id: string;
    productId: string;
    product: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

interface InvoiceFormData {
    customerId: string;
    customerName: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    lineItems: InvoiceLineItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discount: number;
    grandTotal: number;
    notes: string;
    salesmanId: string;
    vanId: string;
    paymentStatus: 'Paid' | 'Unpaid' | 'Advance Paid';
    paymentMethod: string;
    amountPaid: number;
    remainingBalance: number;
}



export default function InvoiceFormPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const prefilledCustomer = location.state as { customerId?: string; customerName?: string } | null;

    const [formData, setFormData] = useState<InvoiceFormData>({
        customerId: prefilledCustomer?.customerId || '',
        customerName: prefilledCustomer?.customerName || '',
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lineItems: [
            {
                id: '1',
                productId: '',
                product: '',
                description: '',
                quantity: 1,
                rate: 0,
                amount: 0
            }
        ],
        subtotal: 0,
        taxRate: 17,
        taxAmount: 0,
        discount: 0,
        grandTotal: 0,
        notes: '',
        salesmanId: '',
        vanId: '',
        paymentStatus: 'Unpaid',
        paymentMethod: '',
        amountPaid: 0,
        remainingBalance: 0
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [customersData, productsData] = await Promise.all([
                    getCustomers(),
                    getProducts()
                ]);
                setCustomers(customersData);
                setProducts(productsData);
            } catch (error) {
                console.error('Failed to load data:', error);
                alert('Failed to load customers/products');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    useEffect(() => {
        const subtotal = formData.lineItems.reduce((sum, item) => sum + item.amount, 0);
        const taxAmount = (subtotal * formData.taxRate) / 100;
        const grandTotal = subtotal + taxAmount - formData.discount;
        const remainingBalance = formData.paymentStatus === 'Paid' ? 0 :
            formData.paymentStatus === 'Advance Paid' ? grandTotal - formData.amountPaid :
                grandTotal;

        setFormData(prev => ({
            ...prev,
            subtotal,
            taxAmount,
            grandTotal,
            remainingBalance
        }));
    }, [formData.lineItems, formData.taxRate, formData.discount, formData.paymentStatus, formData.amountPaid]);

    const handleAddLineItem = () => {
        const newItem: InvoiceLineItem = {
            id: Date.now().toString(),
            productId: '',
            product: '',
            description: '',
            quantity: 1,
            rate: 0,
            amount: 0
        };

        setFormData(prev => ({
            ...prev,
            lineItems: [...prev.lineItems, newItem]
        }));
    };

    const handleRemoveLineItem = (id: string) => {
        if (formData.lineItems.length === 1) {
            alert('Invoice must have at least one line item');
            return;
        }

        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.filter(item => item.id !== id)
        }));
    };

    const handleProductSelect = (lineId: string, productId: string) => {
        const selectedProduct = products.find(p => p.id === productId);

        if (!selectedProduct) return;

        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.map(item => {
                if (item.id !== lineId) return item;

                const updatedItem = {
                    ...item,
                    productId: selectedProduct.id,
                    product: selectedProduct.name,
                    description: selectedProduct.name,
                    rate: selectedProduct.unit_price,
                    amount: item.quantity * selectedProduct.unit_price
                };

                return updatedItem;
            })
        }));
    };

    const handleLineItemChange = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.map(item => {
                if (item.id !== id) return item;

                const updatedItem = { ...item, [field]: value };

                if (field === 'quantity' || field === 'rate') {
                    updatedItem.amount = updatedItem.quantity * updatedItem.rate;
                }

                return updatedItem;
            })
        }));
    };

    const handleCustomerChange = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        setFormData(prev => ({
            ...prev,
            customerId,
            customerName: customer?.name || ''
        }));
    };

    const handleSave = async () => {
        if (!formData.customerId) {
            alert('Please select a customer');
            return;
        }

        if (formData.lineItems.some(item => !item.product || item.quantity <= 0 || item.rate <= 0)) {
            alert('Please fill in all line items with valid quantities and rates');
            return;
        }

        if (formData.grandTotal <= 0) {
            alert('Invoice total must be greater than 0');
            return;
        }

        try {
            setSaving(true);

            const invoiceData = {
                invoiceNumber: formData.invoiceNumber,
                customerId: formData.customerId,
                customerName: formData.customerName,
                invoiceDate: formData.invoiceDate,
                dueDate: formData.dueDate,
                lineItems: formData.lineItems.map(item => ({
                    product: item.product,
                    description: item.description,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount
                })),
                subtotal: formData.subtotal,
                taxRate: formData.taxRate,
                taxAmount: formData.taxAmount,
                discount: formData.discount,
                grandTotal: formData.grandTotal,
                notes: formData.notes,
                salesman: SALESMEN.find(s => s.id === formData.salesmanId)?.name,
                van: VANS.find(v => v.id === formData.vanId)?.name,
                payment_status: formData.paymentStatus,
                payment_method: formData.paymentMethod,
                amount_paid: formData.paymentStatus === 'Paid' ? formData.grandTotal : formData.amountPaid,
                remaining_balance: formData.remainingBalance,
                status: (formData.paymentStatus === 'Paid' ? 'Paid' : formData.paymentStatus === 'Advance Paid' ? 'Partial' : 'Unpaid') as any
            };

            const savedInvoice = await createInvoice(invoiceData);

            console.log('✅ Invoice saved:', savedInvoice);

            alert(`✅ Invoice Created Successfully!\n\nInvoice: ${formData.invoiceNumber}\nCustomer: ${formData.customerName}\nTotal: ${formData.grandTotal.toLocaleString()}\n\nThe invoice has been added to customer ledger.`);

            navigate(`/customers/${formData.customerId}?tab=ledger`);
        } catch (error: any) {
            console.error('Failed to save invoice:', error);
            alert(`❌ Failed to save invoice\n\n${error.message || 'Please try again.'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-[#800020] p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-500" />
                        </button>
                        <div className="w-14 h-14 bg-[#800020] rounded-xl flex items-center justify-center shadow-lg">
                            <FileText size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase">New Invoice</h1>
                            <p className="text-xs text-gray-500 font-semibold mt-1">Create Sales Invoice</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-3 bg-[#800020] text-white rounded-lg text-sm font-black hover:bg-[#600018] flex items-center gap-2 disabled:opacity-50 shadow-xl"
                        >
                            <Save size={18} />
                            {saving ? 'Saving...' : 'Save Invoice'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md p-8 space-y-8">
                {/* New: Salesman and Van Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b-2 border-gray-200">
                    <div>
                        <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                            Salesman <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                            options={SALESMEN}
                            value={formData.salesmanId}
                            onChange={(val) => setFormData(p => ({ ...p, salesmanId: val }))}
                            placeholder="Search and select salesman..."
                            displayKey="name"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                            Van / Route
                        </label>
                        <SearchableSelect
                            options={VANS}
                            value={formData.vanId}
                            onChange={(val) => setFormData(p => ({ ...p, vanId: val }))}
                            placeholder="Search and select van..."
                            displayKey="name"
                        />
                    </div>
                </div>

                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b-2 border-gray-200">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Customer <span className="text-red-500">*</span>
                            </label>
                            <SearchableSelect
                                options={customers}
                                value={formData.customerId}
                                onChange={handleCustomerChange}
                                placeholder="Search and select customer..."
                                displayKey="name"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Invoice Date
                            </label>
                            <input
                                type="date"
                                value={formData.invoiceDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Invoice Number
                            </label>
                            <input
                                type="text"
                                value={formData.invoiceNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-mono font-black focus:border-[#800020] focus:outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] focus:outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <h3 className="text-sm font-black text-gray-700 uppercase mb-4">Line Items</h3>

                    <div className="overflow-x-auto border-2 border-gray-200 rounded-lg">
                        <table className="w-full">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-black text-gray-700 uppercase w-1/5">Product</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-gray-700 uppercase w-2/5">Description</th>
                                    <th className="px-4 py-3 text-center text-xs font-black text-gray-700 uppercase w-24">Qty</th>
                                    <th className="px-4 py-3 text-center text-xs font-black text-gray-700 uppercase w-32">Rate</th>
                                    <th className="px-4 py-3 text-right text-xs font-black text-gray-700 uppercase w-32">Amount</th>
                                    <th className="px-4 py-3 text-center text-xs font-black text-gray-700 uppercase w-20">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {formData.lineItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <SearchableSelect
                                                options={products}
                                                value={item.productId}
                                                onChange={(productId) => handleProductSelect(item.id, productId)}
                                                placeholder="Search product..."
                                                displayKey="name"
                                            />
                                        </td>

                                        <td className="px-4 py-3">
                                            <textarea
                                                value={item.description}
                                                onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                                                placeholder="Item description..."
                                                rows={2}
                                                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#800020] focus:outline-none resize-none"
                                            />
                                        </td>

                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                value={item.quantity || ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                placeholder="0"
                                                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm text-center font-mono font-bold focus:border-[#800020] focus:outline-none"
                                            />
                                        </td>

                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                value={item.rate || ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="0.01"
                                                placeholder=""
                                                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm text-center font-mono font-bold focus:border-[#800020] focus:outline-none"
                                            />
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono font-black text-base text-gray-900">
                                            {item.amount.toLocaleString()}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleRemoveLineItem(item.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remove item"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button
                        onClick={handleAddLineItem}
                        className="mt-4 px-6 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Add Line Item
                    </button>
                </div>

                {/* Payment Options Section */}
                <div className="border-t-2 border-gray-200 pt-8 mt-8">
                    <h3 className="text-sm font-black text-gray-700 uppercase mb-6 flex items-center gap-2">
                        <div className="w-2 h-6 bg-[#800020]"></div>
                        Payment & Terms
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300">
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Payment Status</label>
                            <select
                                value={formData.paymentStatus}
                                onChange={(e) => setFormData(p => ({ ...p, paymentStatus: e.target.value as any, paymentMethod: '', amountPaid: 0 }))}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] outline-none bg-white transition-all"
                            >
                                <option value="Unpaid">Unpaid (Full Credit)</option>
                                <option value="Paid">Paid (Full Payment)</option>
                                <option value="Advance Paid">Advance / Partial Paid</option>
                            </select>
                        </div>

                        {(formData.paymentStatus === 'Paid' || formData.paymentStatus === 'Advance Paid') && (
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Payment Method</label>
                                <select
                                    value={formData.paymentMethod}
                                    onChange={(e) => setFormData(p => ({ ...p, paymentMethod: e.target.value }))}
                                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] outline-none bg-white transition-all shadow-sm"
                                    required
                                >
                                    <option value="">-- Select Method --</option>
                                    {PAYMENT_METHODS.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {formData.paymentStatus === 'Advance Paid' && (
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Amount Paid</label>
                                <input
                                    type="number"
                                    value={formData.amountPaid || ''}
                                    onChange={(e) => setFormData(p => ({ ...p, amountPaid: parseFloat(e.target.value) || 0 }))}
                                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-mono font-black focus:border-[#800020] outline-none transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Totals & Summary */}
                <div className="border-t-2 border-gray-200 pt-8">
                    <div className="flex flex-col md:flex-row gap-8 justify-between">
                        {/* Notes Area */}
                        <div className="w-full md:w-1/2">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">
                                Internal Notes & Terms
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                rows={6}
                                placeholder="Add terms & conditions, delivery notes, or internal comments..."
                                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm font-medium focus:border-[#800020] focus:ring-4 focus:ring-[#800020]/5 outline-none resize-none transition-all shadow-inner bg-gray-50/50"
                            />
                        </div>

                        {/* Totals Card */}
                        <div className="w-full md:w-5/12 bg-white rounded-2xl border-2 border-gray-900 overflow-hidden shadow-2xl skew-y-0 translate-z-0">
                            <div className="bg-gray-900 px-6 py-4">
                                <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Summary & Totals</h4>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center group">
                                    <span className="text-xs font-bold text-gray-500 uppercase group-hover:text-gray-900 transition-colors">Subtotal</span>
                                    <span className="text-lg font-mono font-black text-gray-900">{formData.subtotal.toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-gray-500 uppercase group-hover:text-gray-900 transition-colors">Tax Rate</span>
                                        <div className="flex items-center bg-gray-100 rounded-md px-2 border border-gray-200">
                                            <input
                                                type="number"
                                                value={formData.taxRate}
                                                onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                                                className="w-12 bg-transparent py-1 text-xs text-right font-mono font-black focus:outline-none"
                                                min="0"
                                            />
                                            <span className="text-[10px] font-black text-gray-400 ml-1">%</span>
                                        </div>
                                    </div>
                                    <span className="text-lg font-mono font-black text-gray-900">{formData.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>

                                <div className="flex justify-between items-center group">
                                    <span className="text-xs font-bold text-gray-500 uppercase group-hover:text-gray-900 transition-colors">Discount</span>
                                    <input
                                        type="number"
                                        value={formData.discount || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                                        className="w-32 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right font-mono font-black focus:border-[#800020] outline-none transition-all bg-gray-50"
                                        placeholder="0"
                                    />
                                </div>

                                <div className="pt-4 border-t-2 border-gray-900 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-black text-gray-900 uppercase tracking-widest">Grand Total</span>
                                        <span className="text-3xl font-mono font-black text-[#800020]">{formData.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    {formData.paymentStatus !== 'Unpaid' && (
                                        <div className="flex justify-between items-center bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                                            <span className="text-[10px] font-black text-emerald-700 uppercase">Paid Amount</span>
                                            <span className="text-sm font-mono font-black text-emerald-800">
                                                {formData.paymentStatus === 'Paid' ? formData.grandTotal.toLocaleString() : formData.amountPaid.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center bg-[#800020] px-4 py-3 rounded-xl border border-white/20 shadow-lg mt-2">
                                        <span className="text-xs font-black text-white uppercase tracking-widest">Balance Due</span>
                                        <span className="text-2xl font-mono font-black text-white">{formData.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}