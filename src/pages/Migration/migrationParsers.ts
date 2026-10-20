export type PaymentMode = 'Cash' | 'Bank Transfer';
export type OpeningAccountName = 'Bank' | 'Cash on Hand' | 'Owner Capital';
export type NarrationInvoiceKind = 'credit_note' | 'bad_debt';

/** Cash on hand, petty cash, or any debit whose name contains "cash". */
export function paymentModeFromDebit(debit: string): PaymentMode {
    const normalized = debit.trim().toLowerCase();
    if (
        normalized === 'cash on hand'
        || normalized === 'petty cash'
        || normalized.includes('cash')
    ) {
        return 'Cash';
    }
    return 'Bank Transfer';
}

/** Prefer the due_date column; otherwise a `due YYYY-MM-DD` note in the narration. */
export function dueDateFrom(row: { due_date?: unknown; narration?: unknown }): string | null {
    if (row.due_date !== null && row.due_date !== undefined) {
        const fromColumn = String(row.due_date).trim();
        if (fromColumn) return fromColumn;
    }
    const narration = row.narration === null || row.narration === undefined ? '' : String(row.narration);
    const match = narration.match(/due (\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? null;
}

const NARRATION_INVOICE_PATTERNS: Record<NarrationInvoiceKind, RegExp> = {
    credit_note: /against\s+(INV-[A-Za-z0-9-]+)/,
    bad_debt: /write-off of\s+(INV-[A-Za-z0-9-]+)/,
};

export function invoiceNumberFromNarration(narration: string, kind: NarrationInvoiceKind): string | null {
    return narration.match(NARRATION_INVOICE_PATTERNS[kind])?.[1] ?? null;
}

export function openingAccountName(aType: string, aname: string): OpeningAccountName | null {
    if (aType === 'Cash-in-hand') return 'Cash on Hand';
    if (aType === 'Capital Account') return 'Owner Capital';
    if (aType === 'Bank Accounts' && aname === 'Bank - Operating Account') return 'Bank';
    return null;
}

export function sumLineDiscounts(items: { discount?: number }[]): number {
    const total = items.reduce((sum, item) => {
        const discount = item.discount;
        return sum + (typeof discount === 'number' && Number.isFinite(discount) ? discount : 0);
    }, 0);
    return Math.round(total * 100) / 100;
}
