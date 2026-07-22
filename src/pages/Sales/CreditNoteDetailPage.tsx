import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { getCreditNote, updateCreditNote, applyCreditNoteToInvoice, type CreditNote } from '../../services/creditNoteService';
import { getCustomerInvoices } from '../../services/api';
import { MODULE_FLAGS } from '../../config/moduleFlags';

const THEME = '#800020';

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<CreditNote | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => setNote(await getCreditNote(id)))();
  }, [id]);

  async function resolveApplyInvoice(): Promise<{ id: string; label: string } | null> {
    if (!note) return null;

    const invs = await getCustomerInvoices(note.customerId);
    const open = invs.filter((i) => Number(i.remaining_balance ?? i.grandTotal ?? 0) > 0);
    if (open.length === 0) {
      setApplySuccess(null);
      setPageError('No open invoices found for this customer.');
      setTimeout(() => setPageError(null), 6000);
      return null;
    }

    const toTarget = (inv: (typeof open)[number]) => ({
      id: String(inv.id),
      label: inv.invoiceNumber || `invoice #${inv.id}`,
    });

    if (note.originalInvoiceId) {
      const linked = open.find((i) => String(i.id) === String(note.originalInvoiceId));
      if (linked) return toTarget(linked);
    }

    if (open.length === 1) {
      return toTarget(open[0]);
    }

    const list = open
      .map(
        (i) =>
          `${i.invoiceNumber || i.id} ($${Number(i.remaining_balance ?? i.grandTotal ?? 0).toFixed(2)} outstanding)`,
      )
      .join('\n');
    const picked = window.prompt(`Enter invoice number or ID:\n\n${list}`);
    if (!picked) return null;

    const match = open.find(
      (i) => String(i.id) === picked.trim() || i.invoiceNumber === picked.trim(),
    );
    if (!match) {
      setApplySuccess(null);
      setPageError('Invoice not found in open invoices.');
      setTimeout(() => setPageError(null), 6000);
      return null;
    }
    return toTarget(match);
  }

  async function applyToInvoice() {
    if (!note) return;
    const amount = Number(window.prompt('Amount to apply', String(note.remainingCredit)) || 0);
    if (amount <= 0) return;

    try {
      setPageError(null);
      const invoice = await resolveApplyInvoice();
      if (!invoice) return;

      const updated = await applyCreditNoteToInvoice(note.id, invoice.id, amount);
      setNote(updated);
      setApplySuccess(
        `Applied $${amount.toFixed(2)} to ${invoice.label}. Status: ${updated.status.replace('_', ' ')}.`,
      );
      setTimeout(() => setApplySuccess(null), 6000);
    } catch (e) {
      setApplySuccess(null);
      setPageError(e instanceof Error ? e.message : 'Apply failed.');
      setTimeout(() => setPageError(null), 6000);
    }
  }

  async function cancelNote() {
    if (!note) return;
    if (!window.confirm('Cancel this credit note?')) return;
    try {
      setPageError(null);
      const updated = await updateCreditNote(note.id, { status: 'cancelled' });
      setNote(updated);
      setApplySuccess(`Credit note ${note.creditNoteNumber} cancelled`);
      setTimeout(() => setApplySuccess(null), 6000);
    } catch (e) {
      setApplySuccess(null);
      setPageError(e instanceof Error ? e.message : 'Cancel failed.');
      setTimeout(() => setPageError(null), 6000);
    }
  }

  if (!note) return <div className="p-6">Loading...</div>;
  const step = note.status === 'draft' ? 0 : note.status === 'issued' ? 1 : note.status === 'cancelled' ? -1 : 2;

  // TC-39 — Scoped print. Uses the same `body.printing-section` + the
  // [data-print-target] visibility-hidden trick the Payroll module uses.
  // Without this, window.print() spits out the entire app shell (sidebar,
  // nav, headers, other panels) — the bug the tester reported.
  const handlePrint = () => {
    const target = document.querySelector('[data-print-section="credit-note"]');
    if (!target) {
      window.print();
      return;
    }
    target.setAttribute('data-print-target', '');
    document.body.classList.add('printing-section');
    const cleanup = () => {
      target.removeAttribute('data-print-target');
      document.body.classList.remove('printing-section');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 2000); // Safari fallback
    window.print();
  };

  return (
    <div className="p-6 space-y-6">
      {applySuccess && (
        <div
          className="fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg max-w-md"
          style={{
            background: 'var(--color-badge-green-bg, #ecfdf5)',
            borderLeft: '4px solid var(--color-brand-green, #22c55e)',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-brand-green-tint, #15803d)' }}>
            {applySuccess}
          </p>
        </div>
      )}
      {pageError && (
        <div
          className="fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg max-w-md"
          style={{
            background: 'var(--color-badge-red-bg, #fef2f2)',
            borderLeft: '4px solid var(--color-brand-red-tint, #ef4444)',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-brand-red-tint, #dc2626)' }}>
            {pageError}
          </p>
        </div>
      )}

      <div className="bg-white border rounded-xl p-5 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales/credit-notes')} className="p-2 border rounded-lg"><ArrowLeft size={16} /></button>
          <h1 className="text-xl font-black uppercase">{note.creditNoteNumber}</h1>
        </div>
        <button onClick={handlePrint} className="px-4 py-2 border rounded-lg text-sm font-black uppercase flex items-center gap-2"><Printer size={16} /> Print</button>
      </div>

      {/* TC-39 — Everything inside this wrapper is what actually prints. */}
      <div data-print-section="credit-note" className="space-y-6">
      {/* Title row for the printed page only (header is print-hidden above). */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-black uppercase">Credit Note {note.creditNoteNumber}</h1>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-xs font-black text-gray-500 uppercase mb-2">Timeline</h2>
        <div className="flex gap-2">
          {['Draft', 'Issued', 'Used/Expired'].map((x, i) => (
            <span key={x} className={`px-3 py-2 rounded-lg text-xs font-black uppercase ${step >= i ? 'text-white' : 'bg-gray-100 text-gray-400'}`} style={step >= i ? { backgroundColor: THEME } : undefined}>{x}</span>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-400 uppercase">Customer</div>
          <div className="font-black">{note.customerName}</div>
          <div className="text-xs text-gray-400 uppercase mt-3">Linked Invoice</div>
          <div className="font-black">{note.originalInvoiceNumber || '-'}</div>
          {/* TASK 7 — Backlink to the Sales Return that spawned this CN
              (when present). Click navigates to the SR detail page.
              Hidden while MODULE_FLAGS.sales_returns is false (D3.0.5). */}
          {MODULE_FLAGS.sales_returns && note.originalReturnId && (
            <>
              <div className="text-xs text-gray-400 uppercase mt-3">From Sales Return</div>
              <button
                type="button"
                onClick={() => navigate(`/sales/returns/${note.originalReturnId}`)}
                className="font-black text-left underline hover:opacity-80"
                style={{ color: THEME }}
              >
                {note.originalReturnNumber || `Return #${note.originalReturnId}`}
              </button>
            </>
          )}
          <div className="text-xs text-gray-400 uppercase mt-3">Reason</div>
          <div className="font-black">{note.reason}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase">Total</div>
          <div className="font-mono font-black">{note.totalCreditAmount.toFixed(2)}</div>
          <div className="text-xs text-gray-400 uppercase mt-3">Used</div>
          <div className="font-mono font-black">{note.usedAmount.toFixed(2)}</div>
          <div className="text-xs text-gray-400 uppercase mt-3">Remaining</div>
          <div className="font-mono font-black text-orange-600">{note.remainingCredit.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-xs font-black text-gray-500 uppercase mb-3">Usage History</h2>
        <p className="text-sm text-gray-600">Applied amount: {note.usedAmount.toFixed(2)} against customer receivables.</p>
        {/* Action buttons hidden in print — they're interactive-only. */}
        <div className="mt-4 flex gap-2 print:hidden">
          <button onClick={() => void applyToInvoice()} className="px-4 py-2 rounded-lg text-white text-sm font-black uppercase" style={{ backgroundColor: THEME }}>Apply to Invoice</button>
          <button onClick={() => void cancelNote()} className="px-4 py-2 rounded-lg border text-red-600 text-sm font-black uppercase">Cancel</button>
        </div>
      </div>
      </div> {/* end data-print-section */}
    </div>
  );
}
