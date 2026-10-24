import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle, Loader2, Play, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getReorderRuns,
  getReorderSettings,
  REORDER_SETTING_RANGES,
  runReorderNow,
  updateReorderSettings,
  type ReorderRun,
  type ReorderSettings,
  type ReorderSettingsUpdate,
} from '../../services/reorderService';
import { formatStoredDateTime } from '../../utils/dates';

type NumberField = keyof typeof REORDER_SETTING_RANGES;

type Draft = Record<NumberField, string> & {
  digest_enabled: boolean;
  digest_recipients: string;
};

const NUMBER_FIELDS: Array<{ key: Exclude<NumberField, 'digest_hour_local'>; label: string; step: string }> = [
  { key: 'demand_window_days', label: 'Demand window (days)', step: '1' },
  { key: 'safety_factor', label: 'Safety factor', step: '0.1' },
  { key: 'default_lead_time_days', label: 'Default lead time (days)', step: '1' },
  { key: 'min_days_of_cover_alert', label: 'Min days of cover alert', step: '1' },
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function toDraft(settings: ReorderSettings): Draft {
  return {
    demand_window_days: String(settings.demand_window_days),
    safety_factor: String(settings.safety_factor),
    default_lead_time_days: String(settings.default_lead_time_days),
    min_days_of_cover_alert: String(settings.min_days_of_cover_alert),
    digest_hour_local: String(settings.digest_hour_local),
    digest_enabled: settings.digest_enabled,
    digest_recipients: settings.digest_recipients ?? '',
  };
}

/** Only fields that differ from what the server returned. A cleared number is sent as null so the server rejects it. */
function changedFields(settings: ReorderSettings, draft: Draft): ReorderSettingsUpdate {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(REORDER_SETTING_RANGES) as NumberField[]) {
    const raw = draft[key].trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== settings[key]) out[key] = value;
  }
  if (draft.digest_enabled !== settings.digest_enabled) out.digest_enabled = draft.digest_enabled;
  const recipients = draft.digest_recipients.trim();
  if (recipients !== (settings.digest_recipients ?? '')) out.digest_recipients = recipients === '' ? null : recipients;
  return out as ReorderSettingsUpdate;
}

function rangeHint(key: NumberField): string {
  const { min, max } = REORDER_SETTING_RANGES[key];
  return `${min}–${max}`;
}

const fieldClass = 'w-full bg-white border border-redwood-border rounded-sm px-3 py-2 text-sm font-bold text-redwood-text-main disabled:bg-gray-50 disabled:text-redwood-text-muted';
const labelClass = 'block text-[10px] font-black text-redwood-text-muted uppercase tracking-widest mb-1';

export default function ReorderSettingsSection() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'manager');
  const [settings, setSettings] = useState<ReorderSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [runs, setRuns] = useState<ReorderRun[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [lastRun, setLastRun] = useState<ReorderRun | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getReorderSettings(), getReorderRuns()])
      .then(([loaded, history]) => {
        if (cancelled) return;
        setSettings(loaded);
        setDraft(toDraft(loaded));
        setRuns(history);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load reorder settings.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings || !draft || !canEdit) return;
    const changes = changedFields(settings, draft);
    if (Object.keys(changes).length === 0) {
      setMessage({ kind: 'ok', text: 'No changes to save.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = await updateReorderSettings(changes);
      setSettings(saved);
      setDraft(toDraft(saved));
      setMessage({ kind: 'ok', text: 'Reorder settings saved.' });
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save reorder settings.' });
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setMessage(null);
    try {
      const run = await runReorderNow();
      setLastRun(run);
      setRuns(await getReorderRuns());
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not run reorder planning.' });
    } finally {
      setRunning(false);
    }
  }

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <section data-testid="reorder-settings-section" className="bg-white border border-redwood-border rounded-sm shadow-2xl overflow-hidden">
      <div className="p-8 border-b border-redwood-border bg-gray-50/50">
        <h2 className="text-lg font-black text-redwood-text-main uppercase tracking-tighter">Reorder planning</h2>
        <p className="text-[11px] text-redwood-text-muted font-bold mt-1">
          Inputs for reorder suggestions and the daily digest. {canEdit ? '' : 'Read-only for your role.'}
        </p>
      </div>

      <div className="p-8 space-y-8">
        {loadError && (
          <div className="flex items-center gap-2 text-red-700 text-xs font-bold"><AlertTriangle size={14} /> {loadError}</div>
        )}
        {message && (
          <div
            data-testid="reorder-settings-message"
            className={`flex items-center gap-2 text-xs font-bold ${message.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
          >
            {message.kind === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />} {message.text}
          </div>
        )}

        {!draft && !loadError && <div className="text-xs text-redwood-text-muted"><Loader2 size={14} className="inline animate-spin" /> Loading…</div>}

        {draft && settings && (
          <form onSubmit={save} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {NUMBER_FIELDS.map(({ key, label, step }) => (
                <label key={key} className="block">
                  <span className={labelClass}>{label}</span>
                  <input
                    aria-label={label}
                    type="number"
                    step={step}
                    min={REORDER_SETTING_RANGES[key].min}
                    max={REORDER_SETTING_RANGES[key].max}
                    className={fieldClass}
                    disabled={!canEdit}
                    value={draft[key]}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                  <span className="text-[10px] text-redwood-text-muted">Allowed {rangeHint(key)}</span>
                </label>
              ))}
              <label className="block">
                <span className={labelClass}>Digest hour (local)</span>
                <select
                  aria-label="Digest hour (local)"
                  className={fieldClass}
                  disabled={!canEdit}
                  value={draft.digest_hour_local}
                  onChange={(e) => setField('digest_hour_local', e.target.value)}
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={String(hour)}>{String(hour).padStart(2, '0')}:00</option>
                  ))}
                </select>
                <span className="text-[10px] text-redwood-text-muted">Allowed {rangeHint('digest_hour_local')}</span>
              </label>
              <div>
                <span className={labelClass}>Timezone</span>
                <p data-testid="reorder-timezone" className="text-sm font-bold text-redwood-text-main py-2">
                  {settings.timezone} <span className="text-redwood-text-muted font-normal">(from company settings)</span>
                </p>
              </div>
            </div>

            <label className="flex items-center gap-3">
              <input
                aria-label="Send daily digest"
                type="checkbox"
                disabled={!canEdit}
                checked={draft.digest_enabled}
                onChange={(e) => setField('digest_enabled', e.target.checked)}
              />
              <span className="text-xs font-bold text-redwood-text-main">Send daily digest email</span>
            </label>

            <label className="block">
              <span className={labelClass}>Digest recipients</span>
              <input
                aria-label="Digest recipients"
                className={fieldClass}
                disabled={!canEdit}
                placeholder="buyer@example.com, ops@example.com"
                value={draft.digest_recipients}
                onChange={(e) => setField('digest_recipients', e.target.value)}
              />
              <span className="text-[10px] text-redwood-text-muted">Comma-separated email addresses</span>
            </label>

            {canEdit && (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-redwood-brand text-white px-5 py-2 rounded-sm text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </form>
        )}

        <div className="border-t border-redwood-border pt-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-[11px] font-black text-redwood-text-muted uppercase tracking-widest">Run history</h3>
            {canEdit && (
              <button
                type="button"
                onClick={() => void runNow()}
                disabled={running}
                className="inline-flex items-center gap-2 border border-redwood-border px-4 py-2 rounded-sm text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                <Play size={14} /> {running ? 'Running…' : 'Run now'}
              </button>
            )}
          </div>
          {lastRun && (
            <p data-testid="reorder-run-result" className="text-xs font-bold text-redwood-text-main">
              Run complete: {lastRun.due_count} due · {lastRun.digest_sent ? 'digest sent' : 'digest not sent'}
            </p>
          )}
          <p className="text-[11px] text-redwood-text-muted">Scheduled runs only happen when the server&apos;s reorder scheduler is on.</p>
          <div className="overflow-x-auto border border-redwood-border rounded-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-redwood-text-muted">
                  {['Run at', 'Trigger', 'Due', 'Digest', 'Error'].map((label) => (
                    <th key={label} className="px-3 py-2 font-black">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody data-testid="reorder-run-history">
                {runs.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-3 text-redwood-text-muted">No runs yet.</td></tr>
                )}
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-redwood-border">
                    <td className="px-3 py-2">{formatStoredDateTime(run.run_at)}</td>
                    <td className="px-3 py-2">{run.trigger}</td>
                    <td className="px-3 py-2">{run.due_count}</td>
                    <td className="px-3 py-2">{run.digest_sent ? 'Sent' : 'Not sent'}</td>
                    <td className="px-3 py-2 text-red-700">{run.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
