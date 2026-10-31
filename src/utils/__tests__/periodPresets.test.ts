import { describe, expect, it } from 'vitest';
import { periodPresets } from '../periodPresets';

describe('periodPresets', () => {
    it('2026-10-31', () => {
        const presets = periodPresets(new Date(2026, 9, 31));
        expect(presets.map((p) => p.key)).toEqual(['mtd', 'ytd', 'lastq', 'lasty']);

        const mtd = presets.find((p) => p.key === 'mtd')!;
        expect(mtd.from).toBe('2026-10-01');
        expect(mtd.to).toBe('2026-10-31');
        expect(mtd.label).toContain('Oct');
        expect(mtd.label).toContain('2026');

        const ytd = presets.find((p) => p.key === 'ytd')!;
        expect(ytd.from).toBe('2026-01-01');
        expect(ytd.to).toBe('2026-10-31');
        expect(ytd.label).toContain('2026');

        const lastq = presets.find((p) => p.key === 'lastq')!;
        expect(lastq.from).toBe('2026-07-01');
        expect(lastq.to).toBe('2026-09-30');
        expect(lastq.label).toContain('Q3');
        expect(lastq.label).toContain('2026');

        const lasty = presets.find((p) => p.key === 'lasty')!;
        expect(lasty.from).toBe('2025-01-01');
        expect(lasty.to).toBe('2025-12-31');
        expect(lasty.label).toContain('2025');
    });

    it('2026-01-15', () => {
        const presets = periodPresets(new Date(2026, 0, 15));

        const mtd = presets.find((p) => p.key === 'mtd')!;
        expect(mtd.from).toBe('2026-01-01');
        expect(mtd.to).toBe('2026-01-15');

        const lastq = presets.find((p) => p.key === 'lastq')!;
        expect(lastq.from).toBe('2025-10-01');
        expect(lastq.to).toBe('2025-12-31');
        expect(lastq.label).toContain('Q4');
        expect(lastq.label).toContain('2025');
    });

    it('2027-04-05', () => {
        const presets = periodPresets(new Date(2027, 3, 5));

        const lastq = presets.find((p) => p.key === 'lastq')!;
        expect(lastq.from).toBe('2027-01-01');
        expect(lastq.to).toBe('2027-03-31');
        expect(lastq.label).toContain('Q1');
        expect(lastq.label).toContain('2027');
    });
});
