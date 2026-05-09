import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { fetchPublicInvoiceByToken, type PublicInvoicePayload } from '../services/api';
import { Printer } from 'lucide-react';

const MAROON = '#800020';
const CREAM = '#FDF8F0';
/** QR always points to company site (not the invoice URL). */
const BETTANO_QR_TARGET_URL = 'https://www.bettanoglobal.com'; // TODO: update via Settings

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sliceDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function statusDisplay(status: string | undefined): { label: string; paid: boolean } {
  const s = (status || 'unpaid').toLowerCase();
  if (s === 'paid') return { label: 'PAID', paid: true };
  return { label: 'UNPAID', paid: false };
}

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicInvoicePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token?.trim()) return;
    let cancelled = false;
    fetchPublicInvoiceByToken(token)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Could not load invoice');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    QRCode.toDataURL(BETTANO_QR_TARGET_URL, {
      width: 120,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, []);

  if (!token?.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: CREAM }}>
        <div
          className="bg-white max-w-md w-full p-8 text-center rounded-lg"
          style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.08)' }}
        >
          <p className="text-gray-900 font-semibold">Invoice unavailable</p>
          <p className="text-gray-500 text-sm mt-2">Invalid link</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: CREAM }}>
        <div
          className="bg-white max-w-md w-full p-8 text-center rounded-lg"
          style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.08)' }}
        >
          <p className="text-gray-900 font-semibold">Invoice unavailable</p>
          <p className="text-gray-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CREAM }}>
        <div
          className="w-10 h-10 rounded-full animate-spin border-2 border-gray-300"
          style={{ borderTopColor: MAROON }}
        />
      </div>
    );
  }

  const c = data.company_settings;
  const items = Array.isArray(data.items) ? data.items : [];
  const { label: statusLabel, paid: isPaid } = statusDisplay(data.status);

  return (
    <div
      className="min-h-screen py-10 px-4 print:py-4 print:px-2 print:bg-white"
      style={{ background: CREAM }}
    >
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <article
        className="mx-auto bg-white overflow-hidden print:shadow-none print:max-w-none rounded-lg"
        style={{
          maxWidth: '680px',
          padding: '40px',
          boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
        }}
      >
        {/* HEADER */}
        <header className="text-center pb-6">
          {c.logo ? (
            <div className="flex justify-center mb-4">
              <img src={c.logo} alt="" className="max-h-[80px] w-auto object-contain" />
            </div>
          ) : null}
          <h1 className="font-bold" style={{ fontSize: '26px', color: MAROON }}>
            {c.name}
          </h1>
          <div className="mt-3 space-y-0.5 leading-relaxed" style={{ fontSize: '13px', color: '#666' }}>
            {c.address ? <p>{c.address}</p> : null}
            <p>{[c.city, c.country].filter(Boolean).join(', ')}</p>
            {c.phone ? <p>{c.phone}</p> : null}
            {c.email ? <p>{c.email}</p> : null}
            {c.website ? <p>{c.website}</p> : null}
          </div>
          <div className="mt-6" style={{ borderBottom: `2px solid ${MAROON}` }} />
        </header>

        {/* INVOICE INFO ROW */}
        <div className="flex flex-wrap justify-between items-start gap-4 mt-8 mb-8">
          <div>
            <p
              className="text-xs font-bold tracking-widest mb-1"
              style={{ color: MAROON, fontVariant: 'small-caps', letterSpacing: '0.12em' }}
            >
              INVOICE
            </p>
            <p className="font-bold text-[22px] text-gray-900">{data.invoice_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">
              <span className="text-gray-500">Date </span>
              <span className="font-medium text-gray-800">{sliceDate(data.date)}</span>
            </p>
            {data.due_date ? (
              <p className="text-sm text-gray-600 mt-1">
                <span className="text-gray-500">Due </span>
                <span className="font-medium text-gray-800">{sliceDate(data.due_date)}</span>
              </p>
            ) : null}
            <span
              className="inline-block mt-3 px-3 py-1 text-xs font-bold rounded"
              style={{
                background: isPaid ? '#dcfce7' : MAROON,
                color: isPaid ? '#166534' : '#fff',
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* BILL TO */}
        <div
          className="mb-8 px-4 py-4 rounded-r"
          style={{ background: CREAM, borderLeft: `3px solid ${MAROON}` }}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Bill to</p>
          <p className="font-bold text-base text-gray-900">{data.customer_name || 'Customer'}</p>
        </div>

        {/* ITEMS TABLE */}
        <div className="overflow-x-auto rounded-t-lg overflow-hidden border border-[#eee]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: MAROON, color: '#fff' }}>
                <th className="text-left font-bold py-3 px-3 uppercase text-xs tracking-wide">Item</th>
                <th className="text-right font-bold py-3 px-3 uppercase text-xs tracking-wide w-20">Qty</th>
                <th className="text-right font-bold py-3 px-3 uppercase text-xs tracking-wide w-28">Price</th>
                <th className="text-right font-bold py-3 px-3 uppercase text-xs tracking-wide w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((raw, idx) => {
                const product = String(raw.product ?? raw.name ?? '—');
                const desc = String(raw.description ?? '');
                const qty = Number(raw.quantity) || 0;
                const rate = Number(raw.rate) || 0;
                const amount = Number(raw.amount) || 0;
                const rowBg = idx % 2 === 0 ? '#fff' : CREAM;
                return (
                  <tr key={idx} style={{ background: rowBg, borderBottom: '1px solid #eee' }}>
                    <td className="py-3 px-3 text-gray-900 align-top">
                      <span className="font-medium">{product}</span>
                      {desc ? <p className="text-xs text-gray-500 mt-0.5">{desc}</p> : null}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-gray-700 align-top">{qty}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-gray-700 align-top">
                      {formatMoney(rate)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-gray-900 align-top">
                      {formatMoney(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TOTALS */}
        <div className="mt-6 space-y-2 text-sm">
          <div className="flex justify-end text-gray-600">
            <span className="w-40 text-right">Subtotal</span>
            <span className="w-32 text-right font-medium text-gray-900">{formatMoney(data.subtotal)}</span>
          </div>
          {data.discount > 0 ? (
            <div className="flex justify-end text-gray-600">
              <span className="w-40 text-right">Discount</span>
              <span className="w-32 text-right font-medium text-gray-900">{formatMoney(data.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-end text-gray-600">
            <span className="w-40 text-right">Tax</span>
            <span className="w-32 text-right font-medium text-gray-900">{formatMoney(data.tax)}</span>
          </div>
          <div
            className="flex justify-end items-center font-bold text-lg mt-2 py-3 px-3 -mx-3 rounded"
            style={{ background: MAROON, color: '#fff' }}
          >
            <span className="w-40 text-right uppercase text-sm tracking-wide">Total</span>
            <span className="w-32 text-right" style={{ fontSize: '18px' }}>
              {formatMoney(data.total)}
            </span>
          </div>
        </div>

        {/* FOOTER */}
        {data.notes ? (
          <p className="mt-10 text-sm text-gray-500 italic whitespace-pre-wrap leading-relaxed">{data.notes}</p>
        ) : null}

        <p className="mt-8 text-center text-sm text-gray-600">Thank you for your business.</p>

        {qrDataUrl ? (
          <div className="mt-8 flex flex-col items-center gap-2">
            <img
              src={qrDataUrl}
              alt="bettanoglobal.com"
              width={120}
              height={120}
              className="w-[120px] h-[120px]"
            />
            
          </div>
        ) : null}

        <div className="mt-10 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full py-3.5 rounded-lg text-white font-bold text-sm transition-opacity hover:opacity-95"
            style={{ background: MAROON }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Printer size={18} />
              Print invoice
            </span>
          </button>
        </div>
      </article>
    </div>
  );
}
