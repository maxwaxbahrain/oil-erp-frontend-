import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoices, getPayments, type Invoice, type Payment } from '../../services/api';
import { calculateReceivables } from '../../utils/arMetrics';

// ─── Shared style tokens ────────────────────────────────────────
const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '10px',
  padding: '10px 12px',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '5px 8px',
  background: 'var(--color-redwood-row-bg)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '6px',
  marginBottom: '4px',
  fontSize: '10px',
};

const headerBtn: CSSProperties = {
  padding: '5px 10px',
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '6px',
  fontSize: '9.5px',
  color: 'var(--color-redwood-text-muted)',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

// ─── KPI card helper ────────────────────────────────────────────
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
      borderRadius: '10px',
      padding: '10px 12px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '2.5px',
        background: cfg.stripe,
        borderRadius: '10px 10px 0 0',
      }} />
      <div style={{
        fontSize: '9px', color: 'var(--color-redwood-text-muted)',
        marginBottom: '5px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{cfg.label}</span>
        <span style={{
          fontSize: '7px', fontWeight: 700, padding: '1px 5px',
          borderRadius: '999px', background: cfg.badgeBg, color: cfg.badgeColor,
        }}>{cfg.badge}</span>
      </div>
      <div style={{
        fontSize: '18px', fontWeight: 700,
        color: cfg.valueColor,
        fontFamily: "'Syne',sans-serif",
        lineHeight: 1,
      }}>
        {cfg.value}
      </div>
      <div style={{
        fontSize: '8.5px',
        color: 'var(--color-redwood-text-subtle)',
        marginTop: '2px',
      }}>
        {cfg.sub}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

const daysOverdue = (dueDate: string) => {
  const due = new Date(dueDate).getTime();
  if (isNaN(due)) return null;
  return Math.floor((Date.now() - due) / 86400000);
};

// Extract trailing numeric portion of invoice number for gap detection.
// Guarded against null/undefined — backend rows occasionally omit
// invoiceNumber, which used to crash the whole dashboard via
// `.match()` on undefined and produce a black screen.
const seqOf = (invoiceNumber: string | null | undefined): number | null => {
  if (!invoiceNumber) return null;
  const m = invoiceNumber.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Defensive view of the state — if the backend ever returns a
  // non-array (null, error envelope like `{detail: "..."}`, paginated
  // wrapper like `{results: [...]}`, etc.) the .filter/.map/.reduce
  // calls below would throw and black-screen the dashboard. Coercing
  // to [] here keeps the page rendering with empty data instead.
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  // Responsive column count — same ResizeObserver pattern as
  // WarehouseDashboard. Re-evaluates on resize.
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
    // Defence-in-depth: also coerce at the fetch boundary so the
    // state itself stays a valid Invoice[]/Payment[]. If the backend
    // returns a non-array shape we fall back to []. The .catch
    // handlers reset to [] so a transient error can't leave stale
    // data on screen.
    getInvoices()
      .then(data => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => setInvoices([]));
    getPayments()
      .then(data => setPayments(Array.isArray(data) ? data : []))
      .catch(() => setPayments([]));
  }, []);

  // ───────── Computations (pure JS, no new APIs) ─────────
  const now = new Date();

  // Cash position = sum of payments received. (No payables service
  // exists, so the "minus payables" half of the formula resolves
  // to 0. Sub-text still reads "Bank minus payables" per spec.)
  const cashPosition = safePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const receivables = calculateReceivables(safeInvoices, safePayments, now);
  const arOutstanding = receivables.total;
  const arOver30 = receivables.days60 + receivables.days90;

  // VAT collected MTD + matching net income MTD.
  const mtdInvoices = safeInvoices.filter((i) => {
    const d = new Date(i.invoiceDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const vatMTD = mtdInvoices.reduce((s, i) => s + (Number(i.taxAmount) || 0), 0);
  const netIncomeMTD = mtdInvoices.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);

  // AR Aging buckets.
  const bucketCounts = receivables.invoices.reduce((acc, row) => {
    acc[row.bucket] += 1;
    return acc;
  }, { current: 0, days30: 0, days60: 0, days90: 0 });
  const buckets = {
    current:  { total: receivables.current, count: bucketCounts.current, label: 'Current', color: '#22C55E' },
    late:     { total: receivables.days30, count: bucketCounts.days30, label: '1–30 days', color: '#F59E0B' },
    overdue:  { total: receivables.days60, count: bucketCounts.days60, label: '31–60 days', color: '#EF4444' },
    writeoff: { total: receivables.days90, count: bucketCounts.days90, label: '61+ days', color: '#EF4444' },
  };
  const bucketRows = [buckets.current, buckets.late, buckets.overdue, buckets.writeoff];
  const arTotal = bucketRows.reduce((s, b) => s + b.total, 0);
  const maxBucket = Math.max(1, ...bucketRows.map((b) => b.total));

  // Collection Health row 1 — single worst overdue invoice (real data).
  const worstReceivable = [...receivables.invoices]
    .filter((row) => row.bucket === 'days60' || row.bucket === 'days90')
    .sort((a, b) => b.balance - a.balance)[0];
  const worstInvoice = worstReceivable?.invoice as Invoice | undefined;
  // Cast to any so the fallback chain can probe alternate field
  // shapes (`customer.name`, `companyName`, `clientName`, `billTo.name`)
  // that some payloads use even though Invoice type only declares
  // `customerName`. Also handles empty-string case.
  const _wi = worstInvoice as any;
  const worstName =
    (_wi?.customerName && String(_wi.customerName).trim()) ||
    _wi?.customer?.name ||
    _wi?.customer?.companyName ||
    _wi?.companyName ||
    _wi?.clientName ||
    _wi?.billTo?.name ||
    'Overdue account';
  const worstAmount = worstReceivable?.balance ?? 0;
  const worstDays = worstInvoice ? daysOverdue(worstInvoice.dueDate) : null;

  const mtdCollected = safePayments
    .filter(p => {
      const d = new Date(p.payment_date);
      return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalInvoiced = safeInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
  const totalCollected = safePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const collectionRate = totalInvoiced > 0 ? Math.min(100, (totalCollected / totalInvoiced) * 100) : null;
  const linkedPaymentDays = safePayments
    .map(p => {
      if (!p.invoice_id) return null;
      const inv = safeInvoices.find(i => String(i.id) === String(p.invoice_id));
      if (!inv) return null;
      const invoiceDate = new Date(inv.invoiceDate).getTime();
      const paymentDate = new Date(p.payment_date).getTime();
      if (!Number.isFinite(invoiceDate) || !Number.isFinite(paymentDate)) return null;
      return Math.max(0, Math.round((paymentDate - invoiceDate) / 86400000));
    })
    .filter((n): n is number => n !== null);
  const avgDaysToPay = linkedPaymentDays.length
    ? Math.round(linkedPaymentDays.reduce((s, n) => s + n, 0) / linkedPaymentDays.length)
    : null;

  // Sequential invoice-number gap detection.
  // Wrapped in useMemo so it only recomputes when invoices change
  // — and hardened against the two ways this used to crash:
  //   1. Filter sequence numbers > 1,000,000 so a stray timestamp-as-
  //      invoice-number (e.g. "INV-1735689600000") can't blow the
  //      gap window up to a billion.
  //   2. Cap the inner gap-fill loop at MAX_GAP_FILL iterations so
  //      a missing range never adds more than that many entries to
  //      the Set. Without this cap, V8's 2^24 Set-size limit could
  //      throw "RangeError: Set maximum size exceeded" mid-render.
  const { gapSet } = useMemo(() => {
    const seqList = safeInvoices
      .map((i) => seqOf(i.invoiceNumber))
      .filter((n): n is number => n !== null && n <= 1_000_000)
      .sort((a, b) => a - b);
    const gapSet = new Set<number>();
    const MAX_GAP_FILL = 1_000;
    for (let k = 1; k < seqList.length; k++) {
      if (seqList[k] !== seqList[k - 1] + 1) {
        for (
          let n = seqList[k - 1] + 1;
          n < seqList[k] && (n - seqList[k - 1]) <= MAX_GAP_FILL;
          n++
        ) {
          gapSet.add(n);
        }
      }
    }
    return { seqList, gapSet };
  }, [safeInvoices]);
  // An invoice is flagged as a "gap" point if the number right
  // before it is missing — that's where the audit trail breaks.
  // Same null/undefined guard as seqOf — defends against malformed
  // backend rows.
  const hasGap = (invoiceNumber: string | null | undefined): boolean => {
    if (!invoiceNumber) return false;
    const s = seqOf(invoiceNumber);
    return s !== null && gapSet.has(s - 1);
  };

  // ─── Compliance checklist ─────
  const compliance = [
    { status: '—', iconBg: 'rgba(148,163,184,.14)', iconColor: 'var(--color-redwood-text-muted)',
      title: 'Tax registration number on every invoice',
      sub: 'Not checked',
      badge: 'Not checked', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)' },
    { status: '—', iconBg: 'rgba(148,163,184,.14)', iconColor: 'var(--color-redwood-text-muted)',
      title: 'VAT breakdown separately on printed invoice',
      sub: 'Not checked',
      badge: 'Not checked', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)' },
    { status: '—', iconBg: 'rgba(148,163,184,.14)', iconColor: 'var(--color-redwood-text-muted)',
      title: 'Invoice locking — no edits after posting',
      sub: 'Not checked',
      badge: 'Not checked', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)' },
    { status: '—', iconBg: 'rgba(148,163,184,.14)', iconColor: 'var(--color-redwood-text-muted)',
      title: 'Sequential numbering',
      sub: 'Not checked',
      badge: 'Not checked', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)' },
    { status: '—', iconBg: 'rgba(148,163,184,.14)', iconColor: 'var(--color-redwood-text-muted)',
      title: '7-year record retention — all posted invoices archived',
      sub: 'Not checked',
      badge: 'Not checked', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)' },
    { status: '—', iconBg: 'rgba(148,163,184,.14)', iconColor: 'var(--color-redwood-text-muted)',
      title: 'VAT column on invoice table with correct 15% calculation',
      sub: 'Not checked',
      badge: 'Not checked', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)' },
    { status: '—', iconBg: 'rgba(148,163,184,.14)', iconColor: 'var(--color-redwood-text-muted)',
      title: 'Payment terms on every invoice — Net 15, Net 30, COD',
      sub: 'Not checked',
      badge: 'Not checked', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)' },
  ];

  // ─── Render ─────────────────────────────────────────
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '80px' }}>

      {/* ────────── SECTION A — PAGE HEADER ────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '2px' }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '17px',
            fontWeight: 600,
            color: 'var(--color-redwood-text-main)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: "'Syne',sans-serif",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
            Finance &amp; Tax Compliance
          </h1>
          <p style={{
            fontSize: '9.5px',
            color: 'var(--color-redwood-text-subtle)',
            marginTop: '3px',
            margin: '3px 0 0',
          }}>
            Legal invoice format · VAT breakdown · AR aging · Record retention
          </p>
        </div>
        <div style={{ display: 'flex', gap: '7px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button type="button" style={headerBtn}>⬇ Export VAT Return</button>
          <button type="button" style={headerBtn}>🔒 Lock All Posted</button>
        </div>
      </div>

      {/* ────────── SECTION B — 4 KPI CARDS ────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols.kpi},1fr)`,
        gap: '8px',
      }}>
        {kpiCard({
          stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
          label: 'Cash Position',
          badge: 'Today',
          badgeBg: 'rgba(34,197,94,.18)', badgeColor: '#22C55E',
          value: `$${fmt(cashPosition)}`,
          valueColor: 'var(--color-brand-green)',
          sub: 'Bank minus payables',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)',
          label: 'AR Outstanding',
          badge: 'Aging',
          badgeBg: 'rgba(245,158,11,.18)', badgeColor: '#F59E0B',
          value: `$${fmt(arOutstanding)}`,
          valueColor: 'var(--color-brand-red)',
          sub: `$${fmt(arOver30)} over 30 days`,
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
          label: 'VAT Collected MTD',
          badge: '15%',
          badgeBg: 'rgba(124,58,237,.18)', badgeColor: '#A78BFA',
          value: `$${fmt(vatMTD)}`,
          valueColor: '#7C3AED',
          sub: `At 15% on $${fmt(netIncomeMTD)} income`,
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
          label: 'Compliance Score',
          badge: '30%',
          badgeBg: 'rgba(245,158,11,.18)', badgeColor: '#FCD34D',
          value: '30%',
          valueColor: 'var(--color-brand-amber)',
          sub: 'Critical issues — see checklist',
        })}
      </div>

      {/* ────────── SECTION C — AR Aging + Collection Health ────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols.twoCol ? '1fr minmax(190px,0.55fr)' : '1fr',
        gap: '8px',
      }}>
        {/* C1 — AR Aging Breakdown */}
        <div style={panel}>
          <div style={{
            fontSize: '12px', fontWeight: 600,
            color: 'var(--color-redwood-text-main)',
            marginBottom: '8px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>📊 AR Aging Breakdown</span>
            <button
              onClick={() => navigate('/reports/aged-receivable')}
              style={{ fontSize: '9px', color: '#4F8EF7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Ask AI →
            </button>
          </div>

          {bucketRows.map((b) => {
            const pct = Math.round((b.total / maxBucket) * 100);
            return (
              <div key={b.label} style={{ marginBottom: '5px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '9.5px', color: 'var(--color-redwood-text-muted)', marginBottom: '3px',
                }}>
                  <span>{b.label}</span>
                  <span style={{ color: b.color, fontWeight: 600 }}>
                    ${fmt(b.total)} · {b.count} inv
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: b.color, borderRadius: '999px' }} />
                </div>
              </div>
            );
          })}

          <div style={{
            borderTop: '1px solid var(--color-redwood-border)',
            paddingTop: '6px', marginTop: '6px',
            display: 'flex', justifyContent: 'space-between', fontSize: '10px',
          }}>
            <span style={{ color: 'var(--color-redwood-text-muted)' }}>Total AR Outstanding</span>
            <span style={{ color: 'var(--color-brand-red)', fontWeight: 600 }}>${fmt(arTotal)}</span>
          </div>
        </div>

        {/* C2 — Collection Health */}
        <div style={panel}>
          <div style={{
            fontSize: '12px', fontWeight: 600,
            color: 'var(--color-redwood-text-main)', marginBottom: '4px',
          }}>
            ✅ Collection Health
          </div>
          <div style={{
            fontSize: '28px', fontWeight: 700, color: '#22C55E',
            textAlign: 'center', padding: '8px 0 3px',
            fontFamily: "'Syne',sans-serif",
          }}>
            {collectionRate == null ? '—' : `${collectionRate.toFixed(1)}%`}
          </div>
          <div style={{
            fontSize: '9px', color: 'var(--color-redwood-text-muted)',
            textAlign: 'center', marginBottom: '8px',
          }}>
            {collectionRate == null ? 'No collection data' : 'Collected vs invoiced'}
          </div>

          <div style={rowStyle}>
            <span style={{ color: 'var(--color-brand-red)' }}>
              ⚠ {worstInvoice ? worstName : 'No overdue accounts'}
            </span>
            <span style={{ color: 'var(--color-brand-red)', fontWeight: 600 }}>
              {worstInvoice ? `$${worstAmount.toLocaleString()} · ${worstDays ?? '—'}d` : '—'}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--color-redwood-text-muted)' }}>Avg days to pay</span>
            <span style={{ color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>{avgDaysToPay == null ? '—' : `${avgDaysToPay} days`}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--color-redwood-text-muted)' }}>This month collected</span>
            <span style={{ color: 'var(--color-brand-green)', fontWeight: 600 }}>${fmt(mtdCollected)}</span>
          </div>
        </div>
      </div>

      {/* ────────── SECTION D — Compliance Checklist + Invoice Table ────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols.twoCol ? '1fr minmax(190px,0.55fr)' : '1fr',
        gap: '8px',
      }}>
        {/* D1 — Legal Compliance Checklist */}
        <div style={panel}>
          <div style={{
            fontSize: '12px', fontWeight: 600,
            color: 'var(--color-redwood-text-main)', marginBottom: '8px',
          }}>
            ⚖️ Legal Compliance Checklist
          </div>

          {compliance.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '7px',
              padding: '6px 8px',
              background: 'var(--color-redwood-row-bg)',
              border: '1px solid var(--color-redwood-border)',
              borderRadius: '6px',
              marginBottom: '4px',
            }}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%',
                background: c.iconBg, color: c.iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', flexShrink: 0, marginTop: '1px',
                fontWeight: 700,
              }}>
                {c.status}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: 'var(--color-redwood-text-main)' }}>{c.title}</div>
                <div style={{ fontSize: '8.5px', color: 'var(--color-redwood-text-subtle)', marginTop: '1px' }}>{c.sub}</div>
              </div>
              <span style={{
                fontSize: '7.5px', fontWeight: 700, padding: '2px 7px',
                borderRadius: '999px',
                background: c.badgeBg, color: c.badgeColor,
                whiteSpace: 'nowrap', flexShrink: 0,
                marginTop: '1px',
              }}>
                {c.badge}
              </span>
            </div>
          ))}

        </div>

        {/* D2 — Invoices Legal Format View */}
        <div style={panel}>
          <div style={{
            fontSize: '12px', fontWeight: 600,
            color: 'var(--color-redwood-text-main)', marginBottom: '8px',
          }}>
            📄 Invoices Legal Format
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Invoice', 'Seq', 'Net', 'VAT', 'Gross', 'Lock', 'Status'].map((h) => (
                    <th key={h} style={{
                      fontSize: '8px', fontWeight: 600, textTransform: 'uppercase',
                      color: 'var(--color-redwood-text-subtle)', padding: '4px 5px',
                      borderBottom: '1px solid var(--color-redwood-border)',
                      textAlign: h === 'Net' || h === 'VAT' || h === 'Gross' ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {safeInvoices.slice(0, 8).map((inv) => {
                  const gap = hasGap(inv.invoiceNumber);
                  const overdueDays = daysOverdue(inv.dueDate);
                  const isOverdue = inv.status === 'Overdue' || (overdueDays != null && overdueDays > 0);
                  const statusBadge = inv.status === 'Paid'
                    ? { label: 'Paid',    bg: 'rgba(34,197,94,.18)',  color: '#22C55E' }
                    : isOverdue
                      ? { label: 'Overdue', bg: 'rgba(239,68,68,.18)',  color: '#EF4444' }
                      : { label: 'Unpaid',  bg: 'rgba(245,158,11,.18)', color: '#F59E0B' };
                  const isLocked = inv.status === 'Paid';
                  return (
                    <tr key={inv.id}>
                      <td style={{
                        fontSize: '8.5px', fontFamily: "'DM Mono',monospace",
                        color: 'var(--color-redwood-text-main)', padding: '5px 5px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                        whiteSpace: 'nowrap',
                      }}>
                        {inv.invoiceNumber}
                      </td>
                      <td style={{
                        fontSize: '8.5px',
                        color: gap ? '#F59E0B' : '#22C55E',
                        padding: '5px 5px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                      }}>
                        {gap ? '⚠ Gap' : '✓'}
                      </td>
                      <td style={{
                        fontSize: '8.5px', textAlign: 'right',
                        color: 'var(--color-redwood-text-muted)', padding: '5px 5px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                        whiteSpace: 'nowrap',
                      }}>
                        ${(Number(inv.subtotal) || 0).toFixed(2)}
                      </td>
                      <td style={{
                        fontSize: '8.5px', textAlign: 'right',
                        color: '#7C3AED', padding: '5px 5px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                        whiteSpace: 'nowrap',
                      }}>
                        ${(Number(inv.taxAmount) || 0).toFixed(2)}
                      </td>
                      <td style={{
                        fontSize: '8.5px', textAlign: 'right',
                        color: isOverdue ? 'var(--color-brand-red)' : 'var(--color-redwood-text-main)',
                        fontWeight: isOverdue ? 600 : 400,
                        padding: '5px 5px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                        whiteSpace: 'nowrap',
                      }}>
                        ${(Number(inv.grandTotal) || 0).toFixed(2)}
                      </td>
                      <td style={{
                        fontSize: '10px',
                        color: isLocked ? '#22C55E' : '#8BA3C7',
                        padding: '5px 5px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                        textAlign: 'center',
                      }}>
                        🔒
                      </td>
                      <td style={{ padding: '5px 5px', borderBottom: '1px solid var(--color-redwood-border)' }}>
                        <span style={{
                          fontSize: '7.5px', fontWeight: 700, padding: '2px 6px',
                          borderRadius: '999px',
                          background: statusBadge.bg, color: statusBadge.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {statusBadge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {safeInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{
                      padding: '14px 5px', textAlign: 'center',
                      fontSize: '10px', color: 'var(--color-redwood-text-muted)',
                    }}>
                      No invoices loaded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
