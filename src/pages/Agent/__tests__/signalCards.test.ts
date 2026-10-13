import { describe, expect, it } from 'vitest';

import {
    CREDIT_DETAIL,
    attentionLabel,
    companyAmount,
    priorityPill,
    signalFigure,
    signalWhy,
} from '../signalCards';

describe('signal cards', () => {
    it('formats the company currency and the credit figure', () => {
        localStorage.setItem('zavi_system_settings', JSON.stringify({
            defaultCurrencyCode: 'BHD',
            defaultCurrencySymbol: 'BHD',
            currencyFormat: 'comma_dot',
            currencyPosition: 'before',
        }));
        expect(companyAmount(1250.5)).toBe('BHD 1,250.50');
        expect(companyAmount(110)).toBe('BHD 110');
        expect(signalFigure({
            watcher_id: 'near_credit_limit',
            money: 110,
            why: 'Open balance is 110.00 and the limit is 100.00.',
        })).toBe('BHD 110 / 100 limit');
        expect(signalFigure({ money: 40, why: 'Stock is below the minimum.' })).toBe('BHD 40');
    });

    it('uses the priority colors and hides the technical sentence', () => {
        expect(priorityPill('urgent')).toEqual({ label: 'Urgent', background: '#B91C1C', color: '#FFFFFF' });
        expect(priorityPill('today')).toEqual({ label: 'Today', background: '#F59E0B', color: '#1C1917' });
        expect(priorityPill('fyi')).toEqual({ label: 'FYI', background: '#E2E8F0', color: '#1E293B' });
        expect(attentionLabel(2)).toBe('2 need attention');
        expect(attentionLabel(1)).toBe('1 needs attention');
        const shown = signalWhy(`Open balance is 110.00 and the limit is 100.00. ${CREDIT_DETAIL}`);
        expect(shown).toBe('Open balance is 110.00 and the limit is 100.00.');
        expect(shown).not.toContain('unpaid invoices');
        expect(CREDIT_DETAIL).toContain('unpaid invoices after allocations');
    });
});
