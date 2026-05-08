/**
 * Small-team Employee Self-Service helpers (max 10).
 * Persists role labels, monthly hours, and document metadata in localStorage.
 */

export const PORTAL_TEAM_MAX = 10;

export type PortalRole = 'Office' | 'Van Driver' | 'Salesman';

export interface PortalDocument {
    id: string;
    employeeId: string;
    name: string;
    category: string;
    addedAt: string;
}

export interface MonthlyHours {
    regularHours: number;
    overtimeHours: number;
}

const ROLES_KEY = 'ess_portal_roles_v1';
const HOURS_KEY = 'ess_monthly_hours_v1';
const DOCS_KEY = 'ess_documents_v1';

function stableHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

export function currentPeriod(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getPortalRoles(): Record<string, PortalRole> {
    try {
        const raw = localStorage.getItem(ROLES_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function setPortalRole(employeeId: string, role: PortalRole): void {
    const m = { ...getPortalRoles() };
    m[employeeId] = role;
    localStorage.setItem(ROLES_KEY, JSON.stringify(m));
}

/** Assigns Office / Van Driver / Salesman in rotation for any employee without a stored role. */
export function ensurePortalRoles<T extends { id: string }>(employees: T[]): Record<string, PortalRole> {
    const m = { ...getPortalRoles() };
    const roles: PortalRole[] = ['Office', 'Van Driver', 'Salesman'];
    let changed = false;
    employees.forEach((e, i) => {
        if (!m[e.id]) {
            m[e.id] = roles[i % 3];
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem(ROLES_KEY, JSON.stringify(m));
    }
    return m;
}

export function getMonthlyHours(employeeId: string, period: string = currentPeriod()): MonthlyHours {
    try {
        const raw = localStorage.getItem(HOURS_KEY);
        const all: Record<string, Record<string, MonthlyHours>> = raw ? JSON.parse(raw) : {};
        if (all[employeeId]?.[period]) {
            return all[employeeId][period];
        }
    } catch {
        /* fall through */
    }
    const h = stableHash(`${employeeId}|${period}`);
    return {
        regularHours: 140 + (h % 36),
        overtimeHours: h % 14
    };
}

export function saveMonthlyHours(employeeId: string, period: string, hours: MonthlyHours): void {
    try {
        const raw = localStorage.getItem(HOURS_KEY);
        const all: Record<string, Record<string, MonthlyHours>> = raw ? JSON.parse(raw || '{}') : {};
        if (!all[employeeId]) all[employeeId] = {};
        all[employeeId][period] = {
            regularHours: Math.max(0, Math.round(hours.regularHours)),
            overtimeHours: Math.max(0, Math.round(hours.overtimeHours))
        };
        localStorage.setItem(HOURS_KEY, JSON.stringify(all));
    } catch {
        /* ignore */
    }
}

function defaultDocs(employeeId: string): PortalDocument[] {
    const d = new Date().toISOString().split('T')[0];
    return [
        { id: `${employeeId}-d1`, employeeId, name: 'Employment contract', category: 'HR', addedAt: d },
        { id: `${employeeId}-d2`, employeeId, name: 'ID / license on file', category: 'Compliance', addedAt: d },
        { id: `${employeeId}-d3`, employeeId, name: 'Safety briefing (signed)', category: 'Training', addedAt: d }
    ];
}

export function getDocuments(employeeId: string): PortalDocument[] {
    try {
        const raw = localStorage.getItem(DOCS_KEY);
        const all: Record<string, PortalDocument[]> = raw ? JSON.parse(raw) : {};
        if (!all[employeeId]) {
            all[employeeId] = defaultDocs(employeeId);
            localStorage.setItem(DOCS_KEY, JSON.stringify(all));
        }
        return all[employeeId];
    } catch {
        return defaultDocs(employeeId);
    }
}

export function addPortalDocument(employeeId: string, name: string, category: string): PortalDocument {
    const doc: PortalDocument = {
        id: `doc-${Date.now()}`,
        employeeId,
        name: name.trim(),
        category: category.trim() || 'General',
        addedAt: new Date().toISOString().split('T')[0]
    };
    try {
        const raw = localStorage.getItem(DOCS_KEY);
        const all: Record<string, PortalDocument[]> = raw ? JSON.parse(raw || '{}') : {};
        if (!all[employeeId]) all[employeeId] = [];
        all[employeeId].unshift(doc);
        localStorage.setItem(DOCS_KEY, JSON.stringify(all));
    } catch {
        /* ignore */
    }
    return doc;
}
