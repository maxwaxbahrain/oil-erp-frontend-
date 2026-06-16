import { Loader2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { BillingPlanSlug } from './billingTypes';

interface PlanCardProps {
  label: string;
  monthlyUsd: number;
  userCap: string;
  planSlug: BillingPlanSlug;
  isCurrent: boolean;
  isBusy: boolean;
  onSubscribe: (plan: BillingPlanSlug) => void;
}

const cardBase: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 12,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minHeight: 220,
};

export default function PlanCard({
  label,
  monthlyUsd,
  userCap,
  planSlug,
  isCurrent,
  isBusy,
  onSubscribe,
}: PlanCardProps) {
  return (
    <div
      style={{
        ...cardBase,
        borderColor: isCurrent ? 'rgba(79,142,247,0.45)' : 'var(--color-redwood-border)',
        boxShadow: isCurrent ? '0 0 0 1px rgba(79,142,247,0.2)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--color-redwood-text-main)',
          }}
        >
          {label}
        </div>
        {isCurrent && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '3px 8px',
              borderRadius: 999,
              background: 'var(--color-badge-blue-bg)',
              color: 'var(--color-brand-blue)',
            }}
          >
            Current plan
          </span>
        )}
      </div>

      <div>
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--color-brand-blue)',
          }}
        >
          ${monthlyUsd}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)', marginLeft: 4 }}>/ month</span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)' }}>{userCap}</div>

      <button
        type="button"
        disabled={isCurrent || isBusy}
        onClick={() => onSubscribe(planSlug)}
        style={{
          marginTop: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 8,
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          cursor: isCurrent || isBusy ? 'not-allowed' : 'pointer',
          background: isCurrent || isBusy ? 'rgba(79,142,247,0.35)' : 'var(--color-brand-blue)',
          color: '#fff',
          fontFamily: 'inherit',
        }}
      >
        {isBusy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Redirecting…
          </>
        ) : isCurrent ? (
          'Current plan'
        ) : (
          'Subscribe'
        )}
      </button>
    </div>
  );
}
