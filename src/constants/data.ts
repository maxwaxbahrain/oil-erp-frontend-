export interface Salesman { id: string; name: string; code: string; phone?: string }

const DEFAULT_SALESMEN: Salesman[] = [
    { id: 'S001', name: 'John Doe', code: 'EMP-01' },
    { id: 'S002', name: 'Sarah Jones', code: 'EMP-02' },
    { id: 'S003', name: 'Mike Miller', code: 'EMP-03' },
    { id: 'S004', name: 'Emily Davis', code: 'EMP-04' },
    { id: 'S005', name: 'Robert Wilson', code: 'EMP-05' },
];

const SALESMEN_KEY = 'soltol_salesmen';

// ITEM 7A — Backed by localStorage so users can add new salesmen
// on-the-fly from the invoice form (or Sales Order — ITEM 12C).
// Read-time defaults to DEFAULT_SALESMEN on first run.
export function getSalesmen(): Salesman[] {
    try {
        const raw = localStorage.getItem(SALESMEN_KEY);
        if (raw) return JSON.parse(raw) as Salesman[];
        localStorage.setItem(SALESMEN_KEY, JSON.stringify(DEFAULT_SALESMEN));
        return DEFAULT_SALESMEN;
    } catch {
        return DEFAULT_SALESMEN;
    }
}

export function addSalesman(input: { name: string; phone?: string }): Salesman {
    const list = getSalesmen();
    const nextNum = list.reduce((max, s) => {
        const m = /S(\d+)/.exec(s.id);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0) + 1;
    const newOne: Salesman = {
        id: `S${String(nextNum).padStart(3, '0')}`,
        name: input.name.trim(),
        code: `EMP-${String(nextNum).padStart(2, '0')}`,
        phone: input.phone?.trim() || undefined,
    };
    const next = [...list, newOne];
    try { localStorage.setItem(SALESMEN_KEY, JSON.stringify(next)); } catch { /* quota */ }
    return newOne;
}

// Back-compat export — many call sites just import SALESMEN as a static list.
// They'll get whatever is in localStorage at module-load time.
export const SALESMEN: Salesman[] = getSalesmen();

export const VANS = [
    { id: 'V001', name: 'Van 01 - North Route', code: 'VAN-01', route: 'North' },
    { id: 'V002', name: 'Van 02 - South Route', code: 'VAN-02', route: 'South' },
    { id: 'V003', name: 'Van 03 - East Route', code: 'VAN-03', route: 'East' },
    { id: 'V004', name: 'Van 04 - West Route', code: 'VAN-04', route: 'West' },
    { id: 'V005', name: 'Van 05 - Central Route', code: 'VAN-05', route: 'Central' },
];

export const PAYMENT_METHODS = [
    'Cash',
    'Bank Transfer',
    'Zelle / Instant Payment from App',
    'Check',
    'Credit Card',
    'Debit Card',
    'Wire Transfer',
    'PayPal',
    'Venmo',
    'Cash App',
    'Other'
];
