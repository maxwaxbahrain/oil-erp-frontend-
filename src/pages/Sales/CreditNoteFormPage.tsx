import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { getCustomers, getCustomerInvoices, type Customer, type Invoice } from '../../services/api';
import {
  createCreditNote,
  getCustomerCreditNotes,
  type CreditReason,
  type CreditNoteItem,
} from '../../services/creditNoteService';
import SearchableSelect from '../../components/common/SearchableSelect';

const THEME = '#800020';

export default function CreditNoteFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state || {}) as { customerId?: string; invoiceId?: string; reason?: CreditReason };
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

  useEffect(() => {
    void (async () => setCustomers(await getCustomers()))();
  }, []);

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
      await createCreditNote({
        customerId,
        originalInvoiceId: linkedInvoice ? invoiceId : undefined,
        issueDate,
        expiryDate: expiryDate || undefined,
        reason,
        items: useSimpleAmount ? [{ description: 'Credit adjustment', quantity: 1, unitPrice: simpleAmount, amount: simpleAmount }] : items.filter((x) => x.amount > 0),
        subtotal,
        tax,
        totalCreditAmount: total,
        usedAmount: 0,
        status,
        notes,
      });
      navigate('/sales/credit-notes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl border p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales/credit-notes')} className="p-2 rounded-lg border"><ArrowLeft size={18} /></button>
          <h1 className="text-xl font-black uppercase">New Credit Note</h1>
        </div>
        <div className="flex gap-2">
          <button disabled={saving} onClick={() => void save('draft')} className="px-4 py-2 rounded-lg border text-sm font-black uppercase">Save as Draft</button>
          <button disabled={saving} onClick={() => void save('issued')} className="px-4 py-2 rounded-lg text-white text-sm font-black uppercase" style={{ backgroundColor: THEME }}>Issue Credit Note</button>
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
            <input type="number" className="w-full border rounded-lg px-3 py-2.5" value={simpleAmount} onChange={(e) => setSimpleAmount(Number(e.target.value || 0))} placeholder="Credit amount" />
          ) : (
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input className="col-span-6 border rounded-lg px-3 py-2" value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="Product / description" />
                  <input type="number" className="col-span-2 border rounded-lg px-3 py-2" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value || 0) })} />
                  <input type="number" className="col-span-2 border rounded-lg px-3 py-2" value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value || 0) })} />
                  <div className="col-span-1 border rounded-lg px-3 py-2 font-mono text-sm">{it.amount.toFixed(2)}</div>
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