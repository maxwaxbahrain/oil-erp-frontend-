import type { SalesmanPickerOption } from '../services/employeeService';

/** Parse legacy "Salesman: …" line from invoice/quotation notes. */
export function parseSalesmanNameFromNotes(notes: string | null | undefined): string | null {
    if (!notes) return null;
    for (const line of notes.split('\n')) {
        const stripped = line.trim();
        if (stripped.toLowerCase().startsWith('salesman:')) {
            const value = stripped.slice(stripped.indexOf(':') + 1).trim();
            return value || null;
        }
    }
    return null;
}

export function buildSalesmanNameById(salesmen: SalesmanPickerOption[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const s of salesmen) {
        map.set(String(s.id), s.name);
    }
    return map;
}

const EM_DASH = '—';

/**
 * Display name for list/report cells: FK employee name first, then legacy text/notes.
 * Returns "—" when unknown (never an empty cell).
 */
export function resolveSalesmanDisplayName(
    opts: {
        salesmanEmployeeId?: number | string | null;
        legacyName?: string | null;
        notes?: string | null;
        salesmanById: Map<string, string>;
    },
): string {
    const fk = opts.salesmanEmployeeId;
    if (fk != null && String(fk).trim() !== '') {
        const fromFk = opts.salesmanById.get(String(fk));
        if (fromFk?.trim()) return fromFk.trim();
    }
    const legacy = (opts.legacyName ?? '').trim() || parseSalesmanNameFromNotes(opts.notes) || '';
    return legacy || EM_DASH;
}
