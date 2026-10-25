/**
 * Review and approval of a cycle count's variances. Every quantity and value comes from
 * GET /counts/{id}/variances or the count itself; this panel only formats them.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  approveCount,
  CountApiError,
  getVariances,
  rejectLine,
  type CountVariances as Variances,
  type CycleCountDetail,
  type CycleCountLine,
} from '../../services/cycleCountService';
import { formatCurrency } from '../../services/settingsService';

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}

function qty(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function signed(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n > 0 ? '+' : ''}${qty(n)}`;
}

function money(n: number | null | undefined): string {
  return n == null ? '—' : formatCurrency(n);
}

function decisionChip(line: CycleCountLine): { label: string; color: string } {
  if (line.decision === 'reject') return { label: 'rejected', color: '#94a3b8' };
  if (line.decision === 'post') return { label: 'posted', color: '#22c55e' };
  return { label: 'post', color: '#4F8EF7' };
}

interface Props {
  count: CycleCountDetail;
  canManage: boolean;
  onChanged: (count: CycleCountDetail) => void;
}

export default function CountVariances({ count, canManage, onChanged }: Props) {
  const [data, setData] = useState<Variances | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<CycleCountLine | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getVariances(count.id));
      setHidden(false);
    } catch (err) {
      if (err instanceof CountApiError && err.status === 403) {
        // Blind count still hidden from this user: show nothing, no banner.
        setHidden(true);
        return;
      }
      setError(errorText(err));
    }
  }, [count.id]);

  useEffect(() => {
    void load();
  }, [load, count.status, count.lines_counted, count.posted_value]);

  async function confirmReject() {
    if (!rejectFor) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await rejectLine(count.id, rejectFor.id, rejectNote));
      setRejectFor(null);
      setRejectNote('');
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmApprove() {
    setBusy(true);
    setError(null);
    try {
      onChanged(await approveCount(count.id));
      setConfirming(false);
      await load();
    } catch (err) {
      setConfirming(false);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (hidden) return null;

  const lines = data?.lines ?? [];
  const toPost = lines.filter((line) => line.decision !== 'reject').length;
  const reviewing = count.status === 'review';

  return (
    <section aria-label="Variances" data-testid="variances-panel" style={{ display: 'grid', gap: 8 }}>
      {error && <p role="alert" data-testid="variances-error" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Variances</h2>
        {canManage && reviewing && data && (
          <button type="button" style={primary} disabled={busy} onClick={() => setConfirming(true)}>Approve</button>
        )}
      </div>

      {!data && !error && <p style={{ fontSize: 12 }}>Loading variances…</p>}
      {data && lines.length === 0 && <p data-testid="nothing-to-post" style={{ fontSize: 13 }}>Nothing to post — every counted line matched.</p>}

      {data?.by_location.map((group) => (
        <div key={group.location_id} data-testid={`variance-group-${group.location_id}`} style={card}>
          <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
            {group.location_path || group.location_code || `Location ${group.location_id}`}
          </div>
          {lines.filter((line) => line.location_id === group.location_id).map((line) => {
            const chip = decisionChip(line);
            return (
              <div key={line.id} data-testid={`variance-line-${line.id}`} style={{ display: 'grid', gap: 4, borderTop: '1px solid var(--color-redwood-border)', paddingTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {line.name ?? `Product ${line.product_id}`} <span style={muted}>{line.sku ?? ''}</span>
                  </span>
                  <span data-testid={`variance-decision-${line.id}`} style={pill(chip.color)}>{chip.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
                  <span>Expected {qty(line.expected_qty)}</span>
                  <span>Counted {qty(line.counted_qty)}</span>
                  <span>Variance {signed(line.variance_qty)}</span>
                  <span>Est. {money(line.variance_value)}</span>
                </div>
                {line.decision === 'post' && line.posted_qty != null && (
                  <div data-testid={`variance-posted-${line.id}`} style={{ fontSize: 12 }}>
                    {`Posted ${signed(line.posted_qty)} · ${money(line.posted_value)}`}{' '}
                    <Link to={`/products/${line.product_id}`} style={{ textDecoration: 'underline' }}>Product</Link>
                  </div>
                )}
                {canManage && reviewing && line.decision !== 'reject' && (
                  <button type="button" style={{ ...btn, justifySelf: 'start' }} disabled={busy} onClick={() => { setRejectFor(line); setRejectNote(''); }}>
                    Reject
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {data && lines.length > 0 && (
        <div data-testid="variances-totals" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, fontWeight: 600 }}>
          <span>{`${data.totals.lines} line(s)`}</span>
          <span>{`Units ${signed(data.totals.units)}`}</span>
          <span>{`Est. ${money(data.totals.value)}`}</span>
        </div>
      )}
      {count.status === 'approved' && count.posted_value != null && (
        <div data-testid="posted-total" style={{ fontSize: 13, fontWeight: 700 }}>{`Posted total ${money(count.posted_value)}`}</div>
      )}

      {rejectFor && (
        <div role="dialog" aria-label="Reject line" style={dialog}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{`Reject ${rejectFor.sku ?? rejectFor.name ?? 'line'}? No adjustment will be posted for it.`}</div>
          <input
            aria-label="Reject note"
            value={rejectNote}
            onChange={(event) => setRejectNote(event.target.value)}
            placeholder="Note (optional)"
            style={btn}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={primary} disabled={busy} onClick={() => void confirmReject()}>Confirm reject</button>
            <button type="button" style={btn} disabled={busy} onClick={() => setRejectFor(null)}>Cancel</button>
          </div>
        </div>
      )}

      {confirming && (
        <div role="dialog" aria-label="Approve count" style={dialog}>
          <div data-testid="approve-text" style={{ fontSize: 13 }}>
            {`Post ${toPost} adjustment(s) for ${count.count_number}? Each becomes an inventory adjustment at today's cost; the estimated value shown uses the cost frozen when the count was created.`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={primary} disabled={busy} onClick={() => void confirmApprove()}>{busy ? 'Posting…' : 'Confirm'}</button>
            <button type="button" style={btn} disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

const card: CSSProperties = {
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 12,
  padding: 10,
  display: 'grid',
  gap: 6,
};
const dialog: CSSProperties = { ...card, background: 'var(--color-redwood-bg-surface)' };
const btn: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 7,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};
const primary: CSSProperties = { ...btn, background: '#4F8EF7', color: '#fff', border: 'none' };
const muted: CSSProperties = { fontSize: 11, color: 'var(--color-redwood-text-muted)', fontWeight: 400 };

function pill(color: string): CSSProperties {
  return { border: `1px solid ${color}`, color, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 };
}
