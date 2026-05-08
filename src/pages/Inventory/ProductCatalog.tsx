import { useState, useEffect } from 'react';
import {
    Plus,
    Download,
    Search,
    LayoutGrid,
    List,
    AlertTriangle,
    Package,
    ChevronDown,
    Edit2,
    Trash2,
    Eye,
    CheckCircle2,
    XCircle,
    Inbox,
    Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProducts, deleteProduct, type Product } from '../../services/productService';
import { formatCurrency } from '../../services/settingsService';
import clsx from 'clsx';

export default function ProductCatalog() {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            setLoading(true);
            const data = await getProducts();
            setProducts(data);
        } catch (error) {
            console.error('Failed to load products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
            try {
                await deleteProduct(id);
                loadProducts();
            } catch (error) {
                console.error('Failed to delete product:', error);
            }
        }
    };

    const categories = ['All Categories', ...Array.from(new Set(products.map(p => p.category)))];

    console.log('Products loaded in catalog:', products.length);

    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (p.sku?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All Categories' || p.category === selectedCategory;
        // Ensure we handle potential undefined status by defaulting to Active if missing
        return matchesSearch && matchesCategory;
    });

    const groupedProducts = filteredProducts.reduce((acc, product) => {
        const cat = product.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

    // Stats calculations
    const totalProducts = products.length;
    const inStock = products.filter(p => p.locations.reduce((a, b) => a + (b.currentStock ?? 0), 0) > p.reorderLevel).length;
    const lowStock = products.filter(p => {
        const stock = p.locations.reduce((a, b) => a + (b.currentStock ?? 0), 0);
        return stock > 0 && stock <= p.reorderLevel;
    }).length;
    const outOfStock = products.filter(p => p.locations.reduce((a, b) => a + (b.currentStock ?? 0), 0) === 0).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest text-center">Loading Products...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Products', value: totalProducts, sub: 'Global Inventory', color: 'text-gray-900', icon: Package, bg: 'bg-white' },
                    {
                        label: 'In Stock',
                        value: inStock,
                        sub: `${Math.round((inStock / totalProducts) * 100)}% of total`,
                        color: 'text-emerald-600',
                        icon: CheckCircle2,
                        bg: 'bg-white',
                        border: 'border-l-4 border-l-emerald-500'
                    },
                    {
                        label: 'Low Stock',
                        value: lowStock,
                        sub: 'Order soon',
                        color: 'text-amber-600',
                        icon: AlertTriangle,
                        bg: 'bg-white',
                        border: 'border-l-4 border-l-amber-500'
                    },
                    {
                        label: 'Out of Stock',
                        value: outOfStock,
                        sub: 'Action required',
                        color: 'text-rose-600',
                        icon: XCircle,
                        bg: 'bg-white',
                        border: 'border-l-4 border-l-rose-500'
                    },
                ].map((stat, i) => (
                    <div key={i} className={clsx(
                        "p-8 rounded-3xl border border-gray-100 shadow-sm transition-all hover:shadow-xl group relative overflow-hidden",
                        stat.bg,
                        stat.border
                    )}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700">
                            <stat.icon size={80} />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">{stat.label}</span>
                        <div className="flex items-end justify-between relative z-10">
                            <div>
                                <p className={clsx("text-4xl font-black tracking-tighter", stat.color)}>{stat.value}</p>
                                <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-widest">{stat.sub}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Top Action Bar */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                    <div className="flex-1 w-full relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search products by name or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900/10 focus:bg-white rounded-2xl pl-16 pr-8 py-5 text-sm font-bold transition-all outline-none"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        <div className="relative min-w-[200px]">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full appearance-none bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 text-[11px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white hover:border-gray-900 transition-all"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                        </div>

                        <div className="flex p-1.5 bg-gray-50 border border-gray-100 rounded-2xl">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={clsx("p-3 rounded-xl transition-all", viewMode === 'grid' ? "bg-white text-gray-900 shadow-md" : "text-gray-400")}
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={clsx("p-3 rounded-xl transition-all", viewMode === 'list' ? "bg-white text-gray-900 shadow-md" : "text-gray-400")}
                            >
                                <List size={18} />
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => navigate('/products/import')}
                                className="px-8 py-5 border-2 border-gray-900 text-gray-900 text-[11px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:bg-gray-50 transition-all"
                            >
                                <Zap size={18} className="text-blue-500" /> AI Import
                            </button>
                            <button
                                onClick={() => navigate('/products/new')}
                                className="px-8 py-5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-200"
                            >
                                <Plus size={18} /> Add Product
                            </button>
                            <button className="p-5 bg-gray-50 border border-gray-100 text-gray-600 rounded-2xl hover:bg-white hover:border-gray-900 transition-all">
                                <Download size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product List Grouped by Category */}
            <div className="space-y-12">
                {Object.keys(groupedProducts).length === 0 ? (
                    <div className="bg-white p-20 rounded-3xl border border-gray-100 shadow-sm text-center">
                        <Inbox size={64} className="mx-auto text-gray-200 mb-6" />
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">No products found</h3>
                        <p className="text-gray-400 text-sm font-medium mt-2">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    Object.entries(groupedProducts).map(([category, catProducts]) => (
                        <div key={category} className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-4">
                                    <div className="w-2 h-8 bg-gray-900 rounded-full"></div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
                                            🏷️ {category}
                                            <span className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{catProducts.length} products</span>
                                        </h2>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-all">Edit Category</button>
                                    <button className="px-4 py-2 bg-gray-50 text-[9px] font-black uppercase tracking-widest text-gray-600 rounded-lg hover:bg-gray-100 transition-all">+ Add Product to This Category</button>
                                </div>
                            </div>

                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {catProducts.map(product => {
                                        const totalStock = product.locations.reduce((a, b) => a + (b.currentStock ?? 0), 0);
                                        const status = totalStock === 0 ? 'Out of Stock' : totalStock <= product.reorderLevel ? 'Low Stock' : totalStock > 100 ? 'Overstock' : 'Good';

                                        return (
                                            <div
                                                key={product.id}
                                                className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl transition-all group overflow-hidden flex flex-col cursor-pointer"
                                                onClick={() => navigate(`/products/${product.id}`)}
                                            >
                                                <div className="aspect-[4/3] bg-gray-50 relative flex items-center justify-center overflow-hidden">
                                                    {product.images && product.images.length > 0 ? (
                                                        <img
                                                            src={product.images.find(img => img.isPrimary)?.url || product.images[0].url}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                        />
                                                    ) : (
                                                        <Package className="text-gray-200 group-hover:scale-110 transition-transform duration-700" size={64} />
                                                    )}
                                                    <div className="absolute top-4 right-4">
                                                        <div className={clsx(
                                                            "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm",
                                                            status === 'Good' ? "bg-emerald-500 text-white" :
                                                                status === 'Low Stock' ? "bg-amber-500 text-white" :
                                                                    status === 'Overstock' ? "bg-rose-500 text-white" : "bg-rose-500 text-white"
                                                        )}>
                                                            {status === 'Good' ? '✅ Good' :
                                                                status === 'Low Stock' ? '⚠️ Low Stock' :
                                                                    status === 'Overstock' ? '🔴 Overstock' : '❌ Out of Stock'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-6 flex-1 flex flex-col">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <h4 className="text-base font-black text-gray-900 uppercase tracking-tight leading-tight group-hover:text-gray-700 transition-colors">{product.name}</h4>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">SKU: {product.sku}</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4 mb-6">
                                                        <div className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-xl">
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price</span>
                                                            <span className="text-sm font-black text-gray-900">{formatCurrency(product.pricing.sellingPrice)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-xl">
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">📦 Total Stock</span>
                                                            <span className="text-sm font-black text-gray-900">{totalStock} units</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 text-center mb-6">
                                                        {product.locations.map(loc => (
                                                            <div key={loc.id} className="p-2 bg-gray-50/50 rounded-lg">
                                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter truncate">{loc.name}</p>
                                                                <p className="text-xs font-black text-gray-900">{loc.currentStock}</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="flex gap-2 mt-auto">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/products/${product.id}`); }}
                                                            className="flex-1 py-3 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-600 rounded-xl hover:bg-gray-900 hover:text-white transition-all"
                                                        >
                                                            View Details
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/products/edit/${product.id}`); }}
                                                            className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-900 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                                                            className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Image</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product Name</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">SKU</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Price</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Locations</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {catProducts.map(product => {
                                                const totalStock = product.locations.reduce((a, b) => a + (b.currentStock ?? 0), 0);
                                                const status = totalStock === 0 ? 'Out of Stock' : totalStock <= product.reorderLevel ? 'Low Stock' : totalStock > 100 ? 'Overstock' : 'Good';

                                                return (
                                                    <tr
                                                        key={product.id}
                                                        className="hover:bg-gray-50 transition-all cursor-pointer group"
                                                        onClick={() => navigate(`/products/${product.id}`)}
                                                    >
                                                        <td className="px-8 py-4">
                                                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 overflow-hidden">
                                                                {product.images && product.images.length > 0 ? (
                                                                    <img
                                                                        src={product.images.find(img => img.isPrimary)?.url || product.images[0].url}
                                                                        alt={product.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <Package size={20} />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <span className="text-sm font-black text-gray-900 group-hover:text-gray-700">{product.name}</span>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <span className="text-[11px] font-bold text-gray-400">{product.sku}</span>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <span className="text-sm font-black text-gray-900">{formatCurrency(product.pricing.sellingPrice)}</span>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <span className="text-sm font-black text-gray-900">{totalStock}</span>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <div className={clsx(
                                                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                                                status === 'Good' ? "bg-emerald-50 text-emerald-600" :
                                                                    status === 'Low Stock' ? "bg-amber-50 text-amber-600" :
                                                                        status === 'Overstock' ? "bg-rose-50 text-rose-600" : "bg-rose-50 text-rose-600"
                                                            )}>
                                                                <div className={clsx(
                                                                    "w-1.5 h-1.5 rounded-full",
                                                                    status === 'Good' ? "bg-emerald-500" :
                                                                        status === 'Low Stock' ? "bg-amber-500" : "bg-rose-500"
                                                                )}></div>
                                                                {status}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <div className="flex gap-1">
                                                                {product.locations.map(loc => (
                                                                    <span key={loc.id} className="px-2 py-0.5 bg-gray-100 text-[8px] font-black text-gray-500 rounded uppercase" title={loc.name}>
                                                                        {loc.name[0]}: {loc.currentStock}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-4 text-center">
                                                            <div className="flex justify-center gap-1">
                                                                <button className="p-2 text-gray-400 hover:text-gray-900 transition-all"><Eye size={18} /></button>
                                                                <button className="p-2 text-gray-400 hover:text-gray-900 transition-all"><Edit2 size={18} /></button>
                                                                <button className="p-2 text-gray-400 hover:text-rose-600 transition-all"><Trash2 size={18} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
