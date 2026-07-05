import { authFetch } from '../api/axios';
import { getOilErpApiBase } from '../config/apiBase';

const QUOTATIONS_API = `${getOilErpApiBase()}/quotations`;

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'expired' | 'converted';

export interface QuotationLineItem {
    product_id?: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    description?: string;
}

export interface Quotation {
    id: number;
    quote_number: string;
    customer_id: number;
    customer_name?: string;
    date: string;
    expiry_date?: string | null;
    items: QuotationLineItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    notes?: string | null;
    terms?: string | null;
    status: QuotationStatus;
    converted_sales_order_id?: string | null;
    converted_invoice_id?: number | null;
}

function fromApi(raw: Record<string, unknown>): Quotation {
    return {
        id: Number(raw.id),
        quote_number: String(raw.quote_number ?? raw.quotation_number ?? ''),
        customer_id: Number(raw.customer_id),
        date: String(raw.date ?? '').slice(0, 10),
        expiry_date: raw.expiry_date ? String(raw.expiry_date).slice(0, 10) : null,
        items: Array.isArray(raw.items) ? (raw.items as QuotationLineItem[]) : [],
        subtotal: Number(raw.subtotal ?? 0),
        discount: Number(raw.discount ?? 0),
        tax: Number(raw.tax ?? 0),
        total: Number(raw.total ?? 0),
        notes: raw.notes != null ? String(raw.notes) : null,
        terms: raw.terms != null ? String(raw.terms) : null,
        status: (String(raw.status ?? 'draft').toLowerCase() as QuotationStatus),
        converted_sales_order_id: raw.converted_sales_order_id != null ? String(raw.converted_sales_order_id) : null,
        converted_invoice_id: raw.converted_invoice_id != null ? Number(raw.converted_invoice_id) : null,
    };
}

export async function getQuotations(): Promise<Quotation[]> {
    const r = await authFetch(`${QUOTATIONS_API}/`);
    if (!r.ok) throw new Error(`Failed to load quotations (${r.status})`);
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromApi(row as Record<string, unknown>));
}

export async function getQuotation(id: number | string): Promise<Quotation> {
    const r = await authFetch(`${QUOTATIONS_API}/${encodeURIComponent(String(id))}`);
    if (!r.ok) throw new Error(`Failed to load quotation (${r.status})`);
    return fromApi((await r.json()) as Record<string, unknown>);
}

export async function createQuotation(payload: Partial<Quotation> & { customer_id: number; date: string }): Promise<Quotation> {
    const body = {
        customerId: payload.customer_id,
        date: payload.date,
        expiryDate: payload.expiry_date || undefined,
        items: payload.items ?? [],
        subtotal: payload.subtotal ?? 0,
        discount: payload.discount ?? 0,
        tax: payload.tax ?? 0,
        total: payload.total ?? 0,
        notes: payload.notes,
        terms: payload.terms,
        status: payload.status ?? 'draft',
    };
    const r = await authFetch(`${QUOTATIONS_API}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        const detail = await r.text();
        throw new Error(detail || `Failed to create quotation (${r.status})`);
    }
    return fromApi((await r.json()) as Record<string, unknown>);
}

export async function updateQuotation(id: number | string, payload: Partial<Quotation>): Promise<Quotation> {
    const body: Record<string, unknown> = {};
    if (payload.customer_id != null) body.customerId = payload.customer_id;
    if (payload.date != null) body.date = payload.date;
    if (payload.expiry_date !== undefined) body.expiryDate = payload.expiry_date;
    if (payload.items != null) body.items = payload.items;
    if (payload.subtotal != null) body.subtotal = payload.subtotal;
    if (payload.discount != null) body.discount = payload.discount;
    if (payload.tax != null) body.tax = payload.tax;
    if (payload.total != null) body.total = payload.total;
    if (payload.notes !== undefined) body.notes = payload.notes;
    if (payload.terms !== undefined) body.terms = payload.terms;
    if (payload.status != null) body.status = payload.status;

    const r = await authFetch(`${QUOTATIONS_API}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Failed to update quotation (${r.status})`);
    return fromApi((await r.json()) as Record<string, unknown>);
}

export async function convertQuotationToSalesOrder(id: number | string): Promise<{ sales_order_id: string; so_number: string }> {
    const r = await authFetch(`${QUOTATIONS_API}/${encodeURIComponent(String(id))}/convert-to-sales-order`, { method: 'POST' });
    if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail || `Convert failed (${r.status})`);
    }
    return r.json();
}

export async function convertQuotationToInvoice(id: number | string): Promise<{ invoice_id: number; invoice_number: string }> {
    const r = await authFetch(`${QUOTATIONS_API}/${encodeURIComponent(String(id))}/convert-to-invoice`, { method: 'POST' });
    if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail || `Convert failed (${r.status})`);
    }
    return r.json();
}
