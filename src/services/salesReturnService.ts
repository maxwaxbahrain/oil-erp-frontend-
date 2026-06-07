/**
 * Sales returns — backend /api/sales-returns/
 */
import { API_BASE_URL, getInvoices, type Invoice } from './api';
import { authFetch } from '../api/axios';

export type ReturnStatus = 'draft' | 'pending' | 'approved' | 'completed';

export type ReturnReasonCode =
  | 'damaged'
  | 'wrong_product'
  | 'short_delivery'
  | 'price_dispute'
  | 'customer_changed_mind'
  | 'other';

export const RETURN_REASON_OPTIONS: { code: ReturnReasonCode; label: string }[] = [
  { code: 'damaged', label: 'Damaged Product' },
  { code: 'wrong_product', label: 'Wrong Product Delivered' },
  { code: 'short_delivery', label: 'Short Delivery' },
  { code: 'price_dispute', label: 'Price Dispute' },
  { code: 'customer_changed_mind', label: 'Customer Changed Mind' },
  { code: 'other', label: 'Other' },
];

export function reasonLabel(code: string): string {
  return RETURN_REASON_OPTIONS.find((r) => r.code === code)?.label ?? code;
}

/** Return line sent to API (mirrors invoice item shape + return fields). */
export interface ReturnLineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  originalQuantity: number;
  selected: boolean;
  quantityReturned: number;
  unitPrice: number;
  totalAmount: number;
  lineReason?: ReturnReasonCode | '';
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  returnDate: string;
  invoiceDate: string;
  lineItems: ReturnLineItem[];
  returnReason: ReturnReasonCode | string;
  refundAmount: number;
  notes: string;
  status: ReturnStatus;
  createdAt: string;
  subtotal: number;
  tax: number;
  itemsJson: Record<string, unknown>[];
}

export interface ReturnStats {
  totalReturnsToday: number;
  totalReturnValue: number;
  pendingApprovals: number;
  completedReturns: number;
}

export const RETURN_POLICY_DAYS = 30;

async function parseError(res: Response): Promise<string> {
  const j = await res.json().catch(() => ({}));
  const d = (j as { detail?: unknown }).detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return JSON.stringify(d);
  return `HTTP ${res.status}`;
}

function mapApiRow(r: Record<string, unknown>): SalesReturn {
  const items = (Array.isArray(r.items) ? r.items : []) as Record<string, unknown>[];
  const lineItems: ReturnLineItem[] = items.map((it, idx) => ({
    id: `${idx}-${it.product ?? idx}`,
    productId: it.product_id != null ? String(it.product_id) : '',
    productName: String(it.product ?? it.name ?? ''),
    sku: String(it.item_code ?? it.sku ?? ''),
    originalQuantity: Number(it.original_quantity ?? it.quantity ?? 0),
    selected: true,
    quantityReturned: Number(it.quantity_returned ?? it.quantity ?? 0),
    unitPrice: Number(it.rate ?? 0),
    totalAmount: Number(it.amount ?? 0),
    lineReason: (it.line_reason as ReturnReasonCode) || undefined,
  }));

  const rd = r.return_date as string;
  const returnDate = rd ? (rd.length >= 10 ? rd.slice(0, 10) : rd) : '';

  return {
    id: String(r.id ?? ''),
    returnNumber: String(r.return_number ?? ''),
    invoiceId: String(r.original_invoice_id ?? ''),
    invoiceNumber: String(r.original_invoice_number ?? ''),
    customerId: String(r.customer_id ?? ''),
    customerName: String(r.customer_name ?? ''),
    returnDate,
    invoiceDate: '',
    lineItems,
    returnReason: String(r.reason ?? 'other'),
    refundAmount: Number(r.total_return_amount ?? 0),
    notes: String(r.notes ?? ''),
    status: String(r.status ?? 'draft').toLowerCase() as ReturnStatus,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    subtotal: Number(r.subtotal ?? 0),
    tax: Number(r.tax ?? 0),
    itemsJson: items,
  };
}

export async function getSalesReturns(): Promise<SalesReturn[]> {
  const res = await authFetch(`${API_BASE_URL}/sales-returns/`);
  if (!res.ok) throw new Error(await parseError(res));
  const raw = (await res.json()) as Record<string, unknown>[];
  return raw.map(mapApiRow);
}

export async function getSalesReturn(id: string): Promise<SalesReturn | null> {
  const res = await authFetch(`${API_BASE_URL}/sales-returns/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return mapApiRow((await res.json()) as Record<string, unknown>);
}

export async function getReturnStats(): Promise<ReturnStats> {
  const list = await getSalesReturns();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let totalReturnsToday = 0;
  let totalReturnValue = 0;
  let pendingApprovals = 0;
  let completedReturns = 0;

  for (const r of list) {
    const d = new Date(r.returnDate.includes('T') ? r.returnDate : `${r.returnDate}T12:00:00`);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) {
      totalReturnsToday += 1;
      totalReturnValue += r.refundAmount;
    }
    if (r.status === 'pending') pendingApprovals += 1;
    if (r.status === 'completed') completedReturns += 1;
  }

  return { totalReturnsToday, totalReturnValue, pendingApprovals, completedReturns };
}

export async function getEligibleInvoicesForReturn(customerId: string): Promise<Invoice[]> {
  const allInvoices = await getInvoices();
  const today = new Date();

  return allInvoices.filter((invoice) => {
    if (String(invoice.customerId) !== String(customerId)) return false;
    const invoiceDate = new Date(
      invoice.invoiceDate.includes('T') ? invoice.invoiceDate : `${invoice.invoiceDate}T12:00:00`
    );
    const diffTime = today.getTime() - invoiceDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= RETURN_POLICY_DAYS;
  });
}

export interface CreateSalesReturnPayload {
  originalInvoiceId: number;
  customerId: number;
  returnDate: string;
  reason: ReturnReasonCode;
  items: Record<string, unknown>[];
  subtotal: number;
  tax: number;
  totalReturnAmount: number;
  notes: string;
  status: 'draft' | 'pending';
}

export async function createSalesReturnApi(payload: CreateSalesReturnPayload): Promise<SalesReturn> {
  const res = await authFetch(`${API_BASE_URL}/sales-returns/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalInvoiceId: payload.originalInvoiceId,
      customerId: payload.customerId,
      returnDate: payload.returnDate,
      reason: payload.reason,
      items: payload.items,
      subtotal: payload.subtotal,
      tax: payload.tax,
      totalReturnAmount: payload.totalReturnAmount,
      notes: payload.notes || null,
      status: payload.status,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return mapApiRow((await res.json()) as Record<string, unknown>);
}

export async function patchSalesReturn(
  id: string,
  body: Partial<{
    status: ReturnStatus;
    notes: string;
    returnDate: string;
    reason: ReturnReasonCode;
    items: Record<string, unknown>[];
    subtotal: number;
    tax: number;
    totalReturnAmount: number;
  }>
): Promise<SalesReturn> {
  const payload: Record<string, unknown> = {};
  if (body.status !== undefined) payload.status = body.status;
  if (body.notes != null) payload.notes = body.notes;
  if (body.returnDate != null) payload.returnDate = body.returnDate;
  if (body.reason != null) payload.reason = body.reason;
  if (body.items != null) payload.items = body.items;
  if (body.subtotal != null) payload.subtotal = body.subtotal;
  if (body.tax != null) payload.tax = body.tax;
  if (body.totalReturnAmount != null) payload.totalReturnAmount = body.totalReturnAmount;

  const res = await authFetch(`${API_BASE_URL}/sales-returns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return mapApiRow((await res.json()) as Record<string, unknown>);
}

/** @deprecated use createSalesReturnApi */
export async function createSalesReturn(data: unknown): Promise<SalesReturn> {
  return createSalesReturnApi(data as CreateSalesReturnPayload);
}

/** @deprecated use patchSalesReturn */
export async function updateSalesReturn(id: string, data: Partial<SalesReturn>): Promise<SalesReturn> {
  return patchSalesReturn(id, data as Parameters<typeof patchSalesReturn>[1]);
}

export async function deleteSalesReturn(_id: string): Promise<void> {
  throw new Error('Delete return is not supported');
}

export default {
  getSalesReturns,
  getSalesReturn,
  getReturnStats,
  getEligibleInvoicesForReturn,
  createSalesReturn: createSalesReturnApi,
  patchSalesReturn,
  RETURN_REASON_OPTIONS,
  RETURN_POLICY_DAYS,
};
