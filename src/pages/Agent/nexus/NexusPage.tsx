import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  Brain,
  Package,
  Radio,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import api from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';
import { isStaging } from '../../../config/appEnv';
import { getArSummary } from '../../../services/customerService';
import { getPayments, getProducts, getVanLocations } from '../../../services/api';
import { getPurchaseOrders } from '../../../services/purchasesService';
import { getExpenseStats } from '../../../services/expenseService';
import { listDeliveryNotes } from '../../../services/deliveryService';
import { getAllLeaveRequests } from '../../../services/leaveService';
import { deriveVanLiveStatus } from '../../../lib/vanLiveStatus';
import { dashboardLowStockAlertCount } from '../../../utils/dashboardLowStock';
import { firstName } from '../zavaCopy';
import { companyAmount, priorityPill, signalFigure, signalWhy } from '../signalCards';
import {
  PLANET_RING_ORDER,
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
  type PlanetId,
  type SourceResult,
  type TimelineEvent,
  type TimelineLaneId,
} from './nexusModel';

type HealthBody = {
  data_health?: NexusSignalCard[];
};

const RING: Array<{ id: PlanetId; angle: number }> = [
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
];

const PLANET_ICON: Record<PlanetId, typeof ShoppingCart> = {
  sales: ShoppingCart,
  collections: Wallet,
  purchase: Package,
  inventory: Boxes,
  delivery: Truck,
  finance: Receipt,
  expenses: Receipt,
  payroll: Users,
  ai_team: Brain,
  reports: BarChart3,
};

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function planetById(planets: NexusPlanet[], id: string): NexusPlanet | undefined {
  return planets.find((p) => p.id === id);
}

function laneLabel(lane: TimelineLaneId): string {
  if (lane === 'money') return 'Money';
  if (lane === 'goods') return 'Goods';
  return 'Team';
}

function okResult<T>(value: T): SourceResult<T> {
  return { state: 'ok', value };
}
function errResult<T = number>(): SourceResult<T> {
  return { state: 'error' };
}
function unavailableResult<T = number>(): SourceResult<T> {
  return { state: 'unavailable' };
}

const RING_CIRC = 2 * Math.PI * 118;

export default function NexusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const name = firstName(user?.full_name || user?.username);
  const [cards, setCards] = useState<NexusSignalCard[]>([]);
  const [cardsLoadOk, setCardsLoadOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activePlanetId, setActivePlanetId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [planetInputs, setPlanetInputs] = useState({
    owedToUs: unavailableResult<number>(),
    openPoCount: unavailableResult<number>(),
    lowStockCount: unavailableResult<number>(),
    vansOnline: unavailableResult<number>(),
    vansTotal: unavailableResult<number>(),
    pendingExpenses: unavailableResult<number>(),
    invoiceCountToday: unavailableResult<number>(),
  });
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const load = useCallback(async () => {
    if (!isStaging) return;
    setLoading(true);
    const started = performance.now();
    let requests = 0;
    const track = async <T,>(p: Promise<T>): Promise<T> => {
      requests += 1;
      return p;
    };

    const day = todayIsoLocal();
    const settled = await Promise.allSettled([
      track(api.get<{ cards: NexusSignalCard[] }>('/api/agent/signals')),
      track(api.get<HealthBody>('/api/agent/data-health')),
      track(getArSummary()),
      track(getPurchaseOrders()),
      track(getProducts()),
      track(getVanLocations()),
      track(getExpenseStats()),
      track(getPayments({ start_date: day, end_date: day })),
      track(listDeliveryNotes({ delivery_date: day })),
      track(getAllLeaveRequests()),
    ]);
    if (!isStaging) return;

    const [
      signalsSettled,
      healthSettled,
      arSettled,
      posSettled,
      productsSettled,
      vansSettled,
      expensesSettled,
      paymentsSettled,
      dnsSettled,
      leaveSettled,
    ] = settled;

    const signalsOk = signalsSettled.status === 'fulfilled';
    const healthOk = healthSettled.status === 'fulfilled';
    const loadOk = signalsOk && healthOk;
    setCardsLoadOk(loadOk);

    const signalCards =
      signalsOk && Array.isArray(signalsSettled.value.data?.cards) ? signalsSettled.value.data.cards : [];
    const healthCards =
      healthOk && Array.isArray(healthSettled.value.data?.data_health)
        ? healthSettled.value.data.data_health
        : [];
    const merged = loadOk ? [...signalCards, ...healthCards] : [];
    setCards(merged);
    setActiveCardId(merged[0]?.id ?? null);

    setPlanetInputs({
      owedToUs:
        arSettled.status === 'fulfilled'
          ? okResult(owedToUsFromArSummary(arSettled.value) ?? 0)
          : errResult(),
      openPoCount:
        posSettled.status === 'fulfilled'
          ? okResult(countOpenPurchaseOrders(posSettled.value))
          : errResult(),
      lowStockCount:
        productsSettled.status === 'fulfilled'
          ? okResult(dashboardLowStockAlertCount(productsSettled.value))
          : errResult(),
      vansOnline:
        vansSettled.status === 'fulfilled'
          ? okResult(
              vansSettled.value.filter((v) => deriveVanLiveStatus(v.recorded_at, v.speed) !== 'offline')
                .length,
            )
          : errResult(),
      vansTotal: vansSettled.status === 'fulfilled' ? okResult(vansSettled.value.length) : errResult(),
      pendingExpenses:
        expensesSettled.status === 'fulfilled'
          ? okResult(Number(expensesSettled.value.pending_approval_count || 0))
          : errResult(),
      // GET /invoices/ has no date filter — do not download the full list.
      invoiceCountToday: unavailableResult(),
    });

    const payments = paymentsSettled.status === 'fulfilled' ? paymentsSettled.value : [];
    const dns = dnsSettled.status === 'fulfilled' ? dnsSettled.value : [];
    const leave = leaveSettled.status === 'fulfilled' ? leaveSettled.value : [];
    setTimeline(
      buildTimelineEvents({
        now: new Date(),
        payments,
        deliveryNotes: dns,
        leaveRequests: leave,
      }),
    );

    setRequestCount(requests);
    setLoadMs(Math.round(performance.now() - started));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const planets = useMemo(
    () =>
      buildPlanets({
        cards,
        cardsLoadOk,
        ...planetInputs,
      }),
    [cards, cardsLoadOk, planetInputs],
  );

  const health = businessHealthScore(cards, cardsLoadOk);
  const needs = cardsLoadOk ? needsYouCount(cards) : 0;
  const needsList = cardsLoadOk ? needsYouCards(cards) : [];
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

  const segmentLen = RING_CIRC / PLANET_RING_ORDER.length;

  return (
    <div
      style={{
        minHeight: '100%',
        background:
          'radial-gradient(ellipse 80% 50% at 50% 0%, #1a2a4a 0%, transparent 55%), radial-gradient(circle at 20% 80%, #0a1628 0%, transparent 40%), radial-gradient(circle at 80% 60%, #121a2e 0%, transparent 35%), #04080f',
        color: '#E8EEF9',
        padding: '20px 20px 32px',
        fontFamily: 'ui-sans-serif, system-ui, Segoe UI, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          opacity: 0.35,
          backgroundImage:
            'radial-gradient(1px 1px at 10% 20%, #fff 0, transparent 2px), radial-gradient(1px 1px at 30% 70%, #cbd5e1 0, transparent 2px), radial-gradient(1px 1px at 70% 40%, #fff 0, transparent 2px), radial-gradient(1px 1px at 90% 15%, #94a3b8 0, transparent 2px), radial-gradient(1.5px 1.5px at 55% 85%, #fff 0, transparent 2px)',
        }}
      />

      <div
        style={{
          position: 'relative',
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

      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1fr) minmax(320px, 1.4fr) minmax(220px, 1fr)',
          gap: 16,
          alignItems: 'stretch',
        }}
        className="zava-nexus-grid"
      >
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

          <SectionTitle style={{ marginTop: 22 }}>Needs you · {cardsLoadOk ? needs : '—'}</SectionTitle>
          {!cardsLoadOk && (
            <div style={{ ...cardStyle, borderColor: 'rgba(248,113,113,0.45)', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Couldn&apos;t load signals</div>
              <button
                type="button"
                style={actionBtn}
                onClick={() => {
                  setReloadKey((k) => k + 1);
                }}
              >
                Retry
              </button>
            </div>
          )}
          {loading && cardsLoadOk && <Muted>—</Muted>}
          {!loading && cardsLoadOk && needsList.length === 0 && <Muted>Nothing urgent right now.</Muted>}
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
          <div style={{ position: 'relative', width: 340, height: 340, maxWidth: '100%' }}>
            <svg viewBox="0 0 320 320" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              {PLANET_RING_ORDER.map((id, i) => {
                const planet = planetById(planets, id);
                const color = PLANET_STATUS_COLOR[planet?.status || 'offline'];
                const dashOffset = -i * segmentLen;
                return (
                  <circle
                    key={id}
                    cx="160"
                    cy="160"
                    r="118"
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeDasharray={`${segmentLen - 4} ${RING_CIRC - (segmentLen - 4)}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                    transform="rotate(-90 160 160)"
                    opacity={0.95}
                  />
                );
              })}
            </svg>

            {RING.map((slot, index) => {
              const planet = planetById(planets, slot.id);
              if (!planet) return null;
              const rad = (slot.angle * Math.PI) / 180;
              const r = 118;
              const x = 160 + r * Math.cos(rad);
              const y = 160 + r * Math.sin(rad);
              const color = PLANET_STATUS_COLOR[planet.status];
              const glow = activePlanetId === planet.id;
              const Icon = PLANET_ICON[planet.id];
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
                    width: glow ? 58 : 52,
                    height: glow ? 58 : 52,
                    borderRadius: '50%',
                    border: `2px solid ${color}`,
                    background: planet.connected ? 'rgba(8,15,28,0.95)' : 'rgba(30,41,59,0.85)',
                    boxShadow: glow ? `0 0 22px ${color}` : `0 0 12px ${color}88`,
                    color: '#E2E8F0',
                    cursor: 'pointer',
                    padding: 2,
                    zIndex: 2 + index,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                  }}
                >
                  <Icon size={12} color={color} />
                  <div style={{ fontSize: 8, fontWeight: 800, lineHeight: 1.05, maxWidth: 46 }}>
                    {planet.label}
                  </div>
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
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.05 }}>
                {loading || health == null ? '—' : health}
              </div>
              <div style={{ fontSize: 12, color: '#A5B4C8', marginTop: 4 }}>
                {cardsLoadOk ? `${needs} need${needs === 1 ? 's' : ''} you` : 'Signals unavailable'}
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
            {planets.map((p) => {
              const Icon = PLANET_ICON[p.id];
              return (
                <button
                  key={`m-${p.id}`}
                  type="button"
                  onClick={() => onPlanet(p)}
                  style={{
                    textAlign: 'left',
                    background: 'rgba(15,23,42,0.55)',
                    border: `1px solid ${PLANET_STATUS_COLOR[p.status]}66`,
                    boxShadow: `0 0 10px ${PLANET_STATUS_COLOR[p.status]}22`,
                    borderRadius: 10,
                    padding: '8px 8px',
                    color: '#E2E8F0',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 800,
                      color: PLANET_STATUS_COLOR[p.status],
                    }}
                  >
                    <Icon size={11} />
                    {p.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{p.metricLabel}</div>
                </button>
              );
            })}
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
          {!loading && loadMs != null && (
            <div style={{ marginTop: 10, fontSize: 10, color: '#64748B' }}>
              {requestCount} requests · {loadMs} ms
            </div>
          )}
        </section>

        <aside style={panelStyle}>
          <SectionTitle>Zava · speaking</SectionTitle>
          {!cardsLoadOk ? (
            <Muted>Couldn&apos;t load signals — use Retry on the left.</Muted>
          ) : activeCard ? (
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
            {(upcoming.length === 0 || !cardsLoadOk) && <Muted>—</Muted>}
            {cardsLoadOk &&
              upcoming.map((card) => (
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

      <section style={{ ...panelStyle, marginTop: 16, position: 'relative' }}>
        <SectionTitle>Today · 6 AM – 6 PM</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 10 }}>
          {(['money', 'goods', 'team'] as TimelineLaneId[]).map((lane) => {
            const laneEvents = timeline.filter((e) => e.lane === lane);
            const timed = laneEvents.filter((e) => e.minuteOfDay != null);
            const undated = laneEvents.filter((e) => e.timeNotRecorded);
            return (
              <div key={lane} style={{ display: 'contents' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', paddingTop: 6 }}>{laneLabel(lane)}</div>
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      position: 'relative',
                      height: 44,
                      borderRadius: 10,
                      background: 'rgba(15,23,42,0.65)',
                      border: '1px solid rgba(148,163,184,0.12)',
                    }}
                  >
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
                    {timed.length === 0 && undated.length === 0 && (
                      <span style={{ position: 'absolute', left: 12, top: 14, fontSize: 12, color: '#64748B' }}>—</span>
                    )}
                    {timed.map((ev) => {
                      const clamped = Math.min(1080, Math.max(360, ev.minuteOfDay as number));
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
                  {undated.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#94A3B8' }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>Today (time not recorded)</div>
                      {undated.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => ev.href && navigate(ev.href)}
                          style={{
                            display: 'block',
                            background: 'none',
                            border: 'none',
                            color: '#CBD5E1',
                            fontSize: 11,
                            padding: '2px 0',
                            cursor: ev.href ? 'pointer' : 'default',
                            textAlign: 'left',
                          }}
                        >
                          {ev.label}
                        </button>
                      ))}
                    </div>
                  )}
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
