import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Boxes,
  Building2,
  Calculator,
  FileText,
  Lock,
  Megaphone,
  Package,
  Shield,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { AuthRole } from '../../../contexts/AuthContext';
import type { HomeModuleBlock, HomeModuleId, HomeModules, ModuleTag } from './homeSummaryApi';
import {
  ORBIT_CHIP_DEFS,
  ORBIT_MODULE_DEFS,
  canOpenOrbitChip,
  canOpenOrbitModule,
  type OrbitModuleDef,
  type OrbitNavCtx,
} from './nexusOrbitNav';
import {
  ORBIT_DESIGN_H,
  ORBIT_DESIGN_W,
  orbitFitScale,
  shouldUseOrbitGrid,
} from './orbitScale';

const BLUE = '#4F8EF7';
const GREEN = '#22c55e';
const AMBER = '#F59E0B';
const RED = '#F87171';
const IDLE_BLUE = '#60A5FA';

const TAG_COLOR: Record<ModuleTag, string> = {
  OK: GREEN,
  WATCH: AMBER,
  ACTION: RED,
  ERROR: RED,
  IDLE: IDLE_BLUE,
};

const MODULE_ICON: Record<HomeModuleId, typeof ShoppingCart> = {
  sales: ShoppingCart,
  customers: Users,
  collections: Wallet,
  purchase: Truck,
  inventory: Package,
  warehouse: Boxes,
  delivery: Truck,
  finance: Building2,
  expenses: FileText,
  payroll: Users,
};

const CHIP_ICON: Record<string, typeof Calculator> = {
  tax: Calculator,
  reports: FileText,
  marketing: Megaphone,
  ai_hub: Sparkles,
  users: UserCheck,
  security: Lock,
};

function formatPrimary(block: HomeModuleBlock): string {
  if (block.state === 'error') return "Couldn't load";
  if (block.state === 'unavailable') return 'Not set up yet';
  if (typeof block.value === 'number') {
    if (Math.abs(block.value) >= 1000 && block.value % 1 !== 0) {
      return `$${Math.round(block.value).toLocaleString('en-US')}`;
    }
    if (Math.abs(block.value) >= 100 && Number.isInteger(block.value) === false) {
      return `$${Math.round(block.value).toLocaleString('en-US')}`;
    }
    return Number.isInteger(block.value)
      ? block.value.toLocaleString('en-US')
      : String(block.value);
  }
  if (block.value == null || block.value === '') return '—';
  return String(block.value);
}

/** Collections money: always show $ when ok numeric. */
function formatModuleValue(id: HomeModuleId, block: HomeModuleBlock): string {
  if (block.state !== 'ok') return formatPrimary(block);
  if (id === 'collections' && typeof block.value === 'number') {
    return `$${Math.round(block.value).toLocaleString('en-US')}`;
  }
  if (typeof block.value === 'number') {
    return block.value.toLocaleString('en-US');
  }
  return formatPrimary(block);
}

function tagFor(block: HomeModuleBlock): ModuleTag {
  if (block.state === 'error') return 'ERROR';
  if (block.state === 'unavailable') return 'IDLE';
  return block.tag || 'OK';
}

function ringColor(tag: ModuleTag): string {
  return TAG_COLOR[tag];
}

export function moneyishModuleValue(id: HomeModuleId, block: HomeModuleBlock): string {
  return formatModuleValue(id, block);
}

type Props = {
  needsYouCount: number;
  modules: HomeModules | null;
  role: AuthRole | undefined;
  hasRole: (...roles: AuthRole[]) => boolean;
  onOrbTap: () => void;
  orbActive?: boolean;
  onNavigate: (href: string) => void;
  onRetry?: () => void;
  activeModuleId?: HomeModuleId | null;
};

export default function NexusOrbit({
  needsYouCount,
  modules,
  role,
  hasRole,
  onOrbTap,
  orbActive,
  onNavigate,
  onRetry,
  activeModuleId,
}: Props) {
  const ctx: OrbitNavCtx = useMemo(() => ({ role, hasRole }), [role, hasRole]);
  const visible = useMemo(
    () => ORBIT_MODULE_DEFS.filter((d) => canOpenOrbitModule(ctx, d.id)),
    [ctx],
  );
  const chips = useMemo(
    () => ORBIT_CHIP_DEFS.filter((c) => canOpenOrbitChip(ctx, c.id)),
    [ctx],
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const [useGrid, setUseGrid] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const wrap = wrapRef.current;
    const box = stageBoxRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const pageW = wrap.getBoundingClientRect().width;
      const grid = shouldUseOrbitGrid(pageW);
      setUseGrid(grid);
      if (grid || !box) {
        setScale(1);
        return;
      }
      const { width, height } = box.getBoundingClientRect();
      setScale(orbitFitScale(width, height));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    if (box) ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const placed = useMemo(() => {
    const n = visible.length || 1;
    return visible.map((def, i) => {
      const angle = -90 + (360 / n) * i + (n > 1 ? 360 / n / 2 : 0);
      return { ...def, angle };
    });
  }, [visible]);

  const needHeader =
    needsYouCount <= 0
      ? 'Nothing needs you'
      : `${needsYouCount} need you`;

  return (
    <div ref={wrapRef} className="zava-nexus-orbit" style={root}>
      {useGrid && (
        <div style={narrowHeader} data-testid="nexus-orbit-narrow-header">
          <button
            type="button"
            aria-label={orbActive ? 'Stop Zava' : 'Talk to Zava'}
            onClick={onOrbTap}
            style={{
              ...narrowNeedBtn,
              borderColor: orbActive ? BLUE : 'rgba(79,142,247,0.35)',
              boxShadow: orbActive ? `0 0 16px ${BLUE}66` : 'none',
            }}
          >
            {needHeader}
          </button>
        </div>
      )}

      <div ref={stageBoxRef} style={stageBox}>
        {useGrid ? (
          <div style={gridCards} data-testid="nexus-orbit-grid">
            {placed.map((def) => (
              <ModuleCard
                key={def.id}
                def={def}
                block={modules?.[def.id] ?? { state: 'unavailable' }}
                active={activeModuleId === def.id}
                layout="grid"
                onOpen={() => {
                  const block = modules?.[def.id];
                  if (block?.state === 'error' && onRetry) {
                    onRetry();
                    return;
                  }
                  onNavigate(def.href);
                }}
              />
            ))}
          </div>
        ) : (
          <div
            data-testid="nexus-orbit-ellipse"
            data-orbit-scale={scale.toFixed(3)}
            style={{
              ...scaleHost,
              width: ORBIT_DESIGN_W,
              height: ORBIT_DESIGN_H,
              transform: `translate(-50%, -50%) scale(${scale})`,
            }}
          >
            <div style={designStage}>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
                style={ellipseSvg}
                aria-hidden
              >
                <ellipse
                  cx="50"
                  cy="50"
                  rx="38"
                  ry="32"
                  fill="none"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="0.35"
                  strokeDasharray="1.2 1.8"
                />
              </svg>

              <button
                type="button"
                aria-label={orbActive ? 'Stop Zava' : 'Talk to Zava'}
                onClick={onOrbTap}
                style={{
                  ...orbBtn,
                  boxShadow: orbActive
                    ? `0 0 36px ${BLUE}99, 0 0 12px ${BLUE}`
                    : `0 0 28px ${BLUE}66`,
                  borderColor: orbActive ? BLUE : 'rgba(79,142,247,0.35)',
                }}
              >
                <span style={orbNum}>{needsYouCount}</span>
                <span style={orbNeed}>NEED YOU</span>
              </button>

              <div style={ellipseLayer}>
                {placed.map((def) => {
                  const rad = (def.angle * Math.PI) / 180;
                  const rx = 38;
                  const ry = 32;
                  const x = 50 + rx * Math.cos(rad);
                  const y = 50 + ry * Math.sin(rad);
                  return (
                    <div
                      key={def.id}
                      style={{
                        position: 'absolute',
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 2,
                      }}
                    >
                      <ModuleCard
                        def={def}
                        block={modules?.[def.id] ?? { state: 'unavailable' }}
                        active={activeModuleId === def.id}
                        layout="orbit"
                        onOpen={() => {
                          const block = modules?.[def.id];
                          if (block?.state === 'error' && onRetry) {
                            onRetry();
                            return;
                          }
                          onNavigate(def.href);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div style={chipRow} data-testid="nexus-orbit-chips">
          {chips.map((chip) => {
            const Icon = CHIP_ICON[chip.id] || Shield;
            return (
              <button
                key={chip.id}
                type="button"
                style={chipBtn}
                onClick={() => onNavigate(chip.href)}
              >
                <Icon size={12} color="#94A3B8" />
                {chip.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  def,
  block,
  active,
  layout,
  onOpen,
}: {
  def: OrbitModuleDef;
  block: HomeModuleBlock;
  active?: boolean;
  layout: 'orbit' | 'grid';
  onOpen: () => void;
}) {
  const tag = tagFor(block);
  const color = ringColor(tag);
  const Icon = MODULE_ICON[def.id];
  const primary = formatModuleValue(def.id, block);
  const sub =
    block.state === 'error'
      ? block.sub_line || 'Tap to retry'
      : block.state === 'unavailable'
        ? 'Not set up yet'
        : block.sub_line || '';

  return (
    <button
      type="button"
      data-module={def.id}
      data-state={block.state}
      data-tag={tag}
      title={`${def.label}: ${primary}`}
      onClick={onOpen}
      style={{
        ...card,
        width: layout === 'orbit' ? 148 : '100%',
        borderColor: active ? color : `${color}55`,
        boxShadow: active ? `0 0 16px ${color}66` : `0 0 10px ${color}22`,
      }}
    >
      <span style={{ ...seg, background: color }} aria-hidden />
      <span style={cardInner}>
        <span style={cardTop}>
          <Icon size={12} color={color} style={{ flexShrink: 0 }} />
          <span style={cardName} data-testid={`orbit-name-${def.id}`}>
            {def.label}
          </span>
        </span>
        <span style={{ ...tagPill, color, borderColor: `${color}66`, alignSelf: 'flex-start' }}>{tag}</span>
        <span
          style={{
            ...cardValue,
            color: block.state === 'unavailable' ? '#64748B' : block.state === 'error' ? RED : '#F8FAFC',
            fontSize: block.state === 'unavailable' || block.state === 'error' ? 12 : 15,
          }}
        >
          {primary}
        </span>
        {sub ? <span style={cardSub}>{sub}</span> : null}
      </span>
    </button>
  );
}

/** Test helper — expose formatting rules. */
export function moduleCardDisplay(id: HomeModuleId, block: HomeModuleBlock): {
  primary: string;
  tag: ModuleTag;
  hasNumericPrimary: boolean;
} {
  const primary = formatModuleValue(id, block);
  const tag = tagFor(block);
  const hasNumericPrimary =
    block.state === 'ok' && (typeof block.value === 'number' || /^\d/.test(primary));
  return { primary, tag, hasNumericPrimary };
}

const root: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: '100%',
  height: '100%',
  minWidth: 0,
  minHeight: 0,
};

const narrowHeader: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
  paddingBottom: 4,
};

const narrowNeedBtn: CSSProperties = {
  border: '1.5px solid',
  borderRadius: 999,
  padding: '6px 14px',
  background: `radial-gradient(circle at 35% 28%, #E0E7FF 0%, ${BLUE} 55%, #1E3A8A 100%)`,
  color: '#F8FAFC',
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: '0.04em',
  cursor: 'pointer',
};

const stageBox: CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  width: '100%',
  overflow: 'hidden',
};

const scaleHost: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transformOrigin: 'center center',
};

const designStage: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

const ellipseSvg: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: 0,
};

const ellipseLayer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 1,
};

const orbBtn: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: 132,
  height: 132,
  borderRadius: '50%',
  border: '2px solid',
  background: `radial-gradient(circle at 35% 28%, #E0E7FF 0%, ${BLUE} 48%, #1E3A8A 78%, #0B1224 100%)`,
  cursor: 'pointer',
  zIndex: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  color: '#F8FAFC',
  padding: 0,
};

const orbNum: CSSProperties = {
  fontSize: 36,
  fontWeight: 900,
  lineHeight: 1,
  color: '#FFF',
  textShadow: '0 2px 12px rgba(0,0,0,0.45)',
};

const orbNeed: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.16em',
  color: 'rgba(248,250,252,0.9)',
};

const gridCards: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  padding: 4,
  position: 'relative',
  zIndex: 2,
  height: '100%',
  overflow: 'auto',
  alignContent: 'start',
};

const card: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 0,
  textAlign: 'left',
  background: 'rgba(8,14,28,0.92)',
  border: '1px solid',
  borderRadius: 12,
  padding: 0,
  cursor: 'pointer',
  overflow: 'hidden',
  color: '#E2E8F0',
};

const seg: CSSProperties = {
  width: 4,
  flexShrink: 0,
};

const cardInner: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 8px 8px 8px',
  minWidth: 0,
  flex: 1,
};

const cardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minWidth: 0,
};

/** Full module name — wrap; never ellipsize ("Payroll…"). */
export const ORBIT_CARD_NAME_STYLE: CSSProperties = {
  flex: 1,
  fontSize: 11,
  fontWeight: 700,
  color: '#CBD5E1',
  whiteSpace: 'normal',
  overflow: 'visible',
  textOverflow: 'clip',
  lineHeight: 1.25,
  wordBreak: 'normal',
  overflowWrap: 'anywhere',
};

const cardName: CSSProperties = ORBIT_CARD_NAME_STYLE;

const tagPill: CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.06em',
  border: '1px solid',
  borderRadius: 4,
  padding: '1px 4px',
  flexShrink: 0,
};

const cardValue: CSSProperties = {
  fontWeight: 800,
  lineHeight: 1.2,
};

const cardSub: CSSProperties = {
  fontSize: 9,
  color: '#64748B',
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const chipRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  justifyContent: 'center',
  paddingTop: 2,
  flexShrink: 0,
};

const chipBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  color: '#CBD5E1',
  background: 'rgba(15,23,42,0.85)',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 999,
  padding: '4px 10px',
  cursor: 'pointer',
};
