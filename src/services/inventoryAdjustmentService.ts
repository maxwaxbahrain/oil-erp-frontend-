import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';

export type GlStatus = 'posted' | 'skipped_zero_cost' | 'skipped_no_gl';

export interface InventoryAdjustmentRecord {
    id: number;
    tenantId?: number | null;
    productId: number;
    productName?: string | null;
    quantityDelta: number;
    reason: string;
    note?: string | null;
    adjustmentDate: string;
    stockBefore: number;
    stockAfter: number;
    journalEntryId?: number | null;
    glStatus: GlStatus;
    isReversed: boolean;
    reversedById?: number | null;
    isReversal: boolean;
    reversesAdjustmentId?: number | null;
    createdByUserId?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

async function readApiError(r: Response): Promise<string> {
    try {
        const body = await r.json();
        if (typeof body?.detail === 'string') return body.detail;
        if (body?.detail) return JSON.stringify(body.detail);
    } catch {
        /* ignore */
    }
    return `Request failed (${r.status})`;
}

function fromRecord(raw: Record<string, unknown>): InventoryAdjustmentRecord {
    const glRaw = String(raw.glStatus ?? raw.gl_status ?? 'skipped_no_gl');
    const glStatus: GlStatus =
        glRaw === 'posted' || glRaw === 'skipped_zero_cost' || glRaw === 'skipped_no_gl'
            ? glRaw
            : 'skipped_no_gl';

    return {
        id: Number(raw.id),
        tenantId:
            raw.tenantId != null
                ? Number(raw.tenantId)
                : raw.tenant_id != null
                  ? Number(raw.tenant_id)
                  : null,
        productId: Number(raw.productId ?? raw.product_id),
        productName:
            raw.productName != null
                ? String(raw.productName)
                : raw.product_name != null
                  ? String(raw.product_name)
                  : null,
        quantityDelta: Number(raw.quantityDelta ?? raw.quantity_delta ?? 0),
        reason: String(raw.reason ?? ''),
        note: raw.note != null ? String(raw.note) : null,
        adjustmentDate: String(raw.adjustmentDate ?? raw.adjustment_date ?? ''),
        stockBefore: Number(raw.stockBefore ?? raw.stock_before ?? 0),
        stockAfter: Number(raw.stockAfter ?? raw.stock_after ?? 0),
        journalEntryId:
            raw.journalEntryId != null
                ? Number(raw.journalEntryId)
                : raw.journal_entry_id != null
                  ? Number(raw.journal_entry_id)
                  : null,
        glStatus,
        isReversed: Boolean(raw.isReversed ?? raw.is_reversed),
        reversedById:
            raw.reversedById != null
                ? Number(raw.reversedById)
                : raw.reversed_by_id != null
                  ? Number(raw.reversed_by_id)
                  : null,
        isReversal: Boolean(raw.isReversal ?? raw.is_reversal),
        reversesAdjustmentId:
            raw.reversesAdjustmentId != null
                ? Number(raw.reversesAdjustmentId)
                : raw.reverses_adjustment_id != null
                  ? Number(raw.reverses_adjustment_id)
                  : null,
        createdByUserId:
            raw.createdByUserId != null
                ? Number(raw.createdByUserId)
                : raw.created_by_user_id != null
                  ? Number(raw.created_by_user_id)
                  : null,
        createdAt:
            raw.createdAt != null
                ? String(raw.createdAt)
                : raw.created_at != null
                  ? String(raw.created_at)
                  : null,
        updatedAt:
            raw.updatedAt != null
                ? String(raw.updatedAt)
                : raw.updated_at != null
                  ? String(raw.updated_at)
                  : null,
    };
}

/** GET /api/inventory/adjustments — persisted tenant adjustment history (newest first). */
export async function getAdjustmentHistory(productId?: number): Promise<InventoryAdjustmentRecord[]> {
    const qs = productId != null ? `?productId=${encodeURIComponent(String(productId))}` : '';
    const r = await authFetch(`${API_BASE_URL}/inventory/adjustments${qs}`, { cache: 'no-store' });
    if (!r.ok) {
        throw new Error(await readApiError(r));
    }
    const body = await r.json();
    const rows = Array.isArray(body) ? body : body?.results || body?.data || [];
    return rows
        .filter((row: unknown): row is Record<string, unknown> => row != null && typeof row === 'object')
        .map(fromRecord);
}
