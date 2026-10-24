import type { CSSProperties } from 'react';
import type { PickManifest } from '../../services/pickingService';

const block: CSSProperties = {
  border: '1px solid #111',
  borderRadius: 8,
  padding: 12,
  marginTop: 12,
  breakInside: 'avoid',
  pageBreakInside: 'avoid',
};

function money(value: number | null): string {
  if (value == null) return '—';
  return value.toFixed(2);
}

export default function ManifestPrint({
  manifest,
  onClose,
}: {
  manifest: PickManifest;
  onClose: () => void;
}) {
  const when = manifest.dispatchedAt ? manifest.dispatchedAt.slice(0, 16).replace('T', ' ') : '—';
  const van = [manifest.van.code, manifest.van.plate].filter(Boolean).join(' · ') || '—';

  return (
    <div role="dialog" aria-label="Manifest" style={{ position: 'fixed', inset: 24, overflow: 'auto', zIndex: 40, background: '#fff', color: '#111', padding: 16 }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #manifest-print, #manifest-print * { visibility: visible !important; }
          #manifest-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff;
            color: #111;
          }
          .manifest-no-print { display: none !important; }
        }
      `}</style>
      <div id="manifest-print" data-testid="manifest-print">
        <header>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{manifest.manifestNumber || 'Manifest'}</h2>
          <p>{when}</p>
          <p>Van {van}</p>
          <p>Driver {manifest.driverName || '—'}</p>
        </header>
        {manifest.stops.map((stop, index) => (
          <section key={`${stop.invoiceNumber || 'stop'}-${index}`} data-testid={`manifest-stop-${index}`} style={block}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{stop.customerName || '—'}</h3>
            <p>{stop.address || '—'}</p>
            <p>{stop.phone || '—'}</p>
            <p>Invoice {stop.invoiceNumber || '—'}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['SKU', 'Name', 'Required', 'Picked'].map((heading) => (
                    <th key={heading} style={{ textAlign: 'left', borderBottom: '1px solid #111', padding: '4px 6px' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stop.lines.map((line, lineIndex) => (
                  <tr key={`${line.sku || 'line'}-${lineIndex}`} data-short={line.short ? 'true' : 'false'}>
                    <td style={{ padding: '4px 6px' }}>{line.sku || '—'}</td>
                    <td style={{ padding: '4px 6px' }}>{line.name || '—'}{line.short ? ' short' : ''}</td>
                    <td style={{ padding: '4px 6px' }}>{line.qtyRequired}</td>
                    <td style={{ padding: '4px 6px' }}>{line.qtyPicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Invoice total {money(stop.invoiceTotal)}</p>
            <p>Payment terms {stop.paymentTerms || '—'}</p>
          </section>
        ))}
        <footer data-testid="manifest-totals" style={{ marginTop: 16, fontWeight: 700 }}>
          {`Stops ${manifest.totals.stops} · Units ${manifest.totals.units} · Short lines ${manifest.totals.shortLines}`}
        </footer>
      </div>
      <div className="manifest-no-print" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
