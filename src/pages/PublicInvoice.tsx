import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { fetchPublicInvoiceByToken, type PublicInvoicePayload } from '../services/api';
import { formatCityLine } from '../services/settingsService';
import { Download } from 'lucide-react';

const MAROON = '#800020';
const CREAM = '#FDF8F0';
const DEFAULT_COMPANY_NAME = 'SOLTOL';

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sliceDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function statusDisplay(status: string | undefined): { label: string; paid: boolean } {
  const s = (status || 'unpaid').toLowerCase();
  if (s === 'paid') return { label: 'Paid', paid: true };
  if (s === 'partial') return { label: 'Partial', paid: false };
  return { label: 'Unpaid', paid: false };
}

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const autoPdf = searchParams.get('pdf') === '1';
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
    if (!token?.trim()) return;
    const invoiceUrl = `${window.location.origin}/invoice/${encodeURIComponent(token.trim())}`;
    QRCode.toDataURL(invoiceUrl, {
      width: 120,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [token]);

  useEffect(() => {
    if (!autoPdf || !data) return;
    const t = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(t);
  }, [autoPdf, data]);

  const handleDownloadPdf = () => window.print();

  if (!token?.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 public-invoice-page" style={{ background: CREAM }}>
        <div className="bg-white max-w-md w-full p-8 text-center rounded-lg shadow-md">
          <p className="text-gray-900 font-semibold">Invoice unavailable</p>
          <p className="text-gray-500 text-sm mt-2">Invalid link</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 public-invoice-page" style={{ background: CREAM }}>
        <div className="bg-white max-w-md w-full p-8 text-center rounded-lg shadow-md">
          <p className="text-gray-900 font-semibold">Invoice unavailable</p>
          <p className="text-gray-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center public-invoice-page" style={{ background: CREAM }}>
        <div
          className="w-10 h-10 rounded-full animate-spin border-2 border-gray-300"
          style={{ borderTopColor: MAROON }}
        />
      </div>
    );
  }

  const c = data.company_settings;
  const companyName = (c?.name || '').trim() || DEFAULT_COMPANY_NAME;
  const cityLine = formatCityLine(c?.city, c?.state, c?.postal_code);
  const items = Array.isArray(data.items) ? data.items : [];
  const { label: statusLabel, paid: isPaid } = statusDisplay(data.status);
  const customerAddress = (data.customer_address || '').trim();

  return (
    <div
      className="min-h-screen py-6 px-4 print:py-0 print:px-0 print:bg-white public-invoice-page"
      style={{ background: CREAM }}
    >
      <style>{`
        @media print {
          html, body { background: #fff !important; margin: 0; }
          .public-invoice-page { background: #fff !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .invoice-print-root {
            box-shadow: none !important;
            max-width: none !important;
            padding: 24px !important;
            border-radius: 0 !important;
          }
          .invoice-print-root * {
            color: #111 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .invoice-table-head { background: #333 !important; color: #fff !important; }
          .invoice-total-bar { background: #333 !important; color: #fff !important; }
          .bill-to-box { background: #f5f5f5 !important; border-left-color: #333 !important; }
        }
      `}</style>

      <div className="mx-auto no-print mb-4" style={{ maxWidth: '680px' }}>
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="w-full py-3.5 rounded-lg text-white font-bold text-sm transition-opacity hover:opacity-95 flex items-center justify-center gap-2"
          style={{ background: MAROON }}
        >
          <Download size={18} aria-hidden />
          Download as PDF
        </button>
        <p className="text-center text-xs text-gray-500 mt-2">
          Opens your browser print dialog — choose &quot;Save as PDF&quot;
        </p>
      </div>

      <article
        className="invoice-print-root mx-auto bg-white overflow-hidden print:shadow-none rounded-lg"
        style={{
          maxWidth: '680px',
          padding: '40px',
          boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
        }}
      >
        <header className="text-center pb-6 border-b-2" style={{ borderColor: MAROON }}>
          {c?.logo ? (
            <div className="flex justify-center mb-4">
              <img src={c.logo} alt="" className="max-h-[80px] w-auto object-contain" />
            </div>
          ) : null}
          <h1 className="font-bold tracking-tight" style={{ fontSize: '28px', color: MAROON }}>
            {companyName}
          </h1>
          <div className="mt-3 space-y-0.5 leading-relaxed text-sm text-gray-600">
            {c?.address ? <p>{c.address}</p> : null}
            {cityLine ? <p>{cityLine}</p> : null}
            {c?.country ? <p>{c.country}</p> : null}
            {c?.phone ? <p>{c.phone}</p> : null}
            {c?.email ? <p>{c.email}</p> : null}
            {c?.website ? <p>{c.website}</p> : null}
            {c?.tax_id ? <p>Tax ID: {c.tax_id}</p> : null}
          </div>
        </header>

        <div className="flex flex-wrap justify-between items-start gap-4 mt-8 mb-6">
          <div>
            <p className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">Invoice</p>
            <p className="font-bold text-2xl text-gray-900">{data.invoice_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">
              <span className="text-gray-500">Date </span>
              <span className="font-medium text-gray-900">{sliceDate(data.date)}</span>
            </p>
            {data.due_date ? (
              <p className="text-sm text-gray-600 mt-1">
                <span className="text-gray-500">Due </span>
                <span className="font-medium text-gray-900">{sliceDate(data.due_date)}</span>
              </p>
            ) : null}
            <span
              className="inline-block mt-3 px-3 py-1 text-xs font-bold rounded uppercase"
              style={{
                background: isPaid ? '#dcfce7' : '#fee2e2',
                color: isPaid ? '#166534' : '#991b1b',
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div
          className="bill-to-box mb-8 px-4 py-4 rounded-r"
          style={{ background: CREAM, borderLeft: `3px solid ${MAROON}` }}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Bill to</p>
          <p className="font-bold text-base text-gray-900">{data.customer_name || 'Customer'}</p>
          {customerAddress ? (
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{customerAddress}</p>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-lg overflow-hidden border border-gray-200">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="invoice-table-head" style={{ background: MAROON, color: '#fff' }}>
                <th className="text-left font-bold py-3 px-3 uppercase text-xs">Product</th>
                <th className="text-right font-bold py-3 px-3 uppercase text-xs w-20">Qty</th>
                <th className="text-right font-bold py-3 px-3 uppercase text-xs w-28">Rate</th>
                <th className="text-right font-bold py-3 px-3 uppercase text-xs w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 px-3 text-center text-gray-500">
                    No line items
                  </td>
                </tr>
              ) : (
                items.map((raw, idx) => {
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
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 space-y-2 text-sm">
          <div className="flex justify-end text-gray-600">
            <span className="w-40 text-right">Subtotal</span>
            <span className="w-32 text-right font-medium text-gray-900">{formatMoney(data.subtotal)}</span>
          </div>
          {data.discount > 0 ? (
            <div className="flex justify-end text-gray-600">
              <span className="w-40 text-right">Discount</span>
              <span className="w-32 text-right font-medium text-gray-900">
                −{formatMoney(data.discount)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-end text-gray-600">
            <span className="w-40 text-right">Tax</span>
            <span className="w-32 text-right font-medium text-gray-900">{formatMoney(data.tax)}</span>
          </div>
          <div
            className="invoice-total-bar flex justify-end items-center font-bold text-lg mt-2 py-3 px-3 rounded"
            style={{ background: MAROON, color: '#fff' }}
          >
            <span className="w-40 text-right uppercase text-sm tracking-wide">Total</span>
            <span className="w-32 text-right text-lg">{formatMoney(data.total)}</span>
          </div>
        </div>

        {data.notes ? (
          <div className="mt-8">
            <p className="text-xs font-bold uppercase text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data.notes}</p>
          </div>
        ) : null}

        <p className="mt-8 text-center text-sm text-gray-600">Thank you for your business.</p>

        {qrDataUrl ? (
          <div className="mt-6 flex flex-col items-center gap-1 no-print">
            <img src={qrDataUrl} alt="" width={96} height={96} className="w-24 h-24" />
          </div>
        ) : null}
      </article>
    </div>
  );
}
