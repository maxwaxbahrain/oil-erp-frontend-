import { parseLocalDate } from './dates';

const MS_DAY = 86_400_000;

/**
 * Whole local calendar days from the due date to `now`'s local date.
 * 0 when due today; negative when not yet due.
 */
export function daysOverdue(dueDateIso: string, now: Date = new Date()): number {
    const due = parseLocalDate(dueDateIso);
    if (!due) return 0;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return Math.floor((today.getTime() - dueLocal.getTime()) / MS_DAY);
}
