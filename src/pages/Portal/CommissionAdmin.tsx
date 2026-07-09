import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Percent, Plus, RefreshCw, Settings2 } from 'lucide-react';
import {
  calculateAll,
  createCommissionRule,
  deleteCommissionRule,
  formatCommissionRuleRate,
  formatCommissionUsd,
  getCommissionRecords,
  getCommissionRules,
  getCommissionSummary,
  updateCommissionRule,
  type CommissionRecord,
  type CommissionRule,
  type CommissionSummaryRow,
} from '../../services/commissionService';
import { getSalesmen } from '../../services/employeeService';

const C = {
  t: 'var(--t, #EEF2FF)',
  t2: 'var(--t2, #8BA3C7)',
  t3: 'var(--t3, #3E5678)',
  blue: 'var(--blue, #4F8EF7)',
  green: 'var(--green, #22C55E)',
  amber: 'var(--amber, #F59E0B)',
  br2: 'var(--br2, rgba(255,255,255,.12))',
  bd2: 'var(--bd2, rgba(255,255,255,.04))',
} as const;

type RuleType = 'percent' | 'per_unit';

interface PortalEmployee {
  id: string;
  name: string;
  employeeNumber: string;
  role: string;
  department?: string;
}

interface SalesmanOption {
  id: string;
  name: string;
}

interface RuleFormState {
  employeeId: string;
  ruleType: RuleType;
  rate: string;
  unitLabel: string;
}

interface CommissionAdminProps {
  employees: PortalEmployee[];
  onToast: (message: string) => void;
  onError: (message: string) => void;
}

function emptyAddForm(): RuleFormState {
  return { employeeId: '', ruleType: 'percent', rate: '', unitLabel: '' };
}

function ruleTypeLabel(ruleType: string): string {
  return ruleType.toLowerCase() === 'per_unit' ? 'Per unit' : 'Percent';
}

export default function CommissionAdmin({ employees, onToast, onError }: CommissionAdminProps) {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [summary, setSummary] = useState<CommissionSummaryRow[]>([]);
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [salesmen, setSalesmen] = useState<SalesmanOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [ruleSaving, setRuleSaving] = useState<'add' | number | null>(null);
  const [addForm, setAddForm] = useState<RuleFormState>(emptyAddForm);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<RuleFormState>(emptyAddForm);

  const employeeNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of employees) map.set(Number(e.id), e.name);
    for (const s of salesmen) map.set(Number(s.id), s.name);
    return map;
  }, [employees, salesmen]);

  const activeRules = useMemo(
    () => rules.filter((r) => r.isActive),
    [rules],
  );

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const nameA = employeeNameById.get(a.employeeId) ?? '';
      const nameB = employeeNameById.get(b.employeeId) ?? '';
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return b.id - a.id;
    });
  }, [rules, employeeNameById]);

  const paidTotalsByEmployee = useMemo(() => {
    const map = new Map<number, number>();
    for (const rec of records) {
      if (rec.status !== 'paid') continue;
      map.set(rec.employeeId, (map.get(rec.employeeId) ?? 0) + rec.commissionAmount);
    }
    return map;
  }, [records]);

  const summaryRows = useMemo(() => {
    const byEmployee = new Map<number, CommissionSummaryRow>();
    for (const row of summary) byEmployee.set(row.employeeId, row);
    const employeeIds = new Set<number>([
      ...summary.map((s) => s.employeeId),
      ...records.filter((r) => r.status === 'pending').map((r) => r.employeeId),
    ]);
    return [...employeeIds]
      .sort((a, b) => a - b)
      .map((employeeId) => ({
        employeeId,
        pendingCommissionTotal: byEmployee.get(employeeId)?.pendingCommissionTotal ?? 0,
        invoiceCount: byEmployee.get(employeeId)?.invoiceCount ?? 0,
        paidTotal: paidTotalsByEmployee.get(employeeId) ?? 0,
      }));
  }, [summary, records, paidTotalsByEmployee]);

  const recentRecords = useMemo(
    () => records.slice(0, 25),
    [records],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRows, summaryRows, recordRows, salesmanRows] = await Promise.all([
        getCommissionRules(),
        getCommissionSummary(),
        getCommissionRecords(),
        getSalesmen(),
      ]);
      setRules(rulesRows);
      setSummary(summaryRows);
      setRecords(recordRows);
      setSalesmen(salesmanRows);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load commission data');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function parseRate(value: string): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  function openRuleEditor(rule: CommissionRule) {
    setEditingRuleId(rule.id);
    setEditForm({
      employeeId: String(rule.employeeId),
      ruleType: rule.ruleType.toLowerCase() === 'per_unit' ? 'per_unit' : 'percent',
      rate: String(rule.rate),
      unitLabel: rule.unitLabel ?? '',
    });
  }

  async function handleAddRule() {
    const employeeId = Number(addForm.employeeId);
    const rate = parseRate(addForm.rate);
    if (!employeeId) {
      onError('Select a salesman');
      return;
    }
    if (rate == null) {
      onError('Enter a rate greater than 0');
      return;
    }

    setRuleSaving('add');
    try {
      await createCommissionRule({
        employeeId,
        ruleType: addForm.ruleType,
        rate,
        unitLabel: addForm.ruleType === 'per_unit' ? addForm.unitLabel.trim() || null : null,
      });
      onToast('Commission rule saved — prior active rule for this salesman was deactivated');
      setAddForm(emptyAddForm());
      await loadAll();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create commission rule');
    } finally {
      setRuleSaving(null);
    }
  }

  async function handleSaveRuleEdit(ruleId: number) {
    const rate = parseRate(editForm.rate);
    if (rate == null) {
      onError('Enter a rate greater than 0');
      return;
    }

    setRuleSaving(ruleId);
    try {
      await updateCommissionRule(ruleId, {
        ruleType: editForm.ruleType,
        rate,
        unitLabel: editForm.ruleType === 'per_unit' ? editForm.unitLabel.trim() || null : null,
      });
      onToast('Commission rule updated');
      setEditingRuleId(null);
      await loadAll();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update commission rule');
    } finally {
      setRuleSaving(null);
    }
  }

  async function handleDeactivateRule(rule: CommissionRule) {
    setRuleSaving(rule.id);
    try {
      await deleteCommissionRule(rule.id);
      onToast('Commission rule deactivated');
      if (editingRuleId === rule.id) setEditingRuleId(null);
      await loadAll();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to deactivate commission rule');
    } finally {
      setRuleSaving(null);
    }
  }

  async function handleRecalculateAll() {
    setCalculating(true);
    try {
      const result = await calculateAll();
      onToast(
        result.count === 0
          ? 'Recalculate complete — no invoices matched (salesman + active rule required)'
          : `Recalculated commission for ${result.count} invoice${result.count === 1 ? '' : 's'}`,
      );
      await loadAll();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to recalculate commission');
    } finally {
      setCalculating(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,.04)',
    border: `1px solid ${C.br2}`,
    borderRadius: 7,
    padding: '7px 10px',
    fontSize: 11,
    color: C.t,
    fontFamily: 'inherit',
  };

  const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    border: `1px solid ${C.br2}`,
    color: C.t2,
    borderRadius: 7,
    padding: '5px 10px',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  function renderRuleForm(
    form: RuleFormState,
    setForm: React.Dispatch<React.SetStateAction<RuleFormState>>,
    options: {
      showSalesmanPicker: boolean;
      onSubmit: () => void;
      submitLabel: string;
      saving: boolean;
      onCancel?: () => void;
    },
  ) {
    return (
      <div style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${C.bd2}`,
      }}>
        {options.showSalesmanPicker && (
          <label style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: C.t2, marginBottom: 4 }}>Salesman</div>
            <select
              value={form.employeeId}
              onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Select salesman…</option>
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['percent', 'per_unit'] as const).map((rt) => (
            <button
              key={rt}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, ruleType: rt }))}
              style={{
                ...btnSecondary,
                borderColor: form.ruleType === rt ? C.blue : C.br2,
                color: form.ruleType === rt ? C.blue : C.t2,
              }}
            >
              {rt === 'percent' ? 'Percent of invoice' : 'Per unit'}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <label>
            <div style={{ fontSize: 10, color: C.t2, marginBottom: 4 }}>
              {form.ruleType === 'percent' ? 'Rate (%)' : 'Rate ($ per unit)'}
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.rate}
              onChange={(e) => setForm((prev) => ({ ...prev, rate: e.target.value }))}
              style={inputStyle}
              placeholder={form.ruleType === 'percent' ? '5' : '1.50'}
            />
          </label>
          {form.ruleType === 'per_unit' && (
            <label>
              <div style={{ fontSize: 10, color: C.t2, marginBottom: 4 }}>Unit label (optional)</div>
              <input
                type="text"
                value={form.unitLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, unitLabel: e.target.value }))}
                style={inputStyle}
                placeholder="carton"
              />
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void options.onSubmit()}
            disabled={options.saving}
            style={{
              background: 'rgba(79,142,247,.15)',
              color: C.blue,
              border: '1px solid rgba(79,142,247,.35)',
              borderRadius: 7,
              padding: '5px 12px',
              fontSize: 10,
              fontWeight: 700,
              cursor: options.saving ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {options.saving ? 'Saving…' : options.submitLabel}
          </button>
          {options.onCancel && (
            <button type="button" onClick={options.onCancel} style={btnSecondary}>
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.t, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Settings2 size={13} /> Commission rules
        </span>
      </div>

      <div style={{
        fontSize: 11,
        color: C.t2,
        marginBottom: 10,
        lineHeight: 1.5,
      }}>
        Adding a new rule for a salesman replaces their current active rule (the backend deactivates the prior one automatically).
      </div>

      {salesmen.length === 0 && !loading ? (
        <div style={{
          fontSize: 11,
          color: C.amber,
          background: 'rgba(245,158,11,.08)',
          border: '1px solid rgba(245,158,11,.25)',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 14,
          lineHeight: 1.5,
        }}>
          No salesmen — set an employee&apos;s role to salesman first, then add commission rates here.
        </div>
      ) : (
        <>
          {loading && sortedRules.length === 0 ? (
            <div style={{ fontSize: 12, color: C.t2, marginBottom: 12 }}>Loading rules…</div>
          ) : sortedRules.length === 0 ? (
            <div style={{ fontSize: 12, color: C.t2, marginBottom: 12, lineHeight: 1.5 }}>
              No commission rules yet. Add a rate below for each salesman.
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              {sortedRules.map((rule, i) => {
                const isEditing = editingRuleId === rule.id;
                const saving = ruleSaving === rule.id;
                return (
                  <div
                    key={rule.id}
                    style={{
                      padding: '10px 0',
                      borderBottom: i < sortedRules.length - 1 ? `1px solid ${C.bd2}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.t }}>
                          {employeeNameById.get(rule.employeeId) ?? `Employee #${rule.employeeId}`}
                        </div>
                        <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>
                          {ruleTypeLabel(rule.ruleType)} · {formatCommissionRuleRate(rule)}
                          {rule.isActive ? ' · active' : ' · inactive'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {rule.isActive && (
                          <button
                            type="button"
                            onClick={() => isEditing ? setEditingRuleId(null) : openRuleEditor(rule)}
                            style={btnSecondary}
                            disabled={saving}
                          >
                            {isEditing ? 'Cancel' : 'Edit'}
                          </button>
                        )}
                        {rule.isActive && (
                          <button
                            type="button"
                            onClick={() => void handleDeactivateRule(rule)}
                            disabled={saving}
                            style={{ ...btnSecondary, color: C.amber, borderColor: 'rgba(245,158,11,.35)' }}
                          >
                            {saving ? '…' : 'Deactivate'}
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && renderRuleForm(editForm, setEditForm, {
                      showSalesmanPicker: false,
                      onSubmit: () => void handleSaveRuleEdit(rule.id),
                      submitLabel: 'Save changes',
                      saving,
                      onCancel: () => setEditingRuleId(null),
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8, letterSpacing: '.4px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={11} /> ADD RULE
          </div>
          {renderRuleForm(addForm, setAddForm, {
            showSalesmanPicker: true,
            onSubmit: () => void handleAddRule(),
            submitLabel: 'Add rule',
            saving: ruleSaving === 'add',
          })}
        </>
      )}

      <div style={{ height: 1, background: C.bd2, margin: '18px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.t, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Percent size={13} /> Commission owed
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading || calculating}
            style={{ ...btnSecondary, cursor: loading || calculating ? 'wait' : 'pointer' }}
          >
            <RefreshCw size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => void handleRecalculateAll()}
            disabled={calculating || loading}
            style={{
              background: 'rgba(79,142,247,.15)',
              color: C.blue,
              border: '1px solid rgba(79,142,247,.35)',
              borderRadius: 7,
              padding: '5px 12px',
              fontSize: 10,
              fontWeight: 700,
              cursor: calculating ? 'wait' : 'pointer',
              opacity: calculating ? 0.7 : 1,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Calculator size={10} />
            {calculating ? 'Recalculating…' : 'Recalculate all'}
          </button>
        </div>
      </div>

      {activeRules.length === 0 && (
        <div style={{
          fontSize: 11,
          color: C.amber,
          background: 'rgba(245,158,11,.08)',
          border: '1px solid rgba(245,158,11,.25)',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 12,
          lineHeight: 1.5,
        }}>
          No active commission rules — add rates above, then run Recalculate all for invoices with a salesman assigned.
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8, letterSpacing: '.4px' }}>
        SUMMARY BY SALESMAN
      </div>
      {loading && summaryRows.length === 0 ? (
        <div style={{ fontSize: 12, color: C.t2, marginBottom: 14 }}>Loading summary…</div>
      ) : summaryRows.length === 0 ? (
        <div style={{ fontSize: 12, color: C.t2, marginBottom: 14, lineHeight: 1.5 }}>
          No pending commission owed. Run Recalculate all after invoices have a salesman and commission rules exist.
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {summaryRows.map((row, i) => (
            <div
              key={row.employeeId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 0',
                borderBottom: i < summaryRows.length - 1 ? `1px solid ${C.bd2}` : 'none',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t }}>
                  {employeeNameById.get(row.employeeId) ?? `Employee #${row.employeeId}`}
                </div>
                <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>
                  {row.invoiceCount} pending invoice{row.invoiceCount === 1 ? '' : 's'}
                  {row.paidTotal > 0 ? ` · paid total ${formatCommissionUsd(row.paidTotal)}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>
                {formatCommissionUsd(row.pendingCommissionTotal)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8, letterSpacing: '.4px' }}>
        RECENT COMMISSION RECORDS
      </div>
      {loading && recentRecords.length === 0 ? (
        <div style={{ fontSize: 12, color: C.t2 }}>Loading records…</div>
      ) : recentRecords.length === 0 ? (
        <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
          No commission records yet. Use Recalculate all to compute from invoiced sales.
        </div>
      ) : (
        recentRecords.map((rec, i) => (
          <div
            key={rec.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 0',
              borderBottom: i < recentRecords.length - 1 ? `1px solid ${C.bd2}` : 'none',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.t }}>
                {employeeNameById.get(rec.employeeId) ?? `#${rec.employeeId}`}
                {' · '}
                Invoice #{rec.invoiceId}
              </div>
              <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>
                {formatCommissionRuleRate(rec)}
                {rec.status === 'paid' && rec.payslipId != null ? ` · payslip #${rec.payslipId}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: rec.status === 'paid' ? C.t3 : C.amber }}>
              {rec.status}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t }}>
              {formatCommissionUsd(rec.commissionAmount)}
            </div>
          </div>
        ))
      )}
    </>
  );
}
