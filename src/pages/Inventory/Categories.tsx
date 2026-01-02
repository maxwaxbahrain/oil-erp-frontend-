import { useState, useEffect, useRef } from 'react';
import {
    Tag,
    Plus,
    Edit2,
    Trash2,
    Eye,
    X,
} from 'lucide-react';
import { getCategories, saveCategory, deleteCategory, type Category } from '../../services/productService';
import { getProducts } from '../../services/productService';

export default function Categories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form refs
    const nameRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const iconRef = useRef<HTMLSelectElement>(null);
    const orderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const cats = await getCategories();
            // Calculate product counts for each category
            const products = await getProducts();
            const categoriesWithCounts = cats.map(cat => {
                const categoryProducts = products.filter(p => p.category === cat.name);
                const totalValue = categoryProducts.reduce((sum, p) => {
                    const totalStock = p.locations.reduce((s, l) => s + l.currentStock, 0);
                    return sum + (totalStock * p.pricing.sellingPrice);
                }, 0);
                return {
                    ...cat,
                    productCount: categoryProducts.length,
                    totalStockValue: `$${totalValue.toLocaleString()}`
                };
            });
            setCategories(categoriesWithCounts as any);
        } catch (error) {
            console.error('Failed to load categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const closeModal = () => {
        setIsCreateModalOpen(false);
        setEditingCategory(null);
    };

    const handleSave = async () => {
        const name = nameRef.current?.value.trim();
        const description = descriptionRef.current?.value.trim();
        const icon = iconRef.current?.value;
        const displayOrder = orderRef.current?.value ? parseInt(orderRef.current.value) : undefined;

        if (!name) {
            alert('Category name is required!');
            return;
        }

        setSaving(true);
        try {
            await saveCategory({
                id: editingCategory?.id,
                name,
                description: description || '',
                icon,
                displayOrder
            });
            await loadCategories();
            closeModal();
        } catch (error) {
            console.error('Failed to save category:', error);
            alert('Failed to save category. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteCategory(id);
            await loadCategories();
        } catch (error) {
            console.error('Failed to delete category:', error);
            alert('Failed to delete category. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Loading categories...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Simple Category Management Interface Header */}
            <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-4">
                        <Tag className="text-gray-900" size={32} />
                        Product Categories
                    </h2>
                    <p className="text-gray-500 mt-2 text-sm font-medium uppercase tracking-widest leading-relaxed">
                        Organize your products into categories - works for ANY product type
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-10 py-5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-200 shrink-0"
                >
                    <Plus size={20} /> Create New Category
                </button>
            </div>

            {/* Existing Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {categories.map((cat: any) => (
                    <div key={cat.id} className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700">
                            <span className="text-8xl select-none">{cat.icon || '📦'}</span>
                        </div>

                        <div className="relative flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-4xl">{cat.icon || '📦'}</span>
                                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Category: {cat.name}</h3>
                            </div>

                            <p className="text-gray-500 text-sm font-medium uppercase tracking-widest leading-relaxed mb-8 flex-1">
                                Description: {cat.description}
                            </p>

                            <div className="grid grid-cols-2 gap-6 mb-10 pt-8 border-t border-gray-50">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Number of Products</p>
                                    <p className="text-xl font-black text-gray-900">{cat.productCount || 0} Items</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Stock Value</p>
                                    <p className="text-xl font-black text-gray-900">{cat.totalStockValue || '$0'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Created Date</p>
                                    <p className="text-sm font-black text-gray-600 uppercase">{new Date(cat.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setEditingCategory(cat)}
                                    className="px-6 py-3 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-600 rounded-xl hover:bg-gray-900 hover:text-white transition-all flex items-center gap-2"
                                >
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button className="px-6 py-3 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-600 rounded-xl hover:bg-gray-100 transition-all flex items-center gap-2">
                                    <Eye size={14} /> View Products
                                </button>
                                <button
                                    onClick={() => handleDelete(cat.id, cat.name)}
                                    className="px-6 py-3 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all ml-auto"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Edit Category Modal */}
            {(isCreateModalOpen || editingCategory) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
                                    {editingCategory ? <Edit2 size={24} /> : <Plus size={24} />}
                                    {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Category'}
                                </h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                    Works for Oil, Electronics, Clothing, Food - ANY product type!
                                </p>
                            </div>
                            <button onClick={closeModal} className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-12 space-y-8">
                            <div>
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Category Name: *</label>
                                <input
                                    ref={nameRef}
                                    type="text"
                                    placeholder="e.g., Electronics, Clothing, Food, Tires, Accessories"
                                    defaultValue={editingCategory?.name}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Description: (Optional)</label>
                                <textarea
                                    ref={descriptionRef}
                                    placeholder="Brief description of what products go in this category"
                                    defaultValue={editingCategory?.description}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none h-32 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Category Icon: (Optional)</label>
                                    <div className="relative">
                                        <select
                                            ref={iconRef}
                                            defaultValue={editingCategory?.icon || '🏷️'}
                                            className="w-full appearance-none bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none cursor-pointer"
                                        >
                                            <option value="🏷️">🏷️ Tag</option>
                                            <option value="📦">📦 Box</option>
                                            <option value="🔧">🔧 Tools</option>
                                            <option value="🔋">🔋 Battery</option>
                                            <option value="🛞">🛞 Tire</option>
                                            <option value="🧴">🧴 Oil/Cleaner</option>
                                            <option value="🧰">🧰 Toolkit</option>
                                            <option value="🛢️">🛢️ Drum</option>
                                            <option value="👕">👕 Clothing</option>
                                            <option value="🍔">🍔 Food</option>
                                            <option value="💻">💻 Electronics</option>
                                            <option value="📱">📱 Mobile</option>
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <Tag size={18} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Display Order:</label>
                                    <input
                                        ref={orderRef}
                                        type="number"
                                        placeholder="1"
                                        defaultValue={editingCategory?.displayOrder}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none"
                                    />
                                    <p className="text-[9px] font-black text-gray-400 uppercase mt-2 pl-1">(Lower numbers appear first)</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 bg-gray-50 border-t border-gray-100 flex gap-4">
                            <button
                                onClick={closeModal}
                                disabled={saving}
                                className="flex-1 py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-[2] py-5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50"
                            >
                                {saving ? '⏳ Saving...' : (editingCategory ? '✅ Save Changes' : '✅ Save Category')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
