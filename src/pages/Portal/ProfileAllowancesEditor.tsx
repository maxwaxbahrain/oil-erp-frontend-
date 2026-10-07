import { useMemo, useState } from 'react';
import {
  ALLOWANCE_TYPES,
  DEFAULT_ALLOWANCE_LABELS,
  putProfileAllowances,
  type AllowanceLine,
  type AllowanceType,
} from '../../services/payrollService';

const TYPE_LABELS: Record<AllowanceType, string> = {
  housing: 'Housing',
  transport: 'Transport',
  medical: 'Medical',
  meal: 'Meal',
  fuel: 'Fuel',
  special: 'Special',
  other: 'Other',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,.04)',
  border: '1px solid var(--br2, rgba(255,255,255,.12))',
  borderRadius: 7,
  padding: '7px 10px',
  fontSize: 11,
  color: 'var(--t, #EEF2FF)',
  fontFamily: 'inherit',
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--br2, rgba(255,255,255,.12))',
  color: 'var(--t2, #8BA3C7)',
  borderRadius: 7,
  padding: '5px 10px',
  fontSize: 10,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

interface DraftRow {
  key: string;
  type: AllowanceType;
  label: string;
  labelEdited: boolean;
  amount: string;
}

interface ProfileAllowancesEditorProps {
  profileId: number;
  initialLines: AllowanceLine[];
  onSaved: (lines: AllowanceLine[]) => void | Promise<void>;
}

function defaultLabel(type: AllowanceType): string {
  if (type === 'other') return '';
  return DEFAULT_ALLOWANCE_LABELS[type];
}

function toDraft(line: AllowanceLine, index: number): DraftRow {
  return {
    key: `saved-${index}-${line.type}-${line.label}`,
    type: line.type,
    label: line.label,
    labelEdited: line.type === 'other' || line.label !== defaultLabel(line.type),
    amount: String(line.amount),
  };
}

function resolvedLabel(row: DraftRow): string {
  const typed = row.label.trim();
  if (row.type === 'other') return typed;
  return typed || defaultLabel(row.type);
}

function amountProblem(raw: string): string | null {
  const text = raw.trim();
  if (!text) return 'Amount is required';
  if (!/^\d+(\.\d+)?$/.test(text)) return 'Amount must be a number';
  const fraction = text.split('.')[1];
  if (fraction && fraction.length > 2) return 'Amount must have at most 2 decimal places';
  const value = Number(text);
  if (value < 0 || value > 1_000_000) return 'Amount must be between 0 and 1000000';
  return null;
}

export default function ProfileAllowancesEditor({
  profileId,
  initialLines,
  onSaved,
}: ProfileAllowancesEditorProps) {
  const [rows, setRows] = useState<DraftRow[]>(() => initialLines.map(toDraft));
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [nextKey, setNextKey] = useState(0);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => {
      if (amountProblem(row.amount)) return sum;
      return sum + Number(row.amount.trim());
    }, 0);
  }, [rows]);

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setRowErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError('');
  }

  function changeType(key: string, type: AllowanceType) {
    setRows((current) => current.map((row) => {
      if (row.key !== key) return row;
      return {
        ...row,
        type,
        label: row.labelEdited ? row.label : defaultLabel(type),
      };
    }));
    setFormError('');
  }

  function addRow() {
    const key = `new-${nextKey}`;
    setNextKey((n) => n + 1);
    setRows((current) => [
      ...current,
      { key, type: 'housing', label: defaultLabel('housing'), labelEdited: false, amount: '' },
    ]);
    setFormError('');
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
    setRowErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError('');
  }

  async function handleSave() {
    const errors: Record<string, string> = {};
    const seen = new Set<string>();
    let duplicate = false;
    for (const row of rows) {
      const label = resolvedLabel(row);
      if (row.type === 'other' && !label) {
        errors[row.key] = 'Label is required for Other';
        continue;
      }
      const amountMessage = amountProblem(row.amount);
      if (amountMessage) {
        errors[row.key] = amountMessage;
        continue;
      }
      const key = `${row.type}\u0000${label}`;
      if (seen.has(key)) duplicate = true;
      seen.add(key);
    }
    if (duplicate) {
      setFormError('Duplicate allowance type and label');
    }
    if (Object.keys(errors).length > 0 || duplicate) {
      setRowErrors(errors);
      return;
    }

    const lines: AllowanceLine[] = rows.map((row) => ({
      type: row.type,
      label: resolvedLabel(row),
      amount: Number(row.amount.trim()),
    }));

    setSaving(true);
    setFormError('');
    setRowErrors({});
    try {
      const saved = await putProfileAllowances(profileId, lines);
      setRows(saved.map(toDraft));
      await onSaved(saved);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save allowances');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t2, #8BA3C7)', marginBottom: 6, letterSpacing: '.3px' }}>
        ALLOWANCES
      </div>
      {rows.map((row) => (
        <div key={row.key} style={{ marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 0.8fr auto', gap: 6, alignItems: 'end' }}>
            <label>
              <span style={{ fontSize: 10, color: 'var(--t3, #3E5678)', display: 'block', marginBottom: 4 }}>Type</span>
              <select
                aria-label="Allowance type"
                value={row.type}
                onChange={(e) => changeType(row.key, e.target.value as AllowanceType)}
                style={inputStyle}
              >
                {ALLOWANCE_TYPES.map((type) => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ fontSize: 10, color: 'var(--t3, #3E5678)', display: 'block', marginBottom: 4 }}>Label</span>
              <input
                aria-label="Allowance label"
                value={row.label}
                onChange={(e) => updateRow(row.key, { label: e.target.value, labelEdited: true })}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={{ fontSize: 10, color: 'var(--t3, #3E5678)', display: 'block', marginBottom: 4 }}>Amount</span>
              <input
                aria-label="Allowance amount"
                type="number"
                min="0"
                step="0.01"
                value={row.amount}
                onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                style={inputStyle}
              />
            </label>
            <button type="button" onClick={() => removeRow(row.key)} style={{ ...btnSecondary, marginBottom: 1 }}>
              Remove
            </button>
          </div>
          {rowErrors[row.key] && (
            <div style={{ fontSize: 10, color: 'var(--amber, #F59E0B)', marginTop: 4 }}>{rowErrors[row.key]}</div>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={addRow} style={btnSecondary}>Add allowance</button>
        <div style={{ fontSize: 11, color: 'var(--t, #EEF2FF)', fontWeight: 700 }}>
          Total ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      {formError && (
        <div style={{ fontSize: 11, color: 'var(--amber, #F59E0B)', marginTop: 8 }}>{formError}</div>
      )}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        style={{
          marginTop: 8,
          background: 'var(--green, #22C55E)',
          color: '#fff',
          border: 'none',
          borderRadius: 7,
          padding: '7px 14px',
          fontSize: 11,
          fontWeight: 700,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.7 : 1,
          fontFamily: 'inherit',
        }}
      >
        {saving ? 'Saving…' : 'Save allowances'}
      </button>
      <div style={{ fontSize: 10, color: 'var(--t2, #8BA3C7)', marginTop: 8 }}>
        Allowances are saved separately from the pay profile.
      </div>
    </div>
  );
}
