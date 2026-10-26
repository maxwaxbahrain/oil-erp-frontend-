/**
 * Optional "Tell Zava" draft helper on the customer form.
 * POST /api/agent/extract-customer only — never creates or updates a customer.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Mic, Sparkles } from 'lucide-react';
import api from '../../api/axios';
import {
  claimMicSession,
  registerMicConsumer,
  releaseMicSession,
} from '../../lib/micSessionOwner';

const TELL_ZAVA_MIC_OWNER = 'tell-zava-form' as const;
import {
  RECORD_LIMIT_SECONDS,
  permissionDenied,
  recorderMime,
} from '../../services/zavaVoice';
import type { Customer } from '../../services/customerService';

const C = {
  navyField: '#0F1A2E',
  border: 'rgba(255,255,255,0.10)',
  blue: '#4F8EF7',
  green: '#22c55e',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#5A7394',
  red: '#F87171',
  amber: '#FBBF24',
};

export const ZAVA_READ_ERROR = "Zava couldn't read that — please fill the fields yourself.";

export type ExtractOpening = {
  side: string;
  amount: number;
  as_of: string | null;
};

export type ExtractDuplicate = { id: number; name: string };

export type ExtractCustomerResponse = {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  credit_limit: number | null;
  opening_balance: ExtractOpening | null;
  notes: string | null;
  filled_fields: string[];
  warnings: string[];
  possible_duplicates: ExtractDuplicate[];
};

export type ZavaFormSnapshot = {
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  credit_limit: number | undefined;
  opening_balance: number | undefined;
  openingSide: 'debit' | 'credit';
  openingAsOf: string;
  notes: string;
  isEdit: boolean;
};

export type ZavaFillableField =
  | 'name'
  | 'email'
  | 'phone'
  | 'address'
  | 'category'
  | 'credit_limit'
  | 'opening_balance'
  | 'notes';

export type ZavaConflict = {
  field: ZavaFillableField;
  currentLabel: string;
  proposedLabel: string;
  proposed: unknown;
};

export type ZavaAutoPatch = {
  form?: Partial<Customer>;
  openingSide?: 'debit' | 'credit';
  openingAsOf?: string;
  tagged: ZavaFillableField[];
};

/** True when the user already has a value Zava must not silently overwrite. */
export function isZavaFieldOccupied(field: ZavaFillableField, snap: ZavaFormSnapshot): boolean {
  switch (field) {
    case 'name':
      return Boolean(snap.name.trim());
    case 'email':
      return Boolean(snap.email.trim());
    case 'phone':
      return Boolean(snap.phone.trim());
    case 'address':
      return Boolean(snap.address.trim());
    case 'notes':
      return Boolean(snap.notes.trim());
    case 'category':
      return Boolean(snap.category) && snap.category !== 'retail';
    case 'credit_limit':
      return snap.credit_limit !== undefined && snap.credit_limit !== null && !Number.isNaN(Number(snap.credit_limit));
    case 'opening_balance':
      if (snap.isEdit) return true;
      return snap.opening_balance !== undefined && Math.abs(Number(snap.opening_balance) || 0) > 0.005;
    default:
      return false;
  }
}

function labelForProposed(field: ZavaFillableField, value: unknown): string {
  if (field === 'opening_balance' && value && typeof value === 'object') {
    const ob = value as ExtractOpening;
    const side = String(ob.side || '').toLowerCase() === 'cr' ? 'Cr' : 'Dr';
    return `${side} ${Number(ob.amount).toLocaleString('en-US')}`;
  }
  if (field === 'credit_limit') return `$${Number(value).toLocaleString('en-US')}`;
  return String(value ?? '');
}

function currentLabel(field: ZavaFillableField, snap: ZavaFormSnapshot): string {
  switch (field) {
    case 'name':
      return snap.name;
    case 'email':
      return snap.email;
    case 'phone':
      return snap.phone;
    case 'address':
      return snap.address;
    case 'notes':
      return snap.notes;
    case 'category':
      return snap.category;
    case 'credit_limit':
      return snap.credit_limit === undefined ? '' : String(snap.credit_limit);
    case 'opening_balance': {
      const side = snap.openingSide === 'credit' ? 'Cr' : 'Dr';
      return `${side} ${Number(snap.opening_balance || 0)}`;
    }
    default:
      return '';
  }
}

function proposedValue(field: ZavaFillableField, result: ExtractCustomerResponse): unknown {
  if (field === 'opening_balance') return result.opening_balance;
  return result[field];
}

/** Split extract into silent fills vs Replace? conflicts. Never invent fields. */
export function planZavaApply(
  snap: ZavaFormSnapshot,
  result: ExtractCustomerResponse,
): { auto: ZavaAutoPatch; conflicts: ZavaConflict[] } {
  const keys = (result.filled_fields || []).filter((k): k is ZavaFillableField =>
    ['name', 'email', 'phone', 'address', 'category', 'credit_limit', 'opening_balance', 'notes'].includes(k),
  );
  const form: Partial<Customer> = {};
  let openingSide: 'debit' | 'credit' | undefined;
  let openingAsOf: string | undefined;
  const tagged: ZavaFillableField[] = [];
  const conflicts: ZavaConflict[] = [];

  for (const field of keys) {
    if (field === 'opening_balance' && snap.isEdit) continue;
    const proposed = proposedValue(field, result);
    if (proposed == null || proposed === '') continue;

    if (isZavaFieldOccupied(field, snap)) {
      conflicts.push({
        field,
        currentLabel: currentLabel(field, snap),
        proposedLabel: labelForProposed(field, proposed),
        proposed,
      });
      continue;
    }

    if (field === 'opening_balance') {
      const ob = proposed as ExtractOpening;
      form.opening_balance = Math.abs(Number(ob.amount) || 0);
      openingSide = String(ob.side || '').toLowerCase() === 'cr' ? 'credit' : 'debit';
      if (ob.as_of) openingAsOf = ob.as_of;
      tagged.push('opening_balance');
    } else if (field === 'credit_limit') {
      form.credit_limit = Number(proposed);
      tagged.push(field);
    } else {
      (form as Record<string, unknown>)[field] = proposed;
      tagged.push(field);
    }
  }

  return {
    auto: { form, openingSide, openingAsOf, tagged },
    conflicts,
  };
}

/** Apply one accepted Replace? conflict into a patch. */
export function patchFromConflict(conflict: ZavaConflict): ZavaAutoPatch {
  const tagged: ZavaFillableField[] = [conflict.field];
  if (conflict.field === 'opening_balance') {
    const ob = conflict.proposed as ExtractOpening;
    return {
      form: { opening_balance: Math.abs(Number(ob.amount) || 0) },
      openingSide: String(ob.side || '').toLowerCase() === 'cr' ? 'credit' : 'debit',
      openingAsOf: ob.as_of || undefined,
      tagged,
    };
  }
  if (conflict.field === 'credit_limit') {
    return { form: { credit_limit: Number(conflict.proposed) }, tagged };
  }
  return {
    form: { [conflict.field]: conflict.proposed } as Partial<Customer>,
    tagged,
  };
}

export async function extractCustomerFromText(text: string): Promise<ExtractCustomerResponse> {
  const { data } = await api.post<ExtractCustomerResponse>(
    '/api/agent/extract-customer',
    { text: text.trim() },
    { timeout: 70_000 },
  );
  return data;
}

export async function transcribeZavaClip(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, blob.type.includes('mp4') ? 'clip.mp4' : 'clip.webm');
  const heard = await api.post<{ transcript: string }>('/api/agent/listen', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45_000,
  });
  return (heard.data.transcript || '').trim();
}

type Props = {
  snapshot: ZavaFormSnapshot;
  onApply: (patch: ZavaAutoPatch) => void;
  onOpenDuplicate: (id: number) => void;
};

type Status = 'idle' | 'listening' | 'transcribing' | 'reading' | 'ok' | 'error';

export default function TellZavaBox({ snapshot, onApply, onOpenDuplicate }: Props) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [filledCount, setFilledCount] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<ExtractDuplicate[]>([]);
  const [dupDismissed, setDupDismissed] = useState(false);
  const [conflicts, setConflicts] = useState<ZavaConflict[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const limitTimer = useRef<number | null>(null);

  const clearListen = useCallback(() => {
    if (limitTimer.current != null) {
      window.clearTimeout(limitTimer.current);
      limitTimer.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    releaseMicSession(TELL_ZAVA_MIC_OWNER);
  }, []);

  useEffect(() => () => clearListen(), [clearListen]);

  const stopMic = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    else clearListen();
  }, [clearListen]);

  useEffect(() => {
    return registerMicConsumer(TELL_ZAVA_MIC_OWNER, () => stopMic());
  }, [stopMic]);

  const startMic = useCallback(async () => {
    setError(null);
    try {
      await api.get('/api/agent/voice');
    } catch {
      setError(ZAVA_READ_ERROR);
      setStatus('error');
      return;
    }
    try {
      claimMicSession(TELL_ZAVA_MIC_OWNER);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      streamRef.current = stream;
      const mime = recorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        clearListen();
        const clip = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
        void (async () => {
          setStatus('transcribing');
          try {
            const transcript = await transcribeZavaClip(clip);
            if (!transcript) {
              setError(ZAVA_READ_ERROR);
              setStatus('error');
              return;
            }
            setText(transcript);
            setStatus('idle');
          } catch {
            setError(ZAVA_READ_ERROR);
            setStatus('error');
          }
        })();
      };
      recorderRef.current = recorder;
      limitTimer.current = window.setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      }, RECORD_LIMIT_SECONDS * 1000);
      recorder.start();
      setStatus('listening');
    } catch (err) {
      clearListen();
      setError(permissionDenied(err) ? 'Microphone permission is needed to talk to Zava.' : ZAVA_READ_ERROR);
      setStatus('error');
    }
  }, [clearListen]);

  const onMicTap = () => {
    if (status === 'reading' || status === 'transcribing') return;
    if (status === 'listening') {
      stopMic();
      return;
    }
    void startMic();
  };

  const runExtract = async (raw: string) => {
    const q = raw.trim();
    if (!q || status === 'reading') return;
    setError(null);
    setConflicts([]);
    setDupDismissed(false);
    setDuplicates([]);
    setWarnings([]);
    setFilledCount(0);
    setStatus('reading');
    try {
      const result = await extractCustomerFromText(q);
      const plan = planZavaApply(snapshot, result);
      if (plan.auto.tagged.length > 0) {
        onApply(plan.auto);
      }
      setFilledCount(plan.auto.tagged.length);
      setWarnings(result.warnings || []);
      setDuplicates(result.possible_duplicates || []);
      setConflicts(plan.conflicts);
      setStatus('ok');
    } catch {
      setError(ZAVA_READ_ERROR);
      setStatus('error');
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void runExtract(text);
  };

  const acceptConflict = (c: ZavaConflict) => {
    const patch = patchFromConflict(c);
    onApply(patch);
    setFilledCount((n) => n + 1);
    setConflicts((list) => list.filter((x) => x.field !== c.field));
  };

  const keepConflict = (c: ZavaConflict) => {
    setConflicts((list) => list.filter((x) => x.field !== c.field));
  };

  const busy = status === 'reading' || status === 'transcribing';
  const showDup = !dupDismissed && duplicates.length > 0;
  const firstDup = duplicates[0];

  return (
    <div data-testid="customer-form-zava-slot" style={wrap}>
      <div style={titleRow}>
        <Sparkles size={14} color={C.blue} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
          Tell Zava — it fills the form for you
        </span>
        <span style={{ fontSize: 11, color: C.dim }}>(optional)</span>
      </div>

      <form onSubmit={onSubmit} style={row}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Surjeet A1 Collision, 718-555-0177, 37th Ave, limit 3000"
          data-testid="tell-zava-input"
          disabled={busy || status === 'listening'}
          style={input}
        />
        <button
          type="button"
          data-testid="tell-zava-mic"
          aria-label={status === 'listening' ? 'Stop listening' : 'Talk to Zava'}
          onClick={onMicTap}
          disabled={busy}
          style={{
            ...micBtn,
            borderColor: status === 'listening' ? C.blue : C.border,
            boxShadow: status === 'listening' ? `0 0 12px ${C.blue}66` : 'none',
          }}
        >
          <Mic size={16} color={C.blue} />
        </button>
        <button
          type="submit"
          data-testid="tell-zava-submit"
          disabled={busy || !text.trim() || status === 'listening'}
          style={fillBtn}
        >
          Fill
        </button>
      </form>

      {status === 'reading' && (
        <p data-testid="tell-zava-reading" style={statusLine}>
          Zava is reading…
        </p>
      )}
      {status === 'listening' && (
        <p data-testid="tell-zava-listening" style={statusLine}>
          Listening… tap the mic to stop
        </p>
      )}
      {status === 'ok' && filledCount > 0 && (
        <p data-testid="tell-zava-filled" style={{ ...statusLine, color: C.green }}>
          Zava filled {filledCount} field{filledCount === 1 ? '' : 's'} — check them, then save. Nothing is saved
          until you click Save.
        </p>
      )}
      {status === 'ok' && filledCount === 0 && conflicts.length === 0 && (
        <p data-testid="tell-zava-none" style={statusLine}>
          Zava didn&apos;t find new fields to fill. Nothing was saved.
        </p>
      )}
      {error && (
        <p data-testid="tell-zava-error" role="alert" style={{ ...statusLine, color: C.red }}>
          {error}
        </p>
      )}

      {warnings.length > 0 && (
        <ul data-testid="tell-zava-warnings" style={warnList}>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {conflicts.map((c) => (
        <div key={c.field} data-testid={`tell-zava-replace-${c.field}`} style={replaceCard}>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.35 }}>
            Replace <strong>{c.field.replace('_', ' ')}</strong>? Now &quot;{c.currentLabel}&quot; → Zava
            suggests &quot;{c.proposedLabel}&quot;
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" data-testid={`tell-zava-replace-yes-${c.field}`} style={yesBtn} onClick={() => acceptConflict(c)}>
              Replace
            </button>
            <button type="button" data-testid={`tell-zava-replace-no-${c.field}`} style={noBtn} onClick={() => keepConflict(c)}>
              Keep mine
            </button>
          </div>
        </div>
      ))}

      {showDup && firstDup && (
        <div data-testid="tell-zava-duplicates" style={dupCard}>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.35 }}>
            A customer named <strong>{firstDup.name}</strong> already exists
            {duplicates.length > 1 ? ` (and ${duplicates.length - 1} more)` : ''}.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="tell-zava-open-duplicate"
              style={yesBtn}
              onClick={() => onOpenDuplicate(firstDup.id)}
            >
              Open it
            </button>
            <button
              type="button"
              data-testid="tell-zava-continue-anyway"
              style={noBtn}
              onClick={() => setDupDismissed(true)}
            >
              Continue anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const wrap: CSSProperties = {
  marginBottom: 10,
  padding: '10px 10px 8px',
  borderRadius: 10,
  border: `1px solid rgba(79,142,247,0.35)`,
  background: 'rgba(15,26,46,0.9)',
};

const titleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 8,
};

const row: CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
};

const input: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: C.navyField,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 12,
  color: C.text,
  outline: 'none',
  fontFamily: 'inherit',
};

const micBtn: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: `1.5px solid ${C.border}`,
  background: C.navyField,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const fillBtn: CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 8,
  border: 'none',
  background: C.blue,
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  flexShrink: 0,
  fontFamily: 'inherit',
};

const statusLine: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12,
  color: C.muted,
  lineHeight: 1.35,
};

const warnList: CSSProperties = {
  margin: '8px 0 0',
  paddingLeft: 18,
  fontSize: 11,
  color: C.amber,
  lineHeight: 1.4,
};

const replaceCard: CSSProperties = {
  marginTop: 8,
  padding: '8px 10px',
  borderRadius: 8,
  border: `1px solid rgba(251,191,36,0.35)`,
  background: 'rgba(251,191,36,0.08)',
};

const dupCard: CSSProperties = {
  marginTop: 8,
  padding: '8px 10px',
  borderRadius: 8,
  border: `1px solid rgba(79,142,247,0.35)`,
  background: 'rgba(79,142,247,0.08)',
};

const yesBtn: CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  background: C.blue,
  color: '#fff',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const noBtn: CSSProperties = {
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '6px 10px',
  background: 'transparent',
  color: C.muted,
  fontWeight: 600,
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
