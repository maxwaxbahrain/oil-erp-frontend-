/** Sell and buy by pack. The server owns stock and money; these helpers only shape the line the editors send. */

export type EnteredUom = 'base' | 'pack';

export interface PackProduct {
    id?: string;
    packQty?: number | null;
    packUnit?: string | null;
    baseUnit?: string | null;
    unit?: string | null;
}

export interface PackEntryValue {
    enteredQty: number;
    enteredUom: EnteredUom;
    enteredUnitPrice: number;
}

export interface DocumentEntry {
    enteredQty: number;
    enteredUom: EnteredUom;
    enteredUnitPrice: number;
    packQtySnapshot: number | null;
}

export type PriceKey = 'rate' | 'unitPrice' | 'unitCost';
export type AmountKey = 'amount' | 'total' | 'totalCost';

/** Whether a document line prefills from selling price or purchase cost. */
export type LinePriceSource = 'sell' | 'cost';

/** Base-unit price from the simple API product row (`getProducts`). Cost 0/null → null (no prefill). */
export function apiProductBaseUnitPrice(
    product: { unit_price?: number; cost_price?: number | null },
    source: LinePriceSource,
): number | null {
    if (source === 'cost') {
        const cost = product.cost_price;
        if (cost == null || cost === 0 || !Number.isFinite(Number(cost))) return null;
        return Number(cost);
    }
    const sell = Number(product.unit_price);
    return Number.isFinite(sell) ? sell : null;
}

/** Base-unit price from catalog / barcode lookup product. */
export function catalogProductBaseUnitPrice(
    product: { pricing?: { sellingPrice?: number; purchasePriceExWorks?: number }; cost?: number },
    source: LinePriceSource,
): number {
    if (source === 'cost') {
        const cost = Number(product.pricing?.purchasePriceExWorks ?? product.cost);
        return cost > 0 ? cost : 0;
    }
    return Number(product.pricing?.sellingPrice) || 0;
}

export function roundMoney(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function packSize(product?: PackProduct | null): number {
    const qty = Number(product?.packQty);
    return qty > 0 ? qty : 0;
}

export function hasPack(product?: PackProduct | null): boolean {
    return packSize(product) > 0;
}

export function baseUnitLabel(product?: PackProduct | null): string {
    const label = (product?.baseUnit || product?.unit || 'unit').trim();
    return label || 'unit';
}

export function packUnitLabel(product?: PackProduct | null): string {
    const label = (product?.packUnit || 'pack').trim();
    return label || 'pack';
}

function numOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/** Read the entry columns the document APIs return, in either casing. */
export function readDocumentEntry(
    raw: Record<string, unknown> | null | undefined,
    fallbackQty = 0,
    fallbackPrice = 0,
): DocumentEntry {
    const uomRaw = String(raw?.entered_uom ?? raw?.enteredUom ?? '').toLowerCase();
    const enteredUom: EnteredUom = uomRaw === 'pack' ? 'pack' : 'base';
    const enteredQtyRaw = numOrNull(raw?.entered_qty ?? raw?.enteredQty);
    const priceRaw = numOrNull(raw?.entered_unit_price ?? raw?.enteredUnitPrice);
    const snapshot = numOrNull(raw?.pack_qty_snapshot ?? raw?.packQtySnapshot);
    if (enteredUom === 'pack') {
        return {
            enteredUom,
            enteredQty: enteredQtyRaw != null && enteredQtyRaw > 0 ? enteredQtyRaw : fallbackQty,
            enteredUnitPrice: priceRaw != null ? priceRaw : fallbackPrice,
            packQtySnapshot: snapshot != null && snapshot > 0 ? snapshot : null,
        };
    }
    const qty = enteredQtyRaw != null && enteredQtyRaw > 0 ? enteredQtyRaw : fallbackQty;
    return {
        enteredUom: 'base',
        enteredQty: qty,
        enteredUnitPrice: priceRaw != null ? priceRaw : fallbackPrice,
        packQtySnapshot: null,
    };
}

export function entryMultiplier(
    product: PackProduct | null | undefined,
    snapshot: number | null | undefined,
    uom: EnteredUom,
): number {
    if (uom !== 'pack') return 1;
    const snap = Number(snapshot);
    if (snap > 0) return snap;
    return packSize(product);
}

export function toLinePayload(
    row: PackEntryValue & { packQty?: number | null; packQtySnapshot?: number | null },
    keys?: { price?: PriceKey; amount?: AmountKey },
): Record<string, number | string> {
    const priceKey = keys?.price ?? 'rate';
    const amountKey = keys?.amount ?? 'amount';
    const pack = entryMultiplier({ packQty: row.packQty }, row.packQtySnapshot, row.enteredUom);
    if (row.enteredUom === 'pack' && pack > 0) {
        const enteredQty = Number(row.enteredQty) || 0;
        const enteredUnitPrice = Number(row.enteredUnitPrice) || 0;
        const quantity = enteredQty * pack;
        return {
            quantity,
            [priceKey]: pack > 0 ? enteredUnitPrice / pack : 0,
            [amountKey]: roundMoney(enteredQty * enteredUnitPrice),
            entered_qty: enteredQty,
            entered_uom: 'pack',
            entered_unit_price: enteredUnitPrice,
        };
    }
    const quantity = Number(row.enteredQty) || 0;
    const price = Number(row.enteredUnitPrice) || 0;
    return {
        quantity,
        [priceKey]: price,
        [amountKey]: roundMoney(quantity * price),
        entered_qty: quantity,
        entered_uom: 'base',
        entered_unit_price: price,
    };
}

export function switchEntryUom(
    current: PackEntryValue,
    next: EnteredUom,
    product: PackProduct | null | undefined,
    basePrice: number,
    snapshot?: number | null,
): PackEntryValue {
    if (next === current.enteredUom) return current;
    const pack = next === 'base'
        ? entryMultiplier(product, snapshot, 'pack')
        : packSize(product);
    if (next === 'pack') {
        return {
            enteredUom: 'pack',
            enteredQty: current.enteredQty > 0 ? current.enteredQty : 1,
            enteredUnitPrice: roundMoney((Number(basePrice) || 0) * packSize(product)),
        };
    }
    return {
        enteredUom: 'base',
        enteredQty: (Number(current.enteredQty) || 0) * pack,
        enteredUnitPrice: Number(basePrice) || 0,
    };
}

export function formatPackLine(line: {
    entered_uom?: string | null;
    enteredUom?: string | null;
    entered_qty?: number | null;
    enteredQty?: number | null;
    pack_qty_snapshot?: number | null;
    packQtySnapshot?: number | null;
    packUnit?: string | null;
    pack_unit?: string | null;
    baseUnit?: string | null;
    base_unit?: string | null;
    unit?: string | null;
}): string | null {
    const uom = String(line.entered_uom ?? line.enteredUom ?? '').toLowerCase();
    if (uom !== 'pack') return null;
    const entered = Number(line.entered_qty ?? line.enteredQty);
    const snap = Number(line.pack_qty_snapshot ?? line.packQtySnapshot);
    if (!(entered > 0) || !(snap > 0)) return null;
    const packUnit = (line.packUnit || line.pack_unit || 'pack').trim() || 'pack';
    const baseUnit = (line.baseUnit || line.base_unit || line.unit || 'unit').trim() || 'unit';
    const base = entered * snap;
    const enteredText = Number.isInteger(entered) ? String(entered) : String(entered);
    const baseText = Number.isInteger(base) ? String(base) : String(roundMoney(base));
    return `${enteredText} ${packUnit} (${baseText} ${baseUnit})`;
}

export function formatLineQuantity(
    line: {
        quantity?: number | null;
        entered_uom?: string | null;
        enteredUom?: string | null;
        entered_qty?: number | null;
        enteredQty?: number | null;
        pack_qty_snapshot?: number | null;
        packQtySnapshot?: number | null;
        packUnit?: string | null;
        pack_unit?: string | null;
        baseUnit?: string | null;
        base_unit?: string | null;
        unit?: string | null;
    },
    product?: PackProduct | null,
): string {
    const packed = formatPackLine({
        ...line,
        packUnit: line.packUnit || line.pack_unit || product?.packUnit,
        baseUnit: line.baseUnit || line.base_unit || product?.baseUnit || product?.unit,
    });
    if (packed) return packed;
    return String(line.quantity ?? '');
}

export interface BarcodeScanPlan {
    mode: EnteredUom;
    index: number;
    enteredQty: number;
    quantity: number;
    enteredUnitPrice: number;
    packQtySnapshot: number | null;
    add: number;
}

/** Decide pack vs base from a lookup, then add a line or increment the matching counter. */
export function planBarcodeScan(
    lines: Array<{
        productId?: string;
        enteredUom?: string | null;
        enteredQty?: number;
        quantity?: number;
        enteredUnitPrice?: number;
    }>,
    product: PackProduct & { id: string },
    matchedPackQty: number | null | undefined,
    basePrice: number,
): BarcodeScanPlan {
    const matched = matchedPackQty == null ? null : Number(matchedPackQty);
    const pack = packSize(product);
    const mode: EnteredUom = matched != null && Number.isFinite(matched) && pack > 0 && matched === pack
        ? 'pack'
        : 'base';
    const index = lines.findIndex((line) =>
        String(line.productId || '') === String(product.id)
        && (line.enteredUom === 'pack' ? 'pack' : 'base') === mode
        && String(line.productId || '') !== '',
    );
    const existing = index >= 0 ? lines[index] : undefined;
    if (mode === 'pack') {
        const add = 1;
        const prevQty = index >= 0 ? Number(existing?.enteredQty) || 0 : 0;
        const enteredQty = index >= 0 ? prevQty + add : 1;
        const price = index >= 0 && existing?.enteredUnitPrice != null
            ? Number(existing.enteredUnitPrice)
            : roundMoney((Number(basePrice) || 0) * pack);
        return {
            mode,
            index,
            add,
            enteredQty,
            quantity: enteredQty * pack,
            enteredUnitPrice: price,
            packQtySnapshot: pack,
        };
    }
    const add = matched != null && Number.isFinite(matched) && matched > 0 ? matched : 1;
    const prevQty = index >= 0 ? Number(existing?.quantity) || 0 : 0;
    const quantity = index >= 0 ? prevQty + add : add;
    return {
        mode,
        index,
        add,
        enteredQty: quantity,
        quantity,
        enteredUnitPrice: index >= 0 && existing?.enteredUnitPrice != null
            ? Number(existing.enteredUnitPrice)
            : Number(basePrice) || 0,
        packQtySnapshot: null,
    };
}
