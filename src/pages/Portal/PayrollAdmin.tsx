import { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, Play, RefreshCw } from 'lucide-react';
import {
  createPayrollProfile,
  createPayrollRunRecord,
  formatPayProfileSummary,
  formatPayslipUsd,
  generatePayrollRun,
  getPayrollProfiles,
  getPayslipsByRun,
  listPayrollRuns,
  updatePayrollProfile,
  type ApiPayrollRun,
  type ApiPayslip,
  type PayrollProfile,
} from '../../services/payrollService';

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

interface PortalEmployee {
  id: string;
  name: string;
  employeeNumber: string;
  role: string;
  department?: string;
}

interface ProfileEditState {
  employeeId: string;
  profileId: number | null;
  payType: 'salaried' | 'hourly';
  monthlySalary: string;
  hourlyRate: string;
  overtimeRate: string;
}

interface PayrollAdminProps {
  employees: PortalEmployee[];
  onToast: (message: string) => void;
  onError: (message: string) => void;
}

function defaultRunDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { periodLabel: label, periodStart: fmt(start), periodEnd: fmt(end) };
}

export default function PayrollAdmin({ employees, onToast, onError }: PayrollAdminProps) {
  const defaults = useMemo(() => defaultRunDates(), []);
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileSavingId, setProfileSavingId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<ProfileEditState | null>(null);

  const [runs, setRuns] = useState<ApiPayrollRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runCreating, setRunCreating] = useState(false);
  const [generatingRunId, setGeneratingRunId] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runPayslips, setRunPayslips] = useState<ApiPayslip[]>([]);
  const [runPayslipsLoading, setRunPayslipsLoading] = useState(false);

  const [periodLabel, setPeriodLabel] = useState(defaults.periodLabel);
  const [periodStart, setPeriodStart] = useState(defaults.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd);

  const profileByEmployeeId = useMemo(() => {
    const map = new Map<number, PayrollProfile>();
    for (const p of profiles) map.set(p.employeeId, p);
    return map;
  }, [profiles]);

  const employeeNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of employees) map.set(Number(e.id), e.name);
    return map;
  }, [employees]);

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const rows = await getPayrollProfiles();
      setProfiles(rows);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load pay profiles');
    } finally {
      setProfilesLoading(false);
    }
  }, [onError]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const rows = await listPayrollRuns();
      setRuns(rows);
      setSelectedRunId((prev) => prev ?? (rows[0]?.id ?? null));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load payroll runs');
    } finally {
      setRunsLoading(false);
    }
  }, [onError]);

  const loadRunPayslips = useCallback(async (runId: number) => {
    setRunPayslipsLoading(true);
    try {
      const rows = await getPayslipsByRun(runId);
      setRunPayslips(rows);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load run payslips');
      setRunPayslips([]);
    } finally {
      setRunPayslipsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadProfiles();
    void loadRuns();
  }, [loadProfiles, loadRuns]);

  useEffect(() => {
    if (selectedRunId != null) void loadRunPayslips(selectedRunId);
    else setRunPayslips([]);
  }, [selectedRunId, loadRunPayslips]);

  function openProfileEditor(employee: PortalEmployee) {
    const existing = profileByEmployeeId.get(Number(employee.id));
    const payType = existing?.payType?.toLowerCase() === 'hourly' ? 'hourly' : 'salaried';
    setEditingProfile({
      employeeId: employee.id,
      profileId: existing?.id ?? null,
      payType,
      monthlySalary: existing?.monthlySalary != null ? String(existing.monthlySalary) : '',
      hourlyRate: existing?.hourlyRate != null ? String(existing.hourlyRate) : '',
      overtimeRate: existing?.overtimeRate != null ? String(existing.overtimeRate) : '',
    });
  }

  async function handleSaveProfile() {
    if (!editingProfile) return;
    const employeeId = Number(editingProfile.employeeId);
    if (!Number.isFinite(employeeId)) {
      onError('Invalid employee id');
      return;
    }

    const payType = editingProfile.payType;
    const monthlySalary = payType === 'salaried' ? parseFloat(editingProfile.monthlySalary) : null;
    const hourlyRate = payType === 'hourly' ? parseFloat(editingProfile.hourlyRate) : null;
    const overtimeRate = editingProfile.overtimeRate.trim()
      ? parseFloat(editingProfile.overtimeRate)
      : null;

    if (payType === 'salaried' && (!monthlySalary || Number.isNaN(monthlySalary))) {
      onError('Monthly salary is required for salaried employees');
      return;
    }
    if (payType === 'hourly' && (!hourlyRate || Number.isNaN(hourlyRate))) {
      onError('Hourly rate is required for hourly employees');
      return;
    }
    if (overtimeRate != null && Number.isNaN(overtimeRate)) {
      onError('Overtime rate must be a number');
      return;
    }

    setProfileSavingId(editingProfile.employeeId);
    try {
      if (editingProfile.profileId != null) {
        await updatePayrollProfile(editingProfile.profileId, {
          payType,
          monthlySalary,
          hourlyRate,
          overtimeRate,
        });
        onToast('Pay profile updated');
      } else {
        await createPayrollProfile({
          employeeId,
          payType,
          monthlySalary,
          hourlyRate,
          overtimeRate,
        });
        onToast('Pay profile created');
      }
      setEditingProfile(null);
      await loadProfiles();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save pay profile');
    } finally {
      setProfileSavingId(null);
    }
  }

  async function handleCreateRun() {
    if (!periodLabel.trim() || !periodStart || !periodEnd) {
      onError('Period label and dates are required');
      return;
    }
    if (periodEnd < periodStart) {
      onError('Period end must be on or after period start');
      return;
    }
    setRunCreating(true);
    try {
      const run = await createPayrollRunRecord({
        periodLabel: periodLabel.trim(),
        periodStart,
        periodEnd,
        status: 'draft',
      });
      onToast(`Pay run created — ${run.periodLabel}`);
      await loadRuns();
      setSelectedRunId(run.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create pay run');
    } finally {
      setRunCreating(false);
    }
  }

  async function handleGenerateRun(runId: number) {
    setGeneratingRunId(runId);
    try {
      const generated = await generatePayrollRun(runId);
      onToast(`Generated ${generated.length} payslip${generated.length === 1 ? '' : 's'}`);
      setSelectedRunId(runId);
      setRunPayslips(generated);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to generate payslips');
    } finally {
      setGeneratingRunId(null);
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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.t, display: 'flex', alignItems: 'center', gap: 5 }}>
          <DollarSign size={13} /> Run Payroll
        </span>
        <button
          type="button"
          onClick={() => { void loadProfiles(); void loadRuns(); }}
          disabled={profilesLoading || runsLoading}
          style={{ ...btnSecondary, cursor: profilesLoading || runsLoading ? 'wait' : 'pointer' }}
        >
          <RefreshCw size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {profilesLoading || runsLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Pay Profiles */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8, letterSpacing: '.4px' }}>
          PAY PROFILES
        </div>
        {profilesLoading && employees.length === 0 ? (
          <div style={{ fontSize: 12, color: C.t2 }}>Loading employees…</div>
        ) : employees.length === 0 ? (
          <div style={{ fontSize: 12, color: C.t2 }}>No employees in roster.</div>
        ) : (
          employees.map((emp, i) => {
            const profile = profileByEmployeeId.get(Number(emp.id));
            const isEditing = editingProfile?.employeeId === emp.id;
            const saving = profileSavingId === emp.id;
            return (
              <div
                key={emp.id}
                style={{
                  padding: '10px 0',
                  borderBottom: i < employees.length - 1 ? `1px solid ${C.bd2}` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t }}>{emp.name}</div>
                    <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>
                      {emp.role}{emp.department ? ` · ${emp.department}` : ''} · {formatPayProfileSummary(profile)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => isEditing ? setEditingProfile(null) : openProfileEditor(emp)}
                    style={btnSecondary}
                  >
                    {isEditing ? 'Cancel' : profile ? 'Edit' : 'Set profile'}
                  </button>
                </div>

                {isEditing && editingProfile && (
                  <div style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,.03)',
                    border: `1px solid ${C.bd2}`,
                  }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      {(['salaried', 'hourly'] as const).map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => setEditingProfile({ ...editingProfile, payType: pt })}
                          style={{
                            ...btnSecondary,
                            borderColor: editingProfile.payType === pt ? C.blue : C.br2,
                            color: editingProfile.payType === pt ? C.blue : C.t2,
                          }}
                        >
                          {pt === 'salaried' ? 'Salaried' : 'Hourly'}
                        </button>
                      ))}
                    </div>
                    {editingProfile.payType === 'salaried' ? (
                      <label style={{ display: 'block', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: C.t3, display: 'block', marginBottom: 4 }}>Monthly salary (USD)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingProfile.monthlySalary}
                          onChange={(e) => setEditingProfile({ ...editingProfile, monthlySalary: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                    ) : (
                      <>
                        <label style={{ display: 'block', marginBottom: 8 }}>
                          <span style={{ fontSize: 10, color: C.t3, display: 'block', marginBottom: 4 }}>Hourly rate (USD)</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingProfile.hourlyRate}
                            onChange={(e) => setEditingProfile({ ...editingProfile, hourlyRate: e.target.value })}
                            style={inputStyle}
                          />
                        </label>
                        <label style={{ display: 'block', marginBottom: 8 }}>
                          <span style={{ fontSize: 10, color: C.t3, display: 'block', marginBottom: 4 }}>Overtime rate (optional)</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingProfile.overtimeRate}
                            onChange={(e) => setEditingProfile({ ...editingProfile, overtimeRate: e.target.value })}
                            style={inputStyle}
                            placeholder="Defaults to 1.5× hourly"
                          />
                        </label>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSaveProfile()}
                      disabled={saving}
                      style={{
                        background: C.green,
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
                      {saving ? 'Saving…' : 'Save profile'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Run Payroll */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8, letterSpacing: '.4px' }}>
          RUN PAYROLL
        </div>

        <div style={{
          padding: 10,
          borderRadius: 8,
          background: 'rgba(255,255,255,.03)',
          border: `1px solid ${C.bd2}`,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, color: C.t3, marginBottom: 6 }}>Create pay run (draft)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label>
              <span style={{ fontSize: 9, color: C.t3, display: 'block', marginBottom: 3 }}>Period label</span>
              <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} style={inputStyle} />
            </label>
            <label>
              <span style={{ fontSize: 9, color: C.t3, display: 'block', marginBottom: 3 }}>Start</span>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={inputStyle} />
            </label>
            <label>
              <span style={{ fontSize: 9, color: C.t3, display: 'block', marginBottom: 3 }}>End</span>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void handleCreateRun()}
            disabled={runCreating}
            style={{
              background: C.blue,
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              padding: '7px 14px',
              fontSize: 11,
              fontWeight: 700,
              cursor: runCreating ? 'wait' : 'pointer',
              opacity: runCreating ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {runCreating ? 'Creating…' : 'Create pay run'}
          </button>
        </div>

        {runsLoading && runs.length === 0 ? (
          <div style={{ fontSize: 12, color: C.t2, marginBottom: 10 }}>Loading pay runs…</div>
        ) : runs.length === 0 ? (
          <div style={{ fontSize: 12, color: C.t2, marginBottom: 10 }}>No pay runs yet. Create one above.</div>
        ) : (
          runs.slice(0, 8).map((run, i) => {
            const selected = selectedRunId === run.id;
            const generating = generatingRunId === run.id;
            return (
              <div
                key={run.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: i < Math.min(runs.length, 8) - 1 ? `1px solid ${C.bd2}` : 'none',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: selected ? C.blue : C.t }}>
                    {run.periodLabel}
                  </div>
                  <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>
                    {run.periodStart} → {run.periodEnd} · {run.status}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateRun(run.id)}
                  disabled={generating}
                  style={{
                    background: 'rgba(34,197,94,.15)',
                    color: C.green,
                    border: '1px solid rgba(34,197,94,.35)',
                    borderRadius: 8,
                    padding: '7px 12px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: generating ? 'wait' : 'pointer',
                    opacity: generating ? 0.6 : 1,
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Play size={10} />
                  {generating ? 'Generating…' : 'Generate payslips'}
                </button>
              </div>
            );
          })
        )}

        {selectedRunId != null && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: C.t3, marginBottom: 6 }}>
              Payslips for selected run
            </div>
            {runPayslipsLoading ? (
              <div style={{ fontSize: 12, color: C.t2 }}>Loading payslips…</div>
            ) : runPayslips.length === 0 ? (
              <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
                No payslips for this run yet. Click Generate payslips to create and calculate payslips for all employees with a profile.
              </div>
            ) : (
              runPayslips.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: i < runPayslips.length - 1 ? `1px solid ${C.bd2}` : 'none',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.t }}>
                    {employeeNameById.get(p.employeeId) ?? `Employee #${p.employeeId}`}
                  </div>
                  <div style={{ fontSize: 10, color: C.t2 }}>
                    gross {formatPayslipUsd(p.grossPay)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.green }}>
                    {formatPayslipUsd(p.netPay)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
