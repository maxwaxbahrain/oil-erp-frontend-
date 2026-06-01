import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { PanelLeft, PanelRight, X } from 'lucide-react';
import {
  ADVISOR_URL,
  ADVISOR_TRANSITION,
  ADVISOR_TRANSITION_MS,
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
  shellRef: RefObject<HTMLElement | null>;
  onLayoutChange?: (layout: AdvisorLayout) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startWidth: number;
}

function applyShellMargin(
  shell: HTMLElement,
  side: AdvisorSide,
  width: number,
  transition: 'none' | 'animated',
) {
  shell.style.transition =
    transition === 'none'
      ? 'none'
      : `margin-left ${ADVISOR_TRANSITION}, margin-right ${ADVISOR_TRANSITION}`;
  shell.style.marginLeft = side === 'left' ? `${width}px` : '0px';
  shell.style.marginRight = side === 'right' ? `${width}px` : '0px';
  shell.style.willChange =
    transition === 'none' ? 'margin-left, margin-right' : 'margin-left, margin-right';
}

function clearShellMargin(shell: HTMLElement) {
  shell.style.marginLeft = '';
  shell.style.marginRight = '';
  shell.style.transition = '';
  shell.style.willChange = '';
}

function applyPanelGeometry(
  panel: HTMLElement,
  side: AdvisorSide,
  width: number,
  transition: 'none' | 'animated',
) {
  panel.style.transition =
    transition === 'none'
      ? 'none'
      : `width ${ADVISOR_TRANSITION}, left ${ADVISOR_TRANSITION}, right ${ADVISOR_TRANSITION}`;
  panel.style.width = `${width}px`;
  panel.style.left = side === 'left' ? '0' : 'auto';
  panel.style.right = side === 'right' ? '0' : 'auto';
  panel.style.willChange =
    transition === 'none' ? 'width, left, right' : 'width, left, right';
}

function clearPanelMotionHints(panel: HTMLElement) {
  panel.style.willChange = '';
}

export default function AdvisorDock({
  open,
  onClose,
  shellRef,
  onLayoutChange,
}: AdvisorDockProps) {
  const [width, setWidth] = useState(loadAdvisorWidth);
  const [side, setSide] = useState<AdvisorSide>(loadAdvisorSide);
  const [isRendered, setIsRendered] = useState(open);
  const [isDragging, setIsDragging] = useState(false);

  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pendingWidthRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const sideRef = useRef(side);
  const widthRef = useRef(width);
  const openRef = useRef(open);

  sideRef.current = side;
  widthRef.current = width;
  openRef.current = open;

  const commitLayout = useCallback(
    (layout: AdvisorLayout) => {
      onLayoutChange?.(layout);
    },
    [onLayoutChange],
  );

  const flushDragFrame = useCallback(() => {
    rafRef.current = null;
    const nextWidth = pendingWidthRef.current;
    if (nextWidth == null) return;

    const shell = shellRef.current;
    const panel = panelRef.current;
    if (shell) applyShellMargin(shell, sideRef.current, nextWidth, 'none');
    if (panel) applyPanelGeometry(panel, sideRef.current, nextWidth, 'none');
  }, [shellRef]);

  const scheduleDragFrame = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(flushDragFrame);
  }, [flushDragFrame]);

  const computeDragWidth = useCallback((clientX: number) => {
    const drag = dragRef.current;
    if (!drag) return widthRef.current;

    const delta =
      sideRef.current === 'right'
        ? drag.startX - clientX
        : clientX - drag.startX;
    return clampAdvisorWidth(drag.startWidth + delta);
  }, []);

  const finishDrag = useCallback(
    (target: HTMLElement, pointerId: number) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const finalWidth = pendingWidthRef.current ?? widthRef.current;
      pendingWidthRef.current = null;
      dragRef.current = null;
      setIsDragging(false);

      setWidth(finalWidth);
      saveAdvisorWidth(finalWidth);
      commitLayout({ width: finalWidth, side: sideRef.current });

      const shell = shellRef.current;
      const panel = panelRef.current;
      if (shell) {
        applyShellMargin(shell, sideRef.current, finalWidth, 'animated');
        window.setTimeout(() => {
          if (!dragRef.current && shellRef.current === shell) {
            shell.style.willChange = '';
          }
        }, ADVISOR_TRANSITION_MS);
      }
      if (panel) {
        applyPanelGeometry(panel, sideRef.current, finalWidth, 'animated');
        window.setTimeout(() => {
          if (!dragRef.current && panelRef.current === panel) {
            clearPanelMotionHints(panel);
          }
        }, ADVISOR_TRANSITION_MS);
      }

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    },
    [commitLayout, shellRef],
  );

  useEffect(() => {
    if (open) {
      setIsRendered(true);
      return;
    }

    if (!isRendered) return;

    const shell = shellRef.current;
    const panel = panelRef.current;
    if (shell) applyShellMargin(shell, sideRef.current, 0, 'animated');
    if (panel) applyPanelGeometry(panel, sideRef.current, 0, 'animated');

    const timer = window.setTimeout(() => {
      setIsRendered(false);
      if (shellRef.current) clearShellMargin(shellRef.current);
      if (panelRef.current) {
        panelRef.current.style.transition = '';
        clearPanelMotionHints(panelRef.current);
      }
    }, ADVISOR_TRANSITION_MS);

    return () => window.clearTimeout(timer);
  }, [open, isRendered, shellRef]);

  useEffect(() => {
    if (!open || !isRendered) return;

    const shell = shellRef.current;
    const panel = panelRef.current;
    if (!shell || !panel) return;

    applyShellMargin(shell, sideRef.current, 0, 'none');
    applyPanelGeometry(panel, sideRef.current, 0, 'none');

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!openRef.current) return;
        applyShellMargin(shell, sideRef.current, widthRef.current, 'animated');
        applyPanelGeometry(panel, sideRef.current, widthRef.current, 'animated');
        commitLayout({ width: widthRef.current, side: sideRef.current });

        window.setTimeout(() => {
          if (openRef.current && shellRef.current === shell) {
            shell.style.willChange = '';
          }
          if (openRef.current && panelRef.current === panel) {
            clearPanelMotionHints(panel);
          }
        }, ADVISOR_TRANSITION_MS);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [open, isRendered, commitLayout, shellRef]);

  useEffect(() => {
    if (!open || isDragging) return;

    const onResize = () => {
      const next = clampAdvisorWidth(widthRef.current);
      if (next === widthRef.current) return;

      setWidth(next);
      saveAdvisorWidth(next);
      commitLayout({ width: next, side: sideRef.current });

      const shell = shellRef.current;
      const panel = panelRef.current;
      if (shell) applyShellMargin(shell, sideRef.current, next, 'none');
      if (panel) applyPanelGeometry(panel, sideRef.current, next, 'none');
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, isDragging, commitLayout, shellRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    },
    [],
  );

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!open || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startWidth: widthRef.current,
    };
    pendingWidthRef.current = widthRef.current;
    setIsDragging(true);

    const shell = shellRef.current;
    const panel = panelRef.current;
    if (shell) applyShellMargin(shell, sideRef.current, widthRef.current, 'none');
    if (panel) applyPanelGeometry(panel, sideRef.current, widthRef.current, 'none');

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const onResizePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    pendingWidthRef.current = computeDragWidth(e.clientX);
    scheduleDragFrame();
  };

  const onResizePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    finishDrag(e.currentTarget, e.pointerId);
  };

  const toggleSide = () => {
    if (!open || isDragging) return;

    const nextSide: AdvisorSide = sideRef.current === 'right' ? 'left' : 'right';
    setSide(nextSide);
    sideRef.current = nextSide;
    saveAdvisorSide(nextSide);
    commitLayout({ width: widthRef.current, side: nextSide });

    const shell = shellRef.current;
    const panel = panelRef.current;
    if (shell) applyShellMargin(shell, nextSide, widthRef.current, 'animated');
    if (panel) applyPanelGeometry(panel, nextSide, widthRef.current, 'animated');

    window.setTimeout(() => {
      if (shellRef.current === shell) shell?.style.setProperty('will-change', '');
      if (panelRef.current === panel) clearPanelMotionHints(panel!);
    }, ADVISOR_TRANSITION_MS);
  };

  if (!isRendered) return null;

  const handleOnErpEdge = side === 'right' ? 'left' : 'right';
  const panelBorderSide =
    side === 'right'
      ? { borderLeft: '1px solid var(--color-redwood-border)' }
      : { borderRight: '1px solid var(--color-redwood-border)' };

  const motionTransition = isDragging
    ? 'none'
    : `width ${ADVISOR_TRANSITION}, left ${ADVISOR_TRANSITION}, right ${ADVISOR_TRANSITION}`;

  return (
    <aside
      ref={panelRef}
      role="complementary"
      aria-label="SOLTOL AI Advisor"
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: side === 'left' ? 0 : 'auto',
        right: side === 'right' ? 0 : 'auto',
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
        transition: motionTransition,
        ...panelBorderSide,
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI Advisor panel"
        onPointerDown={startResize}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [handleOnErpEdge]: 0,
          width: '6px',
          cursor: 'col-resize',
          touchAction: 'none',
          zIndex: 1,
          background: isDragging ? 'var(--color-redwood-border)' : 'transparent',
        }}
        onPointerEnter={(e) => {
          if (!isDragging) e.currentTarget.style.background = 'var(--color-redwood-border)';
        }}
        onPointerLeave={(e) => {
          if (!isDragging && !dragRef.current) {
            e.currentTarget.style.background = 'transparent';
          }
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
            disabled={isDragging}
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
          pointerEvents: isDragging ? 'none' : 'auto',
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
