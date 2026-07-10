import type { CSSProperties } from 'react';
import { Lock, X } from 'lucide-react';

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  blue: '#4F8EF7',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
} as const;

const SUPPORT_EMAIL = 'info@soltol.com';

const cardStyle: CSSProperties = {
  background: C.bg2,
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 14,
  padding: '36px 32px',
  maxWidth: 480,
  width: '100%',
  textAlign: 'center',
};

export default function SubscriptionRequired() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'min(70vh, 560px)',
        padding: '32px 24px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={cardStyle}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'rgba(79,142,247,.12)',
            border: '1px solid rgba(79,142,247,.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Lock size={28} color={C.blue} strokeWidth={2} />
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: C.text,
            fontFamily: "'Syne', sans-serif",
            letterSpacing: '-0.02em',
          }}
        >
          This feature requires a subscription
        </h1>
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 14,
            lineHeight: 1.6,
            color: C.muted,
          }}
        >
          Contact our team to unlock premium features.
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          style={{
            display: 'inline-block',
            marginTop: 20,
            fontSize: 15,
            fontWeight: 600,
            color: C.blue,
            textDecoration: 'none',
          }}
        >
          {SUPPORT_EMAIL}
        </a>
        <p
          style={{
            margin: '16px 0 0',
            fontSize: 12,
            color: C.dim,
          }}
        >
          Subscription required — contact {SUPPORT_EMAIL}
        </p>
      </div>
    </div>
  );
}

interface SubscriptionRequiredDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SubscriptionRequiredDialog({ open, onClose }: SubscriptionRequiredDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Subscription required"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(6,15,28,.72)',
        fontFamily: "'DM Sans', sans-serif",
      }}
      onClick={onClose}
    >
      <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(255,255,255,.06)',
            color: C.muted,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <X size={16} />
        </button>
        <div style={{ ...cardStyle, boxShadow: '0 24px 48px rgba(0,0,0,.45)' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(79,142,247,.12)',
              border: '1px solid rgba(79,142,247,.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Lock size={22} color={C.blue} strokeWidth={2} />
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: C.text,
              fontFamily: "'Syne', sans-serif",
            }}
          >
            Subscription required
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: C.muted }}>
            Contact our team to unlock premium features.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{
              display: 'inline-block',
              marginTop: 16,
              fontSize: 14,
              fontWeight: 600,
              color: C.blue,
              textDecoration: 'none',
            }}
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </div>
  );
}

export function LockedNavIcon() {
  return (
    <Lock
      size={14}
      className="flex-shrink-0 opacity-70"
      style={{ color: '#F59E0B' }}
      aria-hidden
    />
  );
}
