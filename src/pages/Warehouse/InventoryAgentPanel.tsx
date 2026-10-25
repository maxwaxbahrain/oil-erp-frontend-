/**
 * Inventory agent inbox on Warehouse › Stock: proposals waiting for a person,
 * and the daily inventory brief. Everything shown comes from the API; this
 * file only formats it. Approving runs the backend service as the signed-in user.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  PROPOSAL_STATUSES,
  listProposals,
  type AgentProposal,
  type ProposalStatus,
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
import { formatStoredDateTime } from '../../utils/dates';
import ProposalCard from './ProposalCard';
import { STATUS_LABELS, approveBtn, chip, errorMessage as message, input, muted } from './proposalStyles';

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
    setStatus(next);
  }

  function onDecided(decided: AgentProposal) {
    setDecidedHere((current) => ({ ...current, [decided.id]: decided }));
    setError(null);
    if (decided.status === 'approved') setNotice(`Proposal #${decided.id} approved.`);
    else if (decided.status === 'rejected') setNotice(`Proposal #${decided.id} rejected.`);
    else setNotice(null);
    void load(status);
  }

  function onError(text: string) {
    setNotice(null);
    setError(text);
    void load(status);
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
          <ProposalCard key={row.id} proposal={row} canDecide={canDecide} onDecided={onDecided} onError={onError} />
        ))}
      </div>
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
const note: CSSProperties = { marginBottom: '8px', fontSize: '12px' };
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' };
const th: CSSProperties = { padding: '8px 10px', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: CSSProperties = { padding: '8px 10px' };
