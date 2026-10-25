import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Package,
    ArrowLeft,
    Save,
    DollarSign,
    Image as ImageIcon,
    CheckCircle2,
    HelpCircle,
    Truck,
    FileText,
    Layers,
    Warehouse,
    PlusCircle,
    Trash2,
    Scan,
    RefreshCw,
    Plus
} from 'lucide-react';
import { getProductById, saveProduct, deleteProduct, listProductBarcodes, addProductBarcode, removeProductBarcode, productCategoryService, type Product, type ProductLocation, type ProductSpecification, type ProductBarcodeRow, type ProductCategory } from '../../services/productService';
import { getSuppliers, type Supplier } from '../../services/purchasesService';
import { getLocationsFlat, type StockLocationNode } from '../../services/stockLocationService';
import { getSystemSettings, formatCurrency } from '../../services/settingsService';
import { getSuggestSettings, type SuggestSettings } from '../../services/reorderService';
import { ImageUpload } from '../../components/Inventory/ImageUpload';
import CostHistoryPanel from '../../components/Inventory/CostHistoryPanel';

export default function ProductForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;
    const settings = getSystemSettings();

    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [stockLocations, setStockLocations] = useState<StockLocationNode[]>([]);
    const [addingCategory, setAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [barcodes, setBarcodes] = useState<ProductBarcodeRow[]>([]);
    const [barcodeDraft, setBarcodeDraft] = useState('');
    const [barcodePack, setBarcodePack] = useState('');
    const [barcodeError, setBarcodeError] = useState('');
    const [openLocationId, setOpenLocationId] = useState<string>('LOC-001');
    // Read-only suggestion from /reorder; Apply only fills the form.
    const [suggestion, setSuggestion] = useState<SuggestSettings | null>(null);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestError, setSuggestError] = useState('');
    // Cost as loaded from the server; a different cost on save revalues stock and needs confirming.
    const [loadedCost, setLoadedCost] = useState<number | null>(null);
    const [costDialogOpen, setCostDialogOpen] = useState(false);
    const [costReason, setCostReason] = useState('');
    const [showCostHistory, setShowCostHistory] = useState(false);
    const [formData, setFormData] = useState<Partial<Product>>({
        status: 'Active',
        category: '',
        uom: 'Pieces',
        quantityPerUnit: undefined,
        shortDescription: '',
        description: '',
        pricing: {
            purchasePriceExWorks: 0,
            freightShipping: 0,
            importDuty: 0,
            otherDirectCosts: 0,
            landedCost: 0,
            operatingExpenseAllocation: 0,
            sellingPrice: 0,
            taxRate: 0,
            taxIncluded: false
        },
        locations: [
            { id: 'LOC-001', name: 'Main Warehouse', type: 'Warehouse', currentStock: undefined, reorderPoint: undefined, maxStock: 500, physicalLocation: '', contactPhone: '', assignedTo: '' },
            { id: 'LOC-002', name: 'Other store', type: 'Store', currentStock: undefined, reorderPoint: undefined, maxStock: 200, physicalLocation: '', contactPhone: '', assignedTo: '' }
        ],
        images: [],
        specifications: [],
        tags: [],
        seo: {
            metaTitle: '',
            metaDescription: '',
            keywords: ''
        },
        reorderLevel: undefined,
        maxStockLevel: 500,
        leadTimeDays: undefined,
        minOrderQty: undefined
    });

    useEffect(() => {
        if (id) {
            loadProduct(id);
        }
    }, [id]);

    useEffect(() => {
        productCategoryService.list().then(setCategories).catch(() => setCategories([]));
        getSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
        getLocationsFlat()
            .then((rows) => setStockLocations(rows.filter((row) => row.isActive && (row.kind === 'bin' || row.kind === 'warehouse'))))
            .catch(() => setStockLocations([]));
    }, []);

    useEffect(() => {
        if (!id) return;
        listProductBarcodes(id).then(setBarcodes).catch(() => setBarcodes([]));
    }, [id]);

    useEffect(() => {
        if (formData.categoryId || !formData.category) return;
        const match = categories.find((row) => row.name.toLowerCase() === formData.category!.trim().toLowerCase());
        if (!match) return;
        setFormData((prev) => ({ ...prev, categoryId: match.id, category: match.name }));
    }, [categories, formData.category, formData.categoryId]);

    async function loadProduct(prodId: string) {
        try {
            setLoading(true);
            const data = await getProductById(prodId);
            if (data) {
                setFormData(data);
                setLoadedCost(Number(data.pricing?.purchasePriceExWorks ?? 0));
                if (data.locations?.[0]?.id) setOpenLocationId(data.locations[0].id);
            }
        } catch (error) {
            console.error('Failed to load product:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleSave = async () => {
        setFormError('');
        if (!formData.name || !formData.category || !formData.sku) {
            alert('Please fill in all required fields (Name, Category, SKU)');
            return;
        }
        if (formData.packQty != null && !(Number(formData.packQty) > 0)) {
            setFormError('pack_qty must be greater than 0');
            return;
        }
        if (formData.reorderQty != null && Number(formData.reorderQty) < 0) {
            setFormError('reorder_qty must be greater than or equal to 0');
            return;
        }
        if (formData.shelfLifeDays != null && !formData.expiryTracked) {
            setFormError('shelf_life_days requires expiry_tracked');
            return;
        }

        const totalStock = getTotalStockFromLocations(formData.locations);
        if (!isEdit && totalStock === 0) {
            const unitsPerPack = Number(formData.quantityPerUnit) || 0;
            const message = unitsPerPack > 0
                ? `Initial stock is 0, but you entered ${unitsPerPack} in "Units per pack" — that field is NOT inventory stock.\n\nEnter quantity in "Initial stock (units)" (section 4), or save with 0 stock anyway?`
                : 'Initial stock is 0 — did you mean to add stock? Enter it in "Initial stock (units)" in section 4.\n\nSave anyway with 0 stock?';
            if (!window.confirm(message)) {
                return;
            }
        }

        // The same number saveProduct sends as cost; a change in edit mode is confirmed first.
        const newCost = Number(formData.pricing?.purchasePriceExWorks ?? 0);
        if (isEdit && loadedCost !== null && newCost !== loadedCost) {
            setCostReason('');
            setCostDialogOpen(true);
            return;
        }
        await persist();
    };

    const persist = async (costChangeReason?: string) => {
        try {
            setLoading(true);
            await saveProduct(
                {
                    ...formData,
                    baseUnit: (formData.baseUnit || '').trim() || formData.uom,
                    costMethod: formData.costMethod || 'average',
                },
                costChangeReason ? { costChangeReason } : undefined,
            );
            alert('Product saved successfully!');
            navigate('/products');
        } catch (error) {
            console.error('Failed to save product:', error);
            const message = error instanceof Error ? error.message : 'Failed to save product. Please try again.';
            setFormError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!isEdit || !id) return;
        if (!window.confirm('Delete this product permanently? This cannot be undone.')) return;
        try {
            setLoading(true);
            await deleteProduct(id);
            navigate('/products');
        } catch (e) {
            console.error(e);
            alert('Failed to delete product.');
        } finally {
            setLoading(false);
        }
    };

    const updatePricing = (updates: any) => {
        const newPricing = { ...(formData.pricing || {}), ...updates };
        // Simple landed cost calculation (sum of costs)
        const landedCost = (newPricing.purchasePriceExWorks || 0) +
            (newPricing.freightShipping || 0) +
            (newPricing.importDuty || 0) +
            (newPricing.otherDirectCosts || 0);

        setFormData({
            ...formData,
            pricing: { ...newPricing, landedCost } as any
        });
    };

    const updateLocation = (locId: string, updates: Partial<ProductLocation>) => {
        setFormData((prev) => ({
            ...prev,
            locations: prev.locations?.map((l) => (l.id === locId ? { ...l, ...updates } : l)),
        }));
    };

    const isMainLocation = (loc: ProductLocation) =>
        loc.id === 'LOC-001' || /^main warehouse$/i.test((loc.name || '').trim());

    const getTotalStockFromLocations = (locations?: ProductLocation[]) =>
        (locations ?? []).reduce((sum, loc) => sum + (Number(loc.currentStock) || 0), 0);

    const mainLocation =
        formData.locations?.find((loc) => isMainLocation(loc)) ?? formData.locations?.[0];

    const addStoreLocation = () => {
        const newLoc: ProductLocation = {
            id: `LOC-${Date.now()}`,
            name: '',
            type: 'Store',
            currentStock: undefined,
            reorderPoint: undefined,
            maxStock: 500,
            physicalLocation: '',
            contactPhone: '',
            assignedTo: '',
        };
        setFormData((prev) => ({
            ...prev,
            locations: [...(prev.locations || []), newLoc],
        }));
        setOpenLocationId(newLoc.id);
    };

    const addWarehouseLocation = () => {
        const newLoc: ProductLocation = {
            id: `LOC-${Date.now()}-W`,
            name: '',
            type: 'Warehouse',
            currentStock: undefined,
            reorderPoint: undefined,
            maxStock: 1000,
            physicalLocation: '',
            contactPhone: '',
            assignedTo: '',
        };
        setFormData((prev) => ({
            ...prev,
            locations: [...(prev.locations || []), newLoc],
        }));
        setOpenLocationId(newLoc.id);
    };

    const removeLocation = (locId: string) => {
        setFormData((prev) => {
            const list = prev.locations || [];
            if (list.length <= 1) return prev;
            const idx = list.findIndex((l) => l.id === locId);
            if (idx === -1) return prev;
            if (isMainLocation(list[idx])) return prev;
            return { ...prev, locations: list.filter((l) => l.id !== locId) };
        });
    };

    const addSpecification = () => {
        setFormData((prev) => ({
            ...prev,
            specifications: [...(prev.specifications || []), { key: '', value: '' }],
        }));
    };

    const updateSpecification = (index: number, updates: Partial<ProductSpecification>) => {
        setFormData((prev) => {
            const specs = [...(prev.specifications || [])];
            if (!specs[index]) return prev;
            specs[index] = { ...specs[index], ...updates };
            return { ...prev, specifications: specs };
        });
    };

    const removeSpecification = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            specifications: (prev.specifications || []).filter((_, i) => i !== index),
        }));
    };

    const handleAddCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;
        setFormError('');
        try {
            const created = await productCategoryService.create({ name, is_active: true });
            setCategories((prev) => [...prev.filter((row) => row.id !== created.id), created]);
            setFormData((prev) => ({ ...prev, categoryId: created.id, category: created.name }));
            setNewCategoryName('');
            setAddingCategory(false);
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Failed to add category');
        }
    };

    const handleAddBarcode = async () => {
        if (!id || !barcodeDraft.trim()) return;
        setBarcodeError('');
        try {
            const created = await addProductBarcode(id, {
                barcode: barcodeDraft.trim(),
                pack_qty: barcodePack.trim() === '' ? null : Number(barcodePack),
                is_primary: false,
            });
            setBarcodes((prev) => [...prev, created]);
            setBarcodeDraft('');
            setBarcodePack('');
        } catch (error) {
            setBarcodeError(error instanceof Error ? error.message : 'Failed to add barcode');
        }
    };

    const handleDeleteBarcode = async (row: ProductBarcodeRow) => {
        if (!id || row.is_primary) return;
        if (!window.confirm('Delete this barcode?')) return;
        setBarcodeError('');
        try {
            await removeProductBarcode(id, row.id);
            setBarcodes((prev) => prev.filter((item) => item.id !== row.id));
        } catch (error) {
            setBarcodeError(error instanceof Error ? error.message : 'Failed to delete barcode');
        }
    };

    const fieldClass = 'w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-6 py-4 text-sm font-bold outline-none';
    const minStockHint = mainLocation?.reorderPoint ?? formData.reorderLevel;

    const InfoTooltip = ({ text }: { text: string }) => (
        <div className="group relative inline-block ml-2 cursor-help">
            <HelpCircle size={14} className="text-gray-300" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-gray-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl font-medium leading-relaxed uppercase">
                {text}
            </div>
        </div>
    );

    // Calculate profit
    const buyPrice = formData.pricing?.purchasePriceExWorks || 0;
    const sellPrice = formData.pricing?.sellingPrice || 0;
    const profit = sellPrice - buyPrice;
    const profitMargin = sellPrice > 0 ? Math.round((profit / sellPrice) * 100) : 0;

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between sticky top-6 z-30 backdrop-blur-md">
                <div className="flex items-center gap-6">
                    <button
                        type="button"
                        onClick={() => navigate('/products')}
                        className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl text-gray-400 hover:text-gray-900 transition-all flex items-center justify-center"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">
                            {isEdit ? 'Update Product' : 'Add New Product'}
                        </h1>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1">
                            {isEdit ? 'Modify product details and stock' : 'List a new item in your inventory'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-4 justify-end">
                    {isEdit && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={loading}
                            className="px-8 py-4 bg-red-50 border border-red-200 text-red-700 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-100 transition-all disabled:opacity-50"
                        >
                            Delete
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => navigate('/products')}
                        className="px-8 py-4 bg-white border border-gray-200 text-gray-500 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="px-10 py-4 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:bg-black transition-all shadow-xl disabled:opacity-50"
                    >
                        {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                        Save
                    </button>
                </div>
            </div>

            {formError && (
                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-2xl px-6 py-4">
                    {formError}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left Column: Form Sections */}
                <div className="lg:col-span-2 space-y-10">

                    {/* 1. Basic Information */}
                    <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-sm space-y-10 relative overflow-hidden">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white">
                                <Package size={20} />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">1. Basic Information</h2>
                        </div>

                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="md:col-span-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Product Name: *</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none"
                                        placeholder="e.g. 15W40 Engine Oil (4L)"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Product SKU / Code: *</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.sku || ''}
                                            onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-6 py-5 text-sm font-bold outline-none font-mono"
                                            placeholder="BT15-40"
                                        />
                                        <button
                                            onClick={() => setFormData({ ...formData, sku: `P-${Math.random().toString(36).substr(2, 9).toUpperCase()}` })}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-900"
                                            title="Auto-Generate SKU"
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Barcode / UPC / EAN:</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.barcode || ''}
                                            onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-6 py-5 text-sm font-bold outline-none font-mono"
                                            placeholder="012345678912"
                                        />
                                        <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-900">
                                            <Scan size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Category: *</label>
                                    <select
                                        aria-label="Category"
                                        value={formData.categoryId ?? ''}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            const categoryId = raw === '' ? undefined : Number(raw);
                                            const row = categories.find((item) => item.id === categoryId);
                                            setFormData({
                                                ...formData,
                                                categoryId,
                                                category: row?.name ?? formData.category ?? '',
                                            });
                                        }}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-6 py-5 text-sm font-bold outline-none cursor-pointer"
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map((row) => (
                                            <option key={row.id} value={row.id}>{row.name}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        aria-label="Category name"
                                        value={formData.category || ''}
                                        onChange={(e) => {
                                            const category = e.target.value;
                                            const row = categories.find((item) => item.name.toLowerCase() === category.trim().toLowerCase());
                                            setFormData({
                                                ...formData,
                                                category,
                                                categoryId: row ? row.id : undefined,
                                            });
                                        }}
                                        className="w-full mt-3 bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                        placeholder="Category name"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setAddingCategory((open) => !open)}
                                        className="mt-3 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900"
                                    >
                                        + Add category
                                    </button>
                                    {addingCategory && (
                                        <div className="mt-3 flex gap-3">
                                            <input
                                                type="text"
                                                aria-label="New category name"
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                className="flex-1 bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-4 py-3 text-sm font-bold outline-none"
                                                placeholder="New category"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddCategory}
                                                className="px-4 py-3 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl"
                                            >
                                                Save category
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Brand:</label>
                                    <input
                                        type="text"
                                        aria-label="Brand"
                                        value={formData.brand || ''}
                                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none"
                                        placeholder="e.g. Soltol"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Unit of Measure */}
                    <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-sm space-y-10 relative overflow-hidden">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white">
                                <Layers size={20} />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">2. Unit of Measure</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div>
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Unit Type: *</label>
                                <select
                                    value={formData.uom || ''}
                                    onChange={e => setFormData({ ...formData, uom: e.target.value })}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-6 py-5 text-sm font-bold outline-none cursor-pointer"
                                >
                                    <optgroup label="🛢️ LIQUID MEASURES (Lubricants, Oils, Fluids)">
                                        <option value="Liters">Liters (L)</option>
                                        <option value="Milliliters">Milliliters (ml)</option>
                                        <option value="Quarts">Quarts (qt)</option>
                                        <option value="Gallons">Gallons (gal)</option>
                                        <option value="Fluid Ounces">Fluid Ounces (fl oz)</option>
                                        <option value="Pints">Pints (pt)</option>
                                        <option value="Barrels">Barrels (bbl)</option>
                                    </optgroup>
                                    <optgroup label="⚖️ WEIGHT MEASURES">
                                        <option value="Kilograms">Kilograms (kg)</option>
                                        <option value="Grams">Grams (g)</option>
                                        <option value="Pounds">Pounds (lb)</option>
                                        <option value="Ounces">Ounces (oz)</option>
                                        <option value="Tons">Tons (ton)</option>
                                        <option value="Milligrams">Milligrams (mg)</option>
                                    </optgroup>
                                    <optgroup label="📏 LENGTH MEASURES">
                                        <option value="Meters">Meters (m)</option>
                                        <option value="Centimeters">Centimeters (cm)</option>
                                        <option value="Millimeters">Millimeters (mm)</option>
                                        <option value="Inches">Inches (in)</option>
                                        <option value="Feet">Feet (ft)</option>
                                        <option value="Yards">Yards (yd)</option>
                                    </optgroup>
                                    <optgroup label="🔢 QUANTITY MEASURES">
                                        <option value="Pieces">Pieces (pcs)</option>
                                        <option value="Pairs">Pairs</option>
                                        <option value="Dozen">Dozen</option>
                                        <option value="Set">Set</option>
                                        <option value="Unit">Unit</option>
                                    </optgroup>
                                    <optgroup label="📦 PACKAGING MEASURES">
                                        <option value="Box">Box</option>
                                        <option value="Carton">Carton</option>
                                        <option value="Case">Case</option>
                                        <option value="Pack">Pack</option>
                                        <option value="Bundle">Bundle</option>
                                        <option value="Roll">Roll</option>
                                        <option value="Sheet">Sheet</option>
                                        <option value="Pallet">Pallet</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">
                                    Units per pack:
                                    <InfoTooltip text="Pack size only — e.g. 1 box = 24 bottles. This is NOT your warehouse stock count." />
                                </label>
                                <input
                                    type="number"
                                    value={formData.quantityPerUnit ?? ''}
                                    onChange={e => setFormData({ ...formData, quantityPerUnit: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none"
                                    placeholder="1"
                                />
                                <p className="text-[10px] text-gray-400 mt-2 pl-1">
                                    Not inventory stock — enter opening quantity in section 4, &ldquo;Initial stock (units)&rdquo;.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Catalog</h2>

                        <div>
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Units & packs</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input aria-label="Base unit" className={fieldClass} placeholder={formData.uom || 'unit'} value={formData.baseUnit ?? ''} onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })} />
                                <input aria-label="Pack qty" type="number" className={fieldClass} placeholder="Pack qty" value={formData.packQty ?? ''} onChange={(e) => setFormData({ ...formData, packQty: e.target.value === '' ? undefined : Number(e.target.value) })} />
                                <input aria-label="Pack unit" className={fieldClass} placeholder="Pack unit" value={formData.packUnit ?? ''} onChange={(e) => setFormData({ ...formData, packUnit: e.target.value })} />
                            </div>
                            {isEdit && formData.packCount != null && (
                                <p className="text-sm font-bold text-gray-500 mt-3">= {formData.packCount} packs</p>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between gap-4 mb-4">
                                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Replenishment</h3>
                                {isEdit && id && (
                                    <button
                                        type="button"
                                        data-testid="suggest-reorder"
                                        disabled={suggestLoading}
                                        onClick={async () => {
                                            setSuggestLoading(true);
                                            setSuggestError('');
                                            try {
                                                setSuggestion(await getSuggestSettings(Number(id)));
                                            } catch (err) {
                                                setSuggestion(null);
                                                setSuggestError(err instanceof Error ? err.message : 'Could not load a suggestion.');
                                            } finally {
                                                setSuggestLoading(false);
                                            }
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest text-redwood-brand underline disabled:opacity-50"
                                    >
                                        {suggestLoading ? 'Suggesting…' : 'Suggest'}
                                    </button>
                                )}
                            </div>
                            {isEdit && suggestError && <p className="text-xs font-bold text-red-600 mb-3">{suggestError}</p>}
                            {isEdit && suggestion && (
                                <div data-testid="reorder-suggestion" className="mb-4 p-4 border border-gray-200 rounded-xl bg-gray-50 text-xs text-gray-700 space-y-2">
                                    <p className="font-black">
                                        Suggested reorder point {suggestion.suggested_reorder_point} · reorder qty {suggestion.suggested_reorder_qty}
                                    </p>
                                    <p>
                                        From avg daily {suggestion.avg_daily.toLocaleString(undefined, { maximumFractionDigits: 2 })} · lead time {suggestion.lead_time} days · safety factor {suggestion.safety_factor} · pack qty {suggestion.pack_qty ?? '—'} · window {suggestion.demand_window_days} days
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            data-testid="apply-reorder-suggestion"
                                            onClick={() => setFormData((prev) => ({
                                                ...prev,
                                                reorderPoint: suggestion.suggested_reorder_point,
                                                reorderQty: suggestion.suggested_reorder_qty,
                                            }))}
                                            className="px-3 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Apply
                                        </button>
                                        <span className="text-gray-500">Fills the two fields. Save the product to keep them.</span>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input aria-label="Reorder point" type="number" className={fieldClass} placeholder={minStockHint != null ? String(minStockHint) : 'Reorder point'} value={formData.reorderPoint ?? ''} onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value === '' ? undefined : Number(e.target.value) })} />
                                <input aria-label="Reorder qty" type="number" className={fieldClass} placeholder="Reorder qty" value={formData.reorderQty ?? ''} onChange={(e) => setFormData({ ...formData, reorderQty: e.target.value === '' ? undefined : Number(e.target.value) })} />
                                <input aria-label="Max stock" type="number" className={fieldClass} placeholder="Max stock" value={formData.maxStock ?? ''} onChange={(e) => setFormData({ ...formData, maxStock: e.target.value === '' ? undefined : Number(e.target.value) })} />
                                <input aria-label="Lead time days" type="number" className={fieldClass} placeholder="Lead time days" value={formData.leadTimeDays ?? ''} onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value === '' ? undefined : Number(e.target.value) })} />
                                <select aria-label="Preferred supplier" className={fieldClass} value={formData.preferredSupplierId ?? ''} onChange={(e) => setFormData({ ...formData, preferredSupplierId: e.target.value === '' ? undefined : Number(e.target.value) })}>
                                    <option value="">Preferred supplier</option>
                                    {suppliers.map((supplier) => (
                                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                    ))}
                                </select>
                                <input aria-label="Supplier SKU" className={fieldClass} placeholder="Supplier SKU" value={formData.supplierSku ?? ''} onChange={(e) => setFormData({ ...formData, supplierSku: e.target.value })} />
                                <select
                                    aria-label="Default bin"
                                    className={fieldClass}
                                    value={formData.defaultLocationId ?? ''}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        defaultLocationId: e.target.value === '' ? null : Number(e.target.value),
                                    })}
                                >
                                    <option value="">Default bin</option>
                                    {stockLocations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name} ({loc.path || loc.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Tracking</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex items-center gap-3 text-sm font-bold text-gray-700">
                                    <input type="checkbox" aria-label="Lot tracked" checked={!!formData.lotTracked} onChange={(e) => setFormData({ ...formData, lotTracked: e.target.checked })} />
                                    Lot tracked
                                </label>
                                <label className="flex items-center gap-3 text-sm font-bold text-gray-700">
                                    <input
                                        type="checkbox"
                                        aria-label="Expiry tracked"
                                        checked={!!formData.expiryTracked}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            expiryTracked: e.target.checked,
                                            shelfLifeDays: e.target.checked ? formData.shelfLifeDays : undefined,
                                        })}
                                    />
                                    Expiry tracked
                                </label>
                                <input
                                    aria-label="Shelf life days"
                                    type="number"
                                    disabled={!formData.expiryTracked}
                                    className={fieldClass}
                                    placeholder="Shelf life days"
                                    value={formData.expiryTracked ? (formData.shelfLifeDays ?? '') : ''}
                                    onChange={(e) => setFormData({ ...formData, shelfLifeDays: e.target.value === '' ? undefined : Number(e.target.value) })}
                                />
                                <input aria-label="Hazmat class" className={fieldClass} placeholder="Hazmat class" value={formData.hazmatClass ?? ''} onChange={(e) => setFormData({ ...formData, hazmatClass: e.target.value })} />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Physical</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input aria-label="Weight kg" type="number" className={fieldClass} placeholder="Weight kg" value={formData.weightKg ?? ''} onChange={(e) => setFormData({ ...formData, weightKg: e.target.value === '' ? undefined : Number(e.target.value) })} />
                                <input aria-label="Volume L" type="number" className={fieldClass} placeholder="Volume L" value={formData.volumeL ?? ''} onChange={(e) => setFormData({ ...formData, volumeL: e.target.value === '' ? undefined : Number(e.target.value) })} />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Costing</h3>
                            <select
                                aria-label="Cost method"
                                className={fieldClass}
                                value={formData.costMethod || 'average'}
                                onChange={(e) => setFormData({ ...formData, costMethod: e.target.value as Product['costMethod'] })}
                            >
                                <option value="average">average</option>
                                <option value="fifo">fifo</option>
                                <option value="standard">standard</option>
                            </select>
                        </div>

                        <div>
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Status</h3>
                            <label className="flex items-center gap-3 text-sm font-bold text-gray-700">
                                <input type="checkbox" aria-label="Discontinued" checked={!!formData.isDiscontinued} onChange={(e) => setFormData({ ...formData, isDiscontinued: e.target.checked })} />
                                Discontinued
                            </label>
                            <p className="text-xs text-gray-500 mt-2">Stays in history and reports; hidden from new documents in a later release</p>
                        </div>
                    </div>

                    {/* 3. Pricing & Profit */}
                    <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-sm space-y-10">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                                <DollarSign size={20} />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">3. Pricing & Profit</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-8">
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest block mb-3 pl-1">
                                        Cost <span className="text-red-500">*</span>
                                        <InfoTooltip text="Your cost per unit (what you pay)" />
                                    </label>
                                    <div className="relative">
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 font-black uppercase text-[10px] tracking-widest pointer-events-none">{settings.defaultCurrencyCode}</div>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            aria-label="Cost"
                                            value={formData.pricing?.purchasePriceExWorks ?? ''}
                                            onChange={e => updatePricing({ purchasePriceExWorks: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-lg font-black transition-all outline-none"
                                            placeholder="0"
                                        />
                                    </div>
                                    {isEdit && (
                                        <div className="mt-2 flex flex-wrap items-center gap-3 pl-1 text-[11px] font-bold text-gray-500">
                                            <span>Changing the cost revalues stock on hand and posts a journal.</span>
                                            {id && (
                                                <button type="button" onClick={() => setShowCostHistory(true)} className="text-gray-900 underline">
                                                    Cost history
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest block mb-3 pl-1">
                                        Sell <span className="text-red-500">*</span>
                                        <InfoTooltip text="Your selling price per unit" />
                                    </label>
                                    <div className="relative">
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 font-black uppercase text-[10px] tracking-widest pointer-events-none">{settings.defaultCurrencyCode}</div>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            value={formData.pricing?.sellingPrice ?? ''}
                                            onChange={e => updatePricing({ sellingPrice: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-lg font-black transition-all outline-none"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-50 p-10 rounded-3xl flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-700">
                                    <CheckCircle2 size={120} className="text-emerald-600" />
                                </div>

                                <div>
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Your Net Profit Per Unit</p>
                                    <p className="text-5xl font-black text-emerald-700 tracking-tighter">{formatCurrency(profit)}</p>
                                </div>

                                <div className="w-full bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-emerald-100 flex items-center justify-between">
                                    <div className="text-left">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Profit Margin</p>
                                        <p className="text-2xl font-black text-emerald-700">{profitMargin}%</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                                        Healthy
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Initial Stock / Inventory */}
                    <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-sm space-y-10">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
                                <Warehouse size={20} />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">4. Initial Stock / Inventory</h2>
                        </div>

                        <div className="space-y-10">
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                                <PlusCircle size={14} /> How many units are you adding to each location?
                            </p>

                            {!isEdit && mainLocation && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 space-y-3">
                                    <label className="text-[11px] font-black text-amber-900 uppercase tracking-widest block pl-1">
                                        Initial stock (units)
                                    </label>
                                    <p className="text-[10px] text-amber-800/80 pl-1 leading-relaxed">
                                        Opening quantity for {mainLocation.name || 'Main Warehouse'}. This is saved as product stock on the server — not the same as &ldquo;Units per pack&rdquo; above.
                                    </p>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        value={mainLocation.currentStock ?? ''}
                                        onChange={(e) =>
                                            updateLocation(mainLocation.id, {
                                                currentStock:
                                                    e.target.value === ''
                                                        ? undefined
                                                        : parseInt(e.target.value, 10),
                                            })
                                        }
                                        className="w-full max-w-xs bg-white border-2 border-amber-300 focus:border-amber-500 rounded-2xl px-6 py-4 text-lg font-black outline-none"
                                        placeholder="e.g. 50"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {formData.locations?.map((loc) => {
                                    const locationPanelOpen = openLocationId === loc.id;
                                    const showStockInCard =
                                        isEdit
                                            ? locationPanelOpen
                                            : isMainLocation(loc)
                                              ? false
                                              : locationPanelOpen;

                                    return (
                                    <div key={loc.id} className="bg-gray-50 p-8 rounded-3xl border border-transparent hover:border-gray-200 transition-all">
                                        <button
                                            type="button"
                                            onClick={() => setOpenLocationId((prev) => (prev === loc.id ? '' : loc.id))}
                                            className="w-full flex items-start justify-between gap-2 mb-6 text-left"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white text-[10px] font-black
                                                    ${loc.type === 'Warehouse' ? 'bg-indigo-500' : 'bg-emerald-500'}
                                                `}>
                                                    {(loc.name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter truncate">
                                                        {loc.name || (loc.type === 'Warehouse' ? 'New Warehouse' : 'New Store')}
                                                    </p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                                        {loc.type} {openLocationId === loc.id ? '• Open' : '• Click to edit'}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                        <div className="flex justify-end -mt-3 mb-4">
                                            {!isMainLocation(loc) && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeLocation(loc.id)}
                                                    className="shrink-0 p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white"
                                                    title="Remove store"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                        {showStockInCard && (
                                            <div className="mb-4">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">
                                                    {isMainLocation(loc) ? 'Initial stock (units)' : 'Stock at this location'}
                                                </label>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    min={0}
                                                    value={loc.currentStock ?? ''}
                                                    onChange={(e) =>
                                                        updateLocation(loc.id, {
                                                            currentStock:
                                                                e.target.value === ''
                                                                    ? undefined
                                                                    : parseInt(e.target.value, 10),
                                                        })
                                                    }
                                                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-gray-900"
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}
                                        {locationPanelOpen && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Name:</label>
                                                        <input
                                                            type="text"
                                                            value={loc.name || ''}
                                                            onChange={(e) => updateLocation(loc.id, { name: e.target.value })}
                                                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-gray-900"
                                                            placeholder={loc.type === 'Warehouse' ? 'Warehouse name' : 'Store name'}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Type:</label>
                                                        <select
                                                            value={loc.type}
                                                            onChange={(e) => updateLocation(loc.id, { type: e.target.value as ProductLocation['type'] })}
                                                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-gray-900"
                                                        >
                                                            <option value="Warehouse">Warehouse</option>
                                                            <option value="Store">Store</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Location Address:</label>
                                                    <input
                                                        type="text"
                                                        value={loc.physicalLocation || ''}
                                                        onChange={(e) => updateLocation(loc.id, { physicalLocation: e.target.value })}
                                                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-gray-900"
                                                        placeholder="e.g. Block A, Main Road, City"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Contact:</label>
                                                        <input
                                                            type="text"
                                                            value={loc.contactPhone || ''}
                                                            onChange={(e) => updateLocation(loc.id, { contactPhone: e.target.value })}
                                                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-gray-900"
                                                            placeholder="Phone / contact"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Warehouse Manager:</label>
                                                        <input
                                                            type="text"
                                                            value={loc.assignedTo || ''}
                                                            onChange={(e) => updateLocation(loc.id, { assignedTo: e.target.value })}
                                                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-gray-900"
                                                            placeholder="Manager name"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Reorder Pt:</label>
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        value={loc.reorderPoint ?? ''}
                                                        onChange={e => updateLocation(loc.id, { reorderPoint: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                                                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-amber-500"
                                                        placeholder="10"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-wrap gap-3 justify-start">
                                <button
                                    type="button"
                                    onClick={addStoreLocation}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all"
                                >
                                    <Plus size={16} /> Add store
                                </button>
                                <button
                                    type="button"
                                    onClick={addWarehouseLocation}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all"
                                >
                                    <Plus size={16} /> Add warehouse
                                </button>
                            </div>

                            <div className="bg-gray-900 p-8 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                                        <PlusCircle size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Initial Quantity</p>
                                        <p className="text-3xl font-black text-white tracking-tighter">
                                            {getTotalStockFromLocations(formData.locations)} Units
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Value</p>
                                    <p className="text-3xl font-black text-emerald-400 tracking-tighter">
                                        {formatCurrency(getTotalStockFromLocations(formData.locations) * (formData.pricing?.purchasePriceExWorks || 0))}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. Specifications & Details */}
                    <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-sm space-y-10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white">
                                    <FileText size={20} />
                                </div>
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">5. Specs & Details</h2>
                            </div>
                            <button
                                type="button"
                                onClick={addSpecification}
                                className="relative z-20 px-6 py-3 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all flex items-center gap-2"
                            >
                                <Plus size={14} /> Add specification
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Short Description:</label>
                                <input
                                    type="text"
                                    value={formData.shortDescription || ''}
                                    onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none"
                                    placeholder="Max 100 characters"
                                    maxLength={100}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {formData.specifications?.map((spec, index) => (
                                    <div key={`spec-row-${index}`} className="flex gap-4 items-end">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Label:</label>
                                            <input
                                                type="text"
                                                value={spec.key}
                                                onChange={e => updateSpecification(index, { key: e.target.value })}
                                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-gray-900"
                                                placeholder="e.g. Weight"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Value:</label>
                                            <input
                                                type="text"
                                                value={spec.value}
                                                onChange={e => updateSpecification(index, { value: e.target.value })}
                                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-gray-900"
                                                placeholder="e.g. 5kg"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeSpecification(index)}
                                            className="w-10 h-10 bg-gray-50 text-gray-400 hover:text-red-500 rounded-xl flex items-center justify-center transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {isEdit && id && (
                        <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Barcodes</h2>
                            <p className="text-xs text-gray-500">The primary barcode stays editable only via the main barcode field.</p>
                            {barcodeError && (
                                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-2xl px-4 py-3">{barcodeError}</div>
                            )}
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-widest text-gray-400">
                                        <th>Barcode</th>
                                        <th>Pack qty</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {barcodes.map((row) => (
                                        <tr key={row.id}>
                                            <td className="py-2 font-mono">{row.barcode}</td>
                                            <td>{row.pack_qty ?? ''}</td>
                                            <td>
                                                {row.is_primary ? (
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Primary</span>
                                                ) : (
                                                    <button type="button" aria-label={`Delete barcode ${row.barcode}`} onClick={() => handleDeleteBarcode(row)} className="text-red-600 text-xs font-bold">
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="flex gap-3">
                                <input aria-label="New barcode" className={fieldClass} value={barcodeDraft} onChange={(e) => setBarcodeDraft(e.target.value)} placeholder="Barcode" />
                                <input aria-label="Barcode pack qty" type="number" className={fieldClass} value={barcodePack} onChange={(e) => setBarcodePack(e.target.value)} placeholder="Pack qty" />
                                <button type="button" onClick={handleAddBarcode} className="px-4 py-3 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl">
                                    Add barcode
                                </button>
                            </div>
                        </div>
                    )}
                </div>


                {/* Right Column: Sidebar Actions/Info */}
                <div className="space-y-8">
                    {/* Image Upload */}
                    <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[12px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                <ImageIcon size={18} /> Product Images
                            </h3>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{formData.images?.length || 0}/10</span>
                        </div>

                        <ImageUpload
                            images={formData.images || []}
                            onChange={imgs => setFormData({ ...formData, images: imgs })}
                        />
                    </div>

                    {/* Supplier Info */}
                    <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
                        <h3 className="text-[12px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <Truck size={18} /> Logistics & Supplier
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Primary Supplier:</label>
                                <select className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-[11px] font-black uppercase tracking-widest outline-none cursor-pointer group-hover:bg-white transition-all">
                                    <option>Select Supplier</option>
                                    <option>Al-Mansoori Trading</option>
                                    <option>General Auto Parts</option>
                                    <option>Global Lubricants LLC</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Lead Time:</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.leadTimeDays ?? ''}
                                            onChange={e => setFormData({ ...formData, leadTimeDays: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                                            placeholder="Days"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Min Order Qty:</label>
                                    <input
                                        type="number"
                                        value={formData.minOrderQty ?? ''}
                                        onChange={e => setFormData({ ...formData, minOrderQty: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {costDialogOpen && (
                <div role="dialog" aria-label="Confirm cost change" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Change cost?</h3>
                        <p className="mt-3 text-sm text-gray-700" data-testid="cost-change-summary">
                            Cost {formatCurrency(loadedCost ?? 0)} → {formatCurrency(Number(formData.pricing?.purchasePriceExWorks ?? 0))}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            Saving revalues the stock on hand at the new cost and posts a journal.
                        </p>
                        <label className="mt-4 block text-[11px] font-black uppercase tracking-widest text-gray-500">
                            Reason (optional)
                            <textarea
                                aria-label="Cost change reason"
                                value={costReason}
                                onChange={(e) => setCostReason(e.target.value)}
                                rows={2}
                                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal outline-none focus:border-gray-900"
                            />
                        </label>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setCostDialogOpen(false)}
                                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => {
                                    setCostDialogOpen(false);
                                    void persist(costReason.trim() || undefined);
                                }}
                                className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-widest text-white"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCostHistory && id && (
                <CostHistoryPanel productId={Number(id)} onClose={() => setShowCostHistory(false)} />
            )}
        </div>
    );
}
