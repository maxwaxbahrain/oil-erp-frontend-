import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Percent, RefreshCw } from 'lucide-react';
import {
  calculateAll,
  formatCommissionUsd,
  getCommissionRecords,
  getCommissionRules,
  getCommissionSummary,
  type CommissionRecord,
  type CommissionRule,
  type CommissionSummaryRow,
} from '../../services/commissionService';

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

interface CommissionAdminProps {
  employees: PortalEmployee[];
  onToast: (message: string) => void;
  onError: (message: string) => void;
}

export default function CommissionAdmin({ employees, onToast, onError }: CommissionAdminProps) {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [summary, setSummary] = useState<CommissionSummaryRow[]>([]);
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const employeeNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of employees) map.set(Number(e.id), e.name);
    return map;
  }, [employees]);

  const activeRules = useMemo(
    () => rules.filter((r) => r.isActive),
    [rules],
  );

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
      const [rulesRows, summaryRows, recordRows] = await Promise.all([
        getCommissionRules(),
        getCommissionSummary(),
        getCommissionRecords(),
      ]);
      setRules(rulesRows);
      setSummary(summaryRows);
      setRecords(recordRows);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load commission data');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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
          No commission rules set yet — add per-salesman rates via the API (S2b rule editor coming soon).
          Recalculate all will only process invoices that have a salesman and an active rule.
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
                {rec.ruleType} @ {rec.rate}
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
