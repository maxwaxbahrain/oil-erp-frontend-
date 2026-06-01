import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { PanelLeft, PanelRight, X } from 'lucide-react';
import {
  ADVISOR_URL,
  clampAdvisorWidth,
  loadAdvisorSide,
  loadAdvisorWidth,
  saveAdvisorSide,
  saveAdvisorWidth,
  type AdvisorSide,
} from '../../constants/advisor';

export interface AdvisorLayout {
  width: number;
  side: AdvisorSide;
}

interface AdvisorDockProps {
  open: boolean;
  onClose: () => void;
  onLayoutChange?: (layout: AdvisorLayout) => void;
}

export default function AdvisorDock({ open, onClose, onLayoutChange }: AdvisorDockProps) {
  const [width, setWidth] = useState(loadAdvisorWidth);
  const [side, setSide] = useState<AdvisorSide>(loadAdvisorSide);
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const emitLayout = useCallback(
    (layout: AdvisorLayout) => {
      onLayoutChange?.(layout);
    },
    [onLayoutChange],
  );

  useEffect(() => {
    if (open) emitLayout({ width, side });
  }, [open, width, side, emitLayout]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const onResize = () => {
      setWidth((current) => {
        const next = clampAdvisorWidth(current);
        if (next !== current) saveAdvisorWidth(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (e: MouseEvent) => {
      const start = resizeRef.current;
      if (!start) return;

      const delta =
        side === 'right' ? start.startX - e.clientX : e.clientX - start.startX;
      const next = clampAdvisorWidth(start.startWidth + delta);
      setWidth(next);
    };

    const onUp = () => {
      setResizing(false);
      resizeRef.current = null;
      setWidth((current) => {
        saveAdvisorWidth(current);
        return current;
      });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, side]);

  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: width };
    setResizing(true);
  };

  const toggleSide = () => {
    setSide((current) => {
      const next = current === 'right' ? 'left' : 'right';
      saveAdvisorSide(next);
      return next;
    });
  };

  if (!open) return null;

  const handleOnErpEdge = side === 'right' ? 'left' : 'right';
  const panelBorderSide =
    side === 'right'
      ? { borderLeft: '1px solid var(--color-redwood-border)' }
      : { borderRight: '1px solid var(--color-redwood-border)' };

  return (
    <aside
      role="complementary"
      aria-label="SOLTOL AI Advisor"
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: `${width}px`,
        maxWidth: '80vw',
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-redwood-bg-surface)',
        boxShadow:
          side === 'right'
            ? '-4px 0 16px rgba(0, 0, 0, 0.18)'
            : '4px 0 16px rgba(0, 0, 0, 0.18)',
        transition: resizing ? 'none' : 'left 0.2s ease-out, right 0.2s ease-out',
        ...panelBorderSide,
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI Advisor panel"
        onMouseDown={startResize}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [handleOnErpEdge]: 0,
          width: '6px',
          cursor: 'col-resize',
          zIndex: 1,
          background: resizing ? 'var(--color-redwood-border)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!resizing) e.currentTarget.style.background = 'var(--color-redwood-border)';
        }}
        onMouseLeave={(e) => {
          if (!resizing) e.currentTarget.style.background = 'transparent';
        }}
      />
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={toggleSide}
            aria-label={side === 'right' ? 'Move panel to left' : 'Move panel to right'}
            title={side === 'right' ? 'Dock left' : 'Dock right'}
            style={headerButtonStyle}
          >
            {side === 'right' ? <PanelLeft size={16} /> : <PanelRight size={16} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Advisor"
            title="Close"
            style={headerButtonStyle}
          >
            <X size={18} />
          </button>
        </div>
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
  );
}

const headerButtonStyle: CSSProperties = {
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
};
