/** YYYY-MM-DD from the browser's local calendar (not UTC). */
export function localIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD, `days` ahead on the local calendar (negative days go backward). */
export function localIsoDatePlusDays(days: number, from: Date = new Date()): string {
  return localIsoDate(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
}

/** First local calendar day of `d`'s month, YYYY-MM-DD. */
export function localMonthStartIso(d: Date = new Date()): string {
  return localIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Last local calendar day of `d`'s month, YYYY-MM-DD. */
export function localMonthEndIso(d: Date = new Date()): string {
  return localIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
