export type AgeBracket = '1-29' | '30-60' | '61-90' | '91-180' | '181-360' | '360+';

export const AGE_BRACKETS: { key: AgeBracket; label: string; from: number; to: number | null }[] = [
    { key: '1-29', label: '1–29 days', from: 1, to: 29 },
    { key: '30-60', label: '30–60 days', from: 30, to: 60 },
    { key: '61-90', label: '61–90 days', from: 61, to: 90 },
    { key: '91-180', label: '91–180 days', from: 91, to: 180 },
    { key: '181-360', label: '181–360 days', from: 181, to: 360 },
    { key: '360+', label: '360+ days', from: 361, to: null },
];

export function inAgeBracket(days: number, bracket: AgeBracket): boolean {
    const def = AGE_BRACKETS.find((b) => b.key === bracket);
    if (!def) return false;
    if (def.to == null) return days >= def.from;
    return days >= def.from && days <= def.to;
}

export function bracketForDays(days: number): AgeBracket | null {
    if (days <= 0) return null;
    for (const b of AGE_BRACKETS) {
        if (inAgeBracket(days, b.key)) return b.key;
    }
    return null;
}

export function emptyBracketStats(): Record<AgeBracket, { count: number; total: number }> {
    return {
        '1-29': { count: 0, total: 0 },
        '30-60': { count: 0, total: 0 },
        '61-90': { count: 0, total: 0 },
        '91-180': { count: 0, total: 0 },
        '181-360': { count: 0, total: 0 },
        '360+': { count: 0, total: 0 },
    };
}

export function bracketStatsFromDaysAndAmounts(
    rows: { days: number; amount: number }[],
): Record<AgeBracket, { count: number; total: number }> {
    const stats = emptyBracketStats();
    for (const row of rows) {
        const key = bracketForDays(row.days);
        if (!key) continue;
        stats[key].count += 1;
        stats[key].total += row.amount;
    }
    return stats;
}
