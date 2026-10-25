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
import { authFetch } from '../api/axios';

export interface Product {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    category: string;
    categoryName?: string | null;
    barcodes?: { barcode: string; packQty: number | null; isPrimary: boolean }[];
    subCategory?: string;
    brand?: string;
    categoryId?: number | null;
    baseUnit?: string | null;
    packQty?: number | null;
    packUnit?: string | null;
    reorderPoint?: number | null;
    reorderQty?: number | null;
    maxStock?: number | null;
    preferredSupplierId?: number | null;
    supplierSku?: string | null;
    defaultLocationId?: number | null;
    defaultLocationCode?: string | null;
    lotTracked?: boolean;
    shelfLifeDays?: number | null;
    expiryTracked?: boolean;
    /** GET /products/{id} only, lot-tracked products. */
    lotsSummary?: { lots: number; nearestExpiry: string | null; expiredQty: number } | null;
    hazmatClass?: string | null;
    weightKg?: number | null;
    volumeL?: number | null;
    costMethod?: 'average' | 'fifo' | 'standard' | null;
    isDiscontinued?: boolean;
    /** Read-only. stock / pack_qty when the server computed it. */
    packCount?: number | null;
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
    image?: string;
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

function optFloat(v: unknown): number | undefined {
    if (v == null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isNaN(n) ? undefined : n;
}

function optInt(v: unknown): number | undefined {
    if (v == null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return Number.isNaN(n) ? undefined : n;
}

function optBool(v: unknown): boolean | undefined {
    if (v == null || v === '') return undefined;
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === '1' || v === 'true' || v === 'True') return true;
    if (v === 0 || v === '0' || v === 'false' || v === 'False') return false;
    return undefined;
}

function optText(v: unknown): string | undefined {
    if (v == null) return undefined;
    const text = String(v).trim();
    return text ? text : undefined;
}

function optCostMethod(v: unknown): Product['costMethod'] {
    if (v === 'average' || v === 'fifo' || v === 'standard') return v;
    return undefined;
}

/** "12 x case" when a pack size is set. */
export function formatPack(packQty?: number | null, packUnit?: string | null): string | null {
    if (packQty == null || !(Number(packQty) > 0)) return null;
    const qty = Number(packQty);
    const unit = (packUnit || '').trim();
    return unit ? `${qty} x ${unit}` : String(qty);
}

export function apiErrorDetail(raw: string): string {
    const text = (raw || '').trim();
    if (!text) return '';
    try {
        const parsed = JSON.parse(text) as { detail?: unknown };
        const detail = parsed && typeof parsed === 'object' && 'detail' in parsed ? parsed.detail : parsed;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail)) {
            return detail.map((item) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'msg' in item) return String((item as { msg: unknown }).msg);
                return JSON.stringify(item);
            }).join('; ');
        }
        if (detail && typeof detail === 'object') return JSON.stringify(detail);
    } catch {
        return text;
    }
    return text;
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

function optCategoryName(raw: Record<string, unknown>): string | null {
    const value = raw.category_name ?? raw.categoryName;
    if (value == null) return null;
    const text = String(value).trim();
    return text || null;
}

function mapBarcodes(value: unknown): Product['barcodes'] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return {
            barcode: row.barcode != null ? String(row.barcode) : '',
            packQty: optFloat(row.pack_qty ?? row.packQty) ?? null,
            isPrimary: optBool(row.is_primary ?? row.isPrimary) === true,
        };
    });
}

export interface CsvImportFailure {
    row: number;
    external_id: string | null;
    error: string;
}

export interface CsvImportResult {
    created: number;
    updated?: number;
    failed: CsvImportFailure[];
}

/** GET /api/v1/csv/export/products — the server file, not a client-built CSV. */
export async function exportProductsCsv(): Promise<Blob> {
    const response = await authFetch(apiUrl('v1/csv/export/products'), { cache: 'no-store' });
    if (!response.ok) {
        const raw = await response.text().catch(() => '');
        throw new Error(apiErrorDetail(raw) || `HTTP ${response.status}`);
    }
    return response.blob();
}

/** POST /api/v1/csv/import/products as multipart field "file". */
export async function importProductsCsv(file: File): Promise<CsvImportResult> {
    const body = new FormData();
    body.append('file', file);
    const response = await authFetch(apiUrl('v1/csv/import/products'), { method: 'POST', body });
    const raw = await response.text().catch(() => '');
    if (!response.ok) throw new Error(apiErrorDetail(raw) || `HTTP ${response.status}`);
    let parsed: Record<string, unknown> = {};
    try {
        parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    } catch {
        throw new Error('Import response was not JSON');
    }
    const failed = Array.isArray(parsed.failed) ? parsed.failed : [];
    return {
        created: num(parsed.created),
        updated: parsed.updated == null ? undefined : num(parsed.updated),
        failed: failed.map((item) => {
            const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
            const error = row.error;
            return {
                row: num(row.row),
                external_id: row.external_id == null ? null : String(row.external_id),
                error: typeof error === 'string' ? error : JSON.stringify(error ?? ''),
            };
        }),
    };
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
    const cost = num(raw.cost);
    const unit = raw.unit != null ? String(raw.unit) : '';
    const barcode = raw.barcode != null ? String(raw.barcode) : undefined;
    const image = raw.image != null ? String(raw.image) : undefined;
    const isActive = raw.is_active !== false;

    return {
        id,
        name,
        sku,
        barcode,
        category,
        categoryName: optCategoryName(raw),
        barcodes: mapBarcodes(raw.barcodes),
        brand: optText(raw.brand),
        categoryId: optInt(raw.category_id),
        baseUnit: optText(raw.base_unit),
        packQty: optFloat(raw.pack_qty),
        packUnit: optText(raw.pack_unit),
        reorderPoint: optFloat(raw.reorder_point),
        reorderQty: optFloat(raw.reorder_qty),
        maxStock: optFloat(raw.max_stock),
        preferredSupplierId: optInt(raw.preferred_supplier_id),
        supplierSku: optText(raw.supplier_sku),
        defaultLocationId: optInt(raw.default_location_id),
        defaultLocationCode: optText(raw.default_location_code),
        lotTracked: optBool(raw.lot_tracked),
        shelfLifeDays: optInt(raw.shelf_life_days),
        expiryTracked: optBool(raw.expiry_tracked),
        lotsSummary: mapLotsSummary(raw.lots_summary),
        hazmatClass: optText(raw.hazmat_class),
        weightKg: optFloat(raw.weight_kg),
        volumeL: optFloat(raw.volume_l),
        costMethod: optCostMethod(raw.cost_method),
        isDiscontinued: optBool(raw.is_discontinued),
        packCount: optFloat(raw.pack_count),
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
            purchasePriceExWorks: cost,
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
        image,
        images: image ? [{ id: 'backend-primary', url: image, isPrimary: true }] : [],
        aiEnabled: false,
        aiDemandPrediction: 0,
        aiConfidenceLevel: 0,
        leadTimeDays: optInt(raw.lead_time_days) ?? 0,
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
    // Backend is the single source of truth for the catalog. localStorage is a
    // write-through cache populated only by `saveProduct` after a successful
    // API call. We deliberately do NOT auto-seed the cache with mock/demo data
    // here — doing so used to create "ghost" rows (e.g. Soltol 15W40 with
    // id:'1') that appeared in the catalog even when the backend was empty,
    // which then 404'd on subsequent edits.
    const stored = localStorage.getItem(PRODUCTS_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? (parsed as Product[]) : [];
    } catch {
        return [];
    }
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

function mapLotsSummary(raw: unknown): Product['lotsSummary'] {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    return {
        lots: Number(row.lots) || 0,
        nearestExpiry: row.nearest_expiry != null ? String(row.nearest_expiry) : null,
        expiredQty: Number(row.expired_qty) || 0,
    };
}

export async function getProducts(): Promise<Product[]> {
    // Backend is the single source of truth for the catalog. We no longer
    // merge in `getImportedProducts()` (localStorage) — that path used to
    // surface "ghost" products that existed only in the browser and 404'd
    // when the user tried to edit them. If the backend is unreachable we
    // return an empty list instead of a stale localStorage snapshot.
    try {
        const response = await authFetch(apiUrl('products/'), { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json().catch(() => null);
        return parseProductsJson(payload).map(mapApiProductToProduct);
    } catch {
        return [];
    }
}

export async function getProductById(id: string): Promise<Product | undefined> {
    // Check localStorage imported products first (always available)
    const imported = getImportedProducts();
    const localProduct = imported.find(p => p.id === id || String(p.id) === String(id));

    // Try backend
    try {
        const response = await authFetch(apiUrl(`products/${encodeURIComponent(id)}`), { cache: 'no-store' });
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

export interface SaveProductOptions {
    /** Sent as cost_change_reason on the PUT; the backend records it on the cost revaluation. */
    costChangeReason?: string;
}

export async function saveProduct(product: Partial<Product>, options: SaveProductOptions = {}): Promise<Product> {
    // Translate the nested frontend form shape to the flat backend Product schema.
    // Backend `ProductUpdate` / `ProductCreate` accepts only these flat keys
    // (see app/schemas/product.py on bettano-erp-backend). Every other rich
    // field on the frontend `Product` type — locations, pricing, specifications,
    // images, tags, seo, … — is UI-only and stays in the localStorage cache.
    const backendPayload: Record<string, unknown> = {
        name: product.name ?? '',
        sku: product.sku ?? '',
        category: product.category ?? '',
        description: product.description ?? product.shortDescription ?? '',
        price: Number(product.pricing?.sellingPrice ?? 0),
        cost: Number(product.pricing?.purchasePriceExWorks ?? 0),
        stock: Number((product.locations ?? []).reduce((sum, loc) => sum + (Number(loc?.currentStock) || 0), 0)),
        min_stock: Number(
            product.locations?.[0]?.reorderPoint ?? product.reorderLevel ?? 0,
        ),
        unit: product.uom ?? 'pcs',
        barcode: product.barcode ?? null,
        image: product.images?.find((img) => img.isPrimary)?.url ?? product.images?.[0]?.url ?? product.image ?? null,
        is_active: product.status === 'Active',
    };
    const catalogPairs: [string, unknown][] = [
        ['brand', product.brand],
        ['category_id', product.categoryId],
        ['base_unit', product.baseUnit],
        ['pack_qty', product.packQty],
        ['pack_unit', product.packUnit],
        ['reorder_point', product.reorderPoint],
        ['reorder_qty', product.reorderQty],
        ['max_stock', product.maxStock],
        ['lead_time_days', product.leadTimeDays || undefined],
        ['preferred_supplier_id', product.preferredSupplierId],
        ['supplier_sku', product.supplierSku],
        ['lot_tracked', product.lotTracked],
        ['shelf_life_days', product.shelfLifeDays],
        ['expiry_tracked', product.expiryTracked],
        ['hazmat_class', product.hazmatClass],
        ['weight_kg', product.weightKg],
        ['volume_l', product.volumeL],
        ['cost_method', product.costMethod],
        ['is_discontinued', product.isDiscontinued],
    ];
    for (const [key, value] of catalogPairs) {
        if (value !== undefined) backendPayload[key] = value;
    }
    if (product.defaultLocationId !== undefined) {
        backendPayload.default_location_id = product.defaultLocationId;
    }
    const costChangeReason = options.costChangeReason?.trim();
    if (costChangeReason) {
        backendPayload.cost_change_reason = costChangeReason;
    }

    // Hit the backend FIRST. If it fails, throw — the form's catch block
    // will surface the real error instead of showing a fake success alert.
    const hasId = product.id != null && String(product.id) !== '';
    const initialUrl = hasId
        ? apiUrl(`products/${encodeURIComponent(String(product.id))}`)
        : apiUrl('products/');
    const initialMethod: 'PUT' | 'POST' = hasId ? 'PUT' : 'POST';

    let resp = await authFetch(initialUrl, {
        method: initialMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload),
    });
    let method: 'PUT' | 'POST' = initialMethod;

    // Self-heal: if the PUT targeted an id that no longer exists on the
    // backend (a "ghost" cached locally from a previous DB lifetime), promote
    // the save to a POST so the user's edit becomes a real backend row
    // instead of failing the entire form. The cache cleanup below strips the
    // old ghost id so the catalog doesn't end up with a duplicate.
    if (resp.status === 404 && hasId) {
        method = 'POST';
        resp = await authFetch(apiUrl('products/'), {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backendPayload),
        });
    }

    if (!resp.ok) {
        let raw = '';
        try { raw = await resp.text(); } catch { /* ignore */ }
        const detail = apiErrorDetail(raw);
        throw new Error(detail || `Backend ${resp.status} on ${method} /products`);
    }

    type BackendRow = {
        id: number | string;
        stock?: number;
        price?: number;
        cost?: number;
        min_stock?: number;
        unit?: string;
        is_active?: boolean;
        image?: string | null;
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
        image: serverRow.image ?? backendPayload.image ?? undefined,
        images: product.images ?? [],
        specifications: product.specifications ?? [],
        tags: product.tags ?? [],
        seo: product.seo ?? { metaTitle: '', metaDescription: '', keywords: '' },
        leadTimeDays: product.leadTimeDays ?? 0,
        minOrderQty: product.minOrderQty ?? 0,
        locations: (() => {
            const inputLocations = product.locations ?? [
                {
                    id: 'LOC-001',
                    name: 'Main Warehouse',
                    type: 'Warehouse' as const,
                    currentStock: serverRow.stock ?? 0,
                    reorderPoint: 0,
                    maxStock: 1000,
                },
            ];
            const serverStock = Number(serverRow.stock ?? 0);
            if (inputLocations.length === 0) {
                return inputLocations;
            }
            const mainIdx = inputLocations.findIndex(
                (loc) => loc.id === 'LOC-001' || /^main warehouse$/i.test((loc.name || '').trim()),
            );
            const idx = mainIdx >= 0 ? mainIdx : 0;
            return inputLocations.map((loc, i) =>
                i === idx ? { ...loc, currentStock: serverStock } : loc,
            );
        })(),
    } as Product;

    // Update local cache AFTER the API succeeds. Cache failures are
    // non-fatal — the backend already accepted the save, so we never
    // undo a real persistence by throwing on a quota/storage error.
    try {
        const cached = getInitialProducts();
        // Drop any stale ghost row that lived under the old (pre-save) id so
        // that a 404→POST upsert (which assigns a new server id) doesn't
        // leave the old id orphaned in the cache as a duplicate row.
        const oldId = product.id != null ? String(product.id) : '';
        const products = oldId && oldId !== serverId
            ? cached.filter((p) => String(p.id) !== oldId)
            : cached;
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
    const resp = await authFetch(apiUrl(`products/${encodeURIComponent(String(id))}`), {
        method: 'DELETE',
    });

    if (!resp.ok && resp.status !== 404) {
        let detail = '';
        try { detail = await resp.text(); } catch { /* ignore */ }
        throw new Error(
            `Backend ${resp.status} on DELETE /products` +
                (detail ? `: ${detail.slice(0, 200)}` : ''),
        );
    }

    const products = getInitialProducts();
    const filtered = products.filter((p) => String(p.id) !== String(id));
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(filtered));
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

export interface ProductCategory {
    id: number;
    name: string;
    parent_id?: number | null;
    is_active: boolean;
}

export interface ProductBarcodeRow {
    id: number;
    product_id: number;
    tenant_id?: number | null;
    barcode: string;
    pack_qty?: number | null;
    is_primary: boolean;
}

async function throwIfNotOk(resp: Response): Promise<void> {
    if (resp.ok) return;
    let raw = '';
    try { raw = await resp.text(); } catch { /* ignore */ }
    throw new Error(apiErrorDetail(raw) || `HTTP ${resp.status}`);
}

export const productCategoryService = {
    async list(): Promise<ProductCategory[]> {
        const response = await authFetch(apiUrl('product-categories/'), { cache: 'no-store' });
        await throwIfNotOk(response);
        const payload = await response.json().catch(() => []);
        return Array.isArray(payload) ? payload as ProductCategory[] : [];
    },
    async create(body: { name: string; parent_id?: number | null; is_active?: boolean }): Promise<ProductCategory> {
        const response = await authFetch(apiUrl('product-categories/'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: body.name, parent_id: body.parent_id ?? null, is_active: body.is_active ?? true }),
        });
        await throwIfNotOk(response);
        return response.json() as Promise<ProductCategory>;
    },
    async update(id: number, body: { name?: string; parent_id?: number | null; is_active?: boolean }): Promise<ProductCategory> {
        const response = await authFetch(apiUrl(`product-categories/${id}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        await throwIfNotOk(response);
        return response.json() as Promise<ProductCategory>;
    },
};

export async function listProductBarcodes(productId: string): Promise<ProductBarcodeRow[]> {
    const response = await authFetch(apiUrl(`products/${encodeURIComponent(productId)}/barcodes`), { cache: 'no-store' });
    await throwIfNotOk(response);
    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? payload as ProductBarcodeRow[] : [];
}

export async function addProductBarcode(
    productId: string,
    body: { barcode: string; pack_qty?: number | null; is_primary?: boolean },
): Promise<ProductBarcodeRow> {
    const response = await authFetch(apiUrl(`products/${encodeURIComponent(productId)}/barcodes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            barcode: body.barcode,
            pack_qty: body.pack_qty ?? null,
            is_primary: body.is_primary ?? false,
        }),
    });
    await throwIfNotOk(response);
    return response.json() as Promise<ProductBarcodeRow>;
}

export async function removeProductBarcode(productId: string, barcodeId: number): Promise<void> {
    const response = await authFetch(apiUrl(`products/${encodeURIComponent(productId)}/barcodes/${barcodeId}`), {
        method: 'DELETE',
    });
    await throwIfNotOk(response);
}

export interface ProductBarcodeLookup {
    product: Product;
    matchedPackQty: number | null;
}

/** GET /api/products/lookup — matched_pack_qty is set when a secondary barcode matched. */
export async function lookupProductByBarcode(barcode: string): Promise<ProductBarcodeLookup> {
    const response = await authFetch(
        apiUrl(`products/lookup?barcode=${encodeURIComponent(barcode)}`),
        { cache: 'no-store' },
    );
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(apiErrorDetail(text) || `HTTP ${response.status}`);
    }
    const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const body = raw && typeof raw === 'object' ? raw : {};
    const productRaw = (body.product && typeof body.product === 'object'
        ? body.product
        : body) as Record<string, unknown>;
    const matched = body.matched_pack_qty ?? body.matchedPackQty ?? productRaw.matched_pack_qty ?? productRaw.matchedPackQty;
    const matchedPackQty = matched == null || matched === '' || Number.isNaN(Number(matched))
        ? null
        : Number(matched);
    return { product: mapApiProductToProduct(productRaw), matchedPackQty };
}

export async function deleteCategory(id: string): Promise<void> {
    return new Promise((resolve) => {
        const categories = getInitialCategories();
        const filtered = categories.filter(c => c.id !== id);
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(filtered));
        setTimeout(() => resolve(), 300);
    });
}
