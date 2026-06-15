import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CreditCard, Loader2, Settings2 } from 'lucide-react';
import {
  createCheckoutSession,
  createPortalSession,
  extractApiDetail,
  getTenantBilling,
} from './Billing/billingApi';
import PlanCard from './Billing/PlanCard';
import {
  BILLING_PLANS,
  normalizePlanSlug,
  type BillingPlanSlug,
  type TenantBillingInfo,
} from './Billing/billingTypes';

const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 12,
  padding: 20,
};

function subscriptionBadgeStyle(status: string | null): CSSProperties {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'active' || normalized === 'trialing') {
    return {
      background: 'var(--color-badge-green-bg)',
      color: 'var(--color-brand-green)',
      border: '1px solid rgba(34,197,94,0.25)',
    };
  }
  if (normalized === 'past_due' || normalized === 'unpaid') {
    return {
      background: 'var(--color-badge-amber-bg)',
      color: 'var(--color-brand-amber)',
      border: '1px solid rgba(245,158,11,0.25)',
    };
  }
  if (normalized === 'canceled' || normalized === 'cancelled') {
    return {
      background: 'var(--color-badge-red-bg)',
      color: 'var(--color-brand-red)',
      border: '1px solid rgba(239,68,68,0.25)',
    };
  }
  return {
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--color-redwood-text-muted)',
    border: '1px solid var(--color-redwood-border)',
  };
}

export default function BillingPage() {
  const [info, setInfo] = useState<TenantBillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyPlan, setBusyPlan] = useState<BillingPlanSlug | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  const loadBilling = useCallback(async () => {
    setError('');
    try {
      const data = await getTenantBilling();
      setInfo(data);
    } catch (err) {
      setInfo(null);
      setError(extractApiDetail(err, 'Could not load billing information for this account.'));
    }
  }, []);

  useEffect(() => {
    loadBilling().finally(() => setLoading(false));
  }, [loadBilling]);

  const handleSubscribe = async (plan: BillingPlanSlug) => {
    setActionError('');
    setBusyPlan(plan);
    try {
      await createCheckoutSession(plan);
    } catch (err) {
      setActionError(extractApiDetail(err, 'Could not start checkout.'));
      setBusyPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setActionError('');
    setPortalBusy(true);
    try {
      await createPortalSession();
    } catch (err) {
      setActionError(extractApiDetail(err, 'Could not open the billing portal.'));
      setPortalBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--color-redwood-text-muted)' }}>
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div style={{ ...panel, color: 'var(--color-redwood-text-muted)', maxWidth: 960 }}>
        {error || 'No tenant billing profile found.'}
      </div>
    );
  }

  const trialActive = info.plan === 'trial' && !info.is_trial_expired;
  const currentPaidPlan = normalizePlanSlug(info.plan);
  const statusLabel = info.subscription_status ?? 'none';

  return (
    <div
      style={{
        maxWidth: 960,
        color: 'var(--color-redwood-text-main)',
        fontFamily: 'var(--font-inter)',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginBottom: 4 }}>Settings / Billing</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
          <Building2 size={20} color="var(--color-brand-blue)" />
          Billing &amp; plan
        </h1>
      </div>

      {info.is_trial_expired && (
        <div
          style={{
            background: 'var(--color-badge-red-bg)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <AlertTriangle size={18} color="var(--color-brand-red)" />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-brand-red-tint)', marginBottom: 4 }}>Trial expired</div>
            <div style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)' }}>
              Your free trial has ended. Subscribe to a plan to continue using AI features and full ERP access.
            </div>
          </div>
        </div>
      )}

      {trialActive && (
        <div
          style={{
            background: 'var(--color-badge-green-bg)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            color: 'var(--color-brand-green-tint)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {info.days_left} day{info.days_left === 1 ? '' : 's'} remaining on your free trial
        </div>
      )}

      <div style={{ ...panel, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          <Stat label="Company" value={info.company_name} />
          <Stat label="Plan" value={info.plan} />
          <Stat
            label="Subscription"
            value={
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  padding: '3px 8px',
                  borderRadius: 999,
                  ...subscriptionBadgeStyle(info.subscription_status),
                }}
              >
                {statusLabel}
              </span>
            }
          />
          <Stat label="AI tokens used" value={info.ai_tokens_used.toLocaleString()} />
          <Stat label="AI cost (USD)" value={`$${info.ai_cost_usd.toFixed(4)}`} />
        </div>
      </div>

      {info.has_active_subscription && (
        <div style={{ ...panel, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Settings2 size={18} color="var(--color-brand-blue)" />
            <span style={{ fontWeight: 600 }}>Manage subscription</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-redwood-text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Update payment method, view invoices, or change your plan in the Stripe customer portal.
          </p>
          <button
            type="button"
            onClick={handleManageSubscription}
            disabled={portalBusy || busyPlan !== null}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid rgba(79,142,247,0.35)',
              background: 'var(--color-badge-blue-bg)',
              color: 'var(--color-brand-blue)',
              fontSize: 13,
              fontWeight: 600,
              cursor: portalBusy || busyPlan !== null ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {portalBusy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Opening portal…
              </>
            ) : (
              'Manage subscription'
            )}
          </button>
        </div>
      )}

      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <CreditCard size={18} color="var(--color-brand-amber)" />
          <span style={{ fontWeight: 600 }}>Choose a plan</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-redwood-text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Subscribe securely via Stripe. You will be redirected to complete payment.
        </p>

        {actionError && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--color-badge-red-bg)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--color-brand-red-tint)',
              fontSize: 12,
            }}
          >
            {actionError}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginBottom: 16,
          }}
        >
          {BILLING_PLANS.map(plan => (
            <PlanCard
              key={plan.slug}
              label={plan.label}
              monthlyUsd={plan.monthlyUsd}
              userCap={plan.userCap}
              planSlug={plan.slug}
              isCurrent={currentPaidPlan === plan.slug}
              isBusy={busyPlan === plan.slug}
              onSubscribe={handleSubscribe}
            />
          ))}
        </div>

        <p style={{ margin: 0, fontSize: 11, color: 'var(--color-redwood-text-subtle)' }}>
          <Link to="/settings" style={{ color: 'var(--color-brand-blue)' }}>
            ← Back to settings
          </Link>
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--color-redwood-text-subtle)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{value}</div>
    </div>
  );
}
