import type { CSSProperties } from 'react';
import type { HomeMetricBlock, HomeSummary, MetricSeverity } from './homeSummaryApi';

const BLUE = '#4F8EF7';

const TAG_COLOR: Record<MetricSeverity, string> = {
  action: '#F87171',
  watch: '#FBBF24',
  good: '#22c55e',
};

export type TopMetricDef = {
  id: keyof Pick<
    HomeSummary,
    'owed_to_us' | 'expenses_to_approve' | 'stock' | 'cash_and_bank' | 'sales_today' | 'profit_month'
  >;
  label: string;
  formatValue: (block: HomeMetricBlock) => string;
};

export const TOP_METRIC_DEFS: TopMetricDef[] = [
  {
    id: 'owed_to_us',
    label: 'Owed to us',
    formatValue: (b) =>
      typeof b.value === 'number' ? `$${Math.round(b.value).toLocaleString('en-US')}` : String(b.value ?? ''),
  },
  {
    id: 'expenses_to_approve',
    label: 'Expenses to approve',
    formatValue: (b) => String(b.value ?? ''),
  },
  {
    id: 'stock',
    label: 'Stock',
    formatValue: (b) => (typeof b.value === 'number' ? `${b.value} out` : String(b.value ?? '')),
  },
  {
    id: 'cash_and_bank',
    label: 'Cash & bank',
    formatValue: (b) =>
      typeof b.value === 'number' ? `$${Math.round(b.value).toLocaleString('en-US')}` : String(b.value ?? ''),
  },
  {
    id: 'sales_today',
    label: 'Sales today',
    formatValue: (b) =>
      typeof b.value === 'number' ? `$${Math.round(b.value).toLocaleString('en-US')}` : String(b.value ?? ''),
  },
  {
    id: 'profit_month',
    label: 'Profit (month)',
    formatValue: (b) =>
      typeof b.value === 'number' ? `$${Math.round(b.value).toLocaleString('en-US')}` : String(b.value ?? ''),
  },
];

/** Visible tiles only (hide unavailable). */
export function visibleTopMetrics(summary: HomeSummary | null): Array<TopMetricDef & { block: HomeMetricBlock }> {
  if (!summary) return [];
  return TOP_METRIC_DEFS.map((def) => ({ ...def, block: summary[def.id] as HomeMetricBlock })).filter(
    (row) => row.block.state !== 'unavailable',
  );
}

type Props = {
  summary: HomeSummary | null;
  onRetry?: (id: TopMetricDef['id']) => void;
};

export default function NexusTopMetrics({ summary, onRetry }: Props) {
  const rows = visibleTopMetrics(summary);
  if (rows.length === 0) return null;

  return (
    <div style={row} data-testid="nexus-top-metrics">
      {rows.map(({ id, label, block, formatValue }) => {
        const isError = block.state === 'error';
        const severity = block.severity || (isError ? 'action' : 'good');
        const border = TAG_COLOR[severity];
        const tag = isError ? 'ACTION' : severity.toUpperCase();
        const valueText = isError ? "Couldn't load" : formatValue(block);
        const sentence = isError ? "Couldn't load" : block.sentence || '';

        return (
          <div
            key={id}
            data-metric={id}
            data-state={block.state}
            style={{
              ...tile,
              borderTop: `3px solid ${border}`,
            }}
          >
            <div style={tileHead}>
              <span style={tileLabel}>{label}</span>
              <span style={{ ...tagStyle, color: border, borderColor: `${border}66` }}>{tag}</span>
            </div>
            <div style={tileValue}>{valueText}</div>
            <div style={tileSentence}>{sentence}</div>
            {isError && onRetry ? (
              <button type="button" style={retryBtn} onClick={() => onRetry(id)}>
                Retry
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: 10,
  marginBottom: 18,
};

const tile: CSSProperties = {
  background: 'rgba(15,23,42,0.92)',
  borderRadius: 10,
  padding: '12px 14px',
  border: '1px solid rgba(148,163,184,0.12)',
  minHeight: 108,
};

const tileHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
};
const tileLabel: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.04em' };
const tagStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.12em',
  border: '1px solid',
  borderRadius: 4,
  padding: '2px 5px',
};
const tileValue: CSSProperties = { fontSize: 22, fontWeight: 800, color: '#F8FAFC', lineHeight: 1.15 };
const tileSentence: CSSProperties = { marginTop: 6, fontSize: 12, color: '#94A3B8', lineHeight: 1.35 };
const retryBtn: CSSProperties = {
  marginTop: 10,
  background: 'transparent',
  border: `1px solid ${BLUE}`,
  color: BLUE,
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};
