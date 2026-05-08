import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, Save, X, User, Truck, Package, Calendar } from 'lucide-react';
import { createSalesOrder, type SalesOrderItem } from '../../services/salesService';
import { getCustomers, getVans, getProducts, type Customer, type Van, type Product } from '../../services/api';
import FormInput from '../../components/forms/FormInput';

interface SalesOrderFormProps {
    onSave: () => void;
    onCancel: () => void;
}

export default function SalesOrderForm({ onSave, onCancel }: SalesOrderFormProps) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [vans, setVans] = useState<Van[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const [customerId, setCustomerId] = useState('');
    const [vanId, setVanId] = useState('');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<SalesOrderItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const [customersData, vansData, productsData] = await Promise.all([
                    getCustomers(),
                    getVans(),
                    getProducts(),
                ]);
                setCustomers(customersData);
                setVans(vansData);
                setProducts(productsData);
            } catch (err) {
                console.error('Failed to load form data', err);
                setError('Critical Master Data Sync Failure. Check backend terminal.');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const addItem = () => {
        setItems([...items, { product_id: '', product_name: '', quantity: 1, unit_price: 0, total: 0 }]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof SalesOrderItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === 'product_id') {
            const product = products.find(p => p.id === value);
            if (product) {
                item.product_id = product.id;
                item.product_name = product.name;
                item.unit_price = product.unit_price;
            }
        } else {
            (item as any)[field] = value;
        }

        item.total = item.quantity * item.unit_price;
        newItems[index] = item;
        setItems(newItems);
    };

    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId || items.length === 0) {
            setError('Select a customer and at least one line item.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await createSalesOrder({
                customer_id: customerId,
                van_id: vanId || null,
                order_date: orderDate,
                items: items as unknown as Array<Record<string, unknown>>,
                subtotal: totalAmount,
                tax: 0,
                total: totalAmount,
                status: 'confirmed',
                payment_status: 'unpaid',
                notes: '',
            });
            onSave();
        } catch (err: any) {
            setError(err.message || 'Transaction Committal Failed. Matrix Rejection.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-20 text-center animate-pulse">
                <div className="w-10 h-10 border-4 border-redwood-brand border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <p className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.3em]">Synchronizing Master Protocols...</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-redwood-border rounded-sm shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-8 py-6 border-b border-redwood-bg-light flex justify-between items-center bg-redwood-bg-light/30">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-redwood-midnight rounded-sm flex items-center justify-center text-redwood-brand shadow-lg">
                        <ShoppingCart size={20} />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-black text-redwood-text-main uppercase tracking-[0.2em]">New Sales Execution Ledger</h3>
                        <p className="text-[10px] text-redwood-text-muted font-bold uppercase tracking-widest mt-0.5">Strategic Fulfillment Protocol</p>
                    </div>
                </div>
                <button onClick={onCancel} className="p-2 text-redwood-text-muted hover:text-redwood-brand transition-colors">
                    <X size={24} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-10">
                {error && (
                    <div className="p-4 bg-redwood-brand/5 border border-redwood-brand border-dashed text-redwood-brand text-[11px] font-black uppercase tracking-widest rounded-sm flex items-center gap-3">
                        <span className="w-2 h-2 bg-redwood-brand rounded-full animate-ping"></span> {error}
                    </div>
                )}

                {/* Authority Context */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest flex items-center gap-2">
                            <User size={12} /> Legal Entity Entity
                        </label>
                        <select
                            required
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            className="w-full bg-redwood-bg-light border border-redwood-border rounded-sm px-4 py-3 text-[13px] font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all shadow-inner uppercase tracking-tight"
                        >
                            <option value="">Select Partner...</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest flex items-center gap-2">
                            <Truck size={12} /> Logistics Asset
                        </label>
                        <select
                            required
                            value={vanId}
                            onChange={(e) => setVanId(e.target.value)}
                            className="w-full bg-redwood-bg-light border border-redwood-border rounded-sm px-4 py-3 text-[13px] font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all shadow-inner uppercase tracking-tight"
                        >
                            <option value="">Select Node...</option>
                            {vans.map(v => (
                                <option key={v.id} value={v.id}>{v.van_number} - {v.driver_name}</option>
                            ))}
                        </select>
                    </div>

                    <FormInput
                        label="Execution Date"
                        type="date"
                        required
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                        icon={<Calendar size={16} />}
                    />
                </div>

                {/* Dispatch Manifest */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-redwood-border pb-4">
                        <h4 className="text-[12px] font-black text-redwood-text-main uppercase tracking-[0.25em] flex items-center gap-3">
                            <Package size={18} className="text-redwood-brand" /> Dispatch Manifest Lines
                        </h4>
                        <button
                            type="button"
                            onClick={addItem}
                            className="px-6 py-2 bg-redwood-bg-light hover:bg-black hover:text-white border border-redwood-border rounded-sm text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
                        >
                            <Plus size={16} /> Append Line
                        </button>
                    </div>

                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-end bg-redwood-bg-light/10 p-6 rounded-sm border border-redwood-border/50 group hover:border-redwood-brand transition-all shadow-sm">
                                <div className="col-span-12 md:col-span-5 space-y-2">
                                    <label className="text-[9px] font-black text-redwood-text-muted uppercase tracking-widest">Material Identification</label>
                                    <select
                                        required
                                        value={item.product_id}
                                        onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                        className="w-full bg-white border border-redwood-border rounded-sm px-4 py-2.5 text-[13px] font-bold focus:border-redwood-brand outline-none transition-all shadow-inner uppercase tracking-tight"
                                    >
                                        <option value="">Select SKU...</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-span-4 md:col-span-2 space-y-2">
                                    <label className="text-[9px] font-black text-redwood-text-muted uppercase tracking-widest">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={item.quantity}
                                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                                        className="w-full bg-white border border-redwood-border rounded-sm px-4 py-2.5 text-[13px] font-bold focus:border-redwood-brand outline-none shadow-inner"
                                    />
                                </div>

                                <div className="col-span-4 md:col-span-2 space-y-2">
                                    <label className="text-[9px] font-black text-redwood-text-muted uppercase tracking-widest">Unit Rate (PKR)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={item.unit_price}
                                        onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value))}
                                        className="w-full bg-white border border-redwood-border rounded-sm px-4 py-2.5 text-[13px] font-bold focus:border-redwood-brand outline-none shadow-inner font-mono"
                                    />
                                </div>

                                <div className="col-span-3 md:col-span-2 space-y-2">
                                    <label className="text-[9px] font-black text-redwood-text-muted uppercase tracking-widest">Line Total</label>
                                    <div className="w-full px-4 py-2.5 text-[13px] font-black text-redwood-text-main bg-redwood-bg-light border border-transparent rounded-sm font-mono flex items-center">
                                        {item.total.toLocaleString()}
                                    </div>
                                </div>

                                <div className="col-span-1 flex justify-end pb-1.5">
                                    <button
                                        type="button"
                                        onClick={() => removeItem(index)}
                                        className="p-2.5 text-redwood-text-muted hover:text-redwood-brand transition-colors rounded-sm hover:bg-white border border-transparent hover:border-redwood-border"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {items.length === 0 && (
                            <div className="p-16 text-center border-2 border-dashed border-redwood-border rounded-sm bg-redwood-bg-light/5 shadow-inner">
                                <p className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.3em] italic">No Dispatch Parameters Assigned</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Commitment Matrix */}
                <div className="pt-10 border-t border-redwood-border flex flex-col md:flex-row justify-between items-end gap-8">
                    <div className="text-right flex flex-col">
                        <span className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.3em]">Aggregate Fiscal Exposure</span>
                        <div className="flex items-baseline gap-3 justify-end mt-1">
                            <span className="text-[14px] font-black text-redwood-brand">PKR</span>
                            <span className="text-4xl font-black text-redwood-text-main tracking-tighter font-mono">{totalAmount.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-8 py-4 bg-white border border-redwood-border text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.2em] rounded-sm hover:bg-redwood-bg-light transition-all shadow-sm"
                        >
                            Abort Protocol
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-12 py-4 bg-redwood-slate text-white text-[12px] font-black uppercase tracking-[0.3em] rounded-sm hover:bg-black transition-all shadow-2xl flex items-center gap-3 disabled:opacity-50 group"
                        >
                            {submitting ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Save size={18} className="text-redwood-brand group-hover:scale-110 transition-transform" /> Commit Dispatch
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
