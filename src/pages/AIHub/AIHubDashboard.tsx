import { useEffect } from 'react';
import { useTracking } from '../../hooks/useTracking';

export default function AIHubDashboard() {
  const { trackPage } = useTracking();

  useEffect(() => {
    trackPage('ai_hub');
  }, [trackPage]);

  return (
    <div style={{ padding: 12, paddingBottom: 80 }}>
      <div
        style={{
          background: 'var(--color-redwood-bg-surface)',
          border: '1px solid var(--color-redwood-border)',
          borderRadius: 14,
          padding: '28px 24px',
          color: 'var(--color-redwood-text-main)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "'Syne', sans-serif",
          }}
        >
          AI Hub metrics not available yet
        </h1>
        <p
          style={{
            margin: '10px 0 0',
            maxWidth: 680,
            color: 'var(--color-redwood-text-muted)',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          This dashboard previously showed demo AI KPIs, forecast accuracy, agent performance, and
          demand bars without a real backend data source. Those fabricated metrics are hidden until
          live AI telemetry and report endpoints are connected.
        </p>
        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
          }}
        >
          {[
            'Forecast accuracy',
            'Agent performance',
            'Automation activity',
            'Demand forecast',
          ].map((label) => (
            <div
              key={label}
              style={{
                background: 'var(--color-redwood-row-bg)',
                border: '1px solid var(--color-redwood-border)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-redwood-text-main)', marginTop: 6 }}>—</div>
              <div style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', marginTop: 4 }}>No live source connected</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
