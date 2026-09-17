import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Printer } from 'lucide-react';
import { getCollectionsReport, type CollectionsRow } from '../../services/api';
import { group1Rows } from './Collections';
import { formatCurrency } from '../../utils/formatters';

const LOAD_ERROR = "Couldn't load the driver list. Check your connection and try again.";

export default function CollectionsDriver() {
  const [rows, setRows] = useState<CollectionsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const report = await getCollectionsReport();
        setRows(group1Rows(report.rows));
      } catch {
        setError(LOAD_ERROR);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = rows; // keep API order: most recent last_order first

  return (
    <div className="max-w-[900px] mx-auto pb-10 space-y-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-3">
        <Link
          to="/finance/collections"
          className="inline-flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700"
        >
          <ArrowLeft size={14} /> Back to Collections
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:opacity-90"
        >
          <Printer size={14} />
          Print
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
          Driver list — Group 1
        </h1>
        <p className="text-sm text-gray-500 mt-1">Cash on delivery from next order</p>
      </div>

      {error && (
        <div className="no-print bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-8">Loading…</p>}

      {!loading && sorted.length === 0 && !error && (
        <p className="text-sm text-gray-500 text-center py-8">No Group 1 invoices right now.</p>
      )}

      <div className="space-y-4">
        {sorted.map((row) => (
          <div
            key={row.invoice_id}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm break-inside-avoid"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="text-lg font-black text-gray-900">{row.customer_name}</h2>
              <p className="text-sm font-bold text-gray-700">
                {row.customer_phone || 'No phone on file'}
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Outstanding: <span className="font-bold">{formatCurrency(row.outstanding)}</span>
              {' · '}
              {row.invoice_number}
            </p>
            <p className="text-lg font-semibold text-gray-900 leading-snug">{row.driver_line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
