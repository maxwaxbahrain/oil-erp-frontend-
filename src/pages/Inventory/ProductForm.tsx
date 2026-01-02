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
    Globe,
    FileText,
    Layers,
    Warehouse,
    MoreHorizontal,
    PlusCircle,
    Trash2,
    Scan,
    RefreshCw,
    Plus
} from 'lucide-react';
import { getProductById, saveProduct, type Product, type ProductLocation, type ProductSpecification } from '../../services/productService';
import { getSystemSettings, formatCurrency } from '../../services/settingsService';
import { ImageUpload } from '../../components/Inventory/ImageUpload';

export default function ProductForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;
    const settings = getSystemSettings();

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<Product>>({
        status: 'Active',
        category: '',
        uom: 'Pieces',
        quantityPerUnit: 1,
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
        wholesalePrice: 0,
        minWholesaleQty: 0,
        locations: [
            { id: 'LOC-001', name: 'Main Warehouse', type: 'Warehouse', currentStock: 0, reorderPoint: 10, maxStock: 500 },
            { id: 'LOC-002', name: 'Van 1', type: 'Van', currentStock: 0, reorderPoint: 5, maxStock: 100 },
            { id: 'LOC-003', name: 'Downtown Store', type: 'Store', currentStock: 0, reorderPoint: 5, maxStock: 200 }
        ],
        images: [],
        specifications: [],
        tags: [],
        seo: {
            metaTitle: '',
            metaDescription: '',
            keywords: ''
        },
        reorderLevel: 10,
        maxStockLevel: 500,
        leadTimeDays: 0,
        minOrderQty: 0
    });

    useEffect(() => {
        if (id) {
            loadProduct(id);
        }
    }, [id]);

    async function loadProduct(prodId: string) {
        try {
            setLoading(true);
            const data = await getProductById(prodId);
            if (data) setFormData(data);
        } catch (error) {
            console.error('Failed to load product:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleSave = async () => {
        if (!formData.name || !formData.category || !formData.sku) {
            alert('Please fill in all required fields (Name, Category, SKU)');
            return;
        }

        try {
            setLoading(true);
            await saveProduct(formData);
            alert('Product saved successfully!');
            navigate('/products');
        } catch (error) {
            console.error('Failed to save product:', error);
            alert('Failed to save product. Please try again.');
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
        setFormData({
            ...formData,
            locations: formData.locations?.map(l => l.id === locId ? { ...l, ...updates } : l)
        });
    };

    const addSpecification = () => {
        const specs = [...(formData.specifications || [])];
        specs.push({ key: '', value: '' });
        setFormData({ ...formData, specifications: specs });
    };

    const updateSpecification = (index: number, updates: Partial<ProductSpecification>) => {
        const specs = [...(formData.specifications || [])];
        specs[index] = { ...specs[index], ...updates };
        setFormData({ ...formData, specifications: specs });
    };

    const removeSpecification = (index: number) => {
        const specs = formData.specifications?.filter((_, i) => i !== index);
        setFormData({ ...formData, specifications: specs });
    };

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
                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/products')}
                        className="px-8 py-4 bg-white border border-gray-200 text-gray-500 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-10 py-4 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:bg-black transition-all shadow-xl disabled:opacity-50"
                    >
                        {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                        Save Product
                    </button>
                </div>
            </div>

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
                                        value={formData.category || ''}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-6 py-5 text-sm font-bold outline-none cursor-pointer"
                                    >
                                        <option value="">Select Category</option>
                                        <option value="Lubricants">Lubricants</option>
                                        <option value="Filters">Filters</option>
                                        <option value="Spare Parts">Spare Parts</option>
                                        <option value="Batteries">Batteries</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1">Brand:</label>
                                    <input
                                        type="text"
                                        value={formData.brand || ''}
                                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none"
                                        placeholder="e.g. Bettano"
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
                                    Qty per Unit:
                                    <InfoTooltip text="For bundled products. Example: 1 Box = 24 pieces" />
                                </label>
                                <input
                                    type="number"
                                    value={formData.quantityPerUnit || ''}
                                    onChange={e => setFormData({ ...formData, quantityPerUnit: parseInt(e.target.value) || 1 })}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-sm font-bold transition-all outline-none"
                                    placeholder="1"
                                />
                            </div>
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
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1 italic">
                                        How much do you BUY it for? *
                                        <InfoTooltip text="The exact cost you pay to your supplier per unit" />
                                    </label>
                                    <div className="relative">
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 font-black uppercase text-[10px] tracking-widest">{settings.defaultCurrencyCode}</div>
                                        <input
                                            type="number"
                                            value={formData.pricing?.purchasePriceExWorks || ''}
                                            onChange={e => updatePricing({ purchasePriceExWorks: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-lg font-black transition-all outline-none"
                                            placeholder=""
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1 italic">
                                            How much do you SELL it for? *
                                            <InfoTooltip text="The price you will charge your customers" />
                                        </label>
                                        <div className="relative">
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 font-black uppercase text-[10px] tracking-widest">{settings.defaultCurrencyCode}</div>
                                            <input
                                                type="number"
                                                value={formData.pricing?.sellingPrice || ''}
                                                onChange={e => updatePricing({ sellingPrice: parseFloat(e.target.value) || 0 })}
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-8 py-5 text-lg font-black transition-all outline-none"
                                                placeholder=""
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1 italic">Wholesale Price:</label>
                                        <input
                                            type="number"
                                            value={formData.wholesalePrice || ''}
                                            onChange={e => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 pl-1 italic">Min Wholesale Qty:</label>
                                        <input
                                            type="number"
                                            value={formData.minWholesaleQty || ''}
                                            onChange={e => setFormData({ ...formData, minWholesaleQty: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-6 py-4 text-sm font-bold outline-none"
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {formData.locations?.map((loc) => (
                                    <div key={loc.id} className="bg-gray-50 p-8 rounded-3xl border border-transparent hover:border-gray-200 transition-all">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black
                                                ${loc.type === 'Warehouse' ? 'bg-indigo-500' : loc.type === 'Van' ? 'bg-amber-500' : 'bg-emerald-500'}
                                            `}>
                                                {loc.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">{loc.name}</p>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{loc.type}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Quantity:</label>
                                                <input
                                                    type="number"
                                                    value={loc.currentStock || ''}
                                                    onChange={e => updateLocation(loc.id, { currentStock: parseInt(e.target.value) || 0 })}
                                                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-gray-900"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Reorder Pt:</label>
                                                <input
                                                    type="number"
                                                    value={loc.reorderPoint || ''}
                                                    onChange={e => updateLocation(loc.id, { reorderPoint: parseInt(e.target.value) || 0 })}
                                                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-amber-500"
                                                    placeholder="10"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-gray-900 p-8 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                                        <PlusCircle size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Initial Quantity</p>
                                        <p className="text-3xl font-black text-white tracking-tighter">
                                            {formData.locations?.reduce((sum, loc) => sum + (loc.currentStock || 0), 0)} Units
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Value</p>
                                    <p className="text-3xl font-black text-emerald-400 tracking-tighter">
                                        {formatCurrency((formData.locations?.reduce((sum, loc) => sum + (loc.currentStock || 0), 0) || 0) * (formData.pricing?.purchasePriceExWorks || 0))}
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
                                onClick={addSpecification}
                                className="px-6 py-3 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all flex items-center gap-2"
                            >
                                <Plus size={14} /> Add Specification
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
                                    <div key={index} className="flex gap-4 items-end">
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
                                            value={formData.leadTimeDays || ''}
                                            onChange={e => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                                            placeholder="Days"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Min Order Qty:</label>
                                    <input
                                        type="number"
                                        value={formData.minOrderQty || ''}
                                        onChange={e => setFormData({ ...formData, minOrderQty: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SEO Settings */}
                    <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
                        <h3 className="text-[12px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <Globe size={18} /> Search Engine (SEO)
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Meta Title:</label>
                                <input
                                    type="text"
                                    value={formData.seo?.metaTitle || ''}
                                    onChange={e => setFormData({ ...formData, seo: { ...formData.seo!, metaTitle: e.target.value } })}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-5 py-3 text-xs font-bold outline-none"
                                    placeholder="Google search title"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Meta Description:</label>
                                <textarea
                                    value={formData.seo?.metaDescription || ''}
                                    onChange={e => setFormData({ ...formData, seo: { ...formData.seo!, metaDescription: e.target.value } })}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-5 py-3 text-xs font-bold outline-none h-24 resize-none"
                                    placeholder="Search description..."
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 pl-1">Keywords:</label>
                                <input
                                    type="text"
                                    value={formData.seo?.keywords || ''}
                                    onChange={e => setFormData({ ...formData, seo: { ...formData.seo!, keywords: e.target.value } })}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-5 py-3 text-xs font-bold outline-none"
                                    placeholder="oil, engine, 15w40"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-gray-900 p-10 rounded-[40px] shadow-2xl space-y-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                            <MoreHorizontal size={120} className="text-white" />
                        </div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest relative z-10">Product Visibility</h3>
                        <div className="space-y-4 relative z-10">
                            <button className="w-full py-4 bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-between px-6">
                                <span>Duplicate Product</span>
                                <Plus size={14} />
                            </button>
                            <button className="w-full py-4 bg-red-500/10 text-red-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-between px-6">
                                <span>Archive Product</span>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
