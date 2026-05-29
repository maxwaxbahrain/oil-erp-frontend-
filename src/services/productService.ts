export interface ProductLocation {
    id: string;
    name: string;
    type: 'Warehouse' | 'Van' | 'Store' | 'Retail';
    currentStock?: number;
    reorderPoint?: number;
    maxStock?: number;
    physicalLocation?: string;
    assignedTo?: string;
    contactPhone?: string;
    avgDailySales?: number;
    lastRestocked?: string;
    todaySales?: number;
}

export interface DetailedPricing {
    purchasePriceExWorks: number;
    freightShipping: number;
    importDuty: number;
    otherDirectCosts: number;
    landedCost: number;
    operatingExpenseAllocation: number;
    sellingPrice: number;
    taxRate: number;
    taxIncluded: boolean;
}

export interface SalesMetrics {
    period: '7d' | '30d' | '90d' | 'YTD';
    unitsSold: number;
    revenue: number;
    grossProfit: number;
    netProfit: number;
    growthVsPrevious: number;
}

export interface ProductImage {
    id: string;
    url: string;
    isPrimary: boolean;
}

export interface ProductSpecification {
    key: string;
    value: string;
}


import { getOilErpApiBase } from '../config/apiBase';

export interface Product {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    category: string;
    subCategory?: string;
    brand?: string;
    status: 'Active' | 'Inactive' | 'Draft';
    description: string;
    shortDescription?: string;
    uom: string;
    quantityPerUnit?: number;

    // Performance Metrics (Calculated or Mocked)
    velocityStatus: 'Fast' | 'Medium' | 'Slow' | 'Dead';
    salesVelocity: number; // units per month
    salesTrend: number; // percentage change
    revenueContribution: number; // percentage of total
    grossMarginPercent: number;
    netProfitPerUnit: number;

    // Inventory Intelligence
    locations: ProductLocation[];
    avgDailySales: number;
    daysStockRemaining: number;
    reorderLevel: number;
    overstockRisk: 'Low' | 'Medium' | 'High';
    maxStockLevel?: number;

    // Pricing
    pricing: DetailedPricing;
    wholesalePrice?: number;
    minWholesaleQty?: number;
    priceHistory: { date: string; cost: number; selling: number }[];

    // Images
    images: ProductImage[];

    // AI Settings & Insights
    aiEnabled: boolean;
    aiDemandPrediction: number;
    aiConfidenceLevel: number;
    aiPricingSuggestion?: number;
    aiActionRequired?: string;

    // Additional Details
    leadTimeDays: number;
    minOrderQty: number;
    weight?: number;
    dimensions?: { l: number; w: number; h: number };
    specifications: ProductSpecification[];

    // Supplier
    primarySupplierId?: string;
    primarySupplierName?: string;
    supplierProductCode?: string;
    supplierReliabilityScore?: number;

    tags: string[];
    seo: {
        metaTitle: string;
        metaDescription: string;
        keywords: string;
    };

    // Loss & Returns
    leakageRate: number; // percentage
    returnRate: number; // percentage
}

function apiUrl(path: string): string {
    const base = getOilErpApiBase().replace(/\/$/, '');
    const p = path.replace(/^\//, '');
    return `${base}/${p}`;
}

function num(v: unknown, fallback = 0): number {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    const n = parseFloat(String(v ?? ''));
    return Number.isNaN(n) ? fallback : n;
}

function parseProductsJson(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    if (payload && typeof payload === 'object') {
        const o = payload as Record<string, unknown>;
        const inner = o.items ?? o.data ?? o.results ?? o.products;
        if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    }
    return [];
}

/** Map FastAPI product row to the rich `Product` shape used by the catalog UI. */
function mapApiProductToProduct(raw: Record<string, unknown>): Product {
    const id = String(raw.id ?? '');
    const name = raw.name != null ? String(raw.name) : '';
    const sku = raw.sku != null ? String(raw.sku) : '';
    const category = raw.category != null ? String(raw.category) : 'Uncategorized';
    const description = raw.description != null ? String(raw.description) : '';
    const stock = num(raw.stock);
    const minStock = num(raw.min_stock);
    const price = num(raw.price);
    const cost = num(raw.cost, price);
    const unit = raw.unit != null ? String(raw.unit) : '';
    const barcode = raw.barcode != null ? String(raw.barcode) : undefined;
    const isActive = raw.is_active !== false;

    return {
        id,
        name,
        sku,
        barcode,
        category,
        status: isActive ? 'Active' : 'Inactive',
        description,
        shortDescription: description.slice(0, 120),
        uom: unit || 'unit',
        velocityStatus: 'Medium',
        salesVelocity: 0,
        salesTrend: 0,
        revenueContribution: 0,
        grossMarginPercent: 0,
        netProfitPerUnit: 0,
        locations: [
            {
                id: 'LOC-WH-001',
                name: 'Main Warehouse',
                type: 'Warehouse',
                currentStock: stock,
                reorderPoint: minStock,
                maxStock: Math.max(stock * 2, minStock * 2, 100),
            },
        ],
        avgDailySales: 0,
        daysStockRemaining: 0,
        reorderLevel: minStock,
        overstockRisk: 'Low',
        pricing: {
            purchasePriceExWorks: 0,
            freightShipping: 0,
            importDuty: 0,
            otherDirectCosts: 0,
            landedCost: cost,
            operatingExpenseAllocation: 0,
            sellingPrice: price,
            taxRate: 0,
            taxIncluded: false,
        },
        priceHistory: [],
        images: [],
        aiEnabled: false,
        aiDemandPrediction: 0,
        aiConfidenceLevel: 0,
        leadTimeDays: 0,
        minOrderQty: 0,
        specifications: [],
        tags: [],
        seo: {
            metaTitle: name,
            metaDescription: description,
            keywords: `${sku},${category}`,
        },
        leakageRate: 0,
        returnRate: 0,
    };
}

const PRODUCTS_KEY = 'zavi_products';

const getInitialProducts = (): Product[] => {
    const stored = localStorage.getItem(PRODUCTS_KEY);
    if (stored) return JSON.parse(stored);

    // Fallback to initial mocks if nothing in storage
    const initialMocks: Product[] = [
        {
            id: '1',
            name: 'Soltol 15W40',
            sku: 'BET-1540',
            barcode: '123456789012',
            category: 'Lubricants',
            subCategory: 'Motor Oil',
            brand: 'Soltol',
            status: 'Active',
            description: 'Premium quality diesel engine oil designed to provide excellent lubrication.',
            shortDescription: 'Premium diesel engine oil',
            uom: 'Liters',
            quantityPerUnit: 1,
            velocityStatus: 'Fast',
            salesVelocity: 450,
            salesTrend: 15,
            revenueContribution: 20.8,
            grossMarginPercent: 32,
            netProfitPerUnit: 350,
            avgDailySales: 15,
            daysStockRemaining: 30,
            reorderLevel: 150,
            overstockRisk: 'Low',
            pricing: {
                purchasePriceExWorks: 950,
                freightShipping: 35,
                importDuty: 25,
                otherDirectCosts: 10,
                landedCost: 1020,
                operatingExpenseAllocation: 130,
                sellingPrice: 1500,
                taxRate: 17,
                taxIncluded: false
            },
            priceHistory: [
                { date: '2023-10-01', cost: 950, selling: 1450 },
                { date: '2023-11-01', cost: 980, selling: 1450 },
                { date: '2023-12-01', cost: 1020, selling: 1500 }
            ],
            images: [
                { id: 'img-1', url: 'https://images.unsplash.com/photo-1620921653148-22c60800b73e?q=80&w=800&auto=format&fit=crop', isPrimary: true }
            ],
            aiEnabled: true,
            aiDemandPrediction: 520,
            aiConfidenceLevel: 87,
            aiPricingSuggestion: 1545,
            aiActionRequired: 'REORDER NOW: Stock will finish in 28 days.',
            locations: [
                { id: 'LOC-001', name: 'Main Warehouse', type: 'Warehouse', currentStock: 280, reorderPoint: 150, maxStock: 1000, physicalLocation: 'Aisle A-12', avgDailySales: 8 },
                { id: 'LOC-002', name: 'Van 1 - Downtown', type: 'Van', currentStock: 85, reorderPoint: 40, maxStock: 150, assignedTo: 'Ahmed Khan', avgDailySales: 12 },
                { id: 'LOC-003', name: 'Main Store', type: 'Store', currentStock: 60, reorderPoint: 30, maxStock: 200, avgDailySales: 3 }
            ],
            leadTimeDays: 7,
            minOrderQty: 200,
            specifications: [
                { key: 'Weight', value: '0.9kg' },
                { key: 'Color', value: 'Amber' }
            ],
            primarySupplierName: 'Soltol International Trading LLC',
            supplierProductCode: 'B-1540-X',
            supplierReliabilityScore: 4.8,

            tags: ['Premium', 'Diesel', 'Soltol'],
            seo: {
                metaTitle: 'Soltol 15W40 Engine Oil | Premium Lubricant',
                metaDescription: 'Buy Soltol 15W40 engine oil for heavy duty diesel engines. High performance lubrication.',
                keywords: 'engine oil, diesel oil, bettano, 15w40'
            },
            leakageRate: 3.0,
            returnRate: 0.4
        }
    ];
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(initialMocks));
    return initialMocks;
};

export const IMPORTED_PRODUCTS_KEY = 'bettano_imported_products';

export function getImportedProducts(): Product[] {
    try {
        const raw = localStorage.getItem(IMPORTED_PRODUCTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveImportedProduct(product: Product): void {
    const existing = getImportedProducts();
    const idx = existing.findIndex(p => p.name.toLowerCase() === product.name.toLowerCase());
    if (idx >= 0) {
        // Update stock
        existing[idx] = { ...existing[idx], ...product };
    } else {
        existing.unshift(product);
    }
    localStorage.setItem(IMPORTED_PRODUCTS_KEY, JSON.stringify(existing));
}

export async function getProducts(): Promise<Product[]> {
    // Always get localStorage imported products first (persists across deploys)
    const imported = getImportedProducts();

    try {
        const response = await fetch(apiUrl('products/'), { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json().catch(() => null);
        const backendProducts = parseProductsJson(payload).map(mapApiProductToProduct);

        // Merge: backend first, then imported products not in backend
        const backendNames = new Set(backendProducts.map(p => p.name.toLowerCase()));
        const extraImported = imported.filter(p => !backendNames.has(p.name.toLowerCase()));
        return [...backendProducts, ...extraImported];
    } catch {
        // Backend unavailable - return imported products
        return imported;
    }
}

export async function getProductById(id: string): Promise<Product | undefined> {
    // Check localStorage imported products first (always available)
    const imported = getImportedProducts();
    const localProduct = imported.find(p => p.id === id || String(p.id) === String(id));

    // Try backend
    try {
        const response = await fetch(apiUrl(`products/${encodeURIComponent(id)}`), { cache: 'no-store' });
        if (response.ok) {
            const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
            if (raw && typeof raw === 'object') {
                const backendProduct = mapApiProductToProduct(raw);
                // Merge: backend data + localStorage pricing/supplier info
                if (localProduct) {
                    return {
                        ...localProduct,
                        ...backendProduct,
                        pricing: localProduct.pricing,
                        primarySupplierName: localProduct.primarySupplierName,
                        description: localProduct.description || backendProduct.description,
                    };
                }
                return backendProduct;
            }
        }
    } catch { /* backend unavailable */ }

    // Fall back to localStorage
    if (localProduct) return localProduct;

    // Try old PRODUCTS_KEY (demo products)
    try {
        const stored = localStorage.getItem(PRODUCTS_KEY);
        const products: Product[] = stored ? JSON.parse(stored) : [];
        return products.find(p => p.id === id);
    } catch { return undefined; }
}

export async function saveProduct(product: Partial<Product>): Promise<Product> {
    // Translate the nested frontend form shape to the flat backend Product schema.
    // Backend `ProductUpdate` / `ProductCreate` accepts only these flat keys
    // (see app/schemas/product.py on bettano-erp-backend). Every other rich
    // field on the frontend `Product` type — locations, pricing, specifications,
    // images, tags, seo, … — is UI-only and stays in the localStorage cache.
    const backendPayload = {
        name: product.name ?? '',
        sku: product.sku ?? '',
        category: product.category ?? '',
        description: product.description ?? product.shortDescription ?? '',
        price: Number(product.pricing?.sellingPrice ?? 0),
        cost: Number(product.pricing?.landedCost ?? 0),
        stock: Number((product.locations ?? []).reduce((sum, loc) => sum + (Number(loc?.currentStock) || 0), 0)),
        min_stock: Number(
            product.locations?.[0]?.reorderPoint ?? product.reorderLevel ?? 0,
        ),
        unit: product.uom ?? 'pcs',
        barcode: product.barcode ?? null,
        is_active: product.status === 'Active',
    };

    // Hit the backend FIRST. If it fails, throw — the form's catch block
    // will surface the real error instead of showing a fake success alert.
    const hasId = product.id != null && String(product.id) !== '';
    const url = hasId
        ? apiUrl(`products/${encodeURIComponent(String(product.id))}`)
        : apiUrl('products/');
    const method = hasId ? 'PUT' : 'POST';

    const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload),
    });
    if (!resp.ok) {
        let detail = '';
        try { detail = await resp.text(); } catch { /* ignore */ }
        throw new Error(
            `Backend ${resp.status} on ${method} /products` +
                (detail ? `: ${detail.slice(0, 200)}` : ''),
        );
    }

    type BackendRow = {
        id: number | string;
        stock?: number;
        price?: number;
        cost?: number;
        min_stock?: number;
        unit?: string;
        is_active?: boolean;
    };
    const serverRow = (await resp.json()) as BackendRow;
    const serverId = String(serverRow.id);

    // Build the rich local product to cache. Authoritative scalar fields come
    // from the server response; nested UI-only fields are preserved from input.
    const savedProduct: Product = {
        ...product,
        id: serverId,
        status: serverRow.is_active === false ? 'Inactive' : (product.status ?? 'Active'),
        velocityStatus: product.velocityStatus ?? 'Medium',
        salesVelocity: product.salesVelocity ?? 0,
        salesTrend: product.salesTrend ?? 0,
        revenueContribution: product.revenueContribution ?? 0,
        grossMarginPercent: product.grossMarginPercent ?? 0,
        netProfitPerUnit: product.netProfitPerUnit ?? 0,
        avgDailySales: product.avgDailySales ?? 0,
        daysStockRemaining: product.daysStockRemaining ?? 0,
        reorderLevel: product.reorderLevel ?? 0,
        overstockRisk: product.overstockRisk ?? 'Low',
        aiEnabled: product.aiEnabled ?? true,
        aiDemandPrediction: product.aiDemandPrediction ?? 0,
        aiConfidenceLevel: product.aiConfidenceLevel ?? 100,
        priceHistory: product.priceHistory ?? [],
        leakageRate: product.leakageRate ?? 0,
        returnRate: product.returnRate ?? 0,
        images: product.images ?? [],
        specifications: product.specifications ?? [],
        tags: product.tags ?? [],
        seo: product.seo ?? { metaTitle: '', metaDescription: '', keywords: '' },
        leadTimeDays: product.leadTimeDays ?? 0,
        minOrderQty: product.minOrderQty ?? 0,
        locations: product.locations ?? [
            {
                id: 'LOC-001',
                name: 'Main Warehouse',
                type: 'Warehouse',
                currentStock: serverRow.stock ?? 0,
                reorderPoint: 0,
                maxStock: 1000,
            },
        ],
    } as Product;

    // Update local cache AFTER the API succeeds. Cache failures are
    // non-fatal — the backend already accepted the save, so we never
    // undo a real persistence by throwing on a quota/storage error.
    try {
        const products = getInitialProducts();
        const existingIndex = products.findIndex((p) => String(p.id) === serverId);
        if (existingIndex !== -1) {
            products[existingIndex] = savedProduct;
        } else {
            products.push(savedProduct);
        }
        try {
            localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
        } catch (e: any) {
            if (
                e?.name === 'QuotaExceededError' ||
                e?.code === 22 ||
                e?.code === 1014 ||
                e?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            ) {
                console.warn('Storage Quota Exceeded! Slimming images before retrying cache write…');
                const slimProducts = products.map((p) => ({
                    ...p,
                    images: (p.images || []).filter((img) => !img.url.startsWith('data:image')),
                }));
                try {
                    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(slimProducts));
                } catch (retryError) {
                    console.error('Local cache write failed (non-fatal — backend already saved):', retryError);
                }
            } else {
                console.warn('Local cache write failed (non-fatal — backend already saved):', e);
            }
        }
    } catch (cacheErr) {
        console.warn('Local cache update failed (non-fatal):', cacheErr);
    }

    return savedProduct;
}

export async function deleteProduct(id: string): Promise<void> {
    return new Promise((resolve) => {
        const products = getInitialProducts();
        const filtered = products.filter(p => p.id !== id);
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(filtered));
        setTimeout(() => resolve(), 300);
    });
}

export async function getAIInsights(_id: string): Promise<string[]> {
    return new Promise((resolve) => {
        setTimeout(() => resolve([
            'Demand is expected to surge by 15% in next 30 days due to seasonal shift.',
            'Current price point is 3% below optimal market elastic price.',
            'Stock rebalancing needed: Move 50 units from Main Warehouse to Downtown Van.'
        ]), 1000);
    });
}

// ===== CATEGORY MANAGEMENT =====

export interface Category {
    id: string;
    name: string;
    description: string;
    icon?: string;
    displayOrder?: number;
    createdAt: string;
}

const CATEGORIES_KEY = 'zavi_categories';

const getInitialCategories = (): Category[] => {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (stored) return JSON.parse(stored);

    // Universal default categories for any business
    const initialCategories: Category[] = [
        {
            id: 'CAT-001',
            name: 'Lubricants',
            description: 'Motor oils and lubricants for all vehicle types',
            icon: '🛢️',
            displayOrder: 1,
            createdAt: new Date().toISOString()
        },
        {
            id: 'CAT-002',
            name: 'Filters',
            description: 'Oil, air, and fuel filters',
            icon: '🏷️',
            displayOrder: 2,
            createdAt: new Date().toISOString()
        },
        {
            id: 'CAT-003',
            name: 'Spare Parts',
            description: 'Vehicle spare parts and accessories',
            icon: '🔧',
            displayOrder: 3,
            createdAt: new Date().toISOString()
        },
        {
            id: 'CAT-004',
            name: 'Batteries',
            description: 'Car and motorcycle batteries',
            icon: '🔋',
            displayOrder: 4,
            createdAt: new Date().toISOString()
        }
    ];
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(initialCategories));
    return initialCategories;
};

export async function getCategories(): Promise<Category[]> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(getInitialCategories()), 100);
    });
}

export async function saveCategory(category: Partial<Category>): Promise<Category> {
    return new Promise((resolve) => {
        const categories = getInitialCategories();
        let savedCategory: Category;

        if (category.id) {
            // Update existing
            const index = categories.findIndex(c => c.id === category.id);
            if (index !== -1) {
                categories[index] = { ...categories[index], ...category } as Category;
                savedCategory = categories[index];
            } else {
                savedCategory = { ...category, id: category.id } as Category;
                categories.push(savedCategory);
            }
        } else {
            // Create new
            savedCategory = {
                ...category,
                id: `CAT-${Date.now()}`,
                createdAt: new Date().toISOString()
            } as Category;
            categories.push(savedCategory);
        }

        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
        setTimeout(() => resolve(savedCategory), 100);
    });
}

export async function deleteCategory(id: string): Promise<void> {
    return new Promise((resolve) => {
        const categories = getInitialCategories();
        const filtered = categories.filter(c => c.id !== id);
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(filtered));
        setTimeout(() => resolve(), 300);
    });
}
