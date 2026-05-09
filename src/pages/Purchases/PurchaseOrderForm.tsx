import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, ShoppingCart } from 'lucide-react';
import { getSuppliers, createSupplier, getSupplierBalance, createPurchaseOrder, type Supplier, type PurchaseOrderItem } from '../../services/purchasesService';
import { getProducts, type Product } from '../../services/api';
import { PAYMENT_METHODS } from '../../constants/data';
import SearchableSelect from '../../components/common/SearchableSelect';

interface POLineItem {
    id: string;
    productId: string;
    product: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

interface POFormData {
    supplierId: string;
    supplierName: string;
    poNumber: string;
    date: string;
    expectedDate: string;
    lineItems: POLineItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discount: number;
    grandTotal: number;
    notes: string;
    paymentStatus: 'Paid' | 'Unpaid' | 'Advance Paid';
    paymentMethod: string;
    amountPaid: number;
    remainingBalance: number;
    paymentReference: string;
    status: 'Pending' | 'Approved' | 'GRN' | 'Paid' | 'Received';
}

export default function PurchaseOrderForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const [suppliers, setSuppliers] = useState<(Supplier & { balance: number })[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showNewSupplier, setShowNewSupplier] = useState(false);
    const [newSupName, setNewSupName] = useState('');
    const [newSupPhone, setNewSupPhone] = useState('');
    const [newSupAddress, setNewSupAddress] = useState('');
    const [savingSup, setSavingSup] = useState(false);

    const prefilledSupplier = location.state as { supplierId?: string; supplierName?: string; isPending?: boolean } | null;

    const [formData, setFormData] = useState<POFormData>({
        supplierId: prefilledSupplier?.supplierId || '',
        supplierName: prefilledSupplier?.supplierName || '',
        poNumber: `PO-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        grandTotal: 0,
        notes: '',
        paymentStatus: 'Unpaid',
        paymentMethod: '',
        amountPaid: 0,
        remainingBalance: 0,
        paymentReference: '',
        status: 'Pending'
    });

    useEffect(() => {
        const fetchSuppliersAndProducts = async () => {
            try {
                setLoading(true);
                const [suppliersData, productsData] = await Promise.all([
                    getSuppliers(),
                    getProducts()
                ]);

                const suppliersWithBalance = await Promise.all(
                    suppliersData.map(async (s) => ({
                        ...s,
                        balance: await getSupplierBalance(s.id)
                    }))
                );

                setSuppliers(suppliersWithBalance);
                setProducts(productsData);
            } catch (error) {
                console.error('Failed to fetch suppliers and products:', error);
                alert('Failed to load suppliers/products');
            } finally {
                setLoading(false);
            }
        };

        fetchSuppliersAndProducts();
    }, []);

    useEffect(() => {
        const subtotal = formData.lineItems.reduce((sum: number, item: POLineItem) => sum + item.amount, 0);
        const taxAmount = (subtotal * formData.taxRate) / 100;
        const grandTotal = subtotal + taxAmount - formData.discount;
        const rawBalance = formData.paymentStatus === 'Paid' ? 0 :
            formData.paymentStatus === 'Advance Paid' ? grandTotal - formData.amountPaid :
                grandTotal;
        const remainingBalance = Math.max(0, rawBalance);

        setFormData(prev => ({
            ...prev,
            subtotal,
            taxAmount,
            grandTotal,
            remainingBalance
        }));
    }, [formData.lineItems, formData.taxRate, formData.discount, formData.paymentStatus, formData.amountPaid]);

    const handleAddLineItem = () => {
        const newItem: POLineItem = {
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
            alert('Order must have at least one line item');
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

                return {
                    ...item,
                    productId: selectedProduct.id,
                    product: selectedProduct.name,
                    description: selectedProduct.name,
                    rate: selectedProduct.unit_price,
                    amount: item.quantity * selectedProduct.unit_price
                };
            })
        }));
    };

    const handleLineItemChange = (id: string, field: keyof POLineItem, value: string | number) => {
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

    const createNewSupplier = async () => {
        if (!newSupName.trim()) return;
        setSavingSup(true);
        try {
            const s = await createSupplier({ name: newSupName, phone: newSupPhone, address: newSupAddress, email: '', taxId: '', paymentTerms: 'Net 30', currency: 'USD', rating: 'A', status: 'Active', code: `SUP-${Date.now().toString().slice(-6)}` });
            setSuppliers((prev: any[]) => [...prev, s]);
            setFormData((p: any) => ({ ...p, supplierId: s.id, supplierName: s.name }));
            setShowNewSupplier(false);
            setNewSupName(''); setNewSupPhone(''); setNewSupAddress('');
        } catch { alert('Failed to create supplier. Try again.'); }
        finally { setSavingSup(false); }
    };

    const handleSupplierChange = (supplierId: string) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        setFormData(prev => ({
            ...prev,
            supplierId,
            supplierName: supplier?.name || ''
        }));
    };

    const handleSave = async () => {
        if (!formData.supplierId) {
            alert('Please select a supplier');
            return;
        }

        if (formData.lineItems.some(item => !item.product || item.quantity <= 0 || item.rate <= 0)) {
            alert('Please fill in all line items with valid quantities and rates');
            return;
        }

        if (formData.grandTotal <= 0) {
            alert('Order total must be greater than 0');
            return;
        }

        try {
            setSaving(true);

            const poData = {
                poNumber: formData.poNumber,
                supplierId: formData.supplierId,
                supplierName: formData.supplierName,
                date: formData.date,
                expectedDate: formData.expectedDate,
                items: formData.lineItems.map(item => ({
                    productId: item.productId,
                    productName: item.product,
                    uom: 'Units',
                    quantity: item.quantity,
                    unitPrice: item.rate,
                    taxRate: formData.taxRate,
                    discount: 0,
                    total: item.amount
                }) as PurchaseOrderItem),
                subtotal: formData.subtotal,
                taxTotal: formData.taxAmount,
                grandTotal: formData.grandTotal,
                notes: formData.notes,
                payment_status: formData.paymentStatus,
                payment_method: formData.paymentMethod,
                amount_paid: formData.paymentStatus === 'Paid' ? formData.grandTotal : formData.amountPaid,
                remaining_balance: formData.remainingBalance,
                status: formData.status
            };

            await createPurchaseOrder(poData);

            alert(`✅ Purchase Requisition Submitted!\n\nPO: ${formData.poNumber}\nSupplier: ${formData.supplierName}\nTotal: ${formData.grandTotal.toLocaleString()}\n\nStatus: PENDING REQUISITION\nNext: A manager must approve this PO from the orders list.`);

            navigate(`/suppliers/${formData.supplierId}?tab=purchases`);
        } catch (error: any) {
            console.error('Failed to save order:', error);
            alert(`❌ Failed to save order\n\n${error.message || 'Please try again.'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-orange-600 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-500" />
                        </button>
                        <div className="w-14 h-14 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                            <ShoppingCart size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase">New Purchase Order</h1>
                            <p className="text-xs text-gray-500 font-semibold mt-1">Creation of Procurement Document</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 uppercase tracking-widest text-[10px]"
                        >
                            Abort
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-3 bg-orange-600 text-white rounded-lg text-sm font-black hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50 shadow-xl uppercase tracking-widest text-[10px]"
                        >
                            <Save size={18} />
                            {saving ? 'Processing...' : 'Authorize Order'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b-2 border-gray-100">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Authorised Vendor <span className="text-red-500">*</span></label>
                            <button type="button" onClick={() => setShowNewSupplier(true)}
                                className="flex items-center gap-1 text-xs font-black text-orange-600 hover:text-orange-800 transition-all">
                                + New Supplier
                            </button>
                        </div>
                        <SearchableSelect
                            options={suppliers}
                            value={formData.supplierId}
                            onChange={handleSupplierChange}
                            placeholder="Find partner in registry..."
                            displayKey="name"
                            disabled={loading}
                        />
                        {showNewSupplier && (
                            <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-black text-orange-700 uppercase">New Supplier</p>
                                    <button onClick={() => setShowNewSupplier(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                                </div>
                                <input type="text" placeholder="Supplier Name *" value={newSupName} onChange={e => setNewSupName(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"/>
                                <input type="text" placeholder="Phone" value={newSupPhone} onChange={e => setNewSupPhone(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"/>
                                <input type="text" placeholder="Address" value={newSupAddress} onChange={e => setNewSupAddress(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"/>
                                <button onClick={createNewSupplier} disabled={savingSup || !newSupName.trim()}
                                    className="w-full py-2 bg-orange-500 text-white text-xs font-black rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-all">
                                    {savingSup ? 'Creating...' : 'Create & Select Supplier'}
                                </button>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                            Procurement Status
                        </label>
                        <div className="w-full border-2 border-yellow-400 bg-yellow-50 rounded-lg px-4 py-3 flex items-center gap-3">
                            <span className="text-lg">🟡</span>
                            <div>
                                <p className="text-sm font-black text-yellow-800 uppercase tracking-wide">Pending Requisition</p>
                                <p className="text-[10px] text-yellow-600 mt-0.5">New POs always start here. Manager approves from the orders list.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b-2 border-gray-200">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                            PO Reference #
                        </label>
                        <input
                            type="text"
                            value={formData.poNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, poNumber: e.target.value }))}
                            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-mono font-black focus:border-orange-600 outline-none transition-all bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                            Document Date
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-black focus:border-orange-600 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                            Expected Arrival
                        </label>
                        <input
                            type="date"
                            value={formData.expectedDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, expectedDate: e.target.value }))}
                            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-black focus:border-orange-600 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <h3 className="text-xs font-black text-gray-700 uppercase mb-4 tracking-widest">Bill of Materials / SKU List</h3>

                    <div className="overflow-x-auto border-2 border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-900 border-b-2 border-gray-900">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em] w-1/4">Product SKU</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em] w-1/3">Description</th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-[0.2em] w-24">Qty</th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-[0.2em] w-32">Unit Rate</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em] w-32">Line Total</th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-[0.2em] w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {formData.lineItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-orange-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <SearchableSelect
                                                options={products}
                                                value={item.productId}
                                                onChange={(productId) => handleProductSelect(item.id, productId)}
                                                placeholder="Select SKU"
                                                displayKey="name"
                                            />
                                        </td>

                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                                                placeholder="Item specifics..."
                                                className="w-full border-2 border-gray-100 rounded-lg px-4 py-3 text-sm font-bold focus:border-orange-600 outline-none bg-gray-50/50"
                                            />
                                        </td>

                                        <td className="px-6 py-4">
                                            <input
                                                type="number"
                                                value={item.quantity || ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-full border-2 border-gray-100 rounded-lg px-4 py-3 text-sm text-center font-mono font-black focus:border-orange-600 outline-none"
                                                placeholder="0"
                                            />
                                        </td>

                                        <td className="px-6 py-4">
                                            <input
                                                type="number"
                                                value={item.rate || ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                                className="w-full border-2 border-gray-100 rounded-lg px-4 py-3 text-sm text-center font-mono font-black focus:border-orange-600 outline-none"
                                                placeholder="0.00"
                                            />
                                        </td>

                                        <td className="px-6 py-4 text-right font-mono font-black text-gray-900 bg-gray-50/30">
                                            {item.amount.toLocaleString()}
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleRemoveLineItem(item.id)}
                                                className="p-2 text-red-500 hover:bg-redwood-brand/10 rounded-full transition-all"
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
                        className="mt-6 px-8 py-3 bg-white border-2 border-gray-900 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-900 hover:text-white transition-all flex items-center gap-3 shadow-md"
                    >
                        <Plus size={16} />
                        Append SKU Item
                    </button>
                </div>

                {/* Fiscal Terms Section */}
                <div className="border-t-2 border-gray-100 pt-8 mt-8">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        Fiscal Settlement Terms
                        <div className="h-px bg-gray-200 flex-1"></div>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-gray-900 p-8 rounded-2xl shadow-xl">
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Liability Status</label>
                            <select
                                value={formData.paymentStatus}
                                onChange={(e) => setFormData(p => ({ ...p, paymentStatus: e.target.value as any, paymentMethod: '', amountPaid: 0 }))}
                                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-4 text-sm font-black text-white focus:border-orange-500 outline-none transition-all uppercase"
                            >
                                <option value="Unpaid">🔴 Unpaid (Accounts Payable)</option>
                                <option value="Paid">🔵 Paid (Settled)</option>
                                <option value="Advance Paid">🟡 Advance / Partial Payment</option>
                            </select>
                        </div>

                        {(formData.paymentStatus === 'Paid' || formData.paymentStatus === 'Advance Paid') && (
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Disbursement Channel</label>
                                <select
                                    value={formData.paymentMethod}
                                    onChange={(e) => setFormData(p => ({ ...p, paymentMethod: e.target.value }))}
                                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-4 text-sm font-black text-white focus:border-orange-500 outline-none transition-all uppercase"
                                    required
                                >
                                    <option value="">-- Select Channel --</option>
                                    {PAYMENT_METHODS.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {formData.paymentStatus === 'Advance Paid' && (
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Upfront Amount</label>
                                    <input
                                        type="number"
                                        value={formData.amountPaid || ''}
                                        onChange={(e) => setFormData(p => ({ ...p, amountPaid: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-4 text-lg font-mono font-black text-white focus:border-orange-500 outline-none transition-all"
                                        placeholder="Enter amount paid"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Payment For (Invoice / PO Reference)</label>
                                    <input
                                        type="text"
                                        value={formData.paymentReference || formData.poNumber}
                                        onChange={(e) => setFormData(p => ({ ...p, paymentReference: e.target.value }))}
                                        className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-4 text-sm font-mono font-black text-orange-400 focus:border-orange-500 outline-none transition-all"
                                        placeholder="e.g. PO-123456 or INV-789"
                                    />
                                    <p className="text-[10px] text-gray-500 italic">Auto-filled with this PO number. Edit if paying against a different invoice.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Totals & Summary */}
                <div className="border-t-2 border-gray-100 pt-10">
                    <div className="flex flex-col md:flex-row gap-12 justify-between">
                        {/* Narrative Area */}
                        <div className="w-full md:w-1/2 space-y-4">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                Transaction Narrative & Logistics Info
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                rows={8}
                                placeholder="Include special handling instructions or contractual references..."
                                className="w-full border-2 border-gray-200 bg-white rounded-lg px-6 py-5 text-sm font-bold text-gray-700 outline-none resize-none shadow-sm"
                            />
                        </div>

                        {/* Fiscal Context Card */}
                        <div className="w-full md:w-5/12 bg-white rounded-3xl border-4 border-gray-900 overflow-hidden shadow-2xl skew-y-0 relative">
                            <div className="bg-gray-900 px-8 py-5">
                                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex justify-between">
                                    Fiscal Analysis
                                    <span className="opacity-40 italic">Procurement v2.5</span>
                                </h4>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="flex justify-between items-center group">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Operational Subtotal</span>
                                    <span className="text-xl font-mono font-black text-gray-900">{formData.subtotal.toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between items-center group">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">VAT / Taxation</span>
                                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-2">
                                            <input
                                                type="number"
                                                value={formData.taxRate}
                                                onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                                                className="w-10 bg-transparent py-1 text-xs font-black text-gray-600 focus:outline-none"
                                                min="0"
                                            />
                                            <span className="text-[9px] font-black text-gray-300">%</span>
                                        </div>
                                    </div>
                                    <span className="text-lg font-mono font-black text-gray-900">{formData.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>

                                <div className="flex justify-between items-center group">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contractual Rebate</span>
                                    <input
                                        type="number"
                                        value={formData.discount || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                                        className="w-32 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 text-sm text-right font-mono font-black focus:border-orange-500 outline-none transition-all"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="pt-8 border-t-4 border-gray-900 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-black text-gray-900 uppercase tracking-widest flex flex-col">
                                            GRAND TOTAL
                                            <span className="text-[9px] font-black text-gray-400 normal-case italic mt-1">Total Fiscal Obligation</span>
                                        </span>
                                        <span className="text-4xl font-mono font-black text-orange-600 tracking-tighter">{formData.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    {formData.paymentStatus !== 'Unpaid' && (
                                        <div className="flex justify-between items-center bg-emerald-500/10 px-4 py-3 rounded-xl border border-emerald-500/20">
                                            <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Amount Disbursed</span>
                                            <span className="text-base font-mono font-black text-emerald-800">
                                                {formData.paymentStatus === 'Paid' ? formData.grandTotal.toLocaleString() : formData.amountPaid.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {formData.paymentStatus === 'Advance Paid' && formData.amountPaid > formData.grandTotal && (
                                        <div className="flex justify-between items-center bg-blue-500/10 px-4 py-3 rounded-xl border border-blue-400/30">
                                            <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest">⚠️ Overpayment / Credit</span>
                                            <span className="text-base font-mono font-black text-blue-800">
                                                +{(formData.amountPaid - formData.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center bg-gray-900 px-6 py-5 rounded-2xl shadow-xl mt-4">
                                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] flex flex-col">
                                            NET LIABILITY
                                            <span className="text-[8px] font-black text-white/30 lowercase mt-1 tracking-widest underline decoration-orange-400/30">due to supplier</span>
                                        </span>
                                        <span className="text-3xl font-mono font-black text-white italic underline">{formData.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
