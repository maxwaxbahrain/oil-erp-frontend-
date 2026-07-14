import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CalendarDays, RefreshCw, Search } from 'lucide-react';
import { getCustomers, type Customer } from '../../services/customerService';
import {
  assignRouteCustomer,
  getRouteWeek,
  type RouteWeekResponse,
} from '../../services/routeService';

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  green: '#22C55E',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
  border: 'rgba(255,255,255,.07)',
};

const panel: CSSProperties = {
  background: C.bg2,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
};

const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Unassigned' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
];

type AssignmentRow = {
  visit_day: number | null;
  line_name: string;
};

function formatUsd(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function assignmentMapFromWeek(week: RouteWeekResponse | null): Record<number, AssignmentRow> {
  const map: Record<number, AssignmentRow> = {};
  if (!week) return map;
  for (const day of week.days) {
    for (const c of day.customers) {
      map[c.customer_id] = {
        visit_day: c.visit_day ?? day.visit_day,
        line_name: c.line_name ?? '',
      };
    }
  }
  return map;
}

export default function RoutePlanning() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [week, setWeek] = useState<RouteWeekResponse | null>(null);
  const [assignments, setAssignments] = useState<Record<number, AssignmentRow>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [custRows, weekData] = await Promise.all([getCustomers(), getRouteWeek()]);
      setCustomers(custRows);
      setWeek(weekData);
      setAssignments(assignmentMapFromWeek(weekData));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load route planning data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshWeek = useCallback(async () => {
    const weekData = await getRouteWeek();
    setWeek(weekData);
    setAssignments(assignmentMapFromWeek(weekData));
  }, []);

  const persistAssign = useCallback(
    async (customerId: number, next: AssignmentRow, prev: AssignmentRow) => {
      setSavingIds((s) => new Set(s).add(customerId));
      setAssignments((a) => ({ ...a, [customerId]: next }));
      try {
        await assignRouteCustomer({
          customer_id: customerId,
          visit_day: next.visit_day,
          line_name: next.line_name.trim() || null,
        });
        await refreshWeek();
      } catch (e) {
        setAssignments((a) => ({ ...a, [customerId]: prev }));
        setError(e instanceof Error ? e.message : 'Failed to save assignment');
      } finally {
        setSavingIds((s) => {
          const n = new Set(s);
          n.delete(customerId);
          return n;
        });
      }
    },
    [refreshWeek],
  );

  const handleDayChange = (customerId: number, value: string) => {
    const prev = assignments[customerId] ?? { visit_day: null, line_name: '' };
    const visit_day = value === '' ? null : Number(value);
    const next = { ...prev, visit_day };
    persistAssign(customerId, next, prev);
  };

  const handleLineChange = (customerId: number, line_name: string) => {
    setAssignments((a) => {
      const prev = a[customerId] ?? { visit_day: null, line_name: '' };
      return { ...a, [customerId]: { ...prev, line_name } };
    });
  };

  const handleLineBlur = (customerId: number, line_name: string) => {
    const prev = assignments[customerId] ?? { visit_day: null, line_name: '' };
    if (line_name.trim() === (prev.line_name || '').trim()) return;
    const next = { ...prev, line_name };
    persistAssign(customerId, next, prev);
  };

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [...customers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!q) return rows;
    return rows.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        String(c.phone || '').includes(q),
    );
  }, [customers, search]);

  const weekDays = week?.days ?? [];

  return (
    <div style={{ background: C.bg, minHeight: '100%', color: C.text, padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <CalendarDays size={22} color={C.blue} />
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Route Planning</h1>
          </div>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
            Assign visit days and lines for sales routes. Changes save to the ERP immediately.
            {week?.week_start ? ` · Week of ${week.week_start}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          style={{
            ...panel,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            color: C.muted,
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          <RefreshCw size={14} style={{ opacity: loading ? 0.5 : 1 }} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            ...panel,
            padding: '12px 16px',
            marginBottom: 16,
            borderColor: 'rgba(239,68,68,.35)',
            color: '#FCA5A5',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Week overview */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>
          Week overview
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          {weekDays.map((day) => (
            <div key={day.visit_day} style={{ ...panel, padding: 14, minHeight: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{day.day_name}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{day.total_count}</span>
              </div>
              <p style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
                {day.visited_count} visited · {day.remaining_count} left
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                {day.customers.length === 0 ? (
                  <p style={{ fontSize: 11, color: C.dim, margin: 0 }}>No customers assigned</p>
                ) : (
                  day.customers.map((c) => (
                    <div
                      key={c.customer_id}
                      style={{
                        background: C.bg3,
                        borderRadius: 8,
                        padding: '8px 10px',
                        border: `1px solid ${C.border}`,
                        opacity: c.visited ? 0.75 : 1,
                      }}
                    >
                      <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 4px', textDecoration: c.visited ? 'line-through' : 'none' }}>
                        {c.name}
                      </p>
                      <p style={{ fontSize: 10, color: C.muted, margin: '0 0 2px' }}>Outstanding {formatUsd(c.balance)}</p>
                      {c.line_name ? (
                        <p style={{ fontSize: 10, color: C.blue, margin: 0 }}>{c.line_name}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
        {week && (
          <p style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
            Collected today: {formatUsd(week.collected_today)}
          </p>
        )}
      </section>

      {/* Assignment table */}
      <section>
        <h2 style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>
          Customer assignments
        </h2>
        <div style={{ ...panel, padding: 16 }}>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={16} color={C.dim} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="search"
              placeholder="Search customers by name, address, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px 10px 38px',
                background: C.bg3,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.text,
                fontSize: 13,
              }}
            />
          </div>

          {loading ? (
            <p style={{ color: C.muted, fontSize: 13 }}>Loading customers…</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', color: C.muted, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Customer</th>
                    <th style={{ padding: '10px 12px', color: C.muted, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Outstanding</th>
                    <th style={{ padding: '10px 12px', color: C.muted, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Credit limit</th>
                    <th style={{ padding: '10px 12px', color: C.muted, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Visit day</th>
                    <th style={{ padding: '10px 12px', color: C.muted, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Line / area</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => {
                    const id = Number(c.id);
                    const row = assignments[id] ?? { visit_day: null, line_name: '' };
                    const saving = savingIds.has(id);
                    return (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: '12px', color: C.muted }}>{formatUsd(c.balance ?? 0)}</td>
                        <td style={{ padding: '12px', color: C.muted }}>{formatUsd(c.credit_limit ?? 0)}</td>
                        <td style={{ padding: '12px' }}>
                          <select
                            value={row.visit_day == null ? '' : String(row.visit_day)}
                            disabled={saving}
                            onChange={(e) => handleDayChange(id, e.target.value)}
                            style={{
                              background: C.bg3,
                              border: `1px solid ${C.border}`,
                              borderRadius: 6,
                              color: C.text,
                              padding: '8px 10px',
                              fontSize: 12,
                              minWidth: 130,
                            }}
                          >
                            {DAY_OPTIONS.map((opt) => (
                              <option key={opt.value || 'unassigned'} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input
                            type="text"
                            placeholder="e.g. North line"
                            value={row.line_name}
                            disabled={saving}
                            onChange={(e) => handleLineChange(id, e.target.value)}
                            onBlur={(e) => handleLineBlur(id, e.target.value)}
                            style={{
                              width: '100%',
                              minWidth: 140,
                              boxSizing: 'border-box',
                              background: C.bg3,
                              border: `1px solid ${C.border}`,
                              borderRadius: 6,
                              color: C.text,
                              padding: '8px 10px',
                              fontSize: 12,
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredCustomers.length === 0 && (
                <p style={{ color: C.dim, fontSize: 13, padding: 16, margin: 0 }}>No customers match your search.</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
