import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ADVISOR_URL } from '../../constants/advisor';

interface AdvisorDockProps {
  open: boolean;
  onClose: () => void;
}

export default function AdvisorDock({ open, onClose }: AdvisorDockProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          zIndex: 210,
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="SOLTOL AI Advisor"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          maxWidth: '100vw',
          zIndex: 211,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-redwood-bg-surface)',
          borderLeft: '1px solid var(--color-redwood-border)',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.35)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.2s ease-out',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-redwood-border)',
            background: 'var(--color-redwood-midnight)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-redwood-text-main)',
            }}
          >
            AI Advisor
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Advisor"
            title="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: '1px solid var(--color-redwood-border)',
              background: 'transparent',
              color: 'var(--color-redwood-text-muted)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={18} />
          </button>
        </header>
        <iframe
          src={ADVISOR_URL}
          title="SOLTOL AI Advisor"
          allow="clipboard-write; clipboard-read"
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      </aside>
    </>
  );
}
