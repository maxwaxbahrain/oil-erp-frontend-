import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { getCustomers, getCustomerInvoices, type Customer, type Invoice } from '../../services/api';
import {
  createCreditNote,
  updateCreditNote,
  getCreditNote,
  getCustomerCreditNotes,
  type CreditReason,
  type CreditNoteItem,
  type CreditStatus,
} from '../../services/creditNoteService';
import SearchableSelect from '../../components/common/SearchableSelect';

const THEME = '#800020';

// CLEANUP-1 — Removed bumpCachedCustomerBalance. The PHASE-3 consistency
// check found getCustomers() never reads the localStorage 'customers'
// cache in production, so the optimistic write was a dead operation.
// Backend updates customer.balance atomically on CN POST and on the
// contra-payment POST (W5-1 Apply flow).

export default function CreditNoteFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // FIX W2-6 — `:id` present ⇒ edit mode. The route `/sales/credit-notes/edit/:id`
  // is already registered; this hook closes the gap so the form actually loads
  // an existing credit note instead of behaving like a fresh New form.
  const { id: editingId } = useParams<{ id?: string }>();
  const isEditing = !!editingId;
  // FIX W8-1 — Extended prefill payload from approved sales returns.
  const prefill = (location.state || {}) as {
    customerId?: string;
    invoiceId?: string;
    reason?: CreditReason;
    prefillItems?: CreditNoteItem[];
    prefillSubtotal?: number;
    prefillTax?: number;
    prefillTotal?: number;
    prefillReturnNumber?: string;
    // TASK 7 — numeric SR id, persisted as originalReturnId on save.
    prefillReturnId?: string;
  };
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(prefill.customerId || '');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [linkedInvoice, setLinkedInvoice] = useState(!!prefill.invoiceId);
  const [invoiceId, setInvoiceId] = useState(prefill.invoiceId || '');
  const [balance, setBalance] = useState(0);
  const [unusedCredits, setUnusedCredits] = useState(0);
  const [reason, setReason] = useState<CreditReason>(prefill.reason || 'other');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CreditNoteItem[]>([{ description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  const [simpleAmount, setSimpleAmount] = useState(0);
  const [useSimpleAmount, setUseSimpleAmount] = useState(false);
  const [saving, setSaving] = useState(false);
  // FIX W2-6 — edit-mode state.
  const [editingCNNumber, setEditingCNNumber] = useState('');
  const [editingStatus, setEditingStatus] = useState<CreditStatus>('draft');
  const [hydrating, setHydrating] = useState(false);
  // CLEANUP-1 — Removed editingPriorIssued/editingPriorTotal. They only
  // existed to feed the optimistic customer-balance delta calc which is
  // now gone. Backend is authoritative for balance.

  useEffect(() => {
    void (async () => setCustomers(await getCustomers()))();
  }, []);

  // FIX W8-1 — One-shot seed from sales-return prefill payload. Only
  // runs when we're NOT in edit mode (edit-mode hydration owns items)
  // and only on first render with non-empty prefillItems. Forces
  // items mode since a return always has line items.
  useEffect(() => {
    if (editingId) return;
    const seedItems = prefill.prefillItems;
    if (!seedItems || seedItems.length === 0) return;
    setItems(seedItems);
    setUseSimpleAmount(false);
    // Items will be recalculated by the existing subtotal useMemo, but
    // we don't need to seed subtotal/tax/total explicitly — they're
    // derived. (Kept on the payload for future use / debugging.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  // FIX W2-6 — Hydrate from the existing CN when in edit mode.
  // Strict guard: partially_used, fully_used, and cancelled CNs are
  // NOT editable here (would desync the customer's credit ledger).
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    void (async () => {
      setHydrating(true);
      try {
        const cn = await getCreditNote(editingId);
        if (!cn) {
          alert('Credit note not found.');
          navigate('/sales/credit-notes');
          return;
        }
        if (cn.status !== 'draft' && cn.status !== 'issued') {
          alert(`This credit note is "${cn.status.replace('_', ' ')}" and can no longer be edited. Open it for view-only instead.`);
          navigate('/sales/credit-notes');
          return;
        }
        if (cancelled) return;
        setEditingCNNumber(cn.creditNoteNumber);
        setEditingStatus(cn.status);
        setCustomerId(cn.customerId);
        setInvoiceId(cn.originalInvoiceId || '');
        setLinkedInvoice(!!cn.originalInvoiceId);
        setReason(cn.reason);
        setIssueDate(cn.issueDate || new Date().toISOString().slice(0, 10));
        setExpiryDate(cn.expiryDate || '');
        setNotes(cn.notes || '');
        // Simple-amount heuristic: matches the marker `save()` writes
        // ("Credit adjustment" with qty 1) when create flow used simple mode.
        const its = cn.items || [];
        if (its.length === 1 && its[0].description === 'Credit adjustment') {
          setUseSimpleAmount(true);
          setSimpleAmount(Number(its[0].unitPrice) || cn.totalCreditAmount);
        } else if (its.length > 0) {
          setUseSimpleAmount(false);
          setItems(its);
        }
      } catch (e) {
        alert('Failed to load credit note: ' + (e instanceof Error ? e.message : String(e)));
        navigate('/sales/credit-notes');
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editingId, navigate]);

  useEffect(() => {
    if (!customerId) return;
    void (async () => {
      const [inv, customerCredits] = await Promise.all([getCustomerInvoices(customerId), getCustomerCreditNotes(customerId)]);
      setInvoices(inv);
      const c = customers.find((x) => x.id === customerId);
      setBalance(Number(c?.balance ?? 0));
      setUnusedCredits(customerCredits.reduce((s, n) => s + n.remainingCredit, 0));
    })();
  }, [customerId, customers]);

  function updateItem(index: number, patch: Partial<CreditNoteItem>) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, ...patch };
        next.amount = Number(next.quantity || 0) * Number(next.unitPrice || 0);
        return next;
      })
    );
  }

  const subtotal = useMemo(() => (useSimpleAmount ? simpleAmount : items.reduce((s, i) => s + i.amount, 0)), [useSimpleAmount, simpleAmount, items]);
  const tax = 0;
  const total = subtotal + tax;

  async function save(status: 'draft' | 'issued') {
    if (!customerId || total <= 0) return;
    setSaving(true);
    try {
      const payload = {
        customerId,
        originalInvoiceId: linkedInvoice ? invoiceId : undefined,
        // TASK 7 — Persist the Sales-Return backlink when present in
        // the nav-state prefill. Only sent on create — once saved, the
        // backlink is locked (the edit form doesn't expose it).
        originalReturnId: !isEditing ? prefill.prefillReturnId : undefined,
        originalReturnNumber: !isEditing ? prefill.prefillReturnNumber : undefined,
        issueDate,
        expiryDate: expiryDate || undefined,
        reason,
        items: useSimpleAmount
          ? [{ description: 'Credit adjustment', quantity: 1, unitPrice: simpleAmount, amount: simpleAmount }]
          : items.filter((x) => x.amount > 0),
        subtotal,
        tax,
        totalCreditAmount: total,
        usedAmount: 0,
        notes,
      };
      if (isEditing && editingId) {
        // FIX W2-6 — edit-mode save uses PATCH semantics.
        await updateCreditNote(editingId, { ...payload, status });
      } else {
        await createCreditNote({ ...payload, status });
      }

      // CLEANUP-1 — Removed optimistic customer-balance bump. Backend
      // updates customer.balance on CN POST; next refetch reflects it.

      navigate('/sales/credit-notes');
    } catch (e) {
      alert('Failed to save credit note: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* FIX W8-1 — Source-of-prefill notice when arriving from an approved
          sales return. Helps the user understand why the form arrived with
          items already filled in. */}
      {!isEditing && prefill.prefillReturnNumber && (
        <div className="bg-amber-50 border-l-4 border-amber-500 px-4 py-3 rounded-r-lg text-xs text-amber-900">
          ℹ️ Pre-filled from sales return <strong>{prefill.prefillReturnNumber}</strong>.
          Edit any item before saving — totals will recalculate automatically.
        </div>
      )}

      <div className="bg-white rounded-xl border p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales/credit-notes')} className="p-2 rounded-lg border"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-xl font-black uppercase">{isEditing ? 'Edit Credit Note' : 'New Credit Note'}</h1>
            {isEditing && editingCNNumber && (
              <p className="text-xs text-gray-500 font-bold mt-0.5">{editingCNNumber} · status: {editingStatus.replace('_', ' ')}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button disabled={saving || hydrating} onClick={() => void save('draft')} className="px-4 py-2 rounded-lg border text-sm font-black uppercase disabled:opacity-50">{isEditing ? 'Save as Draft' : 'Save as Draft'}</button>
          <button disabled={saving || hydrating} onClick={() => void save('issued')} className="px-4 py-2 rounded-lg text-white text-sm font-black uppercase disabled:opacity-50" style={{ backgroundColor: THEME }}>{isEditing ? 'Save & Issue' : 'Issue Credit Note'}</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-6">
        <section>
          <h2 className="text-xs font-black uppercase text-gray-500 mb-3">1. Customer</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <SearchableSelect options={customers} value={customerId} onChange={setCustomerId} placeholder="Search customer" displayKey="name" />
            <div className="border rounded-lg p-3 text-sm"><div className="text-xs text-gray-400 uppercase">Current Balance</div><div className="font-black">{balance.toLocaleString()}</div></div>
            <div className="border rounded-lg p-3 text-sm"><div className="text-xs text-gray-400 uppercase">Unused Credits</div><div className="font-black">{unusedCredits.toLocaleString()}</div></div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-black uppercase text-gray-500 mb-3">2. Linked Invoice (optional)</h2>
          <label className="text-sm font-bold flex items-center gap-2"><input type="checkbox" checked={linkedInvoice} onChange={(e) => setLinkedInvoice(e.target.checked)} /> Link to invoice</label>
          {linkedInvoice && (
            <select className="mt-3 w-full border rounded-lg px-3 py-2.5" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              <option value="">Select invoice</option>
              {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber} - {i.customerName}</option>)}
            </select>
          )}
        </section>

        <section>
          <h2 className="text-xs font-black uppercase text-gray-500 mb-3">3. Credit Items</h2>
          <label className="text-sm font-bold flex items-center gap-2 mb-3"><input type="checkbox" checked={useSimpleAmount} onChange={(e) => setUseSimpleAmount(e.target.checked)} /> Use simple amount mode</label>
          {useSimpleAmount ? (
            <input type="number" className="w-full border rounded-lg px-3 py-2.5" value={simpleAmount || ''} onChange={(e) => setSimpleAmount(Number(e.target.value || 0))} placeholder="Credit amount" />
          ) : (
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input className="col-span-6 border rounded-lg px-3 py-2" value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="Product / description" />
                  <input type="number" className="col-span-2 border rounded-lg px-3 py-2" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value || 0) })} />
                  <input type="number" className="col-span-2 border rounded-lg px-3 py-2" value={it.unitPrice || ''} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value || 0) })} placeholder="Unit price" />
                  <div className="col-span-1 border rounded-lg px-3 py-2 font-mono text-sm">{it.amount > 0 ? it.amount.toFixed(2) : '—'}</div>
                  <button className="col-span-1 border rounded-lg px-2 py-2" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
                </div>
              ))}
              <button onClick={() => setItems((p) => [...p, { description: '', quantity: 1, unitPrice: 0, amount: 0 }])} className="text-sm font-bold flex items-center gap-2"><Plus size={14} /> Add line</button>
            </div>
          )}
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div>
            <h2 className="text-xs font-black uppercase text-gray-500 mb-3">4. Credit Details</h2>
            <select className="w-full border rounded-lg px-3 py-2.5 mb-2" value={reason} onChange={(e) => setReason(e.target.value as CreditReason)}>
              <option value="overcharge">Overcharge</option><option value="return">Return</option><option value="price_adjustment">Price Adjustment</option><option value="goodwill">Goodwill</option><option value="other">Other</option>
            </select>
            <input type="date" className="w-full border rounded-lg px-3 py-2.5 mb-2" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            <input type="date" className="w-full border rounded-lg px-3 py-2.5 mb-2" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            <textarea className="w-full border rounded-lg px-3 py-2.5" rows={3} placeholder="Internal notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase text-gray-500 mb-3">5. Summary</h2>
            <div className="border rounded-xl p-4 space-y-2">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span className="font-mono">{tax.toFixed(2)}</span></div>
              <div className="flex justify-between pt-2 border-t font-black"><span>Total credit amount</span><span className="font-mono">{total.toFixed(2)}</span></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}