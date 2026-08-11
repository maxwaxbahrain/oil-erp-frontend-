import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export const LEGAL_COLORS = {
  bgMain: '#06080f',
  bgCard: '#0d0f18',
  accent: '#4F6BF4',
  accentLight: '#85B7EB',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.35)',
  border: 'rgba(79,107,244,0.2)',
};

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: LEGAL_COLORS.textPrimary,
          marginBottom: 12,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: LEGAL_COLORS.textSecondary }}>{children}</div>
    </section>
  );
}

export function LegalSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: LEGAL_COLORS.textPrimary,
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: LEGAL_COLORS.textSecondary }}>{children}</div>
    </div>
  );
}

export function LegalBulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
      {items.map((item, index) => (
        <li key={index} style={{ marginBottom: 10 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

interface LegalDocumentLayoutProps {
  title: string;
  intro: ReactNode;
  children: ReactNode;
}

export default function LegalDocumentLayout({ title, intro, children }: LegalDocumentLayoutProps) {
  const C = LEGAL_COLORS;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bgMain,
        color: C.textPrimary,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: `1px solid ${C.border}`,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: C.textPrimary,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: C.accent,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            S
          </div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>SOLTOL ONE</span>
        </Link>
        <Link
          to="/login"
          style={{
            fontSize: 13,
            color: C.accentLight,
            textDecoration: 'none',
          }}
        >
          Sign in
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 64px' }}>
        <p
          style={{
            fontSize: 12,
            color: C.textMuted,
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Effective date: July 27, 2026
          <br />
          Last updated: July 27, 2026
        </p>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 12,
            letterSpacing: '-0.02em',
            lineHeight: 1.25,
          }}
        >
          {title}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textSecondary, marginBottom: 36 }}>{intro}</p>

        <div
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '28px 24px',
          }}
        >
          {children}
        </div>

        <p style={{ marginTop: 32, fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
          <Link to="/" style={{ color: C.accentLight, textDecoration: 'none' }}>
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
