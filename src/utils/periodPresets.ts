import { localIsoDate, localMonthStartIso } from './localDate';

export const PERIOD_PRESET_CUSTOM = 'custom';

export type PeriodPresetKey = 'mtd' | 'ytd' | 'lastq' | 'lasty';

export interface PeriodPreset {
    key: PeriodPresetKey;
    label: string;
    from: string;
    to: string;
}

function monthYearLabel(d: Date): string {
    return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

function lastCompletedQuarterRange(now: Date): { from: string; to: string; quarter: number; year: number } {
    const y = now.getFullYear();
    const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const lastQuarterEnd = new Date(y, currentQuarterStartMonth, 0);
    const lastQuarterStartMonth = Math.floor(lastQuarterEnd.getMonth() / 3) * 3;
    const from = localIsoDate(new Date(lastQuarterEnd.getFullYear(), lastQuarterStartMonth, 1));
    const to = localIsoDate(lastQuarterEnd);
    const quarter = Math.floor(lastQuarterStartMonth / 3) + 1;
    return { from, to, quarter, year: lastQuarterEnd.getFullYear() };
}

/** Preset period ranges for financial reports (local calendar dates). */
export function periodPresets(now: Date = new Date()): PeriodPreset[] {
    const today = localIsoDate(now);
    const year = now.getFullYear();
    const lastQuarter = lastCompletedQuarterRange(now);
    const priorYear = year - 1;

    return [
        {
            key: 'mtd',
            label: `This month · ${monthYearLabel(now)}`,
            from: localMonthStartIso(now),
            to: today,
        },
        {
            key: 'ytd',
            label: `Year to date · ${year}`,
            from: `${year}-01-01`,
            to: today,
        },
        {
            key: 'lastq',
            label: `Last quarter · Q${lastQuarter.quarter} ${lastQuarter.year}`,
            from: lastQuarter.from,
            to: lastQuarter.to,
        },
        {
            key: 'lasty',
            label: `Last year · ${priorYear}`,
            from: `${priorYear}-01-01`,
            to: `${priorYear}-12-31`,
        },
    ];
}
