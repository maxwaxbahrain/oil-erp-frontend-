// Commission rules, records, and calculation triggers (Phase S3b)

import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';

export interface CommissionRule {
    id: number;
    tenantId?: number | null;
    employeeId: number;
    ruleType: string;
    rate: number;
    unitLabel?: string | null;
    isActive: boolean;
    effectiveFrom?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface CommissionRecord {
    id: number;
    tenantId?: number | null;
    employeeId: number;
    invoiceId: number;
    ruleType: string;
    rate: number;
    basisAmount: number;
    commissionAmount: number;
    status: string;
    payslipId?: number | null;
    computedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface CommissionSummaryRow {
    employeeId: number;
    pendingCommissionTotal: number;
    invoiceCount: number;
}

export interface CalculateAllResult {
    count: number;
    records: CommissionRecord[];
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

function fromRule(raw: Record<string, unknown>): CommissionRule {
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        employeeId: Number(raw.employeeId ?? raw.employee_id),
        ruleType: String(raw.ruleType ?? raw.rule_type ?? ''),
        rate: Number(raw.rate ?? 0),
        unitLabel: raw.unitLabel != null
            ? String(raw.unitLabel)
            : raw.unit_label != null
              ? String(raw.unit_label)
              : null,
        isActive: Boolean(raw.isActive ?? raw.is_active ?? true),
        effectiveFrom: raw.effectiveFrom != null
            ? String(raw.effectiveFrom).slice(0, 10)
            : raw.effective_from != null
              ? String(raw.effective_from).slice(0, 10)
              : null,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

function fromRecord(raw: Record<string, unknown>): CommissionRecord {
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        employeeId: Number(raw.employeeId ?? raw.employee_id),
        invoiceId: Number(raw.invoiceId ?? raw.invoice_id),
        ruleType: String(raw.ruleType ?? raw.rule_type ?? ''),
        rate: Number(raw.rate ?? 0),
        basisAmount: Number(raw.basisAmount ?? raw.basis_amount ?? 0),
        commissionAmount: Number(raw.commissionAmount ?? raw.commission_amount ?? 0),
        status: String(raw.status ?? 'pending'),
        payslipId: raw.payslipId != null
            ? Number(raw.payslipId)
            : raw.payslip_id != null
              ? Number(raw.payslip_id)
              : null,
        computedAt: raw.computedAt != null
            ? String(raw.computedAt)
            : raw.computed_at != null
              ? String(raw.computed_at)
              : null,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

function fromSummaryRow(raw: Record<string, unknown>): CommissionSummaryRow {
    return {
        employeeId: Number(raw.employeeId ?? raw.employee_id),
        pendingCommissionTotal: Number(raw.pendingCommissionTotal ?? raw.pending_commission_total ?? 0),
        invoiceCount: Number(raw.invoiceCount ?? raw.invoice_count ?? 0),
    };
}

export async function getCommissionRules(): Promise<CommissionRule[]> {
    const r = await authFetch(`${API_BASE_URL}/commission/rules`);
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromRule(row as Record<string, unknown>));
}

export async function getCommissionSummary(): Promise<CommissionSummaryRow[]> {
    const r = await authFetch(`${API_BASE_URL}/commission/summary`);
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromSummaryRow(row as Record<string, unknown>));
}

export async function getCommissionRecords(employeeId?: number): Promise<CommissionRecord[]> {
    const qs = employeeId != null ? `?employeeId=${encodeURIComponent(String(employeeId))}` : '';
    const r = await authFetch(`${API_BASE_URL}/commission/records${qs}`);
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromRecord(row as Record<string, unknown>));
}

export async function calculateAll(): Promise<CalculateAllResult> {
    const r = await authFetch(`${API_BASE_URL}/commission/calculate-all`, { method: 'POST' });
    if (!r.ok) throw new Error(await readApiError(r));
    const raw = (await r.json()) as Record<string, unknown>;
    const records = Array.isArray(raw.records)
        ? (raw.records as Record<string, unknown>[]).map(fromRecord)
        : [];
    return {
        count: Number(raw.count ?? records.length),
        records,
    };
}

export async function calculateInvoice(invoiceId: number): Promise<CommissionRecord> {
    const r = await authFetch(
        `${API_BASE_URL}/commission/calculate/${encodeURIComponent(String(invoiceId))}`,
        { method: 'POST' },
    );
    if (!r.ok) throw new Error(await readApiError(r));
    return fromRecord((await r.json()) as Record<string, unknown>);
}

export function formatCommissionUsd(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}
