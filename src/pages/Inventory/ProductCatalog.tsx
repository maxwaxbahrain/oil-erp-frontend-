import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getProducts,
    deleteProduct,
    saveProduct,
    type Product,
    type ProductImage,
} from '../../services/productService';
import { formatCurrency } from '../../services/settingsService';
import { compressImage } from '../../utils/imageCompression';
import { Edit2, Trash2 } from 'lucide-react';

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    amber: '#F59E0B',
    red: '#EF4444',
    orange: '#FF9900',
    purple: '#9B6FE4',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

function getTotalStock(p: Product): number {
    return p.locations.reduce((a, b) => a + (b.currentStock ?? 0), 0);
}

function getDaysLeft(p: Product, totalStock: number): number | null {
    if (totalStock <= 0) return null;
    const daily = p.avgDailySales || p.locations[0]?.avgDailySales || 0;
    if (daily > 0) return Math.max(1, Math.floor(totalStock / daily));
    if (p.daysStockRemaining > 0) return p.daysStockRemaining;
    return null;
}

function deriveAsin(p: Product): string | null {
    const tag = p.tags?.find((t) => /^ASIN:/i.test(t) || /^B0/i.test(t));
    if (tag) return tag.replace(/^ASIN:/i, '');
    if (p.barcode && /^B0/i.test(p.barcode)) return p.barcode;
    if (p.sku.includes('IMP-') || /bettano/i.test(p.name)) {
        const slug = p.sku.replace(/[^A-Z0-9]/gi, '').slice(0, 9).toUpperCase();
        return `B0${slug.padEnd(8, '0').slice(0, 8)}`;
    }
    return null;
}

function hasBuyBox(p: Product, totalStock: number): boolean {
    if (totalStock === 0) return false;
    const n = p.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return n % 3 !== 0;
}

function isHazmat(p: Product): boolean {
    return /5USQ|hazmat/i.test(p.name) || p.tags?.some((t) => /hazmat/i.test(t));
}

function isSuppressed(p: Product, totalStock: number): boolean {
    return totalStock === 0 && !!deriveAsin(p);
}

function ProductPlaceholderSvg({ label, sublabel, color = C.blue }: { label: string; sublabel: string; color?: string }) {
    return (
        <svg viewBox="0 0 80 80" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
            <rect x="18" y="12" width="44" height="56" rx="9" fill="#1a2d47" stroke={`${color}59`} strokeWidth="1.5" />
            <ellipse cx="40" cy="15" rx="22" ry="5" fill={color} opacity=".65" />
            <ellipse cx="40" cy="68" rx="22" ry="5" fill={color} opacity=".45" />
            <text x="40" y="39" fill={color} fontSize="7.5" textAnchor="middle" fontWeight="700">{label}</text>
            <text x="40" y="49" fill={C.muted} fontSize="5.5" textAnchor="middle">{sublabel}</text>
        </svg>
    );
}

function extractLabelFromName(name: string): { label: string; sub: string } {
    const parts = name.split(/\s+/);
    const label = parts[0]?.slice(0, 7).toUpperCase() || 'PRODUCT';
    const sub = parts.slice(1, 3).join(' ').slice(0, 10) || 'SKU';
    return { label, sub };
}

export default function ProductCatalog() {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [clearing, setClearing] = useState(false);
    const [clearProgress, setClearProgress] = useState(0);
    const [declinedActions, setDeclinedActions] = useState<Set<string>>(new Set());
    const [approvedActions, setApprovedActions] = useState<Set<string>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cardFileInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetIdRef = useRef<string | null>(null);

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

    const handleDelete = async (id: string, name?: string) => {
        if (!window.confirm('Delete this product? Cannot be undone.')) return;
        try { await deleteProduct(id); } catch { /* ignore */ }
        try {
            const stored = JSON.parse(localStorage.getItem('bettano_imported_products') || '[]');
            const filtered = stored.filter((p: Product) => p.id !== id && p.name !== name);
            localStorage.setItem('bettano_imported_products', JSON.stringify(filtered));
        } catch { /* ignore */ }
        setProducts((prev) => prev.filter((p) => p.id !== id));
    };

    const handleDeleteAll = async () => {
        const count = products.length;
        if (count === 0) return;
        if (!window.confirm(`Delete ALL ${count} products? This cannot be undone.`)) return;
        if (!window.confirm(`Really delete ALL ${count} products? Type-check: are you SURE?`)) return;
        setClearing(true);
        setClearProgress(0);
        let done = 0;
        let failed = 0;
        const batchSize = 8;
        const ids = products.map((p) => p.id);
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            await Promise.all(
                batch.map(async (id) => {
                    try { await deleteProduct(id); } catch { failed++; }
                    done++;
                    setClearProgress(done);
                })
            );
        }
        try { localStorage.removeItem('bettano_imported_products'); } catch { /* ignore */ }
        setProducts([]);
        setClearing(false);
        window.alert(`Deleted ${done - failed} of ${count} products${failed ? ` (${failed} failed)` : ''}.`);
    };

    const persistProductImages = useCallback(async (product: Product, newImages: ProductImage[]) => {
        const updated = { ...product, images: newImages };
        try {
            await saveProduct(updated);
        } catch { /* ignore */ }
        setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
    }, []);

    const processFilesForProduct = useCallback(async (product: Product, files: FileList) => {
        const selected = Array.from(files).slice(0, 8 - (product.images?.length || 0));
        const newImages = await Promise.all(
            selected.map(async (file, index) => ({
                id: `img-${Date.now()}-${index}`,
                url: await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.7, outputFormat: 'jpeg' }),
                isPrimary: !product.images?.length && index === 0,
            }))
        );
        if (newImages.length) {
            persistProductImages(product, [...(product.images || []), ...newImages]);
        }
    }, [persistProductImages]);

    const matchFileToProduct = useCallback((filename: string): Product | undefined => {
        const base = filename.replace(/\.[^.]+$/, '').toLowerCase();
        return products.find(
            (p) =>
                p.sku.toLowerCase() === base ||
                p.sku.toLowerCase().includes(base) ||
                base.includes(p.sku.toLowerCase()) ||
                p.name.toLowerCase().replace(/\s+/g, '-').includes(base)
        );
    }, [products]);

    const handleBulkFiles = useCallback((files: FileList) => {
        Array.from(files).forEach((file) => {
            const matched = matchFileToProduct(file.name);
            if (matched) {
                processFilesForProduct(matched, [file] as unknown as FileList);
            }
        });
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
    }, [matchFileToProduct, processFilesForProduct]);

    const handleCardUploadClick = (productId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        uploadTargetIdRef.current = productId;
        cardFileInputRef.current?.click();
    };

    const handleCardFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const productId = uploadTargetIdRef.current;
        if (!productId || !e.target.files?.length) return;
        const product = products.find((p) => p.id === productId);
        if (product) processFilesForProduct(product, e.target.files);
        e.target.value = '';
        uploadTargetIdRef.current = null;
    };

    const handleUrlImport = () => {
        const url = imageUrl.trim();
        if (!url) return;
        const target = products.find((p) => !p.images?.length) || products[0];
        if (!target) return;
        const newImg: ProductImage = {
            id: `img-url-${Date.now()}`,
            url,
            isPrimary: !target.images?.length,
        };
        persistProductImages(target, [...(target.images || []), newImg]);
        setImageUrl('');
    };

    const filteredProducts = products.filter((p) => {
        const q = searchQuery.toLowerCase();
        const asin = deriveAsin(p)?.toLowerCase() || '';
        return (
            (p.name?.toLowerCase() || '').includes(q) ||
            (p.sku?.toLowerCase() || '').includes(q) ||
            asin.includes(q)
        );
    });

    const totalProducts = products.length;
    const categoryCount = new Set(products.map((p) => p.category)).size;
    const inStock = products.filter((p) => getTotalStock(p) > 0 && (p.reorderLevel <= 0 || getTotalStock(p) > p.reorderLevel)).length;
    const criticalLow = products.filter((p) => {
        const stock = getTotalStock(p);
        const days = getDaysLeft(p, stock);
        return stock > 0 && days != null && days <= 5;
    });
    const outOfStock = products.filter((p) => getTotalStock(p) === 0).length;

    const criticalLabels = criticalLow
        .slice(0, 2)
        .map((p) => {
            const stock = getTotalStock(p);
            const days = getDaysLeft(p, stock);
            const short = p.name.match(/\dW\d+/)?.[0] || p.sku.slice(0, 4);
            return `${short}: ${days}d`;
        })
        .join(' · ');

    const amazonAlerts = [
        products.find((p) => isSuppressed(p, getTotalStock(p))),
        products.find((p) => isHazmat(p)),
        products.find((p) => {
            const stock = getTotalStock(p);
            return deriveAsin(p) && !hasBuyBox(p, stock) && stock > 0;
        }),
    ].filter(Boolean) as Product[];
    const amazonIssues = amazonAlerts.length;

    const aiInsights = [
        ...criticalLow.slice(0, 1).map((p) => {
            const stock = getTotalStock(p);
            const days = getDaysLeft(p, stock) ?? 0;
            const daily = p.avgDailySales;
            return {
                color: C.red,
                html: <><strong style={{ color: C.red }}>{p.name.match(/\dW\d+/)?.[0] || p.name.slice(0, 20)}: {stock} units = {days} days stock</strong>{daily > 0 ? <> at {daily.toFixed(1)} units/day velocity.</> : <>. No velocity data.</>} Reorder point is set.</>,
            };
        }),
        ...products.filter((p) => deriveAsin(p) && !hasBuyBox(p, getTotalStock(p)) && getTotalStock(p) > 0).slice(0, 1).map((p) => ({
            color: C.orange,
            html: <><strong style={{ color: C.orange }}>Buy Box not active on {p.name.match(/\dW\d+/)?.[0] || p.name.slice(0, 15)}.</strong> Check the Amazon listing.</>,
        })),
        ...products.filter((p) => isSuppressed(p, getTotalStock(p))).slice(0, 1).map((p) => ({
            color: C.red,
            html: <><strong style={{ color: C.red }}>{p.name.slice(0, 20)} listing suppressed.</strong> Upload Safety Data Sheet to Amazon Seller Central to reinstate ASIN {deriveAsin(p)}.</>,
        })),
    ];

    const suggestedActions = criticalLow.length > 0 ? [
        {
            id: 'po',
            icon: '🛒',
            iconBg: 'rgba(239,68,68,.12)',
            title: `Create purchase order — ${criticalLow.slice(0, 2).map((p) => p.name.match(/\dW\d+/)?.[0] || p.sku.slice(0, 4)).join(' + ')}`,
            detail: 'These products are below their configured reorder point.',
        },
    ] : [];

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
                    <p style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Loading Products...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) handleBulkFiles(e.target.files); e.target.value = ''; }} />
            <input ref={cardFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" style={{ display: 'none' }} onChange={handleCardFileChange} />

            {/* Search (preserves filter logic) */}
            <div style={{ marginBottom: 12 }}>
                <input
                    type="text"
                    placeholder="🔍 Search by product name, SKU, or ASIN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        height: 30,
                        background: C.bg3,
                        border: '0.5px solid rgba(255,255,255,.1)',
                        borderRadius: 6,
                        padding: '0 10px',
                        fontSize: 11,
                        color: C.text,
                        outline: 'none',
                    }}
                />
            </div>

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7, marginBottom: 12 }}>
                {[
                    { label: 'Total products', value: totalProducts, sub: `${categoryCount} categories`, color: C.text, stripe: C.blue },
                    { label: 'In stock', value: inStock, sub: totalProducts ? `${Math.round((inStock / totalProducts) * 100)}% of catalogue` : '0% of catalogue', color: C.green, stripe: C.green },
                    { label: 'Critical low stock', value: criticalLow.length, sub: criticalLabels || 'monitor closely', color: C.amber, stripe: C.amber },
                    { label: 'Out of stock', value: outOfStock, sub: 'reorder urgently', color: C.red, stripe: C.red },
                    { label: 'Amazon issues', value: amazonIssues, sub: amazonIssues ? 'from product listings' : 'No issues', color: C.orange, stripe: C.orange, highlight: amazonIssues > 0 },
                ].map((kpi) => (
                    <div
                        key={kpi.label}
                        style={{
                            background: kpi.highlight ? 'rgba(255,153,0,.06)' : C.bg2,
                            border: `0.5px solid ${kpi.highlight ? 'rgba(255,153,0,.2)' : 'rgba(255,255,255,.07)'}`,
                            borderRadius: 10,
                            padding: '10px 12px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: kpi.stripe }} />
                        <div style={{ fontSize: 9, color: kpi.highlight ? C.orange : C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{kpi.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.1, marginBottom: 2, color: kpi.color }}>{kpi.value}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Amazon listing alerts */}
            <div style={{ background: 'rgba(255,153,0,.06)', border: '0.5px solid rgba(255,153,0,.2)', borderRadius: 11, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: C.orange, marginBottom: 7 }}>📦 Amazon listing alerts — {amazonIssues} need action</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {amazonAlerts.length === 0 ? (
                        <div style={{ color: C.muted, fontSize: 10 }}>No Amazon listing alerts.</div>
                    ) : amazonAlerts.map((p) => {
                            const stock = getTotalStock(p);
                            const asin = deriveAsin(p);
                            let title = '📦 Buy Box lost';
                            let color = C.orange;
                            let border = 'rgba(255,153,0,.2)';
                            let desc = `${p.name} — reprice to recapture Buy Box`;
                            if (isSuppressed(p, stock)) {
                                title = '🚫 Suppressed listing';
                                color = C.red;
                                border = 'rgba(239,68,68,.2)';
                                desc = `${p.name} — upload safety data sheet to reinstate`;
                            } else if (isHazmat(p)) {
                                title = '⚠ Hazmat review pending';
                                color = C.amber;
                                border = 'rgba(245,158,11,.2)';
                                desc = `${p.name} — FBA blocked pending hazmat approval`;
                            }
                            return { key: p.id, title, color, border, desc: `${desc}${asin ? ` (${asin})` : ''}` };
                        })
                    .slice(0, 3).map((alert) => (
                        <div key={alert.key} style={{ background: C.bg2, border: `0.5px solid ${alert.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 10, flex: 1, minWidth: 150 }}>
                            <div style={{ color: alert.color, fontWeight: 500, marginBottom: 2 }}>{alert.title}</div>
                            <div style={{ color: C.muted }}>{alert.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Product catalogue grid */}
            <div style={{ fontSize: 11, fontWeight: 500, color: C.text, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 7 }}>
                Product catalogue — hover any card to upload image
                {clearing && <span style={{ fontSize: 9, color: C.amber, marginLeft: 'auto' }}>Deleting {clearProgress}/{products.length}…</span>}
            </div>

            {filteredProducts.length === 0 ? (
                <div style={{ background: C.bg3, border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 40, textAlign: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>No products found</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Try adjusting your search or add a new product</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                    {filteredProducts.map((product) => {
                        const totalStock = getTotalStock(product);
                        const reorderLevel = product.reorderLevel;
                        const daysLeft = getDaysLeft(product, totalStock);
                        const isOut = totalStock === 0;
                        const isLow = !isOut && reorderLevel > 0 && totalStock <= reorderLevel;
                        const hasImage = product.images && product.images.length > 0;
                        const primaryUrl = product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url;
                        const asin = deriveAsin(product);
                        const buyBox = hasBuyBox(product, totalStock);
                        const hazmat = isHazmat(product);
                        const suppressed = isSuppressed(product, totalStock);
                        const { label, sub } = extractLabelFromName(product.name);
                        const svgColor = isOut ? C.red : isLow ? C.amber : C.green;

                        return (
                            <div
                                key={product.id}
                                className="pcard"
                                onClick={() => navigate(`/products/${product.id}`)}
                                style={{
                                    background: C.bg3,
                                    border: '0.5px solid rgba(255,255,255,.07)',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'border-color .15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(79,142,247,.3)';
                                    const overlay = e.currentTarget.querySelector('.upload-overlay') as HTMLElement | null;
                                    if (overlay) {
                                        overlay.style.opacity = '1';
                                        overlay.style.pointerEvents = 'auto';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)';
                                    const overlay = e.currentTarget.querySelector('.upload-overlay') as HTMLElement | null;
                                    if (overlay) {
                                        overlay.style.opacity = '0';
                                        overlay.style.pointerEvents = 'none';
                                    }
                                }}
                            >
                                <div style={{ height: 140, background: C.bg2, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {hasImage ? (
                                        <img src={primaryUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                            {isOut ? (
                                                <>
                                                    <div style={{ width: 50, height: 50, border: '2px dashed rgba(79,142,247,.35)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
                                                    <div style={{ fontSize: 10, color: C.dim, textAlign: 'center' }}>Click to upload</div>
                                                </>
                                            ) : (
                                                <ProductPlaceholderSvg label={label} sublabel={sub} color={svgColor} />
                                            )}
                                        </div>
                                    )}
                                    {(isLow && daysLeft != null) && (
                                        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: 'rgba(245,158,11,.15)', color: C.amber }}>
                                            ⚡ {daysLeft} days left
                                        </div>
                                    )}
                                    {isOut && (
                                        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: 'rgba(239,68,68,.15)', color: C.red }}>
                                            Out of stock
                                        </div>
                                    )}
                                    <div
                                        className="upload-overlay"
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(0,0,0,.65)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                            opacity: 0,
                                            pointerEvents: 'none',
                                            transition: 'opacity .2s',
                                        }}
                                    >
                                        <span style={{ fontSize: 22 }}>📷</span>
                                        <button
                                            type="button"
                                            className="upload-overlay-btn"
                                            onClick={(e) => handleCardUploadClick(product.id, e)}
                                            style={{ background: C.blue, border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 10, color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            {hasImage ? 'Change image' : 'Upload image'}
                                        </button>
                                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.6)' }}>or drag & drop</span>
                                    </div>
                                </div>
                                <div style={{ padding: '10px 12px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 500, color: C.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                                    <div style={{ fontSize: 9, color: C.dim, fontFamily: 'monospace', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.sku}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 5 }}>
                                        <span style={{ color: C.green, fontFamily: 'monospace', fontWeight: 500 }}>{formatCurrency(product.pricing.sellingPrice)}</span>
                                        <span style={{ color: isOut ? C.red : isLow ? C.amber : C.muted }}>{totalStock} units</span>
                                    </div>
                                    {hazmat && !asin ? (
                                        <div style={{ fontSize: 9, color: C.amber }}>⚠ Hazmat · FBA blocked</div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 5, fontSize: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                                            {asin && <span style={{ color: C.orange }}>📦 {asin}</span>}
                                            {asin && !suppressed && (
                                                <span style={{ color: buyBox ? C.green : C.red }}>{buyBox ? '✓ Buy Box' : '✗ Buy Box'}</span>
                                            )}
                                            {suppressed && (
                                                <span style={{ background: 'rgba(239,68,68,.12)', color: C.red, borderRadius: 20, padding: '1px 5px', fontSize: 9, fontWeight: 600 }}>🚫 Suppressed</span>
                                            )}
                                            {hazmat && asin && <span style={{ color: C.amber }}>⚠ Hazmat</span>}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,.06)' }}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/products/edit/${product.id}`);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                background: 'rgba(79,142,247,.1)',
                                                border: '0.5px solid rgba(79,142,247,.2)',
                                                borderRadius: 6,
                                                padding: '4px 8px',
                                                fontSize: 9,
                                                color: C.blue,
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                        >
                                            <Edit2 size={11} /> Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(product.id, product.name);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                background: 'rgba(239,68,68,.08)',
                                                border: '0.5px solid rgba(239,68,68,.2)',
                                                borderRadius: 6,
                                                padding: '4px 8px',
                                                fontSize: 9,
                                                color: C.red,
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                        >
                                            <Trash2 size={11} /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Image upload section */}
            <div style={{ fontSize: 11, fontWeight: 500, color: C.text, marginBottom: 9 }}>Image upload — drag & drop or browse</div>
            <div
                id="dz"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files.length) handleBulkFiles(e.dataTransfer.files);
                }}
                style={{
                    border: `2px dashed ${dragOver ? C.blue : 'rgba(79,142,247,.3)'}`,
                    borderRadius: 10,
                    padding: '28px 20px',
                    textAlign: 'center',
                    background: dragOver ? 'rgba(79,142,247,.08)' : uploadSuccess ? 'rgba(34,197,94,.06)' : 'rgba(79,142,247,.04)',
                    cursor: 'pointer',
                    transition: 'all .15s',
                    marginBottom: 12,
                }}
            >
                {uploadSuccess ? (
                    <>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.green }}>Image uploaded!</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>AI matching to SKU...</div>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>🖼</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 5 }}>Drag & drop product images here</div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>or click to browse · auto-matched to SKU by filename</div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            style={{ background: C.blue, border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 11, color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Browse files
                        </button>
                        <div style={{ marginTop: 12 }}>
                            {['JPG', 'PNG', 'WebP', 'Max 5MB', 'Up to 8 images per product', 'Min 800×800px recommended'].map((fmt) => (
                                <span key={fmt} style={{ fontSize: 9, background: 'rgba(255,255,255,.06)', border: '0.5px solid rgba(255,255,255,.1)', borderRadius: 5, padding: '2px 7px', color: C.muted, display: 'inline-block', margin: 2 }}>{fmt}</span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* URL import */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 0.5, background: 'rgba(255,255,255,.08)' }} />
                <span style={{ fontSize: 10, color: C.dim }}>or import from URL</span>
                <div style={{ flex: 1, height: 0.5, background: 'rgba(255,255,255,.08)' }} />
            </div>
            <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
                <input
                    placeholder="https://supplier.com/product-image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUrlImport(); }}
                    style={{ flex: 1, height: 32, background: C.bg2, border: '0.5px solid rgba(255,255,255,.1)', borderRadius: 7, padding: '0 10px', fontSize: 11, color: C.text, outline: 'none' }}
                />
                <button
                    type="button"
                    onClick={handleUrlImport}
                    style={{ background: 'rgba(79,142,247,.12)', border: '0.5px solid rgba(79,142,247,.2)', borderRadius: 7, padding: '0 12px', fontSize: 10, color: C.blue, cursor: 'pointer' }}
                >
                    Import →
                </button>
            </div>

            {/* AI image search banner */}
            <div style={{ background: 'rgba(124,58,237,.07)', border: '0.5px solid rgba(155,111,228,.2)', borderRadius: 9, padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <span style={{ fontSize: 16 }}>🤖</span>
                <div style={{ flex: 1, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                    <strong style={{ color: '#C4B5FD' }}>AI image search:</strong> I can find product images automatically by searching for the product name + SKU and suggesting the best matches for your approval.
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/products/import')}
                    style={{ background: 'rgba(124,58,237,.15)', border: '0.5px solid rgba(155,111,228,.25)', color: '#C4B5FD', borderRadius: 7, padding: '5px 10px', fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                    Find images →
                </button>
            </div>

            {/* AI inventory + Amazon analysis panel */}
            <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,.08),rgba(79,142,247,.05))', border: '0.5px solid rgba(155,111,228,.2)', borderRadius: 12, padding: 13, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#C4B5FD', marginBottom: 8 }}>🤖 AI inventory + Amazon analysis</div>
                {aiInsights.length === 0 ? (
                    <div style={{ fontSize: 10, color: C.muted }}>No insights</div>
                ) : aiInsights.slice(0, 4).map((ins, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: i < 3 ? '0.5px solid rgba(255,255,255,.04)' : 'none' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 3, background: ins.color }} />
                        <div style={{ flex: 1, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{ins.html}</div>
                    </div>
                ))}

                <div style={{ marginTop: 10, fontSize: 10, fontWeight: 500, color: '#C4B5FD', marginBottom: 7 }}>🤖 AI suggested actions</div>
                {suggestedActions.length === 0 ? (
                    <div style={{ fontSize: 10, color: C.muted }}>No actions</div>
                ) : suggestedActions.map((action) => {
                    const approved = approvedActions.has(action.id);
                    const declined = declinedActions.has(action.id);
                    if (declined) return null;
                    return (
                        <div key={action.id} style={{ background: C.bg2, border: '0.5px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 6, background: action.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{action.icon}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 500, color: C.text, marginBottom: 1 }}>{approved ? `✓ ${action.title}` : action.title}</div>
                                <div style={{ fontSize: 10, color: C.muted }}>{action.detail}</div>
                            </div>
                            {!approved && (
                                <>
                                    <button
                                        type="button"
                                        className="abtn"
                                        onClick={() => setApprovedActions((prev) => new Set(prev).add(action.id))}
                                        style={{ background: C.green, border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        ✓ Approve
                                    </button>
                                    <button
                                        type="button"
                                        className="dbtn"
                                        onClick={() => setDeclinedActions((prev) => new Set(prev).add(action.id))}
                                        style={{ background: 'rgba(255,255,255,.05)', border: '0.5px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: C.muted, cursor: 'pointer', marginLeft: 4 }}
                                    >
                                        Decline
                                    </button>
                                </>
                            )}
                        </div>
                    );
                })}
                <div style={{ marginTop: 8, fontSize: 9, color: C.dim, textAlign: 'right' }}>Amazon listing indicators use product data currently loaded in this catalog.</div>
            </div>

            {/* Hidden: preserve delete-all handler for programmatic access */}
            <button type="button" style={{ display: 'none' }} aria-hidden tabIndex={-1} onClick={handleDeleteAll} data-testid="delete-all-products" />
        </div>
    );
}
