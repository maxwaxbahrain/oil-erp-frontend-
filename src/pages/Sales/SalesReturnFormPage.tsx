import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw, Save } from 'lucide-react';
import clsx from 'clsx';
import { getCustomers, getInvoices, type Customer, type Invoice } from '../../services/api';
import {
  createSalesReturnApi,
  getEligibleInvoicesForReturn,
  getSalesReturn,
  patchSalesReturn,
  RETURN_REASON_OPTIONS,
  type ReturnLineItem,
  type ReturnReasonCode,
  RETURN_POLICY_DAYS,
} from '../../services/salesReturnService';
import SearchableSelect from '../../components/common/SearchableSelect';

const THEME = '#800020';

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildPayloadItems(lines: ReturnLineItem[]): Record<string, unknown>[] {
  return lines
    .filter((l) => l.selected && l.quantityReturned > 0)
    .map((l) => ({
      product: l.productName,
      product_id: l.productId ? parseInt(l.productId, 10) : null,
      item_code: l.sku || null,
      description: '',
      original_quantity: l.originalQuantity,
      quantity_returned: l.quantityReturned,
      quantity: l.quantityReturned,
      rate: l.unitPrice,
      amount: l.totalAmount,
      line_reason: l.lineReason || null,
    }));
}

export default function SalesReturnFormPage() {
  const navigate = useNavigate();
  const matchEdit = useMatch('/sales/returns/edit/:id');
  const editId = matchEdit?.params?.id;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [eligibleInvoices, setEligibleInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [headerReason, setHeaderReason] = useState<ReturnReasonCode>('other');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);
  const [serverId, setServerId] = useState<string | null>(null);

  const effectiveId = editId || serverId;

  const subtotal = useMemo(() => {
    return lineItems.filter((l) => l.selected).reduce((s, l) => s + l.totalAmount, 0);
  }, [lineItems]);
  const tax = 0;
  const totalReturn = subtotal + tax;

  const loadCustomers = useCallback(async () => {
    const c = await getCustomers();
    setCustomers(c);
  }, []);

  const loadEdit = useCallback(async () => {
    if (!editId) return;
    const row = await getSalesReturn(editId);
    if (!row) {
      alert('Return not found');
      navigate('/sales/returns');
      return;
    }
    if (row.status !== 'draft') {
      navigate(`/sales/returns/${editId}`);
      return;
    }
    setServerId(row.id);
    setCustomerId(row.customerId);
    setInvoiceId(row.invoiceId);
    setReturnDate(row.returnDate);
    setHeaderReason((row.returnReason as ReturnReasonCode) || 'other');
    setNotes(row.notes);
    setLineItems(
      row.lineItems.map((l) => ({
        ...l,
        selected: l.quantityReturned > 0,
      }))
    );
  }, [editId, navigate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadCustomers();
        if (editId) await loadEdit();
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : 'Load failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, loadCustomers, loadEdit]);

  useEffect(() => {
    const run = async () => {
      if (!customerId) {
        setEligibleInvoices([]);
        return;
      }
      try {
        if (editId) {
          const all = await getInvoices();
          setEligibleInvoices(all.filter((i) => String(i.customerId) === String(customerId)));
        } else {
          setEligibleInvoices(await getEligibleInvoicesForReturn(customerId));
        }
      } catch (e) {
        console.error(e);
      }
    };
    run();
  }, [customerId, editId]);

  useEffect(() => {
    if (!invoiceId || !eligibleInvoices.length) {
      if (!editId) setSelectedInvoice(null);
      return;
    }
    const inv = eligibleInvoices.find((i) => String(i.id) === String(invoiceId));
    setSelectedInvoice(inv ?? null);
  }, [invoiceId, eligibleInvoices, editId]);

  const handleCustomerChange = (cid: string) => {
    setCustomerId(cid);
    setInvoiceId('');
    setLineItems([]);
    setSelectedInvoice(null);
  };

  const handleInvoiceSelect = (iid: string) => {
    setInvoiceId(iid);
    const inv = eligibleInvoices.find((x) => String(x.id) === String(iid));
    if (!inv) return;
    setSelectedInvoice(inv);
    setLineItems(
      inv.lineItems.map((item, index) => ({
        id: `ln-${index}-${Date.now()}`,
        productId: '',
        productName: item.product,
        sku: '',
        originalQuantity: item.quantity,
        selected: false,
        quantityReturned: 0,
        unitPrice: item.rate,
        totalAmount: 0,
        lineReason: '',
      }))
    );
  };

  const toggleLine = (id: string, checked: boolean) => {
    setLineItems((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const qty = checked ? Math.min(1, r.originalQuantity) : 0;
        return {
          ...r,
          selected: checked,
          quantityReturned: qty,
          totalAmount: qty * r.unitPrice,
        };
      })
    );
  };

  const setQty = (id: string, q: number) => {
    setLineItems((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const qty = Math.max(0, Math.min(q, r.originalQuantity));
        return {
          ...r,
          quantityReturned: qty,
          totalAmount: qty * r.unitPrice,
          selected: qty > 0,
        };
      })
    );
  };

  const setLineReason = (id: string, code: ReturnReasonCode | '') => {
    setLineItems((rows) => rows.map((r) => (r.id === id ? { ...r, lineReason: code } : r)));
  };

  const persistDraft = async (): Promise<string | null> => {
    if (!customerId || !invoiceId) {
      alert('Select customer and invoice');
      return null;
    }
    const items = buildPayloadItems(lineItems);
    const cid = parseInt(customerId, 10);
    const iid = parseInt(invoiceId, 10);
    if (Number.isNaN(cid) || Number.isNaN(iid)) {
      alert('Invalid customer or invoice');
      return null;
    }

    if (effectiveId) {
      await patchSalesReturn(effectiveId, {
        returnDate,
        reason: headerReason,
        notes,
        items,
        subtotal,
        tax,
        totalReturnAmount: totalReturn,
      });
      return effectiveId;
    }

    const created = await createSalesReturnApi({
      originalInvoiceId: iid,
      customerId: cid,
      returnDate,
      reason: headerReason,
      items,
      subtotal,
      tax,
      totalReturnAmount: totalReturn,
      notes,
      status: 'draft',
    });
    setServerId(created.id);
    navigate(`/sales/returns/edit/${created.id}`, { replace: true });
    return created.id;
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      await persistDraft();
      alert('Draft saved');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const submitReturn = async () => {
    if (!customerId || !invoiceId) {
      alert('Select customer and invoice');
      return;
    }
    if (!headerReason) {
      alert('Select return reason');
      return;
    }
    const selected = lineItems.filter((l) => l.selected && l.quantityReturned > 0);
    if (selected.length === 0) {
      alert('Select at least one line with quantity to return');
      return;
    }
    if (totalReturn <= 0) {
      alert('Total credit must be greater than zero');
      return;
    }

    setSaving(true);
    try {
      const items = buildPayloadItems(lineItems);
      const cid = parseInt(customerId, 10);
      const iid = parseInt(invoiceId, 10);

      if (effectiveId) {
        await patchSalesReturn(effectiveId, {
          returnDate,
          reason: headerReason,
          notes,
          items,
          subtotal,
          tax,
          totalReturnAmount: totalReturn,
          status: 'pending',
        });
      } else {
        await createSalesReturnApi({
          originalInvoiceId: iid,
          customerId: cid,
          returnDate,
          reason: headerReason,
          items,
          subtotal,
          tax,
          totalReturnAmount: totalReturn,
          notes,
          status: 'pending',
        });
      }
      navigate('/sales/returns');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  };

  const daysUntilExpiry = selectedInvoice
    ? Math.max(
        0,
        RETURN_POLICY_DAYS -
          Math.ceil(
            (new Date().getTime() -
              new Date(
                selectedInvoice.invoiceDate.includes('T')
                  ? selectedInvoice.invoiceDate
                  : `${selectedInvoice.invoiceDate}T12:00:00`
              ).getTime()) /
              (1000 * 60 * 60 * 24)
          )
      )
    : 0;

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="animate-spin" style={{ color: THEME }} size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-6 space-y-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => navigate('/sales/returns')}
                className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 mt-1"
              >
                <ArrowLeft size={20} />
              </button>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                style={{ backgroundColor: THEME }}
              >
                <RotateCcw size={26} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-gray-900 uppercase">
                  {editId || serverId ? 'Edit return' : 'New sales return'}
                </h1>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                  Customer returns & credits · {RETURN_POLICY_DAYS}-day policy
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-8">
          <section>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4">
              1 · Customer & invoice
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Customer</label>
                <SearchableSelect
                  options={customers}
                  value={customerId}
                  onChange={handleCustomerChange}
                  placeholder="Search customer…"
                  displayKey="name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Invoice</label>
                <select
                  value={invoiceId}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  disabled={!customerId || eligibleInvoices.length === 0}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#800020]/25 disabled:bg-gray-50"
                >
                  <option value="">
                    {!customerId
                      ? '— Select customer —'
                      : eligibleInvoices.length === 0
                        ? '— No eligible invoices (30-day) —'
                        : '— Select invoice —'}
                  </option>
                  {eligibleInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} · {inv.invoiceDate} · ${formatMoney(inv.grandTotal)}
                    </option>
                  ))}
                </select>
                {selectedInvoice && (
                  <p className="text-xs text-gray-500 mt-2 font-semibold">Policy window: {daysUntilExpiry} days left</p>
                )}
              </div>
            </div>
          </section>

          {invoiceId && lineItems.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4">
                2 · Return items
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 w-10" />
                      <th className="px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase">Product</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black text-gray-500 uppercase">Inv qty</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black text-gray-500 uppercase">Return qty</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black text-gray-500 uppercase">Rate</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black text-gray-500 uppercase">Amount</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase">Line reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((line) => (
                      <tr key={line.id} className={clsx(line.selected && 'bg-[#800020]/5')}>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={line.selected}
                            onChange={(e) => toggleLine(line.id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-900">{line.productName}</td>
                        <td className="px-3 py-2 text-center font-mono">{line.originalQuantity}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={line.originalQuantity}
                            step="0.01"
                            value={line.quantityReturned || ''}
                            onChange={(e) => setQty(line.id, parseFloat(e.target.value) || 0)}
                            disabled={!line.selected}
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-center font-mono disabled:bg-gray-100"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">${formatMoney(line.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-mono font-black">${formatMoney(line.totalAmount)}</td>
                        <td className="px-3 py-2">
                          <select
                            value={line.lineReason || ''}
                            onChange={(e) => setLineReason(line.id, (e.target.value as ReturnReasonCode) || '')}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold"
                          >
                            <option value="">— Optional —</option>
                            {RETURN_REASON_OPTIONS.map((o) => (
                              <option key={o.code} value={o.code}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4">
              3 · Return details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Return reason</label>
                <select
                  value={headerReason}
                  onChange={(e) => setHeaderReason(e.target.value as ReturnReasonCode)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold"
                >
                  {RETURN_REASON_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Return date</label>
                <input
                  type="date"
                  value={returnDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium"
                  placeholder="Internal notes…"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#800020]/20 bg-[#800020]/5 p-5">
            <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.25em] mb-3">4 · Summary</h2>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-sm">
              <span className="font-bold text-gray-600">Items selected</span>
              <span className="font-black text-gray-900">
                {lineItems.filter((l) => l.selected && l.quantityReturned > 0).length} line(s)
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-sm mt-2">
              <span className="font-bold text-gray-600">Subtotal</span>
              <span className="font-mono font-black">${formatMoney(subtotal)}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mt-3 pt-3 border-t border-[#800020]/20">
              <span className="font-black uppercase text-gray-900">Total credit</span>
              <span className="font-mono font-black text-xl" style={{ color: THEME }}>
                ${formatMoney(totalReturn)}
              </span>
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => saveDraft()}
              className="px-6 py-3 rounded-xl border-2 border-gray-200 font-black text-sm uppercase hover:bg-gray-50 disabled:opacity-50"
            >
              Save as draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => submitReturn()}
              className="px-6 py-3 rounded-xl text-white font-black text-sm uppercase flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
              style={{ backgroundColor: THEME }}
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Submit return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
