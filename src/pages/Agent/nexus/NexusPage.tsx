import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, Radio } from 'lucide-react';
import api from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';
import { isStaging } from '../../../config/appEnv';
import { getArSummary } from '../../../services/customerService';
import { getInvoices, getPayments, getProducts, getVanLocations } from '../../../services/api';
import { getPurchaseOrders } from '../../../services/purchasesService';
import { getExpenseStats } from '../../../services/expenseService';
import { listDeliveryNotes } from '../../../services/deliveryService';
import { getAllLeaveRequests } from '../../../services/leaveService';
import { deriveVanLiveStatus } from '../../../lib/vanLiveStatus';
import { firstName } from '../zavaCopy';
import { companyAmount, priorityPill, signalFigure, signalWhy } from '../signalCards';
import {
  PLANET_STATUS_COLOR,
  buildPlanets,
  buildTimelineEvents,
  businessHealthScore,
  comingUpCards,
  countOpenPurchaseOrders,
  needsYouCards,
  needsYouCount,
  owedToUsFromArSummary,
  type NexusPlanet,
  type NexusSignalCard,
  type TimelineEvent,
  type TimelineLaneId,
} from './nexusModel';

type HealthBody = {
  data_health?: NexusSignalCard[];
};

const RING = [
  { id: 'sales', angle: -90 },
  { id: 'collections', angle: -54 },
  { id: 'purchase', angle: -18 },
  { id: 'inventory', angle: 18 },
  { id: 'delivery', angle: 54 },
  { id: 'finance', angle: 90 },
  { id: 'expenses', angle: 126 },
  { id: 'payroll', angle: 162 },
  { id: 'ai_team', angle: 198 },
  { id: 'reports', angle: 234 },
] as const;

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isInvoiceToday(inv: { invoiceDate?: string; date?: string }, now: Date): boolean {
  const raw = inv.invoiceDate || inv.date;
  if (!raw) return false;
  const d = new Date(String(raw).includes('T') ? raw : `${raw}T12:00:00`);
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function planetById(planets: NexusPlanet[], id: string): NexusPlanet | undefined {
  return planets.find((p) => p.id === id);
}

function laneLabel(lane: TimelineLaneId): string {
  if (lane === 'money') return 'Money';
  if (lane === 'goods') return 'Goods';
  return 'Team';
}

export default function NexusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const name = firstName(user?.full_name || user?.username);
  const [cards, setCards] = useState<NexusSignalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activePlanetId, setActivePlanetId] = useState<string | null>(null);
  const [planetInputs, setPlanetInputs] = useState({
    owedToUs: null as number | null,
    openPoCount: null as number | null,
    lowStockCount: null as number | null,
    vansOnline: null as number | null,
    vansTotal: null as number | null,
    pendingExpenses: null as number | null,
    invoiceCountToday: null as number | null,
  });
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (!isStaging) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const day = todayIsoLocal();
        const [signalsRes, healthRes, ar, pos, products, vans, expenses, invoices, payments, dns, leave] =
          await Promise.all([
            api.get<{ cards: NexusSignalCard[] }>('/api/agent/signals').catch(() => ({ data: { cards: [] } })),
            api.get<HealthBody>('/api/agent/data-health').catch(() => ({ data: {} as HealthBody })),
            getArSummary().catch(() => null),
            getPurchaseOrders().catch(() => null),
            getProducts().catch(() => null),
            getVanLocations().catch(() => null),
            getExpenseStats().catch(() => null),
            getInvoices().catch(() => []),
            getPayments().catch(() => []),
            listDeliveryNotes({ delivery_date: day }).catch(() => []),
            getAllLeaveRequests().catch(() => []),
          ]);
        if (cancelled) return;
        const signalCards = Array.isArray(signalsRes.data?.cards) ? signalsRes.data.cards : [];
        const healthCards = Array.isArray(healthRes.data?.data_health) ? healthRes.data.data_health : [];
        const merged = [...signalCards, ...healthCards];
        setCards(merged);
        setActiveCardId(merged[0]?.id ?? null);

        const online =
          vans == null
            ? null
            : vans.filter((v) => deriveVanLiveStatus(v.recorded_at, v.speed) !== 'offline').length;
        setPlanetInputs({
          owedToUs: owedToUsFromArSummary(ar),
          openPoCount: pos == null ? null : countOpenPurchaseOrders(pos),
          lowStockCount:
            products == null
              ? null
              : products.filter((p) => Number(p.current_stock || 0) <= Number(p.minimum_stock || 0)).length,
          vansOnline: online,
          vansTotal: vans == null ? null : vans.length,
          pendingExpenses: expenses == null ? null : Number(expenses.pending_approval_count || 0),
          invoiceCountToday: invoices.filter((inv) => isInvoiceToday(inv, now)).length,
        });
        setTimeline(
          buildTimelineEvents({
            now,
            payments,
            invoices,
            deliveryNotes: dns,
            leaveRequests: leave,
          }),
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load Nexus');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const planets = useMemo(
    () =>
      buildPlanets({
        cards,
        ...planetInputs,
      }),
    [cards, planetInputs],
  );

  const health = businessHealthScore(cards);
  const needs = needsYouCount(cards);
  const needsList = needsYouCards(cards);
  const activeCard = cards.find((c) => c.id === activeCardId) || cards[0] || null;
  const upcoming = comingUpCards(cards, activeCard?.id);
  const nowMinute = new Date().getHours() * 60 + new Date().getMinutes();

  const onPlanet = (planet: NexusPlanet) => {
    setActivePlanetId(planet.id);
    const match = cards.find((c) => String(c.module || '').toLowerCase().includes(planet.id.split('_')[0]));
    if (match) setActiveCardId(match.id);
  };

  if (!isStaging) {
    return (
      <div style={{ padding: 40, color: '#94A3B8' }}>
        Nexus is available on staging only. <Link to="/dashboard">Go to dashboard</Link>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100%',
        background:
          'radial-gradient(ellipse at 50% 30%, #12203a 0%, #070d18 45%, #04080f 100%)',
        color: '#E8EEF9',
        padding: '20px 20px 32px',
        fontFamily: 'ui-sans-serif, system-ui, Segoe UI, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#7C8DB5', textTransform: 'uppercase' }}>
            Zava · Nexus
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>Welcome back, {name}</h1>
        </div>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 999,
            border: '1px solid rgba(148,163,184,0.35)',
            color: '#CBD5E1',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Go to dashboard <ArrowRight size={14} />
        </Link>
      </div>

      {error && (
        <p role="alert" style={{ color: '#FCA5A5', marginBottom: 12 }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1fr) minmax(320px, 1.4fr) minmax(220px, 1fr)',
          gap: 16,
          alignItems: 'stretch',
        }}
        className="zava-nexus-grid"
      >
        {/* Left */}
        <aside style={panelStyle}>
          <SectionTitle>Voice link</SectionTitle>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(79,142,247,0.08)',
              border: '1px solid rgba(79,142,247,0.25)',
              marginBottom: 16,
            }}
          >
            <Radio size={18} color="#60A5FA" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Idle</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                Open Talk to speak — Phase 1 keeps the current mic.
              </div>
            </div>
          </div>
          <Link to="/agent" style={{ fontSize: 12, color: '#93C5FD', fontWeight: 600 }}>
            Open Zava Talk →
          </Link>

          <SectionTitle style={{ marginTop: 22 }}>Needs you · {needs}</SectionTitle>
          {loading && <Muted>—</Muted>}
          {!loading && needsList.length === 0 && <Muted>Nothing urgent right now.</Muted>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {needsList.map((card) => {
              const pill = priorityPill(card.priority);
              return (
                <div key={card.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{card.title}</strong>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: pill.background,
                        color: pill.color,
                      }}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 10px', fontSize: 12, color: '#94A3B8' }}>{signalWhy(card.why)}</p>
                  <button
                    type="button"
                    onClick={() => navigate(card.href || '/agent')}
                    style={actionBtn}
                  >
                    {card.action || 'Open'}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center ring */}
        <section
          style={{
            ...panelStyle,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 420,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 320,
              height: 320,
              maxWidth: '100%',
            }}
          >
            <svg viewBox="0 0 320 320" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <linearGradient id="nexusRing" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4F8EF7" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#A78BFA" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#34D399" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              <circle cx="160" cy="160" r="118" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="10" />
              <circle
                cx="160"
                cy="160"
                r="118"
                fill="none"
                stroke="url(#nexusRing)"
                strokeWidth="10"
                strokeDasharray={`${(health / 100) * 741} 741`}
                strokeLinecap="round"
                transform="rotate(-90 160 160)"
              />
            </svg>

            {RING.map((slot, index) => {
              const planet = planetById(planets, slot.id);
              if (!planet) return null;
              // angle −90 = top (SVG y grows downward)
              const rad = (slot.angle * Math.PI) / 180;
              const r = 118;
              const x = 160 + r * Math.cos(rad);
              const y = 160 + r * Math.sin(rad);
              const color = PLANET_STATUS_COLOR[planet.status];
              const glow = activePlanetId === planet.id;
              return (
                <button
                  key={planet.id}
                  type="button"
                  title={`${planet.label}: ${planet.metricLabel}`}
                  onClick={() => onPlanet(planet)}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    width: glow ? 54 : 48,
                    height: glow ? 54 : 48,
                    borderRadius: '50%',
                    border: `2px solid ${color}`,
                    background: planet.connected ? 'rgba(8,15,28,0.95)' : 'rgba(30,41,59,0.85)',
                    boxShadow: glow ? `0 0 18px ${color}` : `0 0 8px ${color}55`,
                    color: '#E2E8F0',
                    cursor: 'pointer',
                    padding: 0,
                    zIndex: 2 + index,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, lineHeight: 1.1 }}>{planet.label.split(' ')[0]}</div>
                </button>
              );
            })}

            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                width: 150,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  margin: '0 auto 10px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%, #C4B5FD, #4F8EF7 55%, #1E3A5F)',
                  boxShadow: '0 0 40px rgba(99,102,241,0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={28} color="#fff" />
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Business health · Beta
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.05 }}>{loading ? '—' : health}</div>
              <div style={{ fontSize: 12, color: '#A5B4C8', marginTop: 4 }}>
                {needs} need{needs === 1 ? 's' : ''} you
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: 8,
              width: '100%',
              marginTop: 18,
            }}
          >
            {planets.map((p) => (
              <button
                key={`m-${p.id}`}
                type="button"
                onClick={() => onPlanet(p)}
                onDoubleClick={() => p.href && navigate(p.href)}
                style={{
                  textAlign: 'left',
                  background: 'rgba(15,23,42,0.55)',
                  border: `1px solid ${PLANET_STATUS_COLOR[p.status]}55`,
                  borderRadius: 10,
                  padding: '8px 8px',
                  color: '#E2E8F0',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, color: PLANET_STATUS_COLOR[p.status] }}>{p.label}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{p.metricLabel}</div>
              </button>
            ))}
          </div>
          {activePlanetId && planetById(planets, activePlanetId)?.href && (
            <button
              type="button"
              style={{ ...actionBtn, marginTop: 12 }}
              onClick={() => {
                const href = planetById(planets, activePlanetId)?.href;
                if (href) navigate(href);
              }}
            >
              Open {planetById(planets, activePlanetId)?.label}
            </button>
          )}
        </section>

        {/* Right */}
        <aside style={panelStyle}>
          <SectionTitle>Zava · speaking</SectionTitle>
          {activeCard ? (
            <div style={{ ...cardStyle, borderColor: 'rgba(167,139,250,0.45)' }}>
              <div style={{ fontSize: 11, color: '#A78BFA', fontWeight: 700, marginBottom: 6 }}>Current update</div>
              <strong style={{ fontSize: 15 }}>{activeCard.title}</strong>
              <div style={{ fontSize: 18, fontWeight: 800, margin: '8px 0 6px' }}>
                {signalFigure(activeCard) || companyAmount(activeCard.money)}
              </div>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 12px' }}>{signalWhy(activeCard.why)}</p>
              <button type="button" style={actionBtn} onClick={() => navigate(activeCard.href || '/agent')}>
                {activeCard.action || 'Open'}
              </button>
            </div>
          ) : (
            <Muted>{loading ? 'Loading…' : 'No updates yet.'}</Muted>
          )}

          <SectionTitle style={{ marginTop: 20 }}>Coming up</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.length === 0 && <Muted>—</Muted>}
            {upcoming.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveCardId(card.id)}
                style={{
                  ...cardStyle,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>{card.title}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{signalFigure(card)}</div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* Timeline */}
      <section style={{ ...panelStyle, marginTop: 16 }}>
        <SectionTitle>Today · 6 AM – 6 PM</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 10 }}>
          {(['money', 'goods', 'team'] as TimelineLaneId[]).map((lane) => {
            const laneEvents = timeline.filter((e) => e.lane === lane);
            return (
              <div key={lane} style={{ display: 'contents' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', paddingTop: 6 }}>{laneLabel(lane)}</div>
                <div
                  style={{
                    position: 'relative',
                    height: 44,
                    borderRadius: 10,
                    background: 'rgba(15,23,42,0.65)',
                    border: '1px solid rgba(148,163,184,0.12)',
                    marginBottom: 8,
                  }}
                >
                  {/* NOW line (within 6–18) */}
                  {nowMinute >= 360 && nowMinute <= 1080 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${((nowMinute - 360) / 720) * 100}%`,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: '#F472B6',
                        boxShadow: '0 0 10px #F472B6',
                      }}
                    />
                  )}
                  {laneEvents.length === 0 && (
                    <span style={{ position: 'absolute', left: 12, top: 14, fontSize: 12, color: '#64748B' }}>—</span>
                  )}
                  {laneEvents.map((ev) => {
                    const clamped = Math.min(1080, Math.max(360, ev.minuteOfDay));
                    const left = ((clamped - 360) / 720) * 100;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        title={ev.label}
                        onClick={() => ev.href && navigate(ev.href)}
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          border: ev.expected ? '1.5px dashed #94A3B8' : 'none',
                          background: ev.expected ? 'transparent' : '#60A5FA',
                          boxShadow: ev.expected ? 'none' : '0 0 8px #60A5FA',
                          cursor: ev.href ? 'pointer' : 'default',
                          padding: 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <style>{`
        @media (max-width: 1100px) {
          .zava-nexus-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: 'rgba(8, 14, 26, 0.72)',
  border: '1px solid rgba(148,163,184,0.14)',
  borderRadius: 20,
  padding: 18,
  backdropFilter: 'blur(10px)',
};

const cardStyle: CSSProperties = {
  background: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(148,163,184,0.16)',
  borderRadius: 14,
  padding: '12px 12px',
};

const actionBtn: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '8px 12px',
  background: '#4F8EF7',
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

function SectionTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#7C8DB5',
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>{children}</div>;
}
