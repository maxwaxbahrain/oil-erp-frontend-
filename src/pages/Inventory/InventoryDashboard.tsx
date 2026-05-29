import { useState, useEffect } from 'react';
import { Package, Plus, X, Save } from 'lucide-react';
import { getProducts, type Product } from '../../services/api';
import DataTable from '../../components/tables/DataTable';
import FormInput from '../../components/forms/FormInput';

export default function InventoryDashboard() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category: '',
        unit_price: '',
        stock_quantity: '',
        reorder_level: ''
    });

    useEffect(() => {
        loadProducts();
    }, []);

    async function loadProducts() {
        try {
            setLoading(true);
            const data = await getProducts();
            setProducts(data);
        } catch (error) {
            console.error('Failed to load products:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await import('../../services/api').then(mod => mod.createProduct({
                name: formData.name,
                sku: formData.sku,
                category: formData.category,
                unit_price: parseFloat(formData.unit_price) || 0,
                current_stock: parseInt(formData.stock_quantity) || 0,
                minimum_stock: parseInt(formData.reorder_level) || 0
            }));

            setShowForm(false);
            setFormData({
                name: '',
                sku: '',
                category: '',
                unit_price: '',
                stock_quantity: '',
                reorder_level: ''
            });
            loadProducts();
        } catch (error) {
            console.error('Failed to create product:', error);
            alert('Failed to save product. Please try again.');
        }
    };

    const columns = [
        {
            header: 'Product Details',
            accessor: (p: Product) => (
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-sm bg-redwood-bg-light text-redwood-brand flex items-center justify-center border border-redwood-border shadow-inner">
                        <Package size={20} />
                    </div>
                    <div>
                        <div className="font-black text-redwood-text-main uppercase tracking-tight">{p.name}</div>
                        <div className="text-[10px] text-redwood-text-muted font-bold tracking-widest bg-redwood-bg-light px-1.5 py-0.5 rounded-sm inline-block mt-1">
                            SKU: {p.sku}
                        </div>
                    </div>
                </div>
            )
        },
        {
            header: 'Category',
            accessor: (p: Product) => (
                <span className="text-[10px] font-black bg-redwood-slate text-white px-2.5 py-1 rounded-sm tracking-[0.1em] uppercase shadow-sm">
                    {p.category}
                </span>
            )
        },
        {
            header: 'Stock Level',
            accessor: (p: Product) => {
                const reorderPoint = Number(p.minimum_stock) || 0;
                const hasReorderPoint = reorderPoint > 0;
                const isLow = hasReorderPoint && p.current_stock <= reorderPoint;
                return (
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-end">
                            <span className={`text-[11px] font-black ${isLow ? 'text-redwood-brand' : 'text-redwood-text-main'}`}>
                                {p.current_stock} <span className="text-[9px] text-redwood-text-muted font-bold opacity-60">UNITS</span>
                            </span>
                            <span className="text-[9px] font-black text-redwood-text-muted">
                                {hasReorderPoint ? `Reorder: ${reorderPoint}` : 'No reorder point'}
                            </span>
                        </div>
                        <div className="w-48 h-1.5 bg-redwood-bg-light rounded-full overflow-hidden shadow-inner">
                            <div
                                className={`h-full transition-all duration-1000 shadow-sm ${isLow ? 'bg-redwood-brand' : 'bg-redwood-primary'
                                    }`}
                                style={{ width: hasReorderPoint ? `${Math.min((p.current_stock / (reorderPoint * 2)) * 100, 100)}%` : '0%' }}
                            ></div>
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Unit Price',
            accessor: (p: Product) => (
                <div className="text-right">
                    <div className="text-[14px] font-black text-redwood-text-main tracking-tight">${p.unit_price.toLocaleString()}</div>
                    <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-[0.2em] mt-1 flex items-center justify-end gap-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> ACTIVE
                    </div>
                </div>
            ),
            className: 'text-right'
        }
    ];

    if (showForm) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
                <div className="bg-redwood-bg-surface border border-redwood-border rounded-lg shadow-2xl w-full max-w-2xl m-4 overflow-hidden">
                    <div className="px-6 py-4 border-b border-redwood-border flex justify-between items-center bg-redwood-bg-light">
                        <h3 className="text-lg font-bold text-redwood-text-main">New Product</h3>
                        <button onClick={() => setShowForm(false)} className="text-redwood-text-muted hover:text-redwood-text-main transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormInput
                                label="Product Name"
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Premium Widget"
                            />

                            <FormInput
                                label="SKU / Item Code"
                                type="text"
                                required
                                value={formData.sku}
                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                placeholder="e.g. WID-001"
                            />

                            <FormInput
                                label="Category"
                                type="text"
                                required
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                placeholder="e.g. Electronics"
                            />

                            <FormInput
                                label="Unit Price ($)"
                                type="number"
                                step="0.01"
                                required
                                value={formData.unit_price}
                                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                                placeholder="0.00"
                            />

                            <FormInput
                                label="Opening Stock"
                                type="number"
                                required
                                value={formData.stock_quantity}
                                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                                placeholder="0"
                            />

                            <FormInput
                                label="Reorder Level"
                                type="number"
                                value={formData.reorder_level}
                                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="pt-4 border-t border-redwood-border flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-6 py-2 bg-redwood-bg-light border border-redwood-border text-redwood-text-main text-sm font-semibold rounded-md hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-redwood-brand text-white text-sm font-bold rounded-md hover:brightness-90 transition-all shadow-md flex items-center gap-2"
                            >
                                <Save size={16} /> Save Product
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tighter">Product Inventory</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-redwood-brand uppercase tracking-[0.2em] px-2 py-0.5 bg-redwood-brand/10 rounded-sm">
                            Material Master
                        </span>
                        <span className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">
                            Total Products: {products.length}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-redwood-brand border border-transparent text-[11px] font-black text-white rounded-sm hover:brightness-90 transition-all shadow-lg"
                >
                    <Plus size={16} /> Add New Product
                </button>
            </div>

            {/* Products Table */}
            <DataTable
                title="Product Catalog"
                subtitle="Complete inventory of all registered materials and SKUs"
                data={products}
                columns={columns as any}
                loading={loading}
                actions={
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2 bg-redwood-brand text-white text-[11px] font-black rounded-sm hover:brightness-95 transition-all shadow-md flex items-center gap-2"
                    >
                        <Plus size={14} /> New Product
                    </button>
                }
            />
        </div>
    );
}
