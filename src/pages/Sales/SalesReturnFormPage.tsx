import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw, Save } from 'lucide-react';
import clsx from 'clsx';
import { customersOpenForNewDocument, getCustomers, getInvoices, type Customer, type Invoice } from '../../services/api';
import {
  createSalesReturnApi,
  eligibleInvoiceEmptyReason,
  getSalesReturn,
  invoiceOlderThanReturnNoteDays,
  invoicesEligibleForReturn,
  patchSalesReturn,
  RETURN_REASON_OPTIONS,
  returnInvoiceStatusLabel,
  type ReturnLineItem,
  type ReturnReasonCode,
} from '../../services/salesReturnService';
import SearchableSelect from '../../components/common/SearchableSelect';
import { localIsoDate } from '../../utils/localDate';
import PackQtyInput, { BarcodeScanField } from '../../components/Inventory/PackQtyInput';
import { getProducts as getCatalogProducts, lookupProductByBarcode } from '../../services/productService';
import { planBarcodeScan, readDocumentEntry, toLinePayload, type PackEntryValue, type PackProduct } from '../../utils/packEntry';

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
      quantity: l.enteredUom === 'pack'
        ? Number(toLinePayload({
          enteredQty: Number(l.enteredQty) || 0,
          enteredUom: 'pack',
          enteredUnitPrice: Number(l.enteredUnitPrice) || 0,
          packQtySnapshot: l.packQtySnapshot,
        }).quantity)
        : l.quantityReturned,
      rate: l.enteredUom === 'pack'
        ? Number(toLinePayload({
          enteredQty: Number(l.enteredQty) || 0,
          enteredUom: 'pack',
          enteredUnitPrice: Number(l.enteredUnitPrice) || 0,
          packQtySnapshot: l.packQtySnapshot,
        }).rate)
        : l.unitPrice,
      amount: l.enteredUom === 'pack'
        ? Number(toLinePayload({
          enteredQty: Number(l.enteredQty) || 0,
          enteredUom: 'pack',
          enteredUnitPrice: Number(l.enteredUnitPrice) || 0,
          packQtySnapshot: l.packQtySnapshot,
        }).amount)
        : l.totalAmount,
      entered_qty: l.enteredUom === 'pack' ? Number(l.enteredQty) || 0 : l.quantityReturned,
      entered_uom: l.enteredUom === 'pack' ? 'pack' : 'base',
      entered_unit_price: l.enteredUom === 'pack' ? Number(l.enteredUnitPrice) || 0 : l.unitPrice,
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
  const [returnDate, setReturnDate] = useState(() => localIsoDate());
  const [headerReason, setHeaderReason] = useState<ReturnReasonCode>('other');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);
  const [catalogPacks, setCatalogPacks] = useState<Map<string, PackProduct>>(new Map());
  const [serverId, setServerId] = useState<string | null>(null);
  const [invoiceReason, setInvoiceReason] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);

  const effectiveId = editId || serverId;

  const subtotal = useMemo(() => {
    return lineItems.filter((l) => l.selected).reduce((s, l) => s + l.totalAmount, 0);
  }, [lineItems]);
  const tax = 0;
  const totalReturn = subtotal + tax;

  const loadCustomers = useCallback(async () => {
    const c = await getCustomers();
    setCustomers(customersOpenForNewDocument(c));
  }, []);

  const loadEdit = useCallback(async () => {
    if (!editId) return;
    const row = await getSalesReturn(editId);
    if (!row) {
      setNotice({ tone: 'error', text: 'Return not found' });
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
        try {
          const catalog = await getCatalogProducts();
          const packs = new Map<string, PackProduct>();
          for (const row of catalog) {
            packs.set(String(row.id), {
              id: row.id,
              packQty: row.packQty,
              packUnit: row.packUnit,
              baseUnit: row.baseUnit || row.uom,
              unit: row.uom,
            });
          }
          setCatalogPacks(packs);
        } catch {
          setCatalogPacks(new Map());
        }
        if (editId) await loadEdit();
      } catch (e) {
        console.error(e);
        setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Load failed' });
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
        const all = await getInvoices();
        const eligible = invoicesEligibleForReturn(all, customerId);
        setEligibleInvoices(eligible);
        setInvoiceReason(eligible.length === 0 ? eligibleInvoiceEmptyReason(all, customerId) : '');
      } catch (e) {
        console.error(e);
        setEligibleInvoices([]);
        setInvoiceReason(e instanceof Error ? e.message : 'Could not load invoices');
      }
    };
    run();
  }, [customerId]);

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
      inv.lineItems.map((item, index) => {
        const entry = readDocumentEntry(item as unknown as Record<string, unknown>, item.quantity, item.rate);
        return {
        id: `ln-${index}-${Date.now()}`,
        productId: item.productId || '',
        productName: item.product,
        sku: '',
        originalQuantity: item.quantity,
        selected: false,
        quantityReturned: 0,
        unitPrice: item.rate,
        totalAmount: 0,
        lineReason: '',
        enteredUom: entry.enteredUom,
        enteredQty: 0,
        enteredUnitPrice: entry.enteredUom === 'pack' ? entry.enteredUnitPrice : item.rate,
        packQtySnapshot: entry.packQtySnapshot,
        originalEnteredQty: entry.enteredUom === 'pack' ? entry.enteredQty : undefined,
        };
      })
    );
  };

  const toggleLine = (id: string, checked: boolean) => {
    setLineItems((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const qty = checked
          ? (r.enteredUom === 'pack' ? Math.min(1, r.originalEnteredQty || r.originalQuantity) : Math.min(1, r.originalQuantity))
          : 0;
        const priced = r.enteredUom === 'pack'
          ? toLinePayload({
            enteredQty: qty,
            enteredUom: 'pack',
            enteredUnitPrice: Number(r.enteredUnitPrice) || 0,
            packQtySnapshot: r.packQtySnapshot,
          })
          : null;
        return {
          ...r,
          selected: checked,
          enteredQty: qty,
          quantityReturned: priced ? Number(priced.quantity) : qty,
          totalAmount: priced ? Number(priced.amount) : qty * r.unitPrice,
        };
      })
    );
  };

  const onReturnEntry = (id: string, value: PackEntryValue) => {
    setLineItems((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const product = catalogPacks.get(String(r.productId));
        const snapshot = value.enteredUom === 'pack'
          ? (r.packQtySnapshot != null && Number(r.packQtySnapshot) > 0 ? Number(r.packQtySnapshot) : product?.packQty ?? null)
          : null;
        const maxEntered = value.enteredUom === 'pack'
          ? (r.originalEnteredQty && r.originalEnteredQty > 0
            ? r.originalEnteredQty
            : (snapshot ? r.originalQuantity / Number(snapshot) : r.originalQuantity))
          : r.originalQuantity;
        const enteredQty = Math.max(0, Math.min(value.enteredQty, maxEntered || value.enteredQty));
        const priced = toLinePayload({
          enteredQty,
          enteredUom: value.enteredUom,
          enteredUnitPrice: value.enteredUnitPrice,
          packQty: product?.packQty,
          packQtySnapshot: snapshot,
        });
        return {
          ...r,
          enteredUom: value.enteredUom,
          enteredQty,
          enteredUnitPrice: value.enteredUnitPrice,
          packQtySnapshot: snapshot,
          quantityReturned: Number(priced.quantity) || 0,
          unitPrice: value.enteredUom === 'pack' ? Number(priced.rate) : value.enteredUnitPrice,
          totalAmount: Number(priced.amount) || 0,
          selected: enteredQty > 0,
        };
      }),
    );
  };

  const handleBarcodeScan = async (code: string) => {
    try {
      const found = await lookupProductByBarcode(code);
      const product = found.product;
      setCatalogPacks((prev) => {
        const next = new Map(prev);
        next.set(String(product.id), {
          id: product.id,
          packQty: product.packQty,
          packUnit: product.packUnit,
          baseUnit: product.baseUnit || product.uom,
          unit: product.uom,
        });
        return next;
      });
      setLineItems((prev) => {
        const plan = planBarcodeScan(
          prev.map((line) => ({
            productId: line.productId,
            enteredUom: line.enteredUom,
            enteredQty: line.enteredQty,
            quantity: line.quantityReturned,
            enteredUnitPrice: line.enteredUnitPrice ?? line.unitPrice,
          })),
          {
            id: String(product.id),
            packQty: product.packQty,
            packUnit: product.packUnit,
            baseUnit: product.baseUnit || product.uom,
            unit: product.uom,
          },
          found.matchedPackQty,
          Number(product.pricing?.sellingPrice) || 0,
        );
        const index = plan.index >= 0
          ? plan.index
          : prev.findIndex((line) => String(line.productId) === String(product.id));
        if (index < 0) return prev;
        return prev.map((line, i) => {
          if (i !== index) return line;
          const enteredQty = plan.mode === 'pack' ? plan.enteredQty : plan.quantity;
          const priced = toLinePayload({
            enteredQty,
            enteredUom: plan.mode,
            enteredUnitPrice: plan.mode === 'pack' ? (Number(line.enteredUnitPrice) || plan.enteredUnitPrice) : line.unitPrice,
            packQty: product.packQty,
            packQtySnapshot: plan.mode === 'pack' ? (line.packQtySnapshot ?? plan.packQtySnapshot) : null,
          });
          return {
            ...line,
            enteredUom: plan.mode,
            enteredQty,
            enteredUnitPrice: Number(priced.entered_unit_price) || line.unitPrice,
            packQtySnapshot: plan.mode === 'pack' ? (line.packQtySnapshot ?? plan.packQtySnapshot) : null,
            quantityReturned: Number(priced.quantity) || 0,
            totalAmount: Number(priced.amount) || 0,
            selected: enteredQty > 0,
          };
        });
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Barcode lookup failed' });
    }
  };

  const setLineReason = (id: string, code: ReturnReasonCode | '') => {
    setLineItems((rows) => rows.map((r) => (r.id === id ? { ...r, lineReason: code } : r)));
  };

  const persistDraft = async (): Promise<string | null> => {
    if (!customerId || !invoiceId) {
      setNotice({ tone: 'error', text: 'Select customer and invoice' });
      return null;
    }
    const items = buildPayloadItems(lineItems);
    const cid = parseInt(customerId, 10);
    const iid = parseInt(invoiceId, 10);
    if (Number.isNaN(cid) || Number.isNaN(iid)) {
      setNotice({ tone: 'error', text: 'Invalid customer or invoice' });
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
    setNotice(null);
    try {
      const id = await persistDraft();
      if (id) setNotice({ tone: 'ok', text: 'Draft saved' });
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const submitReturn = async () => {
    setNotice(null);
    if (!customerId || !invoiceId) {
      setNotice({ tone: 'error', text: 'Select customer and invoice' });
      return;
    }
    if (!headerReason) {
      setNotice({ tone: 'error', text: 'Select return reason' });
      return;
    }
    const selected = lineItems.filter((l) => l.selected && l.quantityReturned > 0);
    if (selected.length === 0) {
      setNotice({ tone: 'error', text: 'Select at least one line with quantity to return' });
      return;
    }
    if (totalReturn <= 0) {
      setNotice({ tone: 'error', text: 'Total credit must be greater than zero' });
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
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Submit failed' });
    } finally {
      setSaving(false);
    }
  };

  const invoiceOptions = useMemo(
    () =>
      eligibleInvoices.map((inv) => ({
        id: inv.id,
        name: `${inv.invoiceNumber} · ${inv.invoiceDate} · $${formatMoney(inv.grandTotal)} · ${returnInvoiceStatusLabel(inv.status)}`,
        code: inv.invoiceNumber,
      })),
    [eligibleInvoices],
  );

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
                  Customer returns & credits
                </p>
              </div>
            </div>
          </div>
        </div>

        {notice && (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={
              notice.tone === 'error'
                ? 'text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3'
                : 'text-sm font-semibold text-green-800 bg-green-50 border border-green-100 rounded-xl px-4 py-3'
            }
          >
            {notice.text}
          </p>
        )}

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
                <SearchableSelect
                  options={invoiceOptions}
                  value={invoiceId}
                  onChange={handleInvoiceSelect}
                  placeholder={
                    !customerId
                      ? '— Select customer —'
                      : eligibleInvoices.length === 0
                        ? '— No eligible invoices —'
                        : 'Search invoice number…'
                  }
                  displayKey="name"
                  disabled={!customerId || eligibleInvoices.length === 0}
                />
                {customerId && eligibleInvoices.length === 0 && invoiceReason && (
                  <p role="status" className="text-xs font-semibold text-gray-600 mt-2">
                    {invoiceReason}
                  </p>
                )}
                {selectedInvoice && invoiceOlderThanReturnNoteDays(selectedInvoice) && (
                  <p role="status" className="text-xs font-semibold text-gray-600 mt-2">
                    This invoice is older than 30 days.
                  </p>
                )}
              </div>
            </div>
          </section>

          {invoiceId && lineItems.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4">
                2 · Return items
                <div className="mt-3">
                  <BarcodeScanField onScan={handleBarcodeScan} />
                </div>
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
                          <PackQtyInput
                            product={catalogPacks.get(String(line.productId)) || null}
                            value={{
                              enteredQty: line.enteredUom === 'pack' ? Number(line.enteredQty) || 0 : line.quantityReturned,
                              enteredUom: line.enteredUom === 'pack' ? 'pack' : 'base',
                              enteredUnitPrice: line.enteredUom === 'pack' ? Number(line.enteredUnitPrice) || 0 : line.unitPrice,
                            }}
                            basePrice={line.unitPrice}
                            packQtySnapshot={line.packQtySnapshot}
                            disabled={!line.selected && line.enteredUom !== 'pack'}
                            onChange={(value) => onReturnEntry(line.id, value)}
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
                  max={localIsoDate()}
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
