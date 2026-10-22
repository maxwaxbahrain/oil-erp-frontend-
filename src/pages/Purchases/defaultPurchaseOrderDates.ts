import { localIsoDate, localIsoDatePlusDays } from '../../utils/localDate';

/** Order date and expected arrival for a new purchase order, on the local calendar. */
export function defaultPurchaseOrderDates(now: Date = new Date()): { date: string; expectedDate: string } {
    return {
        date: localIsoDate(now),
        expectedDate: localIsoDatePlusDays(7, now),
    };
}
