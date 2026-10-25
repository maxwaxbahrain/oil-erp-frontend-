/**
 * Read-only list of a product's cost revaluations (GET /inventory/revaluations).
 * Amounts and quantities are shown as the backend recorded them.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { listRevaluations, type CostRevaluation } from '../../services/inventoryValuationService';
import { formatCurrency } from '../../services/settingsService';
import { formatStoredDateTime } from '../../utils/dates';

const SOURCE_LABELS: Record<string, string> = {
  product_edit: 'Product edit',
  csv_import: 'CSV import',
  sku_merge: 'SKU merge',
  manual: 'Manual',
};

export default function CostHistoryPanel({ productId, onClose }: { productId: number; onClose: () => void }) {
  const [rows, setRows] = useState<CostRevaluation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRevaluations(productId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof Error ? err.message : 'Could not load cost history.');
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return (
    <div
      role="dialog"
      aria-label="Cost history"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Cost history</h3>
          <button type="button" aria-label="Close cost history" onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>
        {error && <p className="mb-3 text-xs font-bold text-red-600">{error}</p>}
        {rows === null && <p className="text-xs text-gray-500">—</p>}
        {rows !== null && rows.length === 0 && !error && (
          <p className="text-xs text-gray-500">No cost changes recorded yet.</p>
        )}
        {rows !== null && rows.length > 0 && (
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">
                <tr>
                  {['Date', 'Cost', 'Quantity', 'Amount', 'Source', 'Reason', 'Journal'].map((label) => (
                    <th key={label} className="px-3 py-2">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100" data-testid={`revaluation-${row.id}`}>
                    <td className="px-3 py-2">{formatStoredDateTime(row.created_at)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.old_cost)} → {formatCurrency(row.new_cost)}</td>
                    <td className="px-3 py-2">{row.quantity}</td>
                    <td className="px-3 py-2">{formatCurrency(row.amount)}</td>
                    <td className="px-3 py-2">{SOURCE_LABELS[row.source] ?? row.source}</td>
                    <td className="px-3 py-2">{row.reason || '—'}</td>
                    <td className="px-3 py-2">{row.journal_entry_id != null ? `#${row.journal_entry_id}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
