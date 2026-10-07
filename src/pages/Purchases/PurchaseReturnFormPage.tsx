import { useEffect, useMemo, useState } from 'react';
import { useMatch, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { useBankingAccounts } from '../../hooks/useBankingAccounts';
import { getProducts, type Product } from '../../services/api';
import { getSuppliers, type Supplier } from '../../services/purchasesService';
import {
  create,
  get,
  post as postReturn,
  update,
  type PurchaseReturnWriteBody,
  type RefundMode,
} from '../../services/purchaseReturnService';

const POST_CONFIRM = 'Post this return? Stock will go down and the supplier balance will be reduced.';
const ESTIMATE_LABEL = 'Estimated — final cost is set when posted';

interface DraftLine {
  key: string;
  product_id: string;
  quantity: string;
  reason: string;
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function blankLine(): DraftLine {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, product_id: '', quantity: '', reason: '' };
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Display-only. Posted unit cost comes from the backend, not this figure. */
function stockCostLabel(product: Product): string {
  const costText = product.cost_price == null ? '—' : money(product.cost_price);
  return `stock ${product.current_stock} · cost ${costText}`;
}

export default function PurchaseReturnFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isEdit = useMatch('/purchases/returns/:id/edit') != null;
  const editId = isEdit ? params.id : undefined;

  const { banks, loading: accountsLoading } = useBankingAccounts();
  const bankAccounts = banks.filter((account) => account.role === 'bank');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverId, setServerId] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(todayIsoLocal);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refundMode, setRefundMode] = useState<RefundMode>('none');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundAccountId, setRefundAccountId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() => [blankLine()]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [supplierRows, productRows] = await Promise.all([getSuppliers(), getProducts()]);
        if (cancelled) return;
        setSuppliers(supplierRows);
        setProducts(productRows);
        if (!editId) return;
        const row = await get(editId);
        if (cancelled) return;
        if (row.status !== 'draft') {
          navigate(`/purchases/returns/${editId}`);
          return;
        }
        setServerId(String(row.id));
        setSupplierId(String(row.supplier_id));
        setDate(row.date || todayIsoLocal());
        setReason(row.reason || '');
        setNotes(row.notes || '');
        setRefundMode(row.refund_mode || 'none');
        setRefundAmount(row.refund_amount == null ? '' : String(row.refund_amount));
        setRefundAccountId(row.refund_account_id == null ? '' : String(row.refund_account_id));
        setLines(
          row.lines && row.lines.length > 0
            ? row.lines.map((line) => ({
                key: String(line.id),
                product_id: String(line.product_id),
                quantity: String(line.quantity),
                reason: line.reason || '',
              }))
            : [blankLine()],
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, navigate]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products) map.set(String(product.id), product);
    return map;
  }, [products]);

  function lineEstimate(line: DraftLine): number | null {
    const product = productById.get(line.product_id);
    const qty = Number(line.quantity);
    if (!product || product.cost_price == null || !(qty > 0)) return null;
    return qty * product.cost_price;
  }

  const totalEstimate = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const line of lines) {
      const product = productById.get(line.product_id);
      const qty = Number(line.quantity);
      if (!product || product.cost_price == null || !(qty > 0)) continue;
      sum += qty * product.cost_price;
      any = true;
    }
    return any ? sum : null;
  }, [lines, productById]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function buildBody(): PurchaseReturnWriteBody | null {
    if (!supplierId) {
      setError('Supplier is required');
      return null;
    }
    const filled = lines.filter((line) => line.product_id || line.quantity.trim() || line.reason.trim());
    if (filled.length < 1) {
      setError('Add at least one line');
      return null;
    }
    const payloadLines: PurchaseReturnWriteBody['lines'] = [];
    for (const line of filled) {
      if (!line.product_id) {
        setError('Select a product on each line');
        return null;
      }
      const qty = Number(line.quantity);
      if (!(qty > 0)) {
        setError('Quantity must be greater than 0');
        return null;
      }
      const productId = Number(line.product_id);
      if (!Number.isFinite(productId)) {
        setError('Select a product on each line');
        return null;
      }
      payloadLines.push({
        product_id: productId,
        quantity: qty,
        reason: line.reason.trim(),
      });
    }
    if (refundMode === 'bank' && !refundAccountId) {
      setError('Select a bank account for a bank refund');
      return null;
    }
    const supplierNumeric = Number(supplierId);
    if (!Number.isFinite(supplierNumeric)) {
      setError('Supplier is required');
      return null;
    }
    const amountText = refundAmount.trim();
    return {
      supplier_id: supplierNumeric,
      date,
      reason: reason.trim(),
      notes: notes.trim(),
      refund_mode: refundMode,
      refund_amount: amountText === '' ? null : Number(amountText),
      refund_account_id: refundMode === 'bank' ? Number(refundAccountId) : null,
      lines: payloadLines,
    };
  }

  async function save(andPost: boolean) {
    const body = buildBody();
    if (!body) return;
    if (andPost && !window.confirm(POST_CONFIRM)) return;
    setSaving(true);
    setError(null);
    try {
      const idToUpdate = editId || serverId;
      const saved = idToUpdate ? await update(idToUpdate, body) : await create(body);
      setServerId(String(saved.id));
      if (andPost) await postReturn(saved.id);
      navigate(`/purchases/returns/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/purchases/returns')}
          className="p-2 rounded-xl border border-gray-200 bg-white"
          aria-label="Back to purchase returns"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-black text-gray-900">
          {editId ? 'Edit purchase return' : 'New purchase return'}
        </h1>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 bg-white border border-gray-200 rounded-2xl p-4">
        <label className="text-xs font-bold text-gray-600 block">
          Supplier
          <select
            aria-label="Supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-gray-600 block">
          Date
          <input
            aria-label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-gray-600 block sm:col-span-2">
          Reason
          <input
            aria-label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-gray-600 block sm:col-span-2">
          Notes
          <textarea
            aria-label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wide text-gray-700">Lines</h2>
          <button
            type="button"
            onClick={() => setLines((current) => [...current, blankLine()])}
            className="inline-flex items-center gap-1 text-sm font-bold"
          >
            <Plus size={14} /> Add line
          </button>
        </div>
        {lines.map((line) => {
          const product = productById.get(line.product_id);
          const qty = Number(line.quantity);
          const stock = product?.current_stock;
          const overStock = product != null && stock != null && qty > stock;
          const estimate = lineEstimate(line);
          return (
            <div key={line.key} className="grid gap-2 sm:grid-cols-12 items-start border-t border-gray-100 pt-3">
              <label className="sm:col-span-5 text-xs font-bold text-gray-600">
                Product
                <select
                  aria-label="Product"
                  value={line.product_id}
                  onChange={(e) => updateLine(line.key, { product_id: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select product</option>
                  {products.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name} — {stockCostLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sm:col-span-2 text-xs font-bold text-gray-600">
                Quantity
                <input
                  aria-label="Quantity"
                  type="number"
                  min="0"
                  step="any"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="sm:col-span-3 text-xs font-bold text-gray-600">
                Line reason
                <input
                  aria-label="Line reason"
                  value={line.reason}
                  onChange={(e) => updateLine(line.key, { reason: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <div className="sm:col-span-2 text-xs font-bold text-gray-600">
                Estimate
                <div className="mt-2 font-mono text-sm">{estimate == null ? '—' : money(estimate)}</div>
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  className="mt-2 text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {overStock && (
                <p data-testid="stock-warning" className="sm:col-span-12 text-xs font-semibold text-amber-800">
                  Quantity exceeds stock ({stock}).
                </p>
              )}
            </div>
          );
        })}
        <div className="border-t border-gray-100 pt-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-gray-600">{ESTIMATE_LABEL}</p>
          <p className="font-mono font-black">
            Estimate {totalEstimate == null ? '—' : money(totalEstimate)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 bg-white border border-gray-200 rounded-2xl p-4">
        <label className="text-xs font-bold text-gray-600">
          Refund mode
          <select
            aria-label="Refund mode"
            value={refundMode}
            onChange={(e) => {
              const next = e.target.value as RefundMode;
              setRefundMode(next);
              if (next !== 'bank') setRefundAccountId('');
            }}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="none">none</option>
            <option value="cash">cash</option>
            <option value="bank">bank</option>
          </select>
        </label>
        <label className="text-xs font-bold text-gray-600">
          Refund amount
          <input
            aria-label="Refund amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="Blank = full refund"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        {refundMode === 'bank' && (
          <label className="text-xs font-bold text-gray-600 sm:col-span-2">
            Bank account
            {accountsLoading ? (
              <div className="mt-1 text-sm text-gray-500">Loading bank accounts…</div>
            ) : (
              <select
                aria-label="Bank account"
                value={refundAccountId}
                onChange={(e) => setRefundAccountId(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select bank account</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={String(account.id)}>
                    {account.code} — {account.name}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(false)}
          className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-black disabled:opacity-60"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(true)}
          className="px-4 py-2 rounded-xl text-white text-sm font-black disabled:opacity-60"
          style={{ backgroundColor: '#800020' }}
        >
          Save & post
        </button>
      </div>
    </div>
  );
}
