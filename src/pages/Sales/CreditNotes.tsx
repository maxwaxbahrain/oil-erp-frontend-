import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';
import { getCreditNotes, getCreditNoteStats, updateCreditNote, applyCreditNoteToInvoice, type CreditNote } from '../../services/creditNoteService';
import { getCustomerInvoices, type Invoice } from '../../services/api';

type FilterTab = 'all' | 'draft' | 'issued' | 'used' | 'expired' | 'cancelled';

const panelStyle: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '14px',
  padding: '14px 16px',
};

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatIssueDate(raw: string): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return raw;
  }
}

function reasonBadgeStyle(reason: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    overcharge: {
      background: 'var(--color-badge-red-bg)',
      color: 'var(--color-brand-red-tint)',
      border: '1px solid rgba(239,68,68,.2)',
    },
    return: {
      background: 'var(--color-badge-amber-bg)',
      color: 'var(--color-brand-amber-tint)',
      border: '1px solid rgba(245,158,11,.28)',
    },
    price_adjustment: {
      background: 'var(--color-badge-blue-bg)',
      color: 'var(--color-brand-blue-tint)',
      border: '1px solid rgba(79,142,247,.28)',
    },
    goodwill: {
      background: 'var(--color-badge-green-bg)',
      color: 'var(--color-brand-green-tint)',
      border: '1px solid rgba(34,197,94,.28)',
    },
    other: {
      background: 'rgba(124,58,237,.12)',
      color: '#C4B5FD',
      border: '1px solid rgba(124,58,237,.28)',
    },
  };
  return map[reason] ?? map.other;
}

function ReasonBadge({ reason }: { reason: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 20,
        display: 'inline-block',
        whiteSpace: 'nowrap',
        ...reasonBadgeStyle(reason),
      }}
    >
      {reason.replace('_', ' ')}
    </span>
  );
}

function StatusExampleBadge({
  label,
  style,
  faded,
}: {
  label: string;
  style: CSSProperties;
  faded?: boolean;
}) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 20,
        display: 'inline-block',
        whiteSpace: 'nowrap',
        opacity: faded ? 0.5 : 1,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

// CLEANUP-1 — Removed bumpCachedCustomerBalance. Backend is authoritative
// for customer.balance; cancelling/applying a CN flows through endpoints
// the backend already reconciles. No localStorage cache merge happens on
// getCustomers(), so the optimistic write was a dead operation.

export default function CreditNotes() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [stats, setStats] = useState<{ totalIssuedThisMonth: number; totalUsed: number; pendingUnused: number; expiringSoon: number } | null>(null);

  // FIX W5-1 — Apply credit-to-invoice modal state.
  const [applyingCN, setApplyingCN] = useState<CreditNote | null>(null);
  const [applyInvoices, setApplyInvoices] = useState<Invoice[]>([]);
  const [applyInvoiceId, setApplyInvoiceId] = useState('');
  const [applyAmount, setApplyAmount] = useState(0);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [notes, st] = await Promise.all([getCreditNotes(), getCreditNoteStats()]);
      setRows(notes);
      setStats(st);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const [notes, st] = await Promise.all([getCreditNotes(), getCreditNoteStats()]);
      setRows(notes);
      setStats(st);
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const now = new Date();
    return rows.filter((r) => {
      const matchesQ =
        !q ||
        r.creditNoteNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.originalInvoiceNumber || '').toLowerCase().includes(q);
      const expired = !!r.expiryDate && new Date(r.expiryDate) < now && r.remainingCredit > 0;
      const used = r.status === 'partially_used' || r.status === 'fully_used';
      const matchesTab =
        tab === 'all' ||
        (tab === 'draft' && r.status === 'draft') ||
        (tab === 'issued' && r.status === 'issued') ||
        (tab === 'used' && used) ||
        (tab === 'expired' && expired) ||
        (tab === 'cancelled' && r.status === 'cancelled');
      return matchesQ && matchesTab;
    });
  }, [rows, query, tab]);

  const nonCancelledNotes = useMemo(
    () => rows.filter((r) => r.status !== 'cancelled'),
    [rows],
  );

  const tabCounts = useMemo(() => {
    const now = new Date();
    let draft = 0;
    let issued = 0;
    let used = 0;
    let expired = 0;
    let cancelled = 0;
    for (const r of rows) {
      if (r.status === 'draft') draft += 1;
      if (r.status === 'issued') issued += 1;
      if (r.status === 'partially_used' || r.status === 'fully_used') used += 1;
      if (!!r.expiryDate && new Date(r.expiryDate) < now && r.remainingCredit > 0) expired += 1;
      if (r.status === 'cancelled') cancelled += 1;
    }
    return { all: rows.length, draft, issued, used, expired, cancelled };
  }, [rows]);

  const availableCredit = useMemo(
    () =>
      filtered
        .filter((r) => r.status !== 'cancelled')
        .reduce((sum, r) => sum + r.remainingCredit, 0),
    [filtered],
  );

  const filteredTotalSum = useMemo(
    () => filtered.reduce((sum, r) => sum + r.totalCreditAmount, 0),
    [filtered],
  );

  const filteredUsedSum = useMemo(
    () => filtered.reduce((sum, r) => sum + r.usedAmount, 0),
    [filtered],
  );

  const activeCount = useMemo(
    () => rows.filter((r) => r.status !== 'cancelled').length,
    [rows],
  );

  const cancelledCount = useMemo(
    () => rows.filter((r) => r.status === 'cancelled').length,
    [rows],
  );

  async function cancelNote(note: CreditNote) {
    if (!window.confirm(`Cancel ${note.creditNoteNumber}?`)) return;
    await updateCreditNote(note.id, { status: 'cancelled' });
    // CLEANUP-1 — Removed optimistic balance restore. Backend reconciles
    // customer.balance on CN status change; next list refetch reflects it.
    await load();
  }

  // FIX W5-1 — When the user opens the Apply modal for a CN, load the
  // customer's invoices and filter to those with a remaining balance.
  useEffect(() => {
    if (!applyingCN) {
      setApplyInvoices([]);
      setApplyInvoiceId('');
      setApplyAmount(0);
      setApplyError(null);
      return;
    }
    void (async () => {
      try {
        const invs = await getCustomerInvoices(applyingCN.customerId);
        const open = invs.filter(i => (Number(i.remaining_balance ?? i.grandTotal ?? 0)) > 0);
        setApplyInvoices(open);
        // Auto-pick the original linked invoice if it's open + has balance.
        const preferred = open.find(i => String(i.id) === String(applyingCN.originalInvoiceId));
        if (preferred) {
          setApplyInvoiceId(String(preferred.id));
          const max = Math.min(applyingCN.remainingCredit, Number(preferred.remaining_balance ?? preferred.grandTotal ?? 0));
          setApplyAmount(Number(max.toFixed(2)));
        }
      } catch (e) {
        setApplyError(e instanceof Error ? e.message : 'Could not load customer invoices.');
      }
    })();
  }, [applyingCN]);

  // FIX W5-1 — Pick an invoice in the modal: auto-fill amount with max allowed.
  function pickApplyInvoice(invId: string) {
    setApplyInvoiceId(invId);
    setApplyError(null);
    if (!applyingCN) return;
    const inv = applyInvoices.find(i => String(i.id) === String(invId));
    if (!inv) return;
    const max = Math.min(
      applyingCN.remainingCredit,
      Number(inv.remaining_balance ?? inv.grandTotal ?? 0)
    );
    setApplyAmount(Number(max.toFixed(2)));
  }

  async function confirmApplyCredit() {
    if (!applyingCN) return;
    const inv = applyInvoices.find(i => String(i.id) === String(applyInvoiceId));
    if (!inv) {
      setApplyError('Please select an invoice.');
      return;
    }
    setApplying(true);
    setApplyError(null);
    try {
      const updatedCN = await applyCreditNoteToInvoice(
        applyingCN.id,
        String(inv.id),
        applyAmount,
      );
      setApplySuccess(
        `✅ Applied $${applyAmount.toFixed(2)} from ${applyingCN.creditNoteNumber} to invoice ${inv.invoiceNumber || `#${inv.id}`}. ` +
        `CN status: ${updatedCN.status.replace('_', ' ')}.`
      );
      setApplyingCN(null);
      await load();
      setTimeout(() => setApplySuccess(null), 6000);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Apply failed.');
    } finally {
      setApplying(false);
    }
  }

  function printCreditNote(note: CreditNote) {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) {
      // TC-39 — Popup was blocked.  Tell the user instead of silently
      // failing, which was the original bug ("Print not working").
      alert(
        'Please allow popups for this site to print credit notes.\n\n' +
        'Alternative: use your browser\'s File → Print or Save as PDF.'
      );
      return;
    }
    w.document.write(`
      <html><head><title>Credit Note ${note.creditNoteNumber}</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#111}
      h1{font-size:22px;font-weight:900;text-transform:uppercase;margin-bottom:4px}
      .header{display:flex;justify-content:space-between;margin-bottom:24px}
      .badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#f3f4f6;padding:10px;text-align:left;font-size:11px;text-transform:uppercase}
      td{padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px}
      .total{font-size:18px;font-weight:900;color:#800020}
      @media print{button{display:none}}</style></head>
      <body>
      <div class="header">
        <div><h1 style="color:#800020">Credit Note</h1><p style="color:#666;font-size:13px">Reference: ${note.creditNoteNumber}</p></div>
        <div style="text-align:right"><p style="font-size:13px">Issue Date: ${note.issueDate}</p>${note.expiryDate ? `<p style="font-size:13px">Expiry: ${note.expiryDate}</p>` : ''}</div>
      </div>
      <table style="margin-bottom:16px;width:100%"><tr>
        <td style="border:none"><strong>Customer:</strong> ${note.customerName}</td>
        <td style="border:none"><strong>Invoice Ref:</strong> ${note.originalInvoiceNumber || '—'}</td>
        <td style="border:none"><strong>Reason:</strong> ${note.reason.replace('_',' ')}</td>
      </tr></table>
      <table>
        <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
        <tr><td>${note.notes || 'Credit adjustment'}</td><td style="text-align:right">$${note.totalCreditAmount.toLocaleString()}</td></tr>
        ${note.usedAmount > 0 ? `<tr><td>Amount Used</td><td style="text-align:right">-$${note.usedAmount.toLocaleString()}</td></tr>` : ''}
        <tr><td><strong>Remaining Credit</strong></td><td style="text-align:right" class="total">$${note.remainingCredit.toLocaleString()}</td></tr>
      </table>
      <br/><hr/><p style="font-size:11px;color:#999;text-align:center">SOLTOL ONE · Business Platform · Generated ${new Date().toLocaleDateString()}</p>
      </body></html>`);
    w.document.close();
    // Trigger print directly — avoids the inline-<script> route that
    // stricter browser CSPs may block in document.write'd popups.
    w.focus();
    w.print();
  }

  const ghostBtn: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 11px',
    borderRadius: '6px',
    fontSize: '10.5px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--color-redwood-border)',
    background: 'rgba(255,255,255,.04)',
    color: 'var(--color-redwood-text-muted)',
    fontFamily: "'DM Sans',sans-serif",
    transition: '.12s',
  };

  const primaryBtn: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 11px',
    borderRadius: '6px',
    fontSize: '10.5px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    background: '#4F8EF7',
    color: '#fff',
    fontFamily: "'DM Sans',sans-serif",
    transition: '.12s',
  };

  const thStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: 'var(--color-redwood-text-muted)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: CSSProperties = {
    padding: '11px 12px',
    fontSize: 12,
    color: 'var(--color-redwood-text-main)',
    verticalAlign: 'middle',
  };

  const filterTabs: { key: FilterTab; label: string; showCount?: boolean }[] = [
    { key: 'all', label: 'All', showCount: true },
    { key: 'draft', label: 'Draft' },
    { key: 'issued', label: 'Issued' },
    { key: 'used', label: 'Used' },
    { key: 'expired', label: 'Expired' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  // Preserved handlers — used from detail page / print flows
  void cancelNote;
  void printCreditNote;

  if (loading) {
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 16px',
            color: 'var(--color-redwood-text-muted)',
          }}
        >
          <div
            className="w-12 h-12 border-2 rounded-full animate-spin mb-3"
            style={{ borderColor: '#4F8EF7', borderTopColor: 'transparent' }}
          />
          <p style={{ fontSize: 12, fontWeight: 500 }}>Loading credit notes…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="space-y-3">
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--color-badge-blue-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={20} style={{ color: '#4F8EF7' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: '20px',
                  fontWeight: 600,
                  letterSpacing: '-.5px',
                  color: 'var(--color-brand-blue)',
                }}
              >
                Credit notes
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--color-redwood-text-subtle)',
                  marginTop: '2px',
                }}
              >
                Manage customer credits · apply to invoices · track balances
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              style={ghostBtn}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/sales/credit-notes/new')}
              style={primaryBtn}
            >
              <Plus size={14} /> New credit note
            </button>
          </div>
        </div>

        {/* KPI cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '10px', marginBottom: '12px' }}>
            {[
              {
                label: 'Total Issued',
                value: `$${formatMoney(stats.totalIssuedThisMonth)}`,
                sub: `${nonCancelledNotes.length} credit note${nonCancelledNotes.length !== 1 ? 's' : ''}`,
                stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                valueColor: 'var(--color-brand-blue)',
                subColor: 'var(--color-redwood-text-subtle)',
              },
              {
                label: 'Total Used',
                value: `$${formatMoney(stats.totalUsed)}`,
                sub: 'applied to invoices',
                stripe: 'linear-gradient(90deg,#64748B,#94A3B8)',
                valueColor: 'var(--color-redwood-text-main)',
                subColor: 'var(--color-redwood-text-subtle)',
              },
              {
                label: 'Pending / Unused',
                value: `$${formatMoney(stats.pendingUnused)}`,
                sub: 'available to apply',
                stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                valueColor: 'var(--color-brand-green)',
                subColor: 'var(--color-brand-green-tint)',
              },
              {
                label: 'Expiring Soon',
                value: String(stats.expiringSoon),
                sub: 'within 30 days',
                stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
                valueColor: 'var(--color-brand-amber)',
                subColor: 'var(--color-brand-amber-tint)',
              },
            ].map((k) => (
              <div
                key={k.label}
                style={{
                  background: 'var(--color-redwood-bg-surface)',
                  border: '1px solid var(--color-redwood-border)',
                  borderRadius: '14px',
                  padding: '13px 14px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    borderRadius: '14px 14px 0 0',
                    background: k.stripe,
                  }}
                />
                <div
                  style={{
                    fontSize: '10.5px',
                    color: 'var(--color-redwood-text-muted)',
                    fontWeight: 500,
                    marginBottom: '6px',
                  }}
                >
                  {k.label}
                </div>
                <div
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontSize: '22px',
                    fontWeight: 600,
                    letterSpacing: '-.5px',
                    marginBottom: '3px',
                    lineHeight: '1.1',
                    color: k.valueColor,
                  }}
                >
                  {k.value}
                </div>
                <div style={{ fontSize: '10px', color: k.subColor }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} style={{ color: 'var(--color-redwood-text-muted)', flexShrink: 0 }} />
            <input
              type="search"
              placeholder="Search CN number, customer, invoice..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                background: 'var(--color-redwood-row-bg)',
                border: '1px solid var(--color-redwood-border)',
                borderRadius: 8,
                outline: 'none',
                color: 'var(--color-redwood-text-main)',
                fontSize: 12,
                width: '100%',
                padding: '8px 12px',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-redwood-text-muted)',
                  fontSize: 16,
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Filter pills */}
        <div
          style={{
            ...panelStyle,
            padding: 6,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
        >
          {filterTabs.map((t) => {
            const active = tab === t.key;
            const count = tabCounts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  padding: '7px 14px',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: active ? 'var(--color-badge-blue-bg)' : 'transparent',
                  color: active ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)',
                  border: active
                    ? '1px solid rgba(79,142,247,.28)'
                    : '1px solid transparent',
                  transition: 'all .15s ease',
                }}
              >
                {t.label}
                {t.showCount ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {/* Section header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0 10px',
            borderBottom: '1px solid var(--color-redwood-border)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-redwood-text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Credit notes
            <span
              style={{
                fontSize: 11,
                background: 'var(--color-redwood-row-bg)',
                border: '1px solid var(--color-redwood-border)',
                borderRadius: 20,
                padding: '2px 10px',
                color: 'var(--color-redwood-text-muted)',
                fontWeight: 600,
              }}
            >
              {filtered.length}
              {filtered.length !== rows.length ? ` of ${rows.length}` : ''}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)' }}>
            Available credit:{' '}
            <strong style={{ color: 'var(--color-brand-green)' }}>
              ${formatMoney(availableCredit)}
            </strong>
          </span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ ...panelStyle, padding: '60px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--color-badge-blue-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <FileText size={26} style={{ color: '#4F8EF7' }} />
            </div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-redwood-text-main)',
                margin: '0 0 6px',
              }}
            >
              {rows.length === 0 ? 'No credit notes yet' : 'No credit notes match your filter'}
            </h3>
            <p
              style={{
                fontSize: 12,
                color: 'var(--color-redwood-text-muted)',
                maxWidth: 280,
                margin: '0 auto 16px',
              }}
            >
              {rows.length === 0
                ? 'Create a credit note to manage customer credits.'
                : 'Try a different search term or status filter.'}
            </p>
            <button
              type="button"
              onClick={() =>
                rows.length === 0
                  ? navigate('/sales/credit-notes/new')
                  : (setQuery(''), setTab('all'))
              }
              style={primaryBtn}
            >
              {rows.length === 0 ? (
                <>
                  <Plus size={14} /> New credit note
                </>
              ) : (
                'Clear filters'
              )}
            </button>
          </div>
        ) : (
          <div
            style={{
              ...panelStyle,
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr
                    style={{
                      background: 'var(--color-redwood-row-bg)',
                      borderBottom: '1px solid var(--color-redwood-border)',
                    }}
                  >
                    {[
                      'CN #',
                      'Customer',
                      'Salesman',
                      'Invoice',
                      'Issue date',
                      'Reason',
                      'Total',
                      'Used',
                    ].map((col) => (
                      <th
                        key={col}
                        style={{
                          ...thStyle,
                          textAlign: col === 'Total' || col === 'Used' ? 'right' : 'left',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const isCancelled = r.status === 'cancelled';
                    return (
                      <tr
                        key={r.id}
                        onClick={() => navigate(`/sales/credit-notes/${r.id}`)}
                        style={{
                          borderBottom: '1px solid var(--color-redwood-border)',
                          cursor: 'pointer',
                          transition: '.12s',
                          opacity: isCancelled ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--color-redwood-row-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: 12,
                              fontWeight: 600,
                              color: isCancelled
                                ? 'var(--color-redwood-text-muted)'
                                : 'var(--color-brand-green-tint)',
                            }}
                          >
                            {r.creditNoteNumber}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            maxWidth: 160,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.customerName}
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--color-redwood-text-muted)' }}>
                          Unassigned
                        </td>
                        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                          {r.originalInvoiceNumber ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (r.originalInvoiceId) {
                                  navigate(`/sales/invoices/${r.originalInvoiceId}`);
                                } else {
                                  navigate(`/sales/credit-notes/${r.id}`);
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--color-brand-blue-tint)',
                              }}
                            >
                              {r.originalInvoiceNumber}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--color-redwood-text-subtle)' }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          {formatIssueDate(r.issueDate)}
                        </td>
                        <td style={tdStyle}>
                          <ReasonBadge reason={r.reason} />
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: 'right',
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 600,
                          }}
                        >
                          ${formatMoney(r.totalCreditAmount)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: 'right',
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 600,
                          }}
                        >
                          ${formatMoney(r.usedAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: '1px solid var(--color-redwood-border)',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: 11,
                color: 'var(--color-redwood-text-muted)',
              }}
            >
              <span>
                Showing {filtered.length} of {rows.length} credit notes · {activeCount} active ·{' '}
                {cancelledCount} cancelled
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span>
                  Total:{' '}
                  <strong style={{ color: 'var(--color-redwood-text-main)' }}>
                    ${formatMoney(filteredTotalSum)}
                  </strong>
                </span>
                <span>
                  Used:{' '}
                  <strong style={{ color: 'var(--color-redwood-text-main)' }}>
                    ${formatMoney(filteredUsedSum)}
                  </strong>
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Status examples */}
        <div style={{ ...panelStyle, marginTop: 4 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-redwood-text-main)',
              }}
            >
              Status examples
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.4px',
                padding: '2px 8px',
                borderRadius: 20,
                background: 'var(--color-badge-blue-bg)',
                color: 'var(--color-brand-blue-tint)',
                border: '1px solid rgba(79,142,247,.28)',
              }}
            >
              Guide
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <StatusExampleBadge
              label="Draft"
              style={{
                background: 'var(--color-badge-blue-bg)',
                color: 'var(--color-brand-blue-tint)',
                border: '1px solid rgba(79,142,247,.28)',
              }}
            />
            <StatusExampleBadge
              label="Issued"
              style={{
                background: 'var(--color-badge-green-bg)',
                color: 'var(--color-brand-green-tint)',
                border: '1px solid rgba(34,197,94,.28)',
              }}
            />
            <StatusExampleBadge
              label="Used"
              style={{
                background: 'rgba(124,58,237,.12)',
                color: '#C4B5FD',
                border: '1px solid rgba(124,58,237,.28)',
              }}
            />
            <StatusExampleBadge
              label="Expiring"
              style={{
                background: 'var(--color-badge-amber-bg)',
                color: 'var(--color-brand-amber-tint)',
                border: '1px solid rgba(245,158,11,.28)',
              }}
            />
            <StatusExampleBadge
              label="Expired"
              style={{
                background: 'var(--color-badge-red-bg)',
                color: 'var(--color-brand-red-tint)',
                border: '1px solid rgba(239,68,68,.2)',
              }}
            />
            <StatusExampleBadge
              label="Cancelled"
              faded
              style={{
                background: 'rgba(148,163,184,.12)',
                color: 'var(--color-redwood-text-muted)',
                border: '1px solid var(--color-redwood-border)',
              }}
            />
          </div>

          <p
            style={{
              fontSize: 11,
              color: 'var(--color-redwood-text-muted)',
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            Status badges appear on the credit note detail page. Cancelled notes are shown at 50%
            opacity in the list.
          </p>
        </div>
      </div>

      {/* FIX W5-1 — Success banner after applying credit. */}
      {applySuccess && (
        <div
          className="fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg max-w-md"
          style={{
            background: 'var(--color-badge-green-bg)',
            borderLeft: '4px solid var(--color-brand-green)',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-brand-green-tint)' }}>
            {applySuccess}
          </p>
        </div>
      )}

      {/* FIX W5-1 — Apply Credit to Invoice modal. */}
      {applyingCN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: 'var(--color-redwood-bg-surface)',
              border: '1px solid var(--color-redwood-border)',
            }}
          >
            <div
              className="px-6 py-5 flex items-start justify-between"
              style={{
                background: 'var(--color-redwood-row-bg)',
                borderBottom: '1px solid var(--color-redwood-border)',
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.4px',
                    color: 'var(--color-redwood-text-muted)',
                  }}
                >
                  Apply Credit Note
                </p>
                <h3
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontSize: 20,
                    fontWeight: 600,
                    marginTop: 4,
                    color: 'var(--color-redwood-text-main)',
                  }}
                >
                  {applyingCN.creditNoteNumber}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)', marginTop: 4 }}>
                  {applyingCN.customerName} · Available credit: ${applyingCN.remainingCredit.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setApplyingCN(null)}
                className="p-2 rounded-lg"
                style={{ color: 'var(--color-redwood-text-muted)' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--color-redwood-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '.4px',
                    marginBottom: 8,
                  }}
                >
                  Select Invoice
                </label>
                {applyInvoices.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--color-redwood-text-muted)',
                      background: 'var(--color-redwood-row-bg)',
                      border: '1px solid var(--color-redwood-border)',
                      borderRadius: 8,
                      padding: 16,
                    }}
                  >
                    {applyError ? applyError : 'No open invoices found for this customer.'}
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px solid var(--color-redwood-border)',
                      borderRadius: 8,
                      maxHeight: 256,
                      overflowY: 'auto',
                    }}
                  >
                    {applyInvoices.map((inv, idx) => {
                      const bal = Number(inv.remaining_balance ?? inv.grandTotal ?? 0);
                      const selected = String(inv.id) === String(applyInvoiceId);
                      return (
                        <label
                          key={inv.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 16px',
                            cursor: 'pointer',
                            background: selected ? 'var(--color-badge-green-bg)' : 'transparent',
                            borderBottom:
                              idx < applyInvoices.length - 1
                                ? '1px solid var(--color-redwood-border)'
                                : 'none',
                          }}
                        >
                          <input
                            type="radio"
                            name="apply-invoice"
                            checked={selected}
                            onChange={() => pickApplyInvoice(String(inv.id))}
                          />
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--color-redwood-text-main)',
                              }}
                            >
                              {inv.invoiceNumber || `#${inv.id}`}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: 'var(--color-redwood-text-muted)',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '.4px',
                                marginTop: 2,
                              }}
                            >
                              {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'} · Total ${Number(inv.grandTotal ?? 0).toFixed(2)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontFamily: 'ui-monospace, monospace',
                                fontWeight: 600,
                                color: 'var(--color-brand-red-tint)',
                              }}
                            >
                              ${bal.toFixed(2)}
                            </div>
                            <div
                              style={{
                                fontSize: 9,
                                color: 'var(--color-redwood-text-muted)',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                letterSpacing: '.4px',
                              }}
                            >
                              Outstanding
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {applyInvoiceId && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--color-redwood-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '.4px',
                      marginBottom: 8,
                    }}
                  >
                    Amount to Apply
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={applyAmount}
                      onChange={(e) => { setApplyAmount(parseFloat(e.target.value) || 0); setApplyError(null); }}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: '1px solid var(--color-redwood-border)',
                        borderRadius: 8,
                        fontSize: 13,
                        fontFamily: 'ui-monospace, monospace',
                        background: 'var(--color-redwood-row-bg)',
                        color: 'var(--color-redwood-text-main)',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const inv = applyInvoices.find(i => String(i.id) === String(applyInvoiceId));
                        if (!inv || !applyingCN) return;
                        const max = Math.min(
                          applyingCN.remainingCredit,
                          Number(inv.remaining_balance ?? inv.grandTotal ?? 0)
                        );
                        setApplyAmount(Number(max.toFixed(2)));
                      }}
                      style={{
                        ...ghostBtn,
                        padding: '12px 16px',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '.4px',
                      }}
                    >
                      Apply Max
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginTop: 8 }}>
                    Max allowed: ${Math.min(
                      applyingCN.remainingCredit,
                      Number(applyInvoices.find(i => String(i.id) === String(applyInvoiceId))?.remaining_balance ?? applyInvoices.find(i => String(i.id) === String(applyInvoiceId))?.grandTotal ?? 0)
                    ).toFixed(2)}
                  </p>
                </div>
              )}

              {applyError && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--color-brand-red-tint)',
                    background: 'var(--color-badge-red-bg)',
                    border: '1px solid rgba(239,68,68,.2)',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  {applyError}
                </div>
              )}

              <p
                style={{
                  fontSize: 10,
                  color: 'var(--color-brand-amber-tint)',
                  background: 'var(--color-badge-amber-bg)',
                  border: '1px solid rgba(245,158,11,.28)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                ℹ️ This allocates the credit note to the selected invoice. The invoice outstanding balance will reduce by the amount applied — no cash payment or new ledger entry is created.
              </p>
            </div>

            <div
              className="px-6 py-4 flex gap-3"
              style={{
                background: 'var(--color-redwood-row-bg)',
                borderTop: '1px solid var(--color-redwood-border)',
              }}
            >
              <button
                onClick={() => setApplyingCN(null)}
                disabled={applying}
                style={{
                  ...ghostBtn,
                  flex: 1,
                  justifyContent: 'center',
                  padding: '12px 16px',
                  opacity: applying ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmApplyCredit}
                disabled={applying || !applyInvoiceId || applyAmount <= 0}
                style={{
                  ...primaryBtn,
                  flex: 2,
                  justifyContent: 'center',
                  padding: '12px 16px',
                  opacity: applying || !applyInvoiceId || applyAmount <= 0 ? 0.4 : 1,
                }}
              >
                {applying ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Applying…
                  </>
                ) : (
                  'Apply Credit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
