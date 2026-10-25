import { getSystemSettings } from '../../services/settingsService';

export const CREDIT_DETAIL =
    'Open balance is unpaid invoices after allocations, minus unapplied credits.';

export const PRIORITY_PILLS = {
    urgent: { label: 'Urgent', background: '#B91C1C', color: '#FFFFFF' },
    today: { label: 'Today', background: '#F59E0B', color: '#1C1917' },
    fyi: { label: 'FYI', background: '#E2E8F0', color: '#1E293B' },
} as const;

export function attentionLabel(count: number): string {
    if (count === 1) return '1 needs attention';
    return `${count} need attention`;
}

export function priorityPill(priority: string): { label: string; background: string; color: string } {
    if (priority === 'urgent' || priority === 'today' || priority === 'fyi') {
        return PRIORITY_PILLS[priority];
    }
    return PRIORITY_PILLS.fyi;
}

export function groupedAmount(value: number): string {
    const amount = Number(value) || 0;
    const cents = Math.abs(amount - Math.round(amount)) > 0.001;
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: 2,
    });
}

export function companyAmount(value: number): string {
    const settings = getSystemSettings();
    const text = groupedAmount(value);
    if (settings.currencyPosition === 'before') {
        return `${settings.defaultCurrencySymbol} ${text}`;
    }
    return `${text} ${settings.defaultCurrencyCode}`;
}

export function signalFigure(card: { watcher_id?: string; money: number; why: string }): string {
    if (card.watcher_id === 'check_failed') return '';
    if (card.watcher_id === 'unresolved_posting_failures') {
        const count = Math.round(Number(card.money) || 0);
        return count === 1 ? '1 open' : `${count} open`;
    }
    if (card.watcher_id === 'near_credit_limit') {
        const match = String(card.why || '').match(/limit is ([0-9,]+\.[0-9]{2})/);
        if (match) {
            const limit = Number(match[1].replace(/,/g, ''));
            return `${companyAmount(card.money)} / ${groupedAmount(limit)} limit`;
        }
    }
    return companyAmount(card.money);
}

export function signalWhy(why: string): string {
    return why.replace(CREDIT_DETAIL, '').replace(/\s+/g, ' ').trim();
}

export function lastCheckedLabel(iso: string): string {
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return `Last checked: ${iso}`;
    const text = when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    return `Last checked: ${text}`;
}
