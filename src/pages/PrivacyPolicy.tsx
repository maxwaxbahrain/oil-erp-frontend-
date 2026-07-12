import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const C = {
  bgMain: '#06080f',
  bgCard: '#0d0f18',
  accent: '#4F6BF4',
  accentLight: '#85B7EB',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.35)',
  border: 'rgba(79,107,244,0.2)',
};

const LAST_UPDATED = 'July 12, 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: C.textPrimary,
          marginBottom: 12,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: C.textSecondary }}>{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
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
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Last updated: {LAST_UPDATED}
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
          Privacy Policy — SOLTOL ONE &amp; SPOD
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textSecondary, marginBottom: 36 }}>
          SOLTOL ONE (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the SOLTOL ONE web platform and the SPOD
          mobile app for field sales and delivery. This policy explains what information we collect, how we use it,
          and the choices available to you.
        </p>

        <div
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '28px 24px',
          }}
        >
          <Section title="What we collect">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li style={{ marginBottom: 10 }}>
                <strong style={{ color: C.textPrimary }}>Account information</strong> — name, email address, and phone
                number when you register or are invited to a tenant account.
              </li>
              <li style={{ marginBottom: 10 }}>
                <strong style={{ color: C.textPrimary }}>Business data you enter</strong> — customers, invoices, orders,
                deliveries, and other operational records you create while using the service.
              </li>
              <li>
                <strong style={{ color: C.textPrimary }}>SPOD app device data</strong> — while you are on active delivery
                duty: location for live delivery tracking, camera access for proof-of-delivery photos, and signatures
                captured at delivery.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            <p style={{ margin: 0 }}>
              We use your information solely to provide, operate, and improve SOLTOL ONE and SPOD. We do{' '}
              <strong style={{ color: C.textPrimary }}>not</strong> sell your personal data and we do{' '}
              <strong style={{ color: C.textPrimary }}>not</strong> use it for third-party advertising.
            </p>
          </Section>

          <Section title="Data storage">
            <p style={{ margin: 0 }}>
              Data is encrypted in transit (HTTPS/TLS) and stored on secure cloud infrastructure hosted in the{' '}
              <strong style={{ color: C.textPrimary }}>United States</strong>.
            </p>
          </Section>

          <Section title="Data retention &amp; deletion">
            <p style={{ margin: 0 }}>
              We retain data for as long as your account is active or as needed to provide the service. You may request
              deletion of your data by contacting{' '}
              <a href="mailto:info@soltol.com" style={{ color: C.accentLight }}>
                info@soltol.com
              </a>
              . We will process verified requests within a reasonable timeframe, subject to legal or contractual retention
              requirements.
            </p>
          </Section>

          <Section title="Permissions the SPOD app requests">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}>
                <strong style={{ color: C.textPrimary }}>Camera</strong> — capture proof-of-delivery photos.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong style={{ color: C.textPrimary }}>Location</strong> — live delivery tracking while on duty.
              </li>
              <li>
                <strong style={{ color: C.textPrimary }}>Storage</strong> — save delivery PDFs and related documents on
                your device.
              </li>
            </ul>
          </Section>

          <Section title="Contact">
            <p style={{ margin: 0 }}>
              Questions about this policy? Email{' '}
              <a href="mailto:info@soltol.com" style={{ color: C.accentLight }}>
                info@soltol.com
              </a>
              .
            </p>
          </Section>
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
