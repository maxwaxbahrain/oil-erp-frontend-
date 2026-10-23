import { useState } from 'react';
import {
    baseUnitLabel,
    entryMultiplier,
    hasPack,
    packUnitLabel,
    switchEntryUom,
    type EnteredUom,
    type PackEntryValue,
    type PackProduct,
} from '../../utils/packEntry';

export { toLinePayload, planBarcodeScan, formatPackLine, formatLineQuantity, readDocumentEntry } from '../../utils/packEntry';

export interface PackQtyInputProps {
    product?: PackProduct | null;
    value: PackEntryValue;
    onChange: (value: PackEntryValue) => void;
    /** Price the row uses in base mode. Pack mode prefills this × packQty when the unit toggles. */
    basePrice: number;
    priceEditable?: boolean;
    /** Loaded pack rows caption from this snapshot, not the product's current packQty. */
    packQtySnapshot?: number | null;
    disabled?: boolean;
    quantityAriaLabel?: string;
}

const qtyClass = 'w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm text-right font-mono font-bold focus:border-[#4F8EF7] focus:outline-none';

export default function PackQtyInput({
    product,
    value,
    onChange,
    basePrice,
    priceEditable = true,
    packQtySnapshot,
    disabled = false,
    quantityAriaLabel = 'Quantity',
}: PackQtyInputProps) {
    const showToggle = hasPack(product) || value.enteredUom === 'pack';
    const multiplier = entryMultiplier(product, packQtySnapshot, value.enteredUom);
    const baseUnits = (Number(value.enteredQty) || 0) * multiplier;

    const setQty = (raw: string) => {
        onChange({ ...value, enteredQty: raw === '' ? 0 : Number(raw) || 0 });
    };

    return (
        <div className="space-y-1">
            {showToggle && hasPack(product) && (
                <div role="group" aria-label="Unit" className="flex rounded-lg overflow-hidden border border-gray-300 text-[10px] font-black uppercase">
                    <UnitButton
                        pressed={value.enteredUom !== 'pack'}
                        label={baseUnitLabel(product)}
                        onClick={() => onChange(switchEntryUom(value, 'base', product, basePrice, packQtySnapshot))}
                    />
                    <UnitButton
                        pressed={value.enteredUom === 'pack'}
                        label={packUnitLabel(product)}
                        onClick={() => onChange(switchEntryUom(value, 'pack', product, basePrice, packQtySnapshot))}
                    />
                </div>
            )}
            <input
                type="number"
                aria-label={value.enteredUom === 'pack' ? 'Pack quantity' : quantityAriaLabel}
                min="0"
                step="any"
                disabled={disabled}
                value={value.enteredQty || ''}
                onChange={(e) => setQty(e.target.value)}
                className={qtyClass}
            />
            {value.enteredUom === 'pack' && (
                <>
                    <input
                        type="number"
                        aria-label="Price per pack"
                        min="0"
                        step="0.01"
                        readOnly={!priceEditable}
                        disabled={disabled}
                        value={value.enteredUnitPrice || ''}
                        onChange={(e) => {
                            if (!priceEditable) return;
                            onChange({
                                ...value,
                                enteredUnitPrice: e.target.value === '' ? 0 : Number(e.target.value) || 0,
                            });
                        }}
                        className={`${qtyClass} ${priceEditable ? '' : 'bg-gray-100'}`}
                    />
                    <p className="text-[10px] font-semibold text-gray-500 text-right">
                        = {Number.isInteger(baseUnits) ? baseUnits : baseUnits.toFixed(2)} {baseUnitLabel(product)}
                    </p>
                </>
            )}
        </div>
    );
}

function UnitButton({ pressed, label, onClick }: { pressed: boolean; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={`flex-1 px-2 py-1 ${pressed ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}
        >
            {label}
        </button>
    );
}

export function BarcodeScanField({ onScan }: { onScan: (code: string) => void | Promise<void> }) {
    const [code, setCode] = useState('');
    return (
        <form
            className="flex gap-2 items-center"
            onSubmit={(event) => {
                event.preventDefault();
                const next = code.trim();
                if (!next) return;
                setCode('');
                void onScan(next);
            }}
        >
            <input
                aria-label="Scan barcode"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Scan barcode"
                className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
            <button type="submit" className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-black uppercase">
                Scan
            </button>
        </form>
    );
}

export type { EnteredUom, PackEntryValue, PackProduct };
