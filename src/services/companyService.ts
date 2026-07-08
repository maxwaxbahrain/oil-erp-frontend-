// Company announcements + holidays — tenant-scoped API (Phase 4b)

import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';

export interface ApiAnnouncement {
    id: number;
    tenantId?: number | null;
    title: string;
    body: string;
    isPinned: boolean;
    createdBy?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface ApiCompanyHoliday {
    id: number;
    tenantId?: number | null;
    name: string;
    holidayDate: string;
    isCompanyClosed: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface CreateAnnouncementInput {
    title: string;
    body: string;
    isPinned?: boolean;
}

export interface CreateHolidayInput {
    name: string;
    holidayDate: string;
    isCompanyClosed?: boolean;
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

function fromAnnouncement(raw: Record<string, unknown>): ApiAnnouncement {
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        title: String(raw.title ?? ''),
        body: String(raw.body ?? ''),
        isPinned: Boolean(raw.isPinned ?? raw.is_pinned ?? false),
        createdBy: raw.createdBy != null
            ? Number(raw.createdBy)
            : raw.created_by != null
              ? Number(raw.created_by)
              : null,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

function fromHoliday(raw: Record<string, unknown>): ApiCompanyHoliday {
    const holidayDate = raw.holidayDate ?? raw.holiday_date;
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        name: String(raw.name ?? ''),
        holidayDate: holidayDate != null ? String(holidayDate).slice(0, 10) : '',
        isCompanyClosed: Boolean(raw.isCompanyClosed ?? raw.is_company_closed ?? true),
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

export async function getAnnouncements(): Promise<ApiAnnouncement[]> {
    const r = await authFetch(`${API_BASE_URL}/announcements`);
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromAnnouncement(row as Record<string, unknown>));
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<ApiAnnouncement> {
    const r = await authFetch(`${API_BASE_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: input.title,
            body: input.body,
            isPinned: input.isPinned ?? false,
        }),
    });
    if (!r.ok) throw new Error(await readApiError(r));
    return fromAnnouncement((await r.json()) as Record<string, unknown>);
}

export async function deleteAnnouncement(id: number | string): Promise<void> {
    const r = await authFetch(`${API_BASE_URL}/announcements/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!r.ok) throw new Error(await readApiError(r));
}

export async function getHolidays(): Promise<ApiCompanyHoliday[]> {
    const r = await authFetch(`${API_BASE_URL}/holidays`);
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromHoliday(row as Record<string, unknown>));
}

export async function createHoliday(input: CreateHolidayInput): Promise<ApiCompanyHoliday> {
    const r = await authFetch(`${API_BASE_URL}/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: input.name,
            holidayDate: input.holidayDate,
            isCompanyClosed: input.isCompanyClosed ?? true,
        }),
    });
    if (!r.ok) throw new Error(await readApiError(r));
    return fromHoliday((await r.json()) as Record<string, unknown>);
}

export async function deleteHoliday(id: number | string): Promise<void> {
    const r = await authFetch(`${API_BASE_URL}/holidays/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!r.ok) throw new Error(await readApiError(r));
}

export function formatRelativeTime(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isRecentAnnouncement(iso?: string | null, withinDays = 7): boolean {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const diffMs = Date.now() - d.getTime();
    return diffMs >= 0 && diffMs <= withinDays * 24 * 60 * 60 * 1000;
}

export function upcomingHolidays(holidays: ApiCompanyHoliday[]): ApiCompanyHoliday[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return holidays.filter((h) => {
        const d = new Date(`${h.holidayDate}T00:00:00`);
        return !Number.isNaN(d.getTime()) && d >= today;
    });
}

export function formatHolidayMonthDay(holidayDate: string): { month: string; day: string } {
    const d = new Date(`${holidayDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return { month: '—', day: '—' };
    return {
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        day: String(d.getDate()),
    };
}
