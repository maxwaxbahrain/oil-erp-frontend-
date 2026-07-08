// Leave management — tenant-scoped HR API (Phase 2c)

import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';

// Legacy display types (payrollService still imports these)
export type LeaveType =
    | 'Paid Time Off'
    | 'Sick Leave'
    | 'Casual Leave'
    | 'Maternity/Paternity'
    | 'Bereavement'
    | 'Unpaid Leave'
    | 'Work From Home';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface Holiday {
    date: string;
    name: string;
    isMandatory: boolean;
}

export interface LeavePolicy {
    id: number;
    tenantId?: number | null;
    leaveType: string;
    annualQuotaDays: number;
    requiresApproval: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface LeaveBalance {
    id: number;
    tenantId?: number | null;
    employeeId: number;
    leaveType: string;
    year: number;
    quotaDays: number;
    usedDays: number;
    availableDays: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface LeaveRequest {
    id: number;
    tenantId?: number | null;
    employeeId: number;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason?: string | null;
    status: string;
    approvedBy?: number | null;
    approvedOn?: string | null;
    rejectionReason?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface SubmitLeaveRequestInput {
    employeeId: number | string;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason?: string | null;
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

function fromPolicy(raw: Record<string, unknown>): LeavePolicy {
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        leaveType: String(raw.leaveType ?? raw.leave_type ?? ''),
        annualQuotaDays: Number(raw.annualQuotaDays ?? raw.annual_quota_days ?? 0),
        requiresApproval: Boolean(raw.requiresApproval ?? raw.requires_approval ?? true),
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

function fromBalance(raw: Record<string, unknown>): LeaveBalance {
    const quotaDays = Number(raw.quotaDays ?? raw.quota_days ?? 0);
    const usedDays = Number(raw.usedDays ?? raw.used_days ?? 0);
    const availableRaw = raw.availableDays ?? raw.available_days;
    const availableDays = availableRaw != null
        ? Number(availableRaw)
        : quotaDays - usedDays;
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        employeeId: Number(raw.employeeId ?? raw.employee_id),
        leaveType: String(raw.leaveType ?? raw.leave_type ?? ''),
        year: Number(raw.year ?? new Date().getFullYear()),
        quotaDays,
        usedDays,
        availableDays,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

function fromRequest(raw: Record<string, unknown>): LeaveRequest {
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        employeeId: Number(raw.employeeId ?? raw.employee_id),
        leaveType: String(raw.leaveType ?? raw.leave_type ?? ''),
        startDate: String(raw.startDate ?? raw.start_date ?? '').slice(0, 10),
        endDate: String(raw.endDate ?? raw.end_date ?? '').slice(0, 10),
        daysCount: Number(raw.daysCount ?? raw.days_count ?? 0),
        reason: raw.reason != null ? String(raw.reason) : null,
        status: String(raw.status ?? 'pending').toLowerCase(),
        approvedBy: raw.approvedBy != null ? Number(raw.approvedBy) : raw.approved_by != null ? Number(raw.approved_by) : null,
        approvedOn: raw.approvedOn != null ? String(raw.approvedOn) : raw.approved_on != null ? String(raw.approved_on) : null,
        rejectionReason: raw.rejectionReason != null
            ? String(raw.rejectionReason)
            : raw.rejection_reason != null
              ? String(raw.rejection_reason)
              : null,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

export async function getLeavePolicies(): Promise<LeavePolicy[]> {
    const r = await authFetch(`${API_BASE_URL}/leave/policies`);
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromPolicy(row as Record<string, unknown>));
}

export async function getLeaveBalances(employeeId: number | string): Promise<LeaveBalance[]> {
    const r = await authFetch(
        `${API_BASE_URL}/leave/balances?employeeId=${encodeURIComponent(String(employeeId))}`,
    );
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromBalance(row as Record<string, unknown>));
}

export async function getLeaveRequests(employeeId: number | string): Promise<LeaveRequest[]> {
    const r = await authFetch(
        `${API_BASE_URL}/leave/requests?employeeId=${encodeURIComponent(String(employeeId))}`,
    );
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromRequest(row as Record<string, unknown>));
}

/** Tenant-wide leave queue (no employeeId filter) — for manager approvals. */
export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
    const r = await authFetch(`${API_BASE_URL}/leave/requests`);
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromRequest(row as Record<string, unknown>));
}

export async function submitLeaveRequest(payload: SubmitLeaveRequestInput): Promise<LeaveRequest> {
    const r = await authFetch(`${API_BASE_URL}/leave/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            employeeId: Number(payload.employeeId),
            leaveType: payload.leaveType,
            startDate: payload.startDate,
            endDate: payload.endDate,
            daysCount: payload.daysCount,
            reason: payload.reason ?? null,
        }),
    });
    if (!r.ok) throw new Error(await readApiError(r));
    return fromRequest((await r.json()) as Record<string, unknown>);
}

export async function approveLeaveRequest(requestId: number | string): Promise<LeaveRequest> {
    const r = await authFetch(
        `${API_BASE_URL}/leave/requests/${encodeURIComponent(String(requestId))}/approve`,
        { method: 'POST' },
    );
    if (!r.ok) throw new Error(await readApiError(r));
    return fromRequest((await r.json()) as Record<string, unknown>);
}

export async function rejectLeaveRequest(
    requestId: number | string,
    rejectionReason?: string | null,
): Promise<LeaveRequest> {
    const r = await authFetch(
        `${API_BASE_URL}/leave/requests/${encodeURIComponent(String(requestId))}/reject`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejectionReason: rejectionReason ?? null }),
        },
    );
    if (!r.ok) throw new Error(await readApiError(r));
    return fromRequest((await r.json()) as Record<string, unknown>);
}

export async function cancelLeaveRequest(requestId: number | string): Promise<LeaveRequest> {
    const r = await authFetch(
        `${API_BASE_URL}/leave/requests/${encodeURIComponent(String(requestId))}/cancel`,
        { method: 'POST' },
    );
    if (!r.ok) throw new Error(await readApiError(r));
    return fromRequest((await r.json()) as Record<string, unknown>);
}

/** Merge API balances with policies for types that have no balance row yet (current year). */
export async function getLeaveBalanceSummary(employeeId: number | string): Promise<LeaveBalance[]> {
    const year = new Date().getFullYear();
    const [balances, policies] = await Promise.all([
        getLeaveBalances(employeeId),
        getLeavePolicies().catch(() => [] as LeavePolicy[]),
    ]);

    const currentYearBalances = balances.filter((b) => b.year === year);
    const byType = new Map(currentYearBalances.map((b) => [b.leaveType, b]));

    for (const policy of policies) {
        if (!byType.has(policy.leaveType)) {
            byType.set(policy.leaveType, {
                id: 0,
                employeeId: Number(employeeId),
                leaveType: policy.leaveType,
                year,
                quotaDays: policy.annualQuotaDays,
                usedDays: 0,
                availableDays: policy.annualQuotaDays,
            });
        }
    }

    return Array.from(byType.values()).sort((a, b) => a.leaveType.localeCompare(b.leaveType));
}

// Holidays remain mock until a later phase
export const getUpcomingHolidays = (): Holiday[] => [
    { date: '2025-01-01', name: "New Year's Day", isMandatory: true },
    { date: '2025-01-20', name: 'Martin Luther King Jr. Day', isMandatory: true },
    { date: '2025-05-26', name: 'Memorial Day', isMandatory: true },
    { date: '2025-07-04', name: 'Independence Day', isMandatory: true },
    { date: '2025-09-01', name: 'Labor Day', isMandatory: true },
    { date: '2025-11-27', name: 'Thanksgiving Day', isMandatory: true },
    { date: '2025-12-25', name: 'Christmas Day', isMandatory: true },
];
