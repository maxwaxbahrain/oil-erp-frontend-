/**
 * Product Selector Component
 * Allows searching and adding products to van sale
 */

import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { getProducts, type Product } from '../../services/productService';
import type { VanSaleItem } from '../../types/vanSales';

interface ProductSelectorProps {
    items: VanSaleItem[];
    onAddItem: (item: VanSaleItem) => void;
    onRemoveItem: (index: number) => void;
    onUpdateItem: (index: number, item: VanSaleItem) => void;
}

export default function ProductSelector({
    items,
    onAddItem,
    onRemoveItem,
    onUpdateItem
}: ProductSelectorProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);


    // Load products
    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const data = await getProducts();
            setProducts(data);
        } catch (error) {
            console.error('Failed to load products:', error);
        }
    };

    // Filter products based on search
    const filteredProducts = products.filter(product => {
        const search = searchTerm.toLowerCase();
        return (
            product.name.toLowerCase().includes(search) ||
            product.sku?.toLowerCase().includes(search) ||
            product.category?.toLowerCase().includes(search)
        );
    });

    // Add product to items
    const handleSelectProduct = (product: Product) => {
        // Check if product already in list
        const existingIndex = items.findIndex(item => item.product_id === product.id);

        if (existingIndex >= 0) {
            // Increment quantity
            const updatedItem = {
                ...items[existingIndex],
                quantity: items[existingIndex].quantity + 1,
                line_total: (items[existingIndex].quantity + 1) * items[existingIndex].unit_price
            };
            onUpdateItem(existingIndex, updatedItem);
        } else {
            // Add new item
            const newItem: VanSaleItem = {
                product_id: product.id,
                product_name: product.name,
                sku: product.sku || '',
                quantity: 1,
                unit_price: product.pricing?.sellingPrice || 0,
                line_total: product.pricing?.sellingPrice || 0
            };
            onAddItem(newItem);
        }

        // Clear search
        setSearchTerm('');
        setShowDropdown(false);
    };

    // Update item quantity
    const handleQuantityChange = (index: number, newQuantity: number) => {
        if (newQuantity <= 0) {
            onRemoveItem(index);
            return;
        }

        const updatedItem = {
            ...items[index],
            quantity: newQuantity,
            line_total: newQuantity * items[index].unit_price
        };
        onUpdateItem(index, updatedItem);
    };

    // Update item price
    const handlePriceChange = (index: number, newPrice: number) => {
        const updatedItem = {
            ...items[index],
            unit_price: newPrice,
            line_total: items[index].quantity * newPrice
        };
        onUpdateItem(index, updatedItem);
    };

    return (
        <div className="product-selector">
            <div className="section-header">
                <Package className="icon" />
                <h3>Products</h3>
            </div>

            {/* Product Search */}
            <div className="search-container" style={{ position: 'relative', marginBottom: '1rem' }}>
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        placeholder="Search products by name, SKU, or category..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        className="search-input"
                        style={{
                            width: '100%',
                            padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.95rem'
                        }}
                    />
                </div>

                {/* Dropdown */}
                {showDropdown && searchTerm && (
                    <div
                        className="product-dropdown"
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            maxHeight: '300px',
                            overflowY: 'auto',
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            zIndex: 1000,
                            marginTop: '4px'
                        }}
                    >
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    className="product-option"
                                    onClick={() => handleSelectProduct(product)}
                                    style={{
                                        padding: '0.75rem',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid #f0f0f0',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                >
                                    <div style={{ fontWeight: 500 }}>{product.name}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>
                                        SKU: {product.sku || 'N/A'} | Price: ${product.pricing?.sellingPrice?.toFixed(2) || '0.00'}
                                        {product.locations && product.locations.length > 0 && (
                                            <span style={{ marginLeft: '8px', color: product.locations.reduce((sum, loc) => sum + (loc.currentStock ?? 0), 0) > 0 ? '#4caf50' : '#f44336' }}>
                                                Stock: {product.locations.reduce((sum, loc) => sum + (loc.currentStock ?? 0), 0)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
                                No products found
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Items Table */}
            <div className="items-table-container">
                {items.length === 0 ? (
                    <div className="empty-state" style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: '#999',
                        border: '2px dashed #ddd',
                        borderRadius: '4px'
                    }}>
                        <Package size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No products added yet</p>
                        <p style={{ fontSize: '0.9rem' }}>Search and select products above to add them</p>
                    </div>
                ) : (
                    <table className="items-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#8b1538', color: 'white' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left', width: '5%' }}>#</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', width: '35%' }}>Product</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', width: '15%' }}>SKU</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center', width: '12%' }}>Qty</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', width: '15%' }}>Price</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', width: '15%' }}>Total</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center', width: '8%' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '0.75rem' }}>{index + 1}</td>
                                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{item.product_name}</td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#666' }}>
                                        {item.sku || 'N/A'}
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                                            style={{
                                                width: '60px',
                                                padding: '0.4rem',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                textAlign: 'center'
                                            }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.unit_price}
                                            onChange={(e) => handlePriceChange(index, parseFloat(e.target.value) || 0)}
                                            style={{
                                                width: '90px',
                                                padding: '0.4rem',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                textAlign: 'right'
                                            }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                                        ${item.line_total.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                        <button
                                            onClick={() => onRemoveItem(index)}
                                            className="btn-remove"
                                            style={{
                                                padding: '0.4rem',
                                                backgroundColor: '#f44336',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title="Remove item"
                                        >
                                            <X size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`
        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #999;
        }

        .btn-remove:hover {
          background-color: #d32f2f !important;
        }

        .items-table tbody tr:hover {
          background-color: #f9f9f9;
        }

        @media (max-width: 768px) {
          .items-table {
            font-size: 0.85rem;
          }
          
          .items-table th,
          .items-table td {
            padding: 0.5rem !important;
          }
        }
      `}</style>
        </div>
    );
}
