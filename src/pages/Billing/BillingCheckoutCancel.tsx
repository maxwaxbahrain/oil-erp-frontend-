import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const panel = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 12,
  padding: 24,
  maxWidth: 560,
};

export default function BillingCheckoutCancel() {
  return (
    <div style={{ maxWidth: 640, color: 'var(--color-redwood-text-main)', fontFamily: 'var(--font-inter)' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginBottom: 4 }}>Billing / Canceled</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Checkout canceled</h1>
      </div>

      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <XCircle size={24} color="var(--color-brand-amber)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No changes were made</div>
            <div style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5 }}>
              You left Stripe Checkout before completing payment. Your plan is unchanged.
            </div>
          </div>
        </div>

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
          Return to billing
        </Link>
      </div>
    </div>
  );
}
