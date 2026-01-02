import { useState, useEffect, useRef } from 'react';
import { Search, Package, DollarSign, AlertTriangle, ChevronDown, BarChart3 } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    sku?: string;
    unit_price: number;
    uom?: string;
    stock_quantity?: number;
    reorder_level?: number;
    category?: string;
    image_url?: string;
    description?: string;
}

interface ProductSelectProps {
    products: Product[];
    selectedProduct: Product | null;
    onSelect: (product: Product | null) => void;
    quantity?: number;
    required?: boolean;
    disabled?: boolean;
    showStockWarning?: boolean;
}

export default function ProductSelect({
    products,
    selectedProduct,
    onSelect,
    quantity = 1,
    required = false,
    disabled = false,
    showStockWarning = true
}: ProductSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filter products based on search
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectProduct = (product: Product) => {
        onSelect(product);
        setIsOpen(false);
        setSearchTerm('');
    };

    const getStockStatus = (product: Product) => {
        if (product.stock_quantity === undefined) return null;

        const stock = product.stock_quantity;
        const reorderLevel = product.reorder_level || 0;

        if (stock === 0) {
            return { status: 'out', color: 'bg-rose-100 text-rose-700 border-rose-400', label: 'OUT OF STOCK' };
        } else if (stock <= reorderLevel) {
            return { status: 'low', color: 'bg-orange-100 text-orange-700 border-orange-400', label: 'LOW STOCK' };
        } else if (quantity > stock) {
            return { status: 'insufficient', color: 'bg-rose-100 text-rose-700 border-rose-400', label: 'INSUFFICIENT STOCK' };
        } else {
            return { status: 'ok', color: 'bg-emerald-100 text-emerald-700 border-emerald-400', label: 'IN STOCK' };
        }
    };

    return (
        <div className="space-y-3">
            {/* Label */}
            <label className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Package size={14} />
                Select Product
                {required && <span className="text-[#800020]">*</span>}
            </label>

            {/* Dropdown Button */}
            <div ref={dropdownRef} className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={disabled}
                    className="w-full px-4 py-4 bg-white border-2 border-[#A0522D] rounded-xl text-left font-bold text-gray-900 hover:border-[#800020] focus:border-[#800020] focus:ring-2 focus:ring-[#F4E4E6] outline-none transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="flex items-center gap-3">
                        <Package size={20} className="text-[#800020]" />
                        <span className="text-base">
                            {selectedProduct ? (
                                <span>
                                    {selectedProduct.name}
                                    {selectedProduct.sku && (
                                        <span className="text-sm text-gray-500 ml-2">({selectedProduct.sku})</span>
                                    )}
                                </span>
                            ) : (
                                'Select a product...'
                            )}
                        </span>
                    </span>
                    <ChevronDown
                        size={20}
                        className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                {/* Selected Product Details */}
                {selectedProduct && (
                    <div className="mt-3 bg-gradient-to-r from-[#F4E4E6] to-[#E8D5D8] border-2 border-[#A0522D] rounded-xl p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Price */}
                            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                <div className="text-xs font-bold text-gray-500 uppercase mb-1">Unit Price</div>
                                <div className="text-2xl font-black text-[#800020] flex items-center gap-2">
                                    <DollarSign size={20} />
                                    {selectedProduct.unit_price.toFixed(2)}
                                </div>
                                {selectedProduct.uom && (
                                    <div className="text-xs font-medium text-gray-600 mt-1">per {selectedProduct.uom}</div>
                                )}
                            </div>

                            {/* Stock */}
                            {selectedProduct.stock_quantity !== undefined && (
                                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Available Stock</div>
                                    <div className="text-2xl font-black text-gray-900 flex items-center gap-2">
                                        <BarChart3 size={20} />
                                        {selectedProduct.stock_quantity}
                                    </div>
                                    {selectedProduct.uom && (
                                        <div className="text-xs font-medium text-gray-600 mt-1">{selectedProduct.uom}</div>
                                    )}
                                </div>
                            )}

                            {/* Stock Status Badge */}
                            {showStockWarning && selectedProduct.stock_quantity !== undefined && (
                                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 flex items-center justify-center">
                                    {(() => {
                                        const stockStatus = getStockStatus(selectedProduct);
                                        return stockStatus ? (
                                            <div className={`px-4 py-2 rounded-lg text-sm font-black uppercase border-2 ${stockStatus.color}`}>
                                                {stockStatus.label}
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Stock Warning */}
                        {showStockWarning && selectedProduct.stock_quantity !== undefined &&
                            quantity > selectedProduct.stock_quantity && (
                                <div className="mt-4 bg-rose-100 border-2 border-rose-400 rounded-lg p-4 flex items-start gap-3">
                                    <AlertTriangle className="text-rose-700 flex-shrink-0" size={20} />
                                    <div>
                                        <h4 className="text-sm font-black text-rose-900 uppercase">Insufficient Stock</h4>
                                        <p className="text-xs font-medium text-rose-700 mt-1">
                                            Requested quantity ({quantity}) exceeds available stock ({selectedProduct.stock_quantity}).
                                            Please reduce quantity or check with warehouse.
                                        </p>
                                    </div>
                                </div>
                            )}
                    </div>
                )}

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white border-2 border-[#A0522D] rounded-xl shadow-2xl max-h-[500px] overflow-hidden">
                        {/* Search Box */}
                        <div className="p-4 border-b-2 border-gray-200 bg-gray-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by name, SKU, or category..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-[#800020] focus:ring-2 focus:ring-[#F4E4E6] outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Product List */}
                        <div className="overflow-y-auto max-h-96">
                            {filteredProducts.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Package size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-sm font-bold text-gray-500">No products found</p>
                                    <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                                </div>
                            ) : (
                                <div className="p-2">
                                    {filteredProducts.map((product) => {
                                        const stockStatus = getStockStatus(product);
                                        const isOutOfStock = product.stock_quantity === 0;

                                        return (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => handleSelectProduct(product)}
                                                disabled={isOutOfStock}
                                                className={`w-full p-4 text-left rounded-lg transition-all group border-2 mb-2 ${isOutOfStock
                                                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                                                        : 'hover:bg-[#F4E4E6] border-transparent hover:border-[#A0522D]'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    {/* Product Image or Icon */}
                                                    <div className="flex-shrink-0">
                                                        {product.image_url ? (
                                                            <img
                                                                src={product.image_url}
                                                                alt={product.name}
                                                                className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300"
                                                            />
                                                        ) : (
                                                            <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-gray-300">
                                                                <Package size={32} className="text-gray-400" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Product Details */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className={`text-base font-black ${isOutOfStock
                                                                        ? 'text-gray-500'
                                                                        : 'text-gray-900 group-hover:text-[#800020]'
                                                                    } transition-colors truncate`}>
                                                                    {product.name}
                                                                </h4>
                                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                    {product.sku && (
                                                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                                            SKU: {product.sku}
                                                                        </span>
                                                                    )}
                                                                    {product.category && (
                                                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                                            {product.category}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Price */}
                                                            <div className="text-right ml-4">
                                                                <div className="text-lg font-black text-[#800020]">
                                                                    ${product.unit_price.toFixed(2)}
                                                                </div>
                                                                {product.uom && (
                                                                    <div className="text-xs font-medium text-gray-500">
                                                                        per {product.uom}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Stock and Status */}
                                                        <div className="flex items-center gap-3 mt-2">
                                                            {product.stock_quantity !== undefined && (
                                                                <div className="flex items-center gap-2 text-xs">
                                                                    <BarChart3 size={14} className="text-gray-500" />
                                                                    <span className="font-bold text-gray-700">
                                                                        Stock: {product.stock_quantity} {product.uom || 'units'}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {stockStatus && (
                                                                <span className={`px-2 py-1 rounded text-xs font-black border ${stockStatus.color}`}>
                                                                    {stockStatus.label}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Description */}
                                                        {product.description && (
                                                            <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                                                                {product.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer with product count */}
                        <div className="p-3 border-t-2 border-gray-200 bg-gray-50">
                            <p className="text-xs font-bold text-gray-600 text-center">
                                Showing {filteredProducts.length} of {products.length} products
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
