import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../services/settingsService';
import { getInventorySummary, type InventorySummary, type MovementWindow } from '../../services/inventoryLedgerService';

const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '12px',
  padding: '12px 14px',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: 'var(--color-redwood-row-bg)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '7px',
  padding: '7px 9px',
  marginBottom: '5px',
  color: 'inherit',
  textDecoration: 'none',
};

const headerBtn: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '7px',
  padding: '6px 10px',
  fontSize: '10.5px',
  color: 'var(--color-redwood-text-muted)',
  cursor: 'pointer',
  fontFamily: "'DM Sans',sans-serif",
};

function qty(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function kpiCard(cfg: {
  stripe: string;
  label: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  value: string;
  valueColor: string;
  sub: string;
}) {
  return (
    <div style={{
      background: 'var(--color-redwood-bg-surface)',
      border: '1px solid var(--color-redwood-border)',
      borderRadius: '12px',
      padding: '12px 14px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', borderRadius: '12px 12px 0 0', background: cfg.stripe }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-redwood-text-muted)' }}>{cfg.label}</span>
        <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', background: cfg.badgeBg, color: cfg.badgeColor }}>
          {cfg.badge}
        </span>
      </div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, lineHeight: '1.1', marginBottom: '3px', letterSpacing: '-0.5px', color: cfg.valueColor }}>
        {cfg.value}
      </div>
      <div style={{ fontSize: '9.5px', color: 'var(--color-redwood-text-subtle)' }}>{cfg.sub}</div>
    </div>
  );
}

function windowSub(window: MovementWindow | undefined, loading: boolean): { value: string; sub: string } {
  if (loading || !window) return { value: '—', sub: '—' };
  return {
    value: qty(window.units),
    sub: `${window.lines} lines · ${formatCurrency(window.value)}`,
  };
}

export default function WarehouseDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cols, setCols] = useState({ kpi: 4, twoCol: true });

  useEffect(() => {
    const update = () => setCols({
      kpi: window.innerWidth >= 1024 ? 4 : 2,
      twoCol: window.innerWidth >= 1024,
    });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getInventorySummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSummary(null);
          setError(err instanceof Error ? err.message : 'Could not load the warehouse summary.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const report = summary;
  const received = windowSub(report?.received_30d, !report);
  const returned = windowSub(report?.returned_to_supplier_30d, !report);

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-redwood-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box size={20} style={{ color: 'var(--color-brand-amber)' }} />
            Warehouse Management
          </h1>
          <div style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-subtle)', marginTop: '2px' }}>
            Stock ledger · on hand · receipts and returns
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {summary && summary.ledger_drift_count > 0 && (
            <Link
              to="/warehouse/stock?drift=1"
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '6px 10px',
                borderRadius: '999px',
                background: 'rgba(239,68,68,.15)',
                color: 'var(--color-brand-red-tint)',
                textDecoration: 'none',
              }}
            >
              Ledger drift {summary.ledger_drift_count}
            </Link>
          )}
          <button type="button" style={headerBtn} onClick={() => navigate('/warehouse/stock')}>Stock on hand</button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--color-brand-red)' }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols.kpi}, 1fr)`,
        gap: '9px',
        marginBottom: '12px',
      }}>
        {kpiCard({
          stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
          label: 'Stock value at cost',
          badge: 'Ledger', badgeBg: 'rgba(34,197,94,.15)', badgeColor: '#86EFAC',
          value: report ? formatCurrency(report.stock_value_at_cost) : '—',
          valueColor: 'var(--color-redwood-text-main)',
          sub: report ? `GL 1200 ${formatCurrency(report.gl_inventory_1200)} · diff ${formatCurrency(report.gl_difference)}` : '—',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
          label: 'Units on hand',
          badge: 'Ledger', badgeBg: 'rgba(79,142,247,.15)', badgeColor: '#93C5FD',
          value: report ? qty(report.units_on_hand) : '—',
          valueColor: 'var(--color-redwood-text-main)',
          sub: report ? `${report.products_active} active products` : '—',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
          label: 'Received 30d',
          badge: 'GRN', badgeBg: 'rgba(245,158,11,.15)', badgeColor: 'var(--color-brand-amber)',
          value: received.value,
          valueColor: 'var(--color-redwood-text-main)',
          sub: received.sub,
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)',
          label: 'Returned to supplier 30d',
          badge: '30d', badgeBg: 'rgba(239,68,68,.12)', badgeColor: 'var(--color-brand-red-tint)',
          value: returned.value,
          valueColor: 'var(--color-redwood-text-main)',
          sub: returned.sub,
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.kpi > 2 ? 3 : 1}, 1fr)`, gap: '9px', marginBottom: '12px' }}>
        {[
          { label: 'Low stock', value: report ? String(report.below_min_count) : '—', to: '/warehouse/stock?below_min=1' },
          { label: 'Zero stock', value: report ? String(report.zero_stock_count) : '—', to: '/warehouse/stock?zero=1' },
          { label: 'No movement 90d', value: report ? String(report.no_movement_90d_count) : '—', to: '/warehouse/stock' },
        ].map((item) => (
          <Link key={item.label} to={item.to} style={{ ...panel, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>{item.label}</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, color: 'var(--color-redwood-text-main)' }}>{item.value}</div>
          </Link>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: cols.twoCol ? '1fr minmax(250px,0.7fr)' : '1fr',
        gap: '10px',
        marginBottom: '12px',
      }}>
        <div style={panel}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
            Top movers 90d
          </div>
          {!report ? (
            <div style={{ fontSize: '12px', color: 'var(--color-redwood-text-muted)' }}>—</div>
          ) : report.top_movers_90d.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--color-redwood-text-muted)', textAlign: 'center', padding: '12px 0' }}>
              No outbound movement in 90 days
            </div>
          ) : report.top_movers_90d.map((row) => (
            <Link key={row.product_id} to={`/products/${row.product_id}`} style={rowStyle}>
              <span style={{ fontSize: '11px', color: 'var(--color-redwood-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {row.name}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-brand-amber)', flexShrink: 0, marginLeft: '8px' }}>
                {qty(row.units_out)} out
              </span>
            </Link>
          ))}
        </div>

        <div style={panel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
            <RefreshCw size={13} style={{ color: 'var(--color-redwood-text-muted)' }} />
            Reorder Alerts
          </div>
          {!report ? (
            <div style={{ fontSize: '12px', color: 'var(--color-redwood-text-muted)' }}>—</div>
          ) : (
            <>
              <Link to="/warehouse/stock?below_min=1" style={rowStyle}>
                <span style={{ fontSize: '11px', color: 'var(--color-redwood-text-main)' }}>Below minimum</span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-brand-amber)' }}>{report.below_min_count}</span>
              </Link>
              <Link to="/warehouse/stock?zero=1" style={rowStyle}>
                <span style={{ fontSize: '11px', color: 'var(--color-redwood-text-main)' }}>Zero stock</span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-brand-red)' }}>{report.zero_stock_count}</span>
              </Link>
            </>
          )}
        </div>
      </div>

      <div style={{ ...panel, fontSize: '11px', color: 'var(--color-redwood-text-muted)' }}>
        Coming next: bins, lots &amp; expiry, pick lists
      </div>
    </div>
  );
}
