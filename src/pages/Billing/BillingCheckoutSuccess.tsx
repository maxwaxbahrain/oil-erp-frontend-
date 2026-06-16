import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { extractApiDetail, getTenantBilling } from './billingApi';
import {
  isActiveSubscriptionStatus,
  normalizePlanSlug,
  type TenantBillingInfo,
} from './billingTypes';

const panel = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 12,
  padding: 24,
  maxWidth: 560,
};

const POLL_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function BillingCheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [info, setInfo] = useState<TenantBillingInfo | null>(null);
  const [finalizing, setFinalizing] = useState(true);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function loadWithPoll() {
      setFinalizing(true);
      setError('');

      try {
        let latest = await getTenantBilling();

        for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
          if (!mountedRef.current) return;

          if (isActiveSubscriptionStatus(latest.subscription_status)) {
            setInfo(latest);
            setFinalizing(false);
            return;
          }

          if (attempt < POLL_ATTEMPTS - 1) {
            await sleep(POLL_INTERVAL_MS);
            if (!mountedRef.current) return;
            latest = await getTenantBilling();
          }
        }

        setInfo(latest);
        setFinalizing(false);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(extractApiDetail(err, 'Could not confirm your subscription status.'));
        setFinalizing(false);
      }
    }

    void loadWithPoll();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const planLabel = normalizePlanSlug(info?.plan) ?? info?.plan ?? '—';
  const statusLabel = info?.subscription_status ?? 'pending';

  return (
    <div style={{ maxWidth: 640, color: 'var(--color-redwood-text-main)', fontFamily: 'var(--font-inter)' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginBottom: 4 }}>Billing / Success</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Checkout complete</h1>
      </div>

      <div style={panel}>
        {finalizing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--color-redwood-text-muted)' }}>
            <Loader2 size={22} className="animate-spin" color="var(--color-brand-blue)" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 4 }}>
                Finalizing your subscription…
              </div>
              <div style={{ fontSize: 12 }}>Waiting for Stripe to sync with your account.</div>
            </div>
          </div>
        ) : error ? (
          <div style={{ color: 'var(--color-brand-red-tint)', fontSize: 13 }}>{error}</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <CheckCircle2 size={24} color="var(--color-brand-green)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Thank you — your payment was received.</div>
                <div style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5 }}>
                  Plan: <strong style={{ color: 'var(--color-redwood-text-main)' }}>{planLabel}</strong>
                  {' · '}
                  Status: <strong style={{ color: 'var(--color-redwood-text-main)' }}>{statusLabel}</strong>
                </div>
                {!isActiveSubscriptionStatus(info?.subscription_status) && (
                  <div style={{ fontSize: 11, color: 'var(--color-brand-amber)', marginTop: 8 }}>
                    Subscription is still syncing. Refresh billing in a moment if status has not updated.
                  </div>
                )}
              </div>
            </div>
            {sessionId && (
              <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', wordBreak: 'break-all' }}>
                Session: {sessionId}
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/settings/billing"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 14px',
              borderRadius: 8,
              background: 'var(--color-brand-blue)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Back to billing
          </Link>
          <Link
            to="/dashboard"
            style={{
              fontSize: 13,
              color: 'var(--color-brand-blue)',
              textDecoration: 'none',
              alignSelf: 'center',
            }}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
