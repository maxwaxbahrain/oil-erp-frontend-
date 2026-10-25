/**
 * Inventory agent inbox on Warehouse › Stock: proposals waiting for a person,
 * and the daily inventory brief. Everything shown comes from the API; this
 * file only formats it. Approving runs the backend service as the signed-in user.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  PROPOSAL_STATUSES,
  approveProposal,
  listProposals,
  rejectProposal,
  type AgentProposal,
  type BinTransferProposalResult,
  type DraftPoProposalResult,
  type ProposalKind,
  type ProposalStatus,
  type SnoozeProposalResult,
} from '../../services/agentProposalsService';
import {
  getBriefSettings,
  listBriefSends,
  sendTestBrief,
  updateBriefSettings,
  type InventoryBriefSend,
  type InventoryBriefSettings,
  type InventoryBriefSettingsUpdate,
} from '../../services/inventoryBriefService';
import { formatLocalDate, formatStoredDateTime } from '../../utils/dates';

const KIND_LABELS: Record<ProposalKind, string> = {
  draft_po: 'Draft PO',
  snooze: 'Snooze',
  bin_transfer: 'Bin transfer',
};

/** What approving creates, restated in the confirm dialog. */
const KIND_EFFECTS: Record<ProposalKind, string> = {
  draft_po: 'This creates a draft purchase order with the supplier. Nothing is sent or received.',
  snooze: 'This hides the product from reorder suggestions until the snooze ends.',
  bin_transfer: 'This moves the stock between the two locations (one transfer out, one transfer in). No journal is posted.',
};

const STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  failed: 'Failed',
  expired: 'Expired',
};

const READ_ONLY_TIP = 'Only admin, manager, or warehouse users can approve or reject proposals.';

function message(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function qty(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function InventoryAgentPanel() {
  const [open, setOpen] = useState(true);
  return (
    <section
      aria-label="Inventory agent"
      style={{ marginTop: '20px', border: '1px solid var(--color-redwood-border)', borderRadius: '12px', background: 'var(--color-redwood-bg-surface)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-redwood-text-main)',
        }}
      >
        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 600 }}>Inventory agent</span>
        <span style={{ fontSize: '11px', color: 'var(--color-redwood-text-muted)' }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', display: 'grid', gap: '18px' }}>
          <ProposalsSection />
          <DailyBriefSection />
        </div>
      )}
    </section>
  );
}

function ProposalsSection() {
  const { hasRole } = useAuth();
  const canDecide = hasRole('admin', 'manager', 'warehouse');
  const [status, setStatus] = useState<ProposalStatus>('pending');
  const [rows, setRows] = useState<AgentProposal[]>([]);
  // Rows decided here stay on screen after the refetch, so the outcome is visible.
  const [decidedHere, setDecidedHere] = useState<Record<number, AgentProposal>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (which: ProposalStatus) => {
    setLoading(true);
    try {
      // A refetch keeps any message from the action that triggered it.
      setRows(await listProposals(which));
    } catch (err) {
      setRows([]);
      setError(message(err, 'Could not load proposals.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  const shown = useMemo(() => {
    const fetched = rows.map((row) => decidedHere[row.id] ?? row);
    const seen = new Set(fetched.map((row) => row.id));
    const extra = Object.values(decidedHere).filter((row) => !seen.has(row.id));
    return [...extra, ...fetched];
  }, [rows, decidedHere]);

  function chooseStatus(next: ProposalStatus) {
    setDecidedHere({});
    setNotice(null);
    setError(null);
    setConfirmingId(null);
    setRejectingId(null);
    setStatus(next);
  }

  async function confirmApprove(row: AgentProposal) {
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      const decided = await approveProposal(row.id);
      setDecidedHere((current) => ({ ...current, [decided.id]: decided }));
      setConfirmingId(null);
      if (decided.status === 'approved') {
        setNotice(`Proposal #${decided.id} approved.`);
      }
      await load(status);
    } catch (err) {
      setConfirmingId(null);
      setError(`Proposal #${row.id}: ${message(err, 'Could not approve.')}`);
      await load(status);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject(row: AgentProposal) {
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      const decided = await rejectProposal(row.id, rejectReason);
      setDecidedHere((current) => ({ ...current, [decided.id]: decided }));
      setRejectingId(null);
      setRejectReason('');
      setNotice(`Proposal #${decided.id} rejected.`);
      await load(status);
    } catch (err) {
      setRejectingId(null);
      setError(`Proposal #${row.id}: ${message(err, 'Could not reject.')}`);
      await load(status);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <h2 style={heading}>Proposals</h2>
        <div role="group" aria-label="Proposal status" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PROPOSAL_STATUSES.map((value) => (
            <button key={value} type="button" aria-pressed={status === value} style={chip(status === value)} onClick={() => chooseStatus(value)}>
              {STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </div>
      {notice && <div role="status" style={{ ...note, color: 'var(--color-brand-green-tint)' }}>{notice}</div>}
      {error && <div role="alert" style={{ ...note, color: 'var(--color-brand-red)' }}>{error}</div>}
      {loading && shown.length === 0 && <div style={muted}>—</div>}
      {!loading && shown.length === 0 && !error && (
        <div style={muted}>{status === 'pending' ? 'No proposals waiting for approval.' : `No ${STATUS_LABELS[status].toLowerCase()} proposals.`}</div>
      )}
      <div style={{ display: 'grid', gap: '8px' }}>
        {shown.map((row) => (
          <article key={row.id} data-testid={`proposal-${row.id}`} style={card}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={kindChip}>{KIND_LABELS[row.kind] ?? row.kind}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-redwood-text-muted)' }}>#{row.id}</span>
              <span style={statusChip(row.status)}>{STATUS_LABELS[row.status] ?? row.status}</span>
            </div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-redwood-text-main)' }}>{row.summary}</div>
            {row.rationale && <div style={{ ...muted, marginTop: '4px' }}>{row.rationale}</div>}
            <div style={{ ...muted, marginTop: '4px' }}>
              Proposed {formatStoredDateTime(row.proposed_at)}
              {row.status === 'pending' && row.expires_at ? ` · expires ${formatStoredDateTime(row.expires_at)}` : ''}
            </div>
            {row.decided_at && <div style={{ ...muted, marginTop: '2px' }}>Decided {formatStoredDateTime(row.decided_at)}</div>}
            {row.reject_reason && <div style={{ fontSize: '12px', marginTop: '4px' }}>Reason: {row.reject_reason}</div>}
            {row.error && <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--color-brand-red)' }}>Error: {row.error}</div>}
            {row.status === 'approved' && row.result && <ProposalResult row={row} />}

            {row.status === 'pending' && confirmingId === row.id && (
              <div role="dialog" aria-label="Approve proposal" style={dialog}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Approve #{row.id}?</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>{row.summary}</div>
                <div style={{ ...muted, marginTop: '4px' }}>{KIND_EFFECTS[row.kind]} It runs as you.</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button type="button" style={approveBtn} disabled={busyId === row.id} onClick={() => void confirmApprove(row)}>
                    {busyId === row.id ? 'Approving…' : 'Confirm approve'}
                  </button>
                  <button type="button" style={chip(false)} disabled={busyId === row.id} onClick={() => setConfirmingId(null)}>Cancel</button>
                </div>
              </div>
            )}

            {row.status === 'pending' && rejectingId === row.id && (
              <div role="dialog" aria-label="Reject proposal" style={dialog}>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Reason (optional)
                  <input
                    type="text"
                    aria-label="Reject reason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="e.g. Wrong supplier, stock already moved…"
                    style={{ ...input, width: '100%', marginTop: '6px' }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" style={rejectBtn} disabled={busyId === row.id} onClick={() => void confirmReject(row)}>
                    {busyId === row.id ? 'Rejecting…' : 'Confirm reject'}
                  </button>
                  <button
                    type="button"
                    style={chip(false)}
                    disabled={busyId === row.id}
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {row.status === 'pending' && confirmingId !== row.id && rejectingId !== row.id && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {canDecide ? (
                  <>
                    <button
                      type="button"
                      style={approveBtn}
                      onClick={() => {
                        setRejectingId(null);
                        setConfirmingId(row.id);
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      style={rejectBtn}
                      onClick={() => {
                        setConfirmingId(null);
                        setRejectReason('');
                        setRejectingId(row.id);
                      }}
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span title={READ_ONLY_TIP} style={muted}>Read only</span>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function ProposalResult({ row }: { row: AgentProposal }) {
  if (row.kind === 'draft_po') {
    const result = row.result as DraftPoProposalResult;
    const supplierId = row.payload?.supplier_id;
    const label = `PO ${result.po_number}`;
    return (
      <div style={{ fontSize: '12px', marginTop: '4px' }}>
        {supplierId != null ? (
          <Link to={`/suppliers/${supplierId}?tab=purchases`} style={{ fontWeight: 600, textDecoration: 'underline' }}>{label}</Link>
        ) : (
          label
        )}
      </div>
    );
  }
  if (row.kind === 'snooze') {
    const result = row.result as SnoozeProposalResult;
    return <div style={{ fontSize: '12px', marginTop: '4px' }}>Snoozed until {formatLocalDate(result.until) || result.until}</div>;
  }
  const result = row.result as BinTransferProposalResult;
  return (
    <div style={{ marginTop: '4px' }}>
      <div style={{ fontSize: '12px' }}>{qty(Number(result.quantity))} moved</div>
      {result.movement_ids?.length > 0 && (
        <div style={muted}>Movements {result.movement_ids.map((id) => `#${id}`).join(', ')}</div>
      )}
    </div>
  );
}

interface BriefDraft {
  enabled: boolean;
  send_time: string;
  recipients: string;
  include_proposals: boolean;
}

function draftFrom(settings: InventoryBriefSettings): BriefDraft {
  return {
    enabled: settings.enabled,
    send_time: settings.send_time,
    recipients: settings.recipients ?? '',
    include_proposals: settings.include_proposals,
  };
}

/** Only the fields that differ from what the server returned. */
function changedFields(settings: InventoryBriefSettings, draft: BriefDraft): InventoryBriefSettingsUpdate {
  const changes: InventoryBriefSettingsUpdate = {};
  if (draft.enabled !== settings.enabled) changes.enabled = draft.enabled;
  if (draft.send_time.trim() !== settings.send_time) changes.send_time = draft.send_time.trim();
  const recipients = draft.recipients.trim() || null;
  if (recipients !== (settings.recipients || null)) changes.recipients = recipients;
  if (draft.include_proposals !== settings.include_proposals) changes.include_proposals = draft.include_proposals;
  return changes;
}

function DailyBriefSection() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [settings, setSettings] = useState<InventoryBriefSettings | null>(null);
  const [draft, setDraft] = useState<BriefDraft | null>(null);
  const [sends, setSends] = useState<InventoryBriefSend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadSends = useCallback(async () => {
    try {
      setSends(await listBriefSends(30));
    } catch (err) {
      setError(message(err, 'Could not load recent sends.'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getBriefSettings()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        setDraft(draftFrom(loaded));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(message(err, 'Could not load brief settings.'));
      });
    void loadSends();
    return () => {
      cancelled = true;
    };
  }, [loadSends]);

  const changes = settings && draft ? changedFields(settings, draft) : {};
  const dirty = Object.keys(changes).length > 0;

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await updateBriefSettings(changes);
      setSettings(saved);
      setDraft(draftFrom(saved));
      setNotice('Brief settings saved.');
    } catch (err) {
      setError(message(err, 'Could not save brief settings.'));
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const row = await sendTestBrief();
      setNotice(`Test brief ${row.status}${row.error ? `: ${row.error}` : ''}.`);
      await loadSends();
    } catch (err) {
      setError(message(err, 'Could not send a test brief.'));
    } finally {
      setTesting(false);
    }
  }

  const readOnly = !isAdmin;

  return (
    <div>
      <h2 style={{ ...heading, marginBottom: '8px' }}>Daily brief</h2>
      {notice && <div role="status" style={{ ...note, color: 'var(--color-brand-green-tint)' }}>{notice}</div>}
      {error && <div role="alert" style={{ ...note, color: 'var(--color-brand-red)' }}>{error}</div>}
      {draft && settings && (
        <div style={{ display: 'grid', gap: '8px', maxWidth: '520px', fontSize: '12px' }}>
          <label style={row}>
            <input
              type="checkbox"
              aria-label="Brief enabled"
              checked={draft.enabled}
              disabled={readOnly}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
            />
            Send the daily inventory brief
          </label>
          <label style={row}>
            Send time
            <input
              type="text"
              aria-label="Send time"
              inputMode="numeric"
              placeholder="HH:MM"
              value={draft.send_time}
              disabled={readOnly}
              onChange={(event) => setDraft({ ...draft, send_time: event.target.value })}
              style={{ ...input, width: '80px' }}
            />
            <span style={muted} data-testid="brief-timezone">{settings.timezone} (from company settings)</span>
          </label>
          <label style={{ display: 'grid', gap: '4px' }}>
            Recipients
            <input
              type="text"
              aria-label="Recipients"
              value={draft.recipients}
              disabled={readOnly}
              onChange={(event) => setDraft({ ...draft, recipients: event.target.value })}
              style={input}
            />
            <span style={muted}>Comma-separated; empty = company admins</span>
          </label>
          <label style={row}>
            <input
              type="checkbox"
              aria-label="Include proposals"
              checked={draft.include_proposals}
              disabled={readOnly}
              onChange={(event) => setDraft({ ...draft, include_proposals: event.target.checked })}
            />
            Include pending proposals
          </label>
          {isAdmin ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" style={approveBtn} disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" style={chip(false)} disabled={testing} onClick={() => void sendTest()}>
                {testing ? 'Sending…' : 'Send me a test brief'}
              </button>
            </div>
          ) : (
            <span style={muted}>Only an admin can change the brief.</span>
          )}
        </div>
      )}

      <h3 style={{ ...heading, fontSize: '13px', marginTop: '14px', marginBottom: '4px' }}>Recent sends</h3>
      <div style={{ ...muted, marginBottom: '6px' }}>Scheduled sends only happen when the server's inventory brief scheduler is on.</div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-redwood-border)', borderRadius: '10px' }}>
        <table aria-label="Recent sends" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-redwood-text-muted)' }}>
              {['Sent', 'Trigger', 'Status', 'Recipients', 'Narrative', 'Error'].map((label) => (
                <th key={label} style={th}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sends.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...td, color: 'var(--color-redwood-text-muted)' }}>No sends yet.</td>
              </tr>
            )}
            {sends.map((send) => (
              <tr key={send.id} style={{ borderTop: '1px solid var(--color-redwood-border)' }}>
                <td style={td}>{formatStoredDateTime(send.sent_at)}</td>
                <td style={td}>{send.trigger}</td>
                <td style={td}>{send.status}</td>
                <td style={td}>{send.recipients_count}</td>
                <td style={td}>{send.narrative_ok ? 'Yes' : 'No'}</td>
                <td style={td}>{send.error ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const heading: CSSProperties = { margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-redwood-text-main)' };
const muted: CSSProperties = { fontSize: '11px', color: 'var(--color-redwood-text-muted)' };
const note: CSSProperties = { marginBottom: '8px', fontSize: '12px' };
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' };
const th: CSSProperties = { padding: '8px 10px', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: CSSProperties = { padding: '8px 10px' };
const card: CSSProperties = {
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '10px',
  padding: '10px 12px',
  background: 'var(--color-redwood-row-bg)',
};
const dialog: CSSProperties = {
  marginTop: '8px',
  padding: '10px',
  borderRadius: '10px',
  border: '1px solid var(--color-redwood-border)',
  background: 'var(--color-redwood-bg-surface)',
};
const input: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '8px',
  padding: '7px 10px',
  fontSize: '12px',
  color: 'var(--color-redwood-text-main)',
};
const kindChip: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: '999px',
  background: 'rgba(79,142,247,.18)',
  color: 'var(--color-redwood-text-main)',
};
const approveBtn: CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(34,197,94,.28)',
  background: 'var(--color-badge-green-bg)',
  color: 'var(--color-brand-green-tint)',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};
const rejectBtn: CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(239,68,68,.25)',
  background: 'var(--color-badge-red-bg)',
  color: 'var(--color-brand-red-tint)',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};

function statusChip(status: ProposalStatus): CSSProperties {
  const tone =
    status === 'approved'
      ? 'var(--color-brand-green-tint)'
      : status === 'failed' || status === 'rejected'
        ? 'var(--color-brand-red-tint)'
        : 'var(--color-redwood-text-muted)';
  return { fontSize: '10px', fontWeight: 600, color: tone };
}

function chip(active: boolean): CSSProperties {
  return {
    background: active ? 'rgba(79,142,247,.18)' : 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '11px',
    color: 'var(--color-redwood-text-main)',
    cursor: 'pointer',
  };
}
