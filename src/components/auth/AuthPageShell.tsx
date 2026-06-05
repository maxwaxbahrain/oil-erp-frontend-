import type { ReactNode } from 'react';

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthPageShell({ title, subtitle, children, footer }: AuthPageShellProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 font-inter antialiased"
      style={{ background: 'var(--auth-page-bg)', color: 'var(--auth-text)' }}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: 'var(--auth-card-bg)',
          border: '1px solid var(--auth-card-border)',
          borderRadius: '16px',
          padding: '40px 36px',
        }}
      >
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <div
              className="flex items-center justify-center"
              style={{
                width: '44px',
                height: '44px',
                background: 'var(--auth-brand)',
                borderRadius: '11px',
                fontFamily: "'Syne', sans-serif",
                fontSize: '24px',
                fontWeight: 500,
                color: 'var(--auth-text)',
              }}
            >
              S
            </div>
            <span
              className="font-semibold"
              style={{ fontSize: '20px', color: 'var(--auth-text)', fontFamily: "'Syne', sans-serif" }}
            >
              SOLTOL
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--auth-accent)',
                background: 'var(--auth-badge-bg)',
                border: '1px solid var(--auth-badge-border)',
                padding: '2px 8px',
                borderRadius: '5px',
              }}
            >
              ONE
            </span>
          </div>
          <h1
            className="mt-3 font-semibold"
            style={{ fontSize: '18px', color: 'var(--auth-text)', fontFamily: "'Syne', sans-serif" }}
          >
            {title}
          </h1>
          <p className="mt-2" style={{ fontSize: '14px', color: 'var(--auth-text-muted)' }}>
            {subtitle}
          </p>
        </div>

        {children}

        {footer}

        <div className="mt-6 text-center">
          <p style={{ fontSize: '13px', color: 'var(--auth-text-footer)', fontWeight: 500 }}>SOLTOL ONE</p>
          <p style={{ fontSize: '12px', color: 'var(--auth-text-footer-muted)' }}>Built in the United States</p>
          <p style={{ fontSize: '12px', color: 'var(--auth-text-footer-muted)' }}>Built for the world</p>
        </div>
      </div>
    </div>
  );
}
