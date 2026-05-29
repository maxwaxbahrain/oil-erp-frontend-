import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracking } from '../../hooks/useTracking';
import ProductCatalog from './ProductCatalog';
import Categories, { type CategoriesHandle } from './Categories';
import LowStockAlerts from './LowStockAlerts';
import StockAdjustmentManager from './StockAdjustmentManager';
import { getProducts, type Product } from '../../services/productService';

type TabType = 'Products' | 'Categories' | 'Stock Adjustment' | 'Low Stock' | 'Amazon Listings';

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    blue: '#4F8EF7',
    orange: '#FF9900',
    red: '#EF4444',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

function getTotalStock(p: Product): number {
    return p.locations.reduce((a, b) => a + (b.currentStock ?? 0), 0);
}

export default function ProductManagement() {
    const navigate = useNavigate();
    const { trackPage } = useTracking();
    useEffect(() => { trackPage('inventory'); }, [trackPage]);
    const categoriesRef = useRef<CategoriesHandle>(null);
    const [activeTab, setActiveTab] = useState<TabType>('Products');
    const [lowStockCount, setLowStockCount] = useState(0);
    const amazonIssueCount = 0;
    const isCategoriesTab = activeTab === 'Categories';

    useEffect(() => {
        getProducts().then((products) => {
            const count = products.filter((p) => {
                const stock = getTotalStock(p);
                const reorder = p.reorderLevel;
                return stock === 0 || (reorder > 0 && stock > 0 && stock <= reorder);
            }).length;
            setLowStockCount(count);
        }).catch(() => setLowStockCount(0));
    }, []);

    const handleTabClick = (tab: TabType) => {
        if (tab === 'Amazon Listings') {
            navigate('/amazon');
            return;
        }
        setActiveTab(tab);
    };

    const tabs: { id: TabType; label: string; badge?: number; badgeColor?: string; accent?: boolean }[] = [
        { id: 'Products', label: 'All products' },
        { id: 'Categories', label: 'Categories' },
        { id: 'Stock Adjustment', label: 'Stock adjustment' },
        { id: 'Low Stock', label: 'Low stock alerts', badge: lowStockCount, badgeColor: C.red },
        { id: 'Amazon Listings', label: '📦 Amazon listings', badge: amazonIssueCount, badgeColor: C.orange, accent: true },
    ];

    return (
        <div
            style={{
                background: C.bg,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,.07)',
                fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                fontSize: 12,
                color: C.text,
            }}
        >
            {/* Page Header */}
            <div style={{ background: C.bg2, borderBottom: '1px solid rgba(255,255,255,.07)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 9,
                                background: 'rgba(79,142,247,.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 18,
                            }}
                        >
                            {isCategoriesTab ? '🏷️' : '📦'}
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 500, color: C.text }}>Product management</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                                {isCategoriesTab
                                    ? 'Categories · Amazon browse nodes · AI auto-sort · product assignment'
                                    : 'Products · image upload · prices · stock · Amazon ASIN · FBA inventory · listing status'}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {isCategoriesTab ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => categoriesRef.current?.runAiAutoCategorise()}
                                    style={{
                                        background: 'transparent',
                                        border: '0.5px solid rgba(255,255,255,.12)',
                                        borderRadius: 8,
                                        padding: '5px 10px',
                                        fontSize: 10,
                                        color: C.muted,
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✨ AI auto-categorise
                                </button>
                                <button
                                    type="button"
                                    onClick={() => categoriesRef.current?.openCreate()}
                                    style={{
                                        background: C.blue,
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '6px 12px',
                                        fontSize: 11,
                                        color: '#fff',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    + New category
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => navigate('/products/import')}
                                    style={{
                                        background: 'transparent',
                                        border: '0.5px solid rgba(255,255,255,.12)',
                                        borderRadius: 8,
                                        padding: '5px 10px',
                                        fontSize: 10,
                                        color: C.muted,
                                        cursor: 'pointer',
                                    }}
                                >
                                    ⚡ AI import
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/amazon')}
                                    style={{
                                        background: 'transparent',
                                        border: '0.5px solid rgba(255,255,255,.12)',
                                        borderRadius: 8,
                                        padding: '5px 10px',
                                        fontSize: 10,
                                        color: C.muted,
                                        cursor: 'pointer',
                                    }}
                                >
                                    📦 Sync Amazon
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/products/new')}
                                    style={{
                                        background: C.blue,
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '6px 12px',
                                        fontSize: 11,
                                        color: '#fff',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    + Add product
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div
                style={{
                    background: C.bg2,
                    borderBottom: '1px solid rgba(255,255,255,.07)',
                    padding: '0 14px',
                    display: 'flex',
                    flexWrap: 'wrap',
                }}
            >
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabClick(tab.id)}
                            style={{
                                fontSize: 10,
                                color: isActive ? C.blue : tab.accent ? C.orange : C.dim,
                                padding: '7px 10px',
                                borderBottom: `2px solid ${isActive ? C.blue : 'transparent'}`,
                                cursor: 'pointer',
                                fontWeight: 500,
                                background: 'transparent',
                                border: 'none',
                                borderBottomWidth: 2,
                                borderBottomStyle: 'solid',
                                borderBottomColor: isActive ? C.blue : 'transparent',
                            }}
                        >
                            {tab.label}
                            {tab.badge != null && tab.badge > 0 && (
                                <span
                                    style={{
                                        fontSize: 8,
                                        background: tab.badgeColor === C.orange ? 'rgba(255,153,0,.15)' : 'rgba(239,68,68,.15)',
                                        color: tab.badgeColor,
                                        borderRadius: 20,
                                        padding: '1px 5px',
                                        marginLeft: 3,
                                    }}
                                >
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div style={{ padding: '12px 16px', background: C.bg }}>
                {activeTab === 'Products' && <ProductCatalog />}
                {activeTab === 'Categories' && <Categories ref={categoriesRef} />}
                {activeTab === 'Stock Adjustment' && <StockAdjustmentManager />}
                {activeTab === 'Low Stock' && <LowStockAlerts />}
            </div>
        </div>
    );
}
