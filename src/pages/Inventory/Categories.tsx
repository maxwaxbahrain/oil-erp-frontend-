import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import {
    getCategories,
    saveCategory,
    deleteCategory,
    getProducts,
    saveProduct,
    type Category,
    type Product,
} from '../../services/productService';
import { formatCurrency } from '../../services/settingsService';

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    amber: '#F59E0B',
    orange: '#FF9900',
    purple: '#9B6FE4',
    red: '#EF4444',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

const AMAZON_CATEGORY_MAP: Record<string, string> = {
    Lubricants: 'Automotive > Oils',
    Filters: 'Automotive > Filters',
    'Spare Parts': 'Automotive > Parts',
    Batteries: 'Automotive > Batteries',
};

export interface CategoriesHandle {
    openCreate: () => void;
    runAiAutoCategorise: () => void;
}

interface CategoryStats extends Category {
    productCount: number;
    stockValue: number;
    avgMargin: number;
    inStockCount: number;
}

function getTotalStock(p: Product): number {
    return p.locations.reduce((a, b) => a + (b.currentStock ?? 0), 0);
}

function formatCompactUsd(amount: number): string {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
    return formatCurrency(amount);
}

function isUncategorized(p: Product, categoryNames: Set<string>): boolean {
    const cat = (p.category || '').trim();
    return !cat || cat === 'Uncategorized' || cat === 'Imported' || !categoryNames.has(cat);
}

function isImportedUncategorized(p: Product, categoryNames: Set<string>): boolean {
    const imported = p.tags?.some((t) => /imported/i.test(t)) || p.category === 'Imported';
    return imported && isUncategorized(p, categoryNames);
}

function guessCategory(product: Product, categories: Category[]): string | null {
    const name = product.name.toLowerCase();
    if (/oil|lubric|0w|5w|10w|motor|synthetic/i.test(name)) {
        return categories.find((c) => c.name === 'Lubricants')?.name ?? null;
    }
    if (/filter|air filter|oil filter/i.test(name)) {
        return categories.find((c) => c.name === 'Filters')?.name ?? null;
    }
    if (/battery|batteries/i.test(name)) {
        return categories.find((c) => c.name === 'Batteries')?.name ?? null;
    }
    if (/part|brake|pad|rotor|spark|plug/i.test(name)) {
        return categories.find((c) => c.name === 'Spare Parts')?.name ?? null;
    }
    return null;
}

function hasAmazonMapping(p: Product): boolean {
    return p.tags?.some((t) => /^ASIN:/i.test(t) || /^B0/i.test(t)) || !!(p.barcode && /^B0/i.test(p.barcode));
}

const Categories = forwardRef<CategoriesHandle>(function Categories(_props, ref) {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<CategoryStats[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [viewCategory, setViewCategory] = useState<CategoryStats | null>(null);
    const [assignCategoryId, setAssignCategoryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [aiRunning, setAiRunning] = useState(false);

    const nameRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const iconRef = useRef<HTMLSelectElement>(null);
    const orderRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
        openCreate: () => setIsCreateModalOpen(true),
        runAiAutoCategorise: () => handleAiSortAll(),
    }));

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const [cats, prods] = await Promise.all([getCategories(), getProducts()]);
            setProducts(prods);
            const withStats: CategoryStats[] = cats
                .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
                .map((cat) => {
                    const categoryProducts = prods.filter((p) => p.category === cat.name);
                    const stockValue = categoryProducts.reduce((sum, p) => {
                        const stock = getTotalStock(p);
                        return sum + stock * (p.pricing?.sellingPrice ?? 0);
                    }, 0);
                    const margins = categoryProducts
                        .map((p) => p.grossMarginPercent ?? 0)
                        .filter((m) => m > 0);
                    const avgMargin = margins.length
                        ? margins.reduce((a, b) => a + b, 0) / margins.length
                        : 0;
                    const inStockCount = categoryProducts.filter((p) => getTotalStock(p) > 0).length;
                    return {
                        ...cat,
                        productCount: categoryProducts.length,
                        stockValue,
                        avgMargin,
                        inStockCount,
                    };
                });
            setCategories(withStats);
        } catch (error) {
            console.error('Failed to load categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const categoryNames = new Set(categories.map((c) => c.name));
    const uncategorizedProducts = products.filter((p) => isUncategorized(p, categoryNames));
    const importedUncategorized = products.filter((p) => isImportedUncategorized(p, categoryNames));
    const importedBucket = importedUncategorized.length > 0 ? importedUncategorized : uncategorizedProducts;
    const totalStockValue = products.reduce((sum, p) => {
        const stock = getTotalStock(p);
        return sum + stock * (p.pricing?.sellingPrice ?? 0);
    }, 0);
    const mappedCount = products.filter(
        (p) => !isUncategorized(p, categoryNames) && hasAmazonMapping(p)
    ).length;

    const closeModal = () => {
        setIsCreateModalOpen(false);
        setEditingCategory(null);
    };

    const handleSave = async () => {
        const name = nameRef.current?.value.trim();
        const description = descriptionRef.current?.value.trim();
        const icon = iconRef.current?.value;
        const displayOrder = orderRef.current?.value ? parseInt(orderRef.current.value, 10) : undefined;

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
                displayOrder,
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

    const assignProductsToCategory = async (categoryName: string, targetProducts: Product[]) => {
        if (!targetProducts.length) return;
        setSaving(true);
        try {
            await Promise.all(
                targetProducts.map((p) => saveProduct({ ...p, category: categoryName }))
            );
            await loadCategories();
            setAssignCategoryId(null);
        } catch (error) {
            console.error('Failed to assign products:', error);
            alert('Failed to assign products. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleAiSortAll = async () => {
        if (aiRunning) return;
        const targets = uncategorizedProducts;
        if (!targets.length) {
            alert('No uncategorized products to sort.');
            return;
        }
        if (!confirm(`Run AI sort on ${targets.length} uncategorized product${targets.length === 1 ? '' : 's'}?`)) {
            return;
        }
        setAiRunning(true);
        try {
            const assignments: Product[] = [];
            for (const p of targets) {
                const guessed = guessCategory(p, categories);
                if (guessed) {
                    assignments.push({ ...p, category: guessed });
                }
            }
            if (assignments.length) {
                await Promise.all(assignments.map((p) => saveProduct(p)));
                await loadCategories();
            }
            alert(`AI sorted ${assignments.length} of ${targets.length} products into categories.`);
        } catch (error) {
            console.error('AI sort failed:', error);
            alert('AI sort failed. Please try again.');
        } finally {
            setAiRunning(false);
        }
    };

    const aiInsights = [
        {
            color: C.amber,
            text: (
                <>
                    <strong style={{ color: C.amber }}>{uncategorizedProducts.length} products</strong> have no category
                    assigned — Amazon listings may be suppressed without proper browse node mapping.
                </>
            ),
        },
        {
            color: C.orange,
            text: (
                <>
                    <strong style={{ color: C.orange }}>Imported bucket</strong> contains{' '}
                    {importedBucket.length} product{importedBucket.length === 1 ? '' : 's'} awaiting manual or AI
                    categorisation before FBA sync.
                </>
            ),
        },
        {
            color: C.green,
            text: (
                <>
                    <strong style={{ color: C.green }}>{categories.filter((c) => c.productCount > 0).length} categories</strong>{' '}
                    have products assigned · total catalogue value {formatCompactUsd(totalStockValue)} across{' '}
                    {categories.length} categories.
                </>
            ),
        },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ textAlign: 'center' }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            border: `3px solid ${C.blue}`,
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            margin: '0 auto 12px',
                        }}
                    />
                    <p style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        Loading categories...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Alert bar */}
            {uncategorizedProducts.length > 0 && (
                <div
                    style={{
                        background: 'rgba(245,158,11,.06)',
                        border: '0.5px solid rgba(245,158,11,.35)',
                        borderRadius: 10,
                        padding: '10px 14px',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                    }}
                >
                    <span style={{ fontSize: 11, color: C.amber, fontWeight: 500 }}>
                        {uncategorizedProducts.length} uncategorised product{uncategorizedProducts.length === 1 ? '' : 's'}
                    </span>
                    <button
                        type="button"
                        onClick={handleAiSortAll}
                        disabled={aiRunning}
                        style={{
                            background: 'rgba(155,111,228,.15)',
                            border: '0.5px solid rgba(155,111,228,.35)',
                            borderRadius: 8,
                            padding: '5px 12px',
                            fontSize: 10,
                            color: C.purple,
                            fontWeight: 600,
                            cursor: aiRunning ? 'wait' : 'pointer',
                        }}
                    >
                        🤖 AI sort all →
                    </button>
                </div>
            )}

            {/* Imported bucket */}
            {importedBucket.length > 0 && (
                <div
                    style={{
                        background: C.bg2,
                        border: '1.5px dashed rgba(245,158,11,.35)',
                        borderRadius: 11,
                        padding: '12px 14px',
                        marginBottom: 12,
                    }}
                >
                    <div style={{ fontSize: 11, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                        Imported (uncategorised) — {importedBucket.length} product{importedBucket.length === 1 ? '' : 's'}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>
                        {importedBucket.slice(0, 5).map((p) => p.name).join(' · ')}
                        {importedBucket.length > 5 && ` · +${importedBucket.length - 5} more`}
                    </div>
                    <button
                        type="button"
                        onClick={() => setAssignCategoryId('imported')}
                        style={{
                            background: 'rgba(245,158,11,.12)',
                            border: '0.5px solid rgba(245,158,11,.3)',
                            borderRadius: 8,
                            padding: '6px 14px',
                            fontSize: 10,
                            color: C.amber,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Assign to category →
                    </button>
                </div>
            )}

            {/* Key metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7, marginBottom: 12 }}>
                {[
                    { label: 'Categories', value: categories.length, sub: 'active categories', color: C.text, stripe: C.blue },
                    { label: 'Total stock value', value: formatCompactUsd(totalStockValue), sub: 'across all products', color: C.green, stripe: C.green },
                    { label: 'Uncategorised', value: uncategorizedProducts.length, sub: 'need assignment', color: C.amber, stripe: C.amber },
                    { label: 'Mapped to categories', value: mappedCount, sub: 'Amazon browse nodes', color: C.text, stripe: C.purple },
                ].map((kpi) => (
                    <div
                        key={kpi.label}
                        style={{
                            background: C.bg2,
                            border: '0.5px solid rgba(255,255,255,.07)',
                            borderRadius: 10,
                            padding: '10px 12px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: kpi.stripe }} />
                        <div style={{ fontSize: 9, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>
                            {kpi.label}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.1, marginBottom: 2, color: kpi.color }}>
                            {kpi.value}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Categories grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
                {categories.map((cat) => {
                    const amazonPath = AMAZON_CATEGORY_MAP[cat.name] || `Automotive > ${cat.name}`;
                    return (
                        <div
                            key={cat.id}
                            style={{
                                background: C.bg3,
                                border: '0.5px solid rgba(255,255,255,.07)',
                                borderRadius: 12,
                                padding: '14px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 28 }}>{cat.icon || '📦'}</span>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{cat.name}</div>
                                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2, maxWidth: 220 }}>{cat.description}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    <button
                                        type="button"
                                        onClick={() => setEditingCategory(cat)}
                                        style={{ background: 'none', border: 'none', fontSize: 10, color: C.blue, cursor: 'pointer', padding: 0 }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewCategory(cat)}
                                        style={{ background: 'none', border: 'none', fontSize: 10, color: C.muted, cursor: 'pointer', padding: 0 }}
                                    >
                                        View
                                    </button>
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'inline-flex',
                                    alignSelf: 'flex-start',
                                    background: 'rgba(255,153,0,.1)',
                                    border: '0.5px solid rgba(255,153,0,.25)',
                                    borderRadius: 6,
                                    padding: '3px 8px',
                                    fontSize: 9,
                                    color: C.orange,
                                    fontWeight: 500,
                                    marginBottom: 12,
                                }}
                            >
                                📦 {amazonPath}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                                {[
                                    { label: 'PRODUCTS', value: cat.productCount },
                                    { label: 'STOCK VALUE', value: formatCompactUsd(cat.stockValue) },
                                    { label: 'AVG MARGIN', value: cat.avgMargin ? `${cat.avgMargin.toFixed(1)}%` : '—' },
                                    { label: 'IN STOCK', value: cat.inStockCount },
                                ].map((stat) => (
                                    <div key={stat.label}>
                                        <div style={{ fontSize: 8, color: C.dim, fontWeight: 600, letterSpacing: '.4px', marginBottom: 2 }}>
                                            {stat.label}
                                        </div>
                                        <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{stat.value}</div>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setAssignCategoryId(cat.id)}
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: '1.5px dashed rgba(79,142,247,.35)',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    fontSize: 10,
                                    color: C.blue,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    marginBottom: 12,
                                }}
                            >
                                + Assign products to {cat.name}
                            </button>

                            <div
                                style={{
                                    borderTop: '0.5px solid rgba(255,255,255,.06)',
                                    paddingTop: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginTop: 'auto',
                                }}
                            >
                                <span style={{ fontSize: 9, color: C.dim }}>
                                    Created {new Date(cat.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                {cat.productCount === 0 ? (
                                    <span style={{ fontSize: 9, color: C.amber, fontWeight: 500 }}>⚠️ No products assigned</span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(cat.id, cat.name)}
                                        style={{ background: 'none', border: 'none', fontSize: 9, color: C.red, cursor: 'pointer', padding: 0 }}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* AI Category Analysis */}
            <div
                style={{
                    background: C.bg2,
                    border: '0.5px solid rgba(255,255,255,.07)',
                    borderRadius: 12,
                    padding: '14px 16px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>🤖 AI category analysis</span>
                    {uncategorizedProducts.length > 0 && (
                        <span
                            style={{
                                fontSize: 8,
                                background: 'rgba(245,158,11,.15)',
                                color: C.amber,
                                borderRadius: 20,
                                padding: '2px 8px',
                                fontWeight: 600,
                            }}
                        >
                            Action needed
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {aiInsights.map((insight, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                            <span
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: insight.color,
                                    flexShrink: 0,
                                    marginTop: 4,
                                }}
                            />
                            <span>{insight.text}</span>
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        background: C.bg3,
                        border: '0.5px solid rgba(255,255,255,.07)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                    }}
                >
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: C.text, marginBottom: 2 }}>
                            Suggested action
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>
                            Run AI sort to assign {uncategorizedProducts.length} uncategorised product
                            {uncategorizedProducts.length === 1 ? '' : 's'} to the best-fit categories
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            type="button"
                            onClick={handleAiSortAll}
                            disabled={aiRunning || uncategorizedProducts.length === 0}
                            style={{
                                background: C.purple,
                                border: 'none',
                                borderRadius: 8,
                                padding: '6px 14px',
                                fontSize: 10,
                                color: '#fff',
                                fontWeight: 600,
                                cursor: aiRunning ? 'wait' : 'pointer',
                                opacity: uncategorizedProducts.length === 0 ? 0.5 : 1,
                            }}
                        >
                            Run AI sort
                        </button>
                        <button
                            type="button"
                            onClick={() => setAssignCategoryId('imported')}
                            style={{
                                background: 'transparent',
                                border: '0.5px solid rgba(255,255,255,.12)',
                                borderRadius: 8,
                                padding: '6px 14px',
                                fontSize: 10,
                                color: C.muted,
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            Review first
                        </button>
                    </div>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {(isCreateModalOpen || editingCategory) && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                        background: 'rgba(0,0,0,.6)',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <div
                        style={{
                            background: C.bg2,
                            border: '0.5px solid rgba(255,255,255,.1)',
                            width: '100%',
                            maxWidth: 520,
                            borderRadius: 16,
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                padding: '16px 20px',
                                borderBottom: '0.5px solid rgba(255,255,255,.07)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                                    {editingCategory ? `Edit category: ${editingCategory.name}` : 'Create new category'}
                                </div>
                                <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                                    Organise products into browse-ready categories
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                style={{
                                    width: 32,
                                    height: 32,
                                    background: C.bg3,
                                    border: '0.5px solid rgba(255,255,255,.1)',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: C.muted,
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: 9, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 6 }}>
                                    Category name *
                                </label>
                                <input
                                    ref={nameRef}
                                    type="text"
                                    placeholder="e.g. Lubricants, Filters, Batteries"
                                    defaultValue={editingCategory?.name}
                                    style={{
                                        width: '100%',
                                        background: C.bg3,
                                        border: '0.5px solid rgba(255,255,255,.1)',
                                        borderRadius: 8,
                                        padding: '10px 12px',
                                        fontSize: 11,
                                        color: C.text,
                                        outline: 'none',
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 9, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 6 }}>
                                    Description
                                </label>
                                <textarea
                                    ref={descriptionRef}
                                    placeholder="Brief description of what products go in this category"
                                    defaultValue={editingCategory?.description}
                                    style={{
                                        width: '100%',
                                        background: C.bg3,
                                        border: '0.5px solid rgba(255,255,255,.1)',
                                        borderRadius: 8,
                                        padding: '10px 12px',
                                        fontSize: 11,
                                        color: C.text,
                                        outline: 'none',
                                        height: 80,
                                        resize: 'none',
                                    }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: 9, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 6 }}>
                                        Icon
                                    </label>
                                    <select
                                        ref={iconRef}
                                        defaultValue={editingCategory?.icon || '🏷️'}
                                        style={{
                                            width: '100%',
                                            background: C.bg3,
                                            border: '0.5px solid rgba(255,255,255,.1)',
                                            borderRadius: 8,
                                            padding: '10px 12px',
                                            fontSize: 11,
                                            color: C.text,
                                            outline: 'none',
                                        }}
                                    >
                                        <option value="🏷️">🏷️ Tag</option>
                                        <option value="📦">📦 Box</option>
                                        <option value="🔧">🔧 Tools</option>
                                        <option value="🔋">🔋 Battery</option>
                                        <option value="🛞">🛞 Tire</option>
                                        <option value="🧴">🧴 Oil/Cleaner</option>
                                        <option value="🧰">🧰 Toolkit</option>
                                        <option value="🛢️">🛢️ Drum</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 9, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 6 }}>
                                        Display order
                                    </label>
                                    <input
                                        ref={orderRef}
                                        type="number"
                                        placeholder="1"
                                        defaultValue={editingCategory?.displayOrder}
                                        style={{
                                            width: '100%',
                                            background: C.bg3,
                                            border: '0.5px solid rgba(255,255,255,.1)',
                                            borderRadius: 8,
                                            padding: '10px 12px',
                                            fontSize: 11,
                                            color: C.text,
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '14px 20px', borderTop: '0.5px solid rgba(255,255,255,.07)', display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={saving}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: '0.5px solid rgba(255,255,255,.12)',
                                    borderRadius: 8,
                                    padding: '10px',
                                    fontSize: 10,
                                    color: C.muted,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    flex: 2,
                                    background: C.blue,
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '10px',
                                    fontSize: 10,
                                    color: '#fff',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                {saving ? 'Saving...' : editingCategory ? 'Save changes' : 'Save category'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign products modal */}
            {assignCategoryId && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                        background: 'rgba(0,0,0,.6)',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <div
                        style={{
                            background: C.bg2,
                            border: '0.5px solid rgba(255,255,255,.1)',
                            width: '100%',
                            maxWidth: 440,
                            borderRadius: 16,
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(255,255,255,.07)' }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Assign products to category</div>
                            <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                                {uncategorizedProducts.length} uncategorised product{uncategorizedProducts.length === 1 ? '' : 's'} available
                            </div>
                        </div>
                        <div style={{ padding: '12px 20px', maxHeight: 280, overflowY: 'auto' }}>
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                        const targets = assignCategoryId === 'imported' ? importedBucket : uncategorizedProducts;
                                        assignProductsToCategory(cat.name, targets);
                                    }}
                                    disabled={saving}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        background: C.bg3,
                                        border: '0.5px solid rgba(255,255,255,.07)',
                                        borderRadius: 8,
                                        padding: '10px 12px',
                                        marginBottom: 6,
                                        cursor: saving ? 'wait' : 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{ fontSize: 20 }}>{cat.icon || '📦'}</span>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 500, color: C.text }}>{cat.name}</div>
                                        <div style={{ fontSize: 9, color: C.dim }}>{cat.productCount} products · {formatCompactUsd(cat.stockValue)}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(255,255,255,.07)' }}>
                            <button
                                type="button"
                                onClick={() => setAssignCategoryId(null)}
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: '0.5px solid rgba(255,255,255,.12)',
                                    borderRadius: 8,
                                    padding: '8px',
                                    fontSize: 10,
                                    color: C.muted,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View products modal */}
            {viewCategory && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                        background: 'rgba(0,0,0,.6)',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <div
                        style={{
                            background: C.bg2,
                            border: '0.5px solid rgba(255,255,255,.1)',
                            width: '100%',
                            maxWidth: 480,
                            borderRadius: 16,
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                padding: '16px 20px',
                                borderBottom: '0.5px solid rgba(255,255,255,.07)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                                {viewCategory.icon} {viewCategory.name} — {viewCategory.productCount} products
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewCategory(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: C.muted,
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '12px 20px', maxHeight: 320, overflowY: 'auto' }}>
                            {products.filter((p) => p.category === viewCategory.name).length === 0 ? (
                                <div style={{ fontSize: 11, color: C.dim, textAlign: 'center', padding: '20px 0' }}>
                                    No products assigned yet
                                </div>
                            ) : (
                                products
                                    .filter((p) => p.category === viewCategory.name)
                                    .map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => navigate(`/products/${p.id}`)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '8px 0',
                                                borderBottom: '0.5px solid rgba(255,255,255,.05)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <span style={{ fontSize: 11, color: C.text }}>{p.name}</span>
                                            <span style={{ fontSize: 9, color: C.dim }}>{getTotalStock(p)} units</span>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default Categories;
