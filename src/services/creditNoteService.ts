import { API_BASE_URL } from './api';

export type CreditReason = 'overcharge' | 'return' | 'price_adjustment' | 'goodwill' | 'other';
export type CreditStatus = 'draft' | 'issued' | 'partially_used' | 'fully_used' | 'cancelled';

export interface CreditNoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  originalInvoiceId?: string;
  originalInvoiceNumber?: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  expiryDate?: string;
  reason: CreditReason;
  items: CreditNoteItem[];
  subtotal: number;
  tax: number;
  totalCreditAmount: number;
  usedAmount: number;
  remainingCredit: number;
  status: CreditStatus;
  notes?: string;
  createdAt?: string;
}

export interface CreditNoteCreateInput {
  originalInvoiceId?: string;
  customerId: string;
  issueDate: string;
  expiryDate?: string;
  reason: CreditReason;
  items: CreditNoteItem[];
  subtotal: number;
  tax: number;
  totalCreditAmount: number;
  usedAmount?: number;
  status: 'draft' | 'issued';
  notes?: string;
}

export interface CreditNoteStats {
  totalIssuedThisMonth: number;
  totalUsed: number;
  pendingUnused: number;
  expiringSoon: number;
}

function toUi(row: any): CreditNote {
  return {
    id: String(row.id),
    creditNoteNumber: String(row.credit_note_number),
    originalInvoiceId: row.original_invoice_id != null ? String(row.original_invoice_id) : undefined,
    originalInvoiceNumber: row.original_invoice_number || undefined,
    customerId: String(row.customer_id),
    customerName: row.customer_name || '',
    issueDate: row.issue_date ? String(row.issue_date).slice(0, 10) : '',
    expiryDate: row.expiry_date ? String(row.expiry_date).slice(0, 10) : undefined,
    reason: row.reason,
    items: Array.isArray(row.items)
      ? row.items.map((it: any) => ({
          description: String(it.description ?? it.product ?? ''),
          quantity: Number(it.quantity ?? it.qty ?? 0),
          unitPrice: Number(it.unitPrice ?? it.rate ?? 0),
          amount: Number(it.amount ?? 0),
        }))
      : [],
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    totalCreditAmount: Number(row.total_credit_amount ?? 0),
    usedAmount: Number(row.used_amount ?? 0),
    remainingCredit: Number(row.remaining_credit ?? 0),
    status: row.status,
    notes: row.notes || undefined,
    createdAt: row.created_at || undefined,
  };
}

function toApi(input: any) {
  return {
    originalInvoiceId: input.originalInvoiceId ? Number(input.originalInvoiceId) : undefined,
    customerId: input.customerId ? Number(input.customerId) : undefined,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate || null,
    reason: input.reason,
    items: input.items || [],
    subtotal: Number(input.subtotal ?? 0),
    tax: Number(input.tax ?? 0),
    totalCreditAmount: Number(input.totalCreditAmount ?? 0),
    usedAmount: Number(input.usedAmount ?? 0),
    status: input.status,
    notes: input.notes || '',
  };
}

export async function getCreditNotes(): Promise<CreditNote[]> {
  const r = await fetch(`${API_BASE_URL}/credit-notes/`);
  if (!r.ok) throw new Error('Failed to load credit notes');
  const rows = await r.json();
  return (rows as any[]).map(toUi);
}

export async function getCreditNote(id: string): Promise<CreditNote | null> {
  const r = await fetch(`${API_BASE_URL}/credit-notes/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Failed to load credit note');
  return toUi(await r.json());
}

export async function getCustomerCreditNotes(customerId: string): Promise<CreditNote[]> {
  const r = await fetch(`${API_BASE_URL}/credit-notes/customer/${encodeURIComponent(customerId)}`);
  if (!r.ok) throw new Error('Failed to load customer credit notes');
  const rows = await r.json();
  return (rows as any[]).map(toUi);
}

export async function createCreditNote(input: CreditNoteCreateInput): Promise<CreditNote> {
  const r = await fetch(`${API_BASE_URL}/credit-notes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toApi(input)),
  });
  if (!r.ok) throw new Error(await r.text());
  return toUi(await r.json());
}

export async function updateCreditNote(
  id: string,
  patch: {
    originalInvoiceId?: string;
    customerId?: string;
    issueDate?: string;
    expiryDate?: string;
    reason?: CreditReason;
    items?: CreditNoteItem[];
    subtotal?: number;
    tax?: number;
    totalCreditAmount?: number;
    usedAmount?: number;
    notes?: string;
    status?: CreditStatus;
  }
): Promise<CreditNote> {
  const body: any = toApi(patch);
  if (patch.status) body.status = patch.status;
  const r = await fetch(`${API_BASE_URL}/credit-notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return toUi(await r.json());
}

export async function getCreditNoteStats(): Promise<CreditNoteStats> {
  const notes = await getCreditNotes();
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const totalIssuedThisMonth = notes
    .filter((n) => n.status !== 'draft' && n.status !== 'cancelled')
    .filter((n) => {
      const d = new Date(n.issueDate);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((s, n) => s + n.totalCreditAmount, 0);

  const totalUsed = notes.reduce((s, n) => s + n.usedAmount, 0);
  const pendingUnused = notes
    .filter((n) => n.status !== 'cancelled' && n.remainingCredit > 0)
    .reduce((s, n) => s + n.remainingCredit, 0);
  const expiringSoon = notes.filter((n) => n.remainingCredit > 0 && n.expiryDate).filter((n) => {
    const d = new Date(n.expiryDate as string);
    return d >= now && d <= in30;
  }).length;

  return { totalIssuedThisMonth, totalUsed, pendingUnused, expiringSoon };
}
