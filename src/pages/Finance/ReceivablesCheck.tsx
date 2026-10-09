import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import {
  getCollectionsReport,
  getCustomerPayments,
  getInvoices,
  getReceivablesCheck,
} from '../../services/api';
import { getCreditNotes } from '../../services/creditNoteService';
import { formatCurrency } from '../../services/settingsService';
import {
  buildReceivablesCheck,
  type ReceivablesCheckReport,
} from '../../utils/receivablesCheck';

function Section({
  title,
  count,
  total,
  children,
}: {
  title: string;
  count: number;
  total: number;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-black uppercase tracking-wide text-gray-900">{title}</h2>
        <p className="text-xs font-bold text-gray-500">
          {count} · {formatCurrency(total)}
        </p>
      </div>
      {count === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">None.</p>
      ) : (
        children
      )}
    </section>
  );
}

export default function ReceivablesCheck() {
  const [report, setReport] = useState<ReceivablesCheckReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getInvoices(),
      getCustomerPayments(),
      getCreditNotes(),
      getReceivablesCheck(),
      getCollectionsReport(undefined, 'all'),
    ])
      .then(([invoices, payments, notes, check, collections]) => {
        if (cancelled) return;
        setReport(
          buildReceivablesCheck({
            invoices,
            payments,
            creditNotes: notes,
            importedCredits: check.imported_credits,
            unappliedPayments: check.unapplied_payments,
            collections: { total: collections.total, rows: collections.rows },
          }),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load receivables.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto pb-10">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
            <ClipboardCheck size={24} className="text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Receivables Check</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Read only. This page does not change invoices, payments, or credits.
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {!report && !error && <p className="text-sm font-bold text-gray-400">Loading...</p>}

      {report && (
        <>
          <Section title="Paid in SOLTOL, still open in the old balance" count={report.paidShownOpen.count} total={report.paidShownOpen.total}>
            <RecordTable rows={report.paidShownOpen.rows} />
          </Section>

          <Section title="Unapplied credits and returns" count={report.unappliedCredits.count} total={report.unappliedCredits.total}>
            <RecordTable rows={report.unappliedCredits.rows} showStored />
          </Section>

          <Section title="Customer payments not linked to an invoice" count={report.unappliedPayments.count} total={report.unappliedPayments.total}>
            <RecordTable rows={report.unappliedPayments.rows} />
          </Section>

          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-black uppercase tracking-wide text-gray-900">
                Per customer · {report.customers.length}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    {['Customer', 'Gross open', 'Unapplied credits', 'Net balance'].map((heading) => (
                      <th key={heading} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.customers.map((row) => (
                    <tr key={row.customerId}>
                      <td className="px-5 py-3 text-sm font-bold text-gray-900">
                        <Link className="hover:underline" to={`/customers/${row.customerId}`}>{row.customerName}</Link>
                      </td>
                      <td className="px-5 py-3 text-sm font-mono">{formatCurrency(row.gross)}</td>
                      <td className="px-5 py-3 text-sm font-mono">{formatCurrency(row.credits)}</td>
                      <td className="px-5 py-3 text-sm font-mono font-black">{formatCurrency(row.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-black uppercase tracking-wide text-gray-900">Why the totals differ</h2>
              <p className="text-xs font-bold text-gray-500">
                {report.gapAddsUp ? 'The parts add up to the cent.' : 'The parts do not add up. Reload and check again.'}
              </p>
            </div>
            <p className="px-5 pt-4 text-sm text-gray-600">
              Aged Receivable gross is {formatCurrency(report.gross)}. Collections “All outstanding” is {formatCurrency(report.collectionsTotal)}.
              Net balance is {formatCurrency(report.net)}, which is the gross minus unapplied credits.
              {report.fallbackCount > 0
                ? ` ${report.fallbackCount} invoice(s) had no server balance, so the payment fallback was used for those.`
                : ' Every loaded invoice had a server balance.'}
            </p>
            <table className="w-full text-left mt-2">
              <tbody>
                {report.gapLines.map((line) => (
                  <tr key={line.label} className="border-t border-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-700">{line.label}</td>
                    <td className="px-5 py-3 text-sm font-mono font-bold text-right">{formatCurrency(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function RecordTable({
  rows,
  showStored,
}: {
  rows: ReceivablesCheckReport['paidShownOpen']['rows'];
  showStored?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Record</th>
            <th className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
            {showStored && <th className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stored as</th>}
            <th className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
            <th className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Why</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-5 py-3 text-sm font-bold">
                <Link className="text-blue-700 hover:underline" to={row.href}>{row.label}</Link>
              </td>
              <td className="px-5 py-3 text-sm text-gray-700">{row.customerName}</td>
              {showStored && <td className="px-5 py-3 text-sm text-gray-700">{row.storedAs}</td>}
              <td className="px-5 py-3 text-sm font-mono">{formatCurrency(row.amount)}</td>
              <td className="px-5 py-3 text-xs text-gray-500 max-w-md">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
