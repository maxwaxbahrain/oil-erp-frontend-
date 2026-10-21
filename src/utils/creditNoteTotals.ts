const EXCLUDED = new Set(['cancelled', 'void', 'draft']);

export type CreditNoteTotalInput = {
    status?: string | null;
    /** Note total. `totalCreditAmount` is the field on the loaded credit-note record. */
    total?: number | null;
    totalCreditAmount?: number | null;
    usedAmount?: number | null;
    remainingCredit?: number | null;
    expiryDate?: string | null;
};

export type CreditNoteTotals = {
    totalIssued: number;
    issuedCount: number;
    totalUsed: number;
    pendingUnused: number;
    expiringSoon: number;
};

function noteTotal(note: CreditNoteTotalInput): number {
    const raw = note.total ?? note.totalCreditAmount ?? 0;
    const amount = Number(raw);
    return Number.isFinite(amount) ? amount : 0;
}

function countsAsIssued(status: string | null | undefined): boolean {
    return !EXCLUDED.has(String(status ?? '').trim().toLowerCase());
}

export function computeCreditNoteTotals(
    notes: CreditNoteTotalInput[],
    today: Date = new Date(),
): CreditNoteTotals {
    const issued = notes.filter((note) => countsAsIssued(note.status));
    const totalIssued = issued.reduce((sum, note) => sum + noteTotal(note), 0);

    const totalUsed = notes.reduce((sum, note) => sum + (Number(note.usedAmount) || 0), 0);
    const pendingUnused = notes
        .filter((note) => note.status !== 'cancelled' && (Number(note.remainingCredit) || 0) > 0)
        .reduce((sum, note) => sum + (Number(note.remainingCredit) || 0), 0);

    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = notes.filter((note) => (Number(note.remainingCredit) || 0) > 0 && note.expiryDate).filter((note) => {
        const expiry = new Date(note.expiryDate as string);
        return expiry >= today && expiry <= in30;
    }).length;

    return {
        totalIssued,
        issuedCount: issued.length,
        totalUsed,
        pendingUnused,
        expiringSoon,
    };
}
