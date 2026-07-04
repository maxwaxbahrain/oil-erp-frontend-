import { memo } from 'react';
import { Trash2 } from 'lucide-react';
import SearchableSelect from '../../components/common/SearchableSelect';
import type { Product } from '../../services/api';

export interface InvoiceLineItem {
    id: string;
    productId: string;
    product: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    isService?: boolean;
    lineDiscount?: number;
    lineTaxRate?: number;
}

type InvoiceLineRowProps = {
    item: InvoiceLineItem;
    products: Product[];
    onProductSelect: (lineId: string, productId: string) => void;
    onLineItemChange: (id: string, field: keyof InvoiceLineItem, value: string | number) => void;
    onRemove: (id: string) => void;
};

function InvoiceLineRow({
    item,
    products,
    onProductSelect,
    onLineItemChange,
    onRemove,
}: InvoiceLineRowProps) {
    const isServiceLine = !!item.isService;
    const selectedProd = !isServiceLine
        ? products.find(p => String(p.id) === String(item.productId))
        : undefined;
    const availableStock = selectedProd
        ? Number((selectedProd as { stock?: number; current_stock?: number }).stock
            ?? (selectedProd as { current_stock?: number }).current_stock ?? 0)
        : null;
    const qty = Number(item.quantity) || 0;
    const overStock = !isServiceLine && availableStock !== null && qty > availableStock;

    return (
        <tr className="hover:bg-gray-50">
            <td className="px-4 py-3">
                {isServiceLine ? (
                    <input
                        type="text"
                        value={item.product}
                        onChange={(e) => onLineItemChange(item.id, 'product', e.target.value)}
                        placeholder="Service or cargo charge name..."
                        className="w-full rounded-lg px-3 py-2 text-sm font-bold focus:outline-none placeholder:text-[#8BA3C7]"
                        style={{
                            border: '0.5px solid var(--color-border-tertiary)',
                            background: 'var(--color-background-primary)',
                            color: 'var(--color-text-primary)',
                        }}
                    />
                ) : (
                    <SearchableSelect
                        options={products}
                        value={item.productId}
                        onChange={(productId) => onProductSelect(item.id, productId)}
                        placeholder="Search product..."
                        displayKey="name"
                        theme="dark"
                    />
                )}
                {!isServiceLine && selectedProd && availableStock !== null && (
                    <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                        availableStock === 0
                            ? 'bg-rose-100 text-rose-700'
                            : availableStock < 10
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                    }`}>
                        In stock: {availableStock} {(selectedProd as { unit?: string }).unit || 'units'}
                    </div>
                )}
            </td>

            <td className="px-4 py-3">
                <textarea
                    value={item.description}
                    onChange={(e) => onLineItemChange(item.id, 'description', e.target.value)}
                    placeholder="Item description..."
                    rows={2}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#4F8EF7] focus:outline-none resize-none"
                />
            </td>

            <td className="px-4 py-3">
                <input
                    type="number"
                    value={item.quantity || ''}
                    onChange={(e) => onLineItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    min="1"
                    placeholder="Enter quantity"
                    className={`w-full border-2 rounded-lg px-3 py-2 text-sm text-center font-mono font-bold focus:outline-none ${
                        overStock
                            ? 'border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-500'
                            : 'border-gray-300 focus:border-[#4F8EF7]'
                    }`}
                />
                {overStock && (
                    <p className="text-[10px] font-bold text-rose-600 mt-1 text-center">
                        Only {availableStock} in stock
                    </p>
                )}
            </td>

            <td className="px-3 py-3">
                <input
                    type="number"
                    value={item.rate || ''}
                    onChange={(e) => onLineItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    placeholder="Enter rate"
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm text-center font-mono font-bold focus:border-[#4F8EF7] focus:outline-none"
                />
            </td>

            <td className="px-2 py-3">
                <input
                    type="number"
                    value={item.lineDiscount || ''}
                    onChange={(e) => onLineItemChange(item.id, 'lineDiscount', parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                    className="w-full border-2 border-gray-300 rounded-lg px-2 py-2 text-sm text-center font-mono font-bold focus:border-[#4F8EF7] focus:outline-none"
                />
            </td>

            <td className="px-2 py-3">
                <input
                    type="number"
                    value={item.lineTaxRate || ''}
                    onChange={(e) => onLineItemChange(item.id, 'lineTaxRate', parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                    className="w-full border-2 border-gray-300 rounded-lg px-2 py-2 text-sm text-center font-mono font-bold focus:border-[#4F8EF7] focus:outline-none"
                />
            </td>

            <td className="px-4 py-3 text-right font-mono font-black text-base text-gray-900">
                {item.amount.toLocaleString()}
            </td>

            <td className="px-4 py-3 text-center">
                <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove item"
                >
                    <Trash2 size={18} />
                </button>
            </td>
        </tr>
    );
}

export default memo(InvoiceLineRow);
