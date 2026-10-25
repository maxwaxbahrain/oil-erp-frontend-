/**
 * One inventory agent proposal, with the Approve confirm and Reject reason
 * dialogs. Used on Warehouse › Stock and in the Zava chat thread. Approving
 * runs the backend service as the signed-in user; this file only formats what
 * the API returns.
 */
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  approveProposal,
  rejectProposal,
  type AgentProposal,
  type BinTransferProposalResult,
  type DraftPoProposalResult,
  type ProposalKind,
  type ProposalStatus,
  type SnoozeProposalResult,
} from '../../services/agentProposalsService';
import { formatLocalDate, formatStoredDateTime } from '../../utils/dates';
import { STATUS_LABELS, approveBtn, chip, errorMessage, input, muted } from './proposalStyles';

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

const READ_ONLY_TIP = 'Only admin, manager, or warehouse users can approve or reject proposals.';

function qty(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

interface ProposalCardProps {
  proposal: AgentProposal;
  canDecide: boolean;
  /** The row the API returned after approve (approved or failed) or reject. */
  onDecided: (proposal: AgentProposal) => void;
  /** A refused decision (403, 404, 409), already prefixed with the proposal number. */
  onError: (message: string) => void;
}

export default function ProposalCard({ proposal: row, canDecide, onDecided, onError }: ProposalCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirmApprove() {
    setBusy(true);
    try {
      const decided = await approveProposal(row.id);
      setConfirming(false);
      onDecided(decided);
    } catch (err) {
      setConfirming(false);
      onError(`Proposal #${row.id}: ${errorMessage(err, 'Could not approve.')}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    setBusy(true);
    try {
      const decided = await rejectProposal(row.id, rejectReason);
      setRejecting(false);
      setRejectReason('');
      onDecided(decided);
    } catch (err) {
      setRejecting(false);
      onError(`Proposal #${row.id}: ${errorMessage(err, 'Could not reject.')}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article data-testid={`proposal-${row.id}`} style={card}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={kindChip}>{KIND_LABELS[row.kind] ?? row.kind}</span>
        <span style={{ fontSize: '11px', color: 'var(--color-redwood-text-muted)' }}>#{row.id}</span>
        <span style={statusChip(row.status)}>{STATUS_LABELS[row.status] ?? row.status}</span>
      </div>
      <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-redwood-text-main)' }}>{row.summary}</div>
      {row.rationale && <div style={{ ...muted, marginTop: '4px' }}>{row.rationale}</div>}
      {row.proposed_at && (
        <div style={{ ...muted, marginTop: '4px' }}>
          Proposed {formatStoredDateTime(row.proposed_at)}
          {row.status === 'pending' && row.expires_at ? ` · expires ${formatStoredDateTime(row.expires_at)}` : ''}
        </div>
      )}
      {row.decided_at && <div style={{ ...muted, marginTop: '2px' }}>Decided {formatStoredDateTime(row.decided_at)}</div>}
      {row.reject_reason && <div style={{ fontSize: '12px', marginTop: '4px' }}>Reason: {row.reject_reason}</div>}
      {row.error && <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--color-brand-red)' }}>Error: {row.error}</div>}
      {row.status === 'approved' && row.result && <ProposalResult row={row} />}

      {row.status === 'pending' && confirming && (
        <div role="dialog" aria-label="Approve proposal" style={dialog}>
          <div style={{ fontSize: '12px', fontWeight: 600 }}>Approve #{row.id}?</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>{row.summary}</div>
          <div style={{ ...muted, marginTop: '4px' }}>{KIND_EFFECTS[row.kind]} It runs as you.</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button type="button" style={approveBtn} disabled={busy} onClick={() => void confirmApprove()}>
              {busy ? 'Approving…' : 'Confirm approve'}
            </button>
            <button type="button" style={chip(false)} disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}

      {row.status === 'pending' && rejecting && (
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
            <button type="button" style={rejectBtn} disabled={busy} onClick={() => void confirmReject()}>
              {busy ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button
              type="button"
              style={chip(false)}
              disabled={busy}
              onClick={() => {
                setRejecting(false);
                setRejectReason('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {row.status === 'pending' && !confirming && !rejecting && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          {canDecide ? (
            <>
              <button
                type="button"
                style={approveBtn}
                onClick={() => {
                  setRejecting(false);
                  setConfirming(true);
                }}
              >
                Approve
              </button>
              <button
                type="button"
                style={rejectBtn}
                onClick={() => {
                  setConfirming(false);
                  setRejectReason('');
                  setRejecting(true);
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
const kindChip: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: '999px',
  background: 'rgba(79,142,247,.18)',
  color: 'var(--color-redwood-text-main)',
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
