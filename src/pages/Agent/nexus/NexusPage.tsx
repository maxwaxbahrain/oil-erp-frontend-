import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  Building2,
  Crosshair,
  FileText,
  MapPin,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import api from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';
import { useErpShell, useErpShellReload } from '../../../contexts/ErpShellContext';
import { isStaging } from '../../../config/appEnv';
import { getPayments, getVanLocations } from '../../../services/api';
import { getExpenseStats } from '../../../services/expenseService';
import { listDeliveryNotes } from '../../../services/deliveryService';
import { getAllLeaveRequests } from '../../../services/leaveService';
import { deriveVanLiveStatus } from '../../../lib/vanLiveStatus';
import { summarizeLowStock } from '../../../utils/lowStock';
import {
  alertShellReady,
  attentionFactsFromAlerts,
  computeAlertCounts,
  formatAttentionWelcome,
  shellLoadFailureLines,
} from '../../../utils/alertCounts';
import { firstName } from '../zavaCopy';
import { companyAmount, signalFigure, signalWhy } from '../signalCards';
import {
  PLANET_RING_ORDER,
  PLANET_STATUS_COLOR,
  buildPlanets,
  buildTimelineEvents,
  comingUpCards,
  countOpenPurchaseOrders,
  needsYouCards,
  owedToUsFromArSummary,
  type NexusPlanet,
  type NexusSignalCard,
  type PlanetId,
  type SourceResult,
  type TimelineEvent,
  type TimelineLaneId,
} from './nexusModel';
import { useNexusVoice } from './useNexusVoice';
import NexusHero, { formatHeroSpeakLine } from './NexusHero';
import NexusTopMetrics from './NexusTopMetrics';
import {
  clearHomeSummaryCache,
  formatUpdatedAgo,
  homeSummaryCacheKey,
  loadHomeSummary,
  readHomeSummaryCache,
  writeHomeSummaryCache,
  type HomeSummary,
} from './homeSummaryApi';

type HealthBody = {
  data_health?: NexusSignalCard[];
};

/** Reports at 12 o'clock — matches 11_nexus.jpg */
const RING: Array<{ id: PlanetId; angle: number }> = PLANET_RING_ORDER.map((id, i) => ({
  id,
  angle: -90 + i * 36,
}));

const PLANET_ICON: Record<PlanetId, typeof ShoppingCart> = {
  sales: ShoppingCart,
  collections: Wallet,
  purchase: Truck,
  inventory: Boxes,
  delivery: MapPin,
  finance: Building2,
  expenses: FileText,
  payroll: Users,
  ai_team: Crosshair,
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

function formatNowLabel(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `NOW ${hh}:${mm}`;
}

const RING_R = 132;
const RING_CIRC = 2 * Math.PI * RING_R;
const ORBIT_R = 178;
const VIEW = 420;
const CX = VIEW / 2;
const CY = VIEW / 2;

export default function NexusPage() {
  const { user } = useAuth();
  const shell = useErpShell();
  const reloadShell = useErpShellReload();
  const navigate = useNavigate();
  const name = firstName(user?.full_name || user?.username);
  const [cards, setCards] = useState<NexusSignalCard[]>([]);
  const [cardsLoad, setCardsLoad] = useState<SourceResult<true>>(unavailableResult());
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activePlanetId, setActivePlanetId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [planetInputs, setPlanetInputs] = useState({
    owedToUs: unavailableResult<number>(),
    openPoCount: unavailableResult<number>(),
    lowStockCount: unavailableResult<{ alertCount: number; outOfStock: number; belowMin: number }>(),
    vansOnline: unavailableResult<number>(),
    vansTotal: unavailableResult<number>(),
    pendingExpenses: unavailableResult<number>(),
    invoiceCountToday: unavailableResult<number>(),
  });
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const cacheKey = homeSummaryCacheKey(
    (user as { tenant_id?: number | string } | null)?.tenant_id ?? null,
    user?.id ?? null,
  );
  const [homeSummary, setHomeSummary] = useState<HomeSummary | null>(() => readHomeSummaryCache(cacheKey));
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  // Clear home-summary cache on logout (user becomes null).
  useEffect(() => {
    if (!user) {
      clearHomeSummaryCache();
      setHomeSummary(null);
    }
  }, [user]);

  const alertCounts = useMemo(
    () =>
      computeAlertCounts({
        invoices: shell.invoices,
        payments: shell.payments,
        products: shell.products,
        arSummary: shell.arSummary,
        productsLoad: shell.productsLoad,
        invoicesLoad: shell.invoicesLoad,
        paymentsLoad: shell.paymentsLoad,
        arLoad: shell.arLoad,
      }),
    [shell],
  );
  const shellReady = alertShellReady(shell);
  const loadFailures = useMemo(() => shellLoadFailureLines(alertCounts), [alertCounts]);
  const attentionFacts = useMemo(() => attentionFactsFromAlerts(alertCounts), [alertCounts]);
  const cardsLoadOk = cardsLoad.state === 'ok';
  const welcomeLine = useMemo(
    () =>
      formatAttentionWelcome({
        firstName: name,
        shellReady,
        facts: attentionFacts,
        loadFailures,
      }),
    [name, shellReady, attentionFacts, loadFailures],
  );

  // Instant cache + background refresh once shell is ready.
  useEffect(() => {
    if (!isStaging || !shellReady) return;
    const cached = readHomeSummaryCache(cacheKey);
    if (cached) setHomeSummary(cached);
    let cancelled = false;
    void loadHomeSummary(shell).then((summary) => {
      if (cancelled) return;
      setHomeSummary(summary);
      writeHomeSummaryCache(cacheKey, summary);
    });
    return () => {
      cancelled = true;
    };
  }, [shell, shellReady, cacheKey, summaryRefreshKey]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Reuse App shell data for Collections / Inventory / Purchase — no re-fetch.
  useEffect(() => {
    if (!isStaging || !shellReady) return;
    const owed = owedToUsFromArSummary(shell.arSummary);
    const low =
      shell.productsLoad === 'ok'
        ? (() => {
            const s = summarizeLowStock(shell.products as any[]);
            return okResult({
              alertCount: s.alertCount,
              outOfStock: s.outOfStock,
              belowMin: s.belowMin,
            });
          })()
        : errResult<{ alertCount: number; outOfStock: number; belowMin: number }>();
    setPlanetInputs((prev) => ({
      ...prev,
      owedToUs: owed != null ? okResult(owed) : okResult(0),
      openPoCount: okResult(countOpenPurchaseOrders(shell.purchaseOrders as Array<{ status?: string | null }>)),
      lowStockCount: low,
      invoiceCountToday: unavailableResult(),
    }));
  }, [shell, shellReady]);

  // Progressive extras: signals, vans, expenses, timeline — settle one-by-one.
  useEffect(() => {
    if (!isStaging) return;
    let cancelled = false;
    const started = performance.now();
    let requests = 0;
    setLoadingExtras(true);
    setCardsLoad(unavailableResult());

    const patch = (partial: Partial<typeof planetInputs>) => {
      if (cancelled) return;
      setPlanetInputs((prev) => ({ ...prev, ...partial }));
    };

    const run = async <T,>(p: Promise<T>): Promise<PromiseSettledResult<T>> => {
      requests += 1;
      try {
        const value = await p;
        return { status: 'fulfilled', value };
      } catch (reason) {
        return { status: 'rejected', reason };
      }
    };

    void (async () => {
      const day = todayIsoLocal();

      void run(api.get<{ cards: NexusSignalCard[] }>('/api/agent/signals')).then((signalsSettled) => {
        void run(api.get<HealthBody>('/api/agent/data-health')).then((healthSettled) => {
          if (cancelled) return;
          const signalsOk = signalsSettled.status === 'fulfilled';
          const healthOk = healthSettled.status === 'fulfilled';
          const loadOk = signalsOk && healthOk;
          const signalCards =
            signalsOk && Array.isArray(signalsSettled.value.data?.cards)
              ? signalsSettled.value.data.cards
              : [];
          const healthCards =
            healthOk && Array.isArray(healthSettled.value.data?.data_health)
              ? healthSettled.value.data.data_health
              : [];
          const merged = loadOk ? [...signalCards, ...healthCards] : [];
          setCards(merged);
          setActiveCardId(merged[0]?.id ?? null);
          setCardsLoad(loadOk ? okResult(true) : errResult());
        });
      });

      void run(getVanLocations()).then((vansSettled) => {
        if (cancelled) return;
        if (vansSettled.status === 'fulfilled') {
          const list = vansSettled.value;
          patch({
            vansOnline: okResult(
              list.filter((v) => deriveVanLiveStatus(v.recorded_at, v.speed) !== 'offline').length,
            ),
            vansTotal: okResult(list.length),
          });
        } else {
          patch({ vansOnline: errResult(), vansTotal: errResult() });
        }
      });

      void run(getExpenseStats()).then((expensesSettled) => {
        if (cancelled) return;
        patch({
          pendingExpenses:
            expensesSettled.status === 'fulfilled'
              ? okResult(Number(expensesSettled.value.pending_approval_count || 0))
              : errResult(),
        });
      });

      const [paymentsSettled, dnsSettled, leaveSettled] = await Promise.all([
        run(getPayments({ start_date: day, end_date: day })),
        run(listDeliveryNotes({ delivery_date: day })),
        run(getAllLeaveRequests()),
      ]);
      if (cancelled) return;
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
      setLoadingExtras(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const planets = useMemo(
    () =>
      buildPlanets({
        cards,
        cardsLoadOk,
        cardsLoad,
        ...planetInputs,
      }).filter((p) => p.visible),
    [cards, cardsLoadOk, cardsLoad, planetInputs],
  );

  const needs = attentionFacts.length;
  const signalNeeds = cardsLoadOk ? needsYouCards(cards).filter((c) => !dismissed.has(c.id)) : [];
  const speakable = cards.filter((c) => !dismissed.has(c.id));
  const activeCard = speakable.find((c) => c.id === activeCardId) || speakable[0] || null;
  const upcoming = comingUpCards(speakable, activeCard?.id);
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const activeIndex = activeCard ? speakable.findIndex((c) => c.id === activeCard.id) + 1 : 0;
  const speakModule = String(activeCard?.module || 'Update').toUpperCase();

  const heroSpeakLine = useMemo(
    () => formatHeroSpeakLine(name, homeSummary, now),
    [name, homeSummary, now],
  );

  const voice = useNexusVoice({
    firstName: name,
    cards,
    cardsLoadOk: shellReady && !alertCounts.shellLoading,
    needsYou: needs,
    speakable,
    activeCardId,
    setActiveCardId,
    setActivePlanetId,
    navigate,
    heroLine: heroSpeakLine,
  });

  const updatedLabel = homeSummary?.generated_at
    ? formatUpdatedAgo(homeSummary.generated_at, now)
    : null;

  const onPlanet = (planet: NexusPlanet) => {
    if (planet.status === 'error') {
      setReloadKey((k) => k + 1);
      return;
    }
    setActivePlanetId(planet.id);
    const match = cards.find((c) => String(c.module || '').toLowerCase().includes(planet.id.split('_')[0]));
    if (match) setActiveCardId(match.id);
  };

  const nextUpdate = () => {
    if (!activeCard || speakable.length < 2) return;
    const i = speakable.findIndex((c) => c.id === activeCard.id);
    const next = speakable[(i + 1) % speakable.length];
    setActiveCardId(next.id);
  };

  if (!isStaging) {
    return (
      <div style={{ padding: 40, color: '#94A3B8' }}>
        Nexus is available on staging only. <Link to="/dashboard">Go to dashboard</Link>
      </div>
    );
  }

  const segmentLen = RING_CIRC / PLANET_RING_ORDER.length;
  const gap = 6;

  return (
    <div className="zava-nexus-root" style={rootStyle}>
      <div aria-hidden style={starsStyle} />
      <div aria-hidden style={nebulaStyle} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <Link to="/dashboard" style={dashLinkStyle}>
          Go to dashboard
        </Link>
      </div>

      <NexusHero
        firstName={name}
        summary={homeSummary}
        updatedLabel={updatedLabel}
        now={now}
        onMicTap={voice.onMicTap}
        micActive={voice.voiceState === 'listening' || voice.voiceState === 'speaking'}
      />
      <NexusTopMetrics
        summary={homeSummary}
        onRetry={() => {
          setSummaryRefreshKey((k) => k + 1);
          reloadShell();
        }}
      />

      <div className="zava-nexus-grid" style={gridStyle}>
        {/* LEFT */}
        <aside style={panelStyle}>
          <SectionTitle>Voice link</SectionTitle>
          <div style={voicePanelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  color: voice.voiceState === 'idle' ? '#34D399' : '#5EEAD4',
                }}
              >
                {voice.statusLabel.toUpperCase()}
                {voice.countdown != null ? ` · ${voice.countdown}s` : ''}
              </span>
              <Waveform />
            </div>
            <div style={transcriptStyle}>
              <p>
                <span style={whoStyle}>ZAVA</span>
                {voice.zavaLine
                  ? ` ${voice.zavaLine}`
                  : shellReady
                    ? ` ${welcomeLine}`
                    : ' Loading your numbers…'}
              </p>
              <p style={{ marginTop: 8 }}>
                <span style={{ ...whoStyle, color: '#60A5FA' }}>YOU</span>
                {voice.youLine ? ` ${voice.youLine}` : ' —'}
              </p>
            </div>
            {voice.voiceNotice ? (
              <p style={{ marginTop: 8, fontSize: 11, color: '#FBBF24' }}>{voice.voiceNotice}</p>
            ) : null}
            {voice.fallbackChips && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {voice.fallbackChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    style={chipBtn}
                    onClick={() => void voice.runChip(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
            {voice.pendingConfirm && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" style={chipBtn} onClick={() => void voice.confirmYes()}>
                  Yes
                </button>
                <button type="button" style={chipBtn} onClick={() => void voice.confirmNo()}>
                  No
                </button>
              </div>
            )}
            {voice.customerChoices && voice.customerChoices.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
                {voice.customerChoices.map((c) => (
                  <li key={c.id} style={{ marginBottom: 6 }}>
                    <button type="button" style={chipBtn} onClick={() => void voice.pickCustomer(c)}>
                      {c.name}
                      {c.arLoadedOk && c.balance != null
                        ? ` · $${Math.round(c.balance).toLocaleString('en-US')}`
                        : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginTop: 10, fontSize: 11, color: '#64748B' }}>
              Tap the center orb to talk · push-to-talk only
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
            <SectionTitle style={{ marginBottom: 0 }}>Needs you</SectionTitle>
            {shellReady && needs > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, color: '#F87171', letterSpacing: '0.08em' }}>
                {needs} NEED YOU
              </span>
            )}
          </div>

          {!shellReady && <Muted>Loading…</Muted>}
          {shellReady && loadFailures.length > 0 && (
            <div style={{ ...cardStyle, borderColor: 'rgba(248,113,113,0.45)', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                {loadFailures.join(' ')}
              </div>
              <button type="button" style={primaryBtn} onClick={() => reloadShell()}>
                Retry
              </button>
            </div>
          )}
          {shellReady
            && loadFailures.length === 0
            && attentionFacts.length === 0
            && signalNeeds.length === 0 && (
            <Muted>Nothing needs you right now.</Muted>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {attentionFacts.map((fact, idx) => (
              <div
                key={fact.id}
                style={{
                  ...cardStyle,
                  borderColor: idx === 0 ? 'rgba(248,113,113,0.45)' : 'rgba(251,191,36,0.35)',
                }}
              >
                <strong style={{ fontSize: 13, display: 'block' }}>{fact.label}</strong>
                <p style={{ margin: '6px 0 12px', fontSize: 12, color: '#94A3B8' }}>
                  Same figure as the top alert bar
                </p>
                <button
                  type="button"
                  style={primaryBtn}
                  onClick={() =>
                    navigate(
                      fact.id === 'out_of_stock'
                        ? '/products'
                        : fact.id === 'owed' || fact.id === 'overdue'
                          ? '/finance/collections'
                          : '/dashboard',
                    )
                  }
                >
                  Open
                </button>
              </div>
            ))}
            {signalNeeds.map((card, idx) => (
              <div
                key={card.id}
                style={{
                  ...cardStyle,
                  borderColor: idx === 0 ? 'rgba(248,113,113,0.45)' : 'rgba(251,191,36,0.35)',
                }}
              >
                <strong style={{ fontSize: 13, display: 'block' }}>{card.title}</strong>
                <p style={{ margin: '6px 0 12px', fontSize: 12, color: '#94A3B8' }}>{signalWhy(card.why)}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={primaryBtn} onClick={() => navigate(card.href || '/agent')}>
                    {card.action || 'Open'}
                  </button>
                  <button
                    type="button"
                    style={ghostBtn}
                    onClick={() => setDismissed((prev) => new Set(prev).add(card.id))}
                  >
                    Later
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER */}
        <section style={{ ...panelStyle, padding: 12, overflow: 'visible' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto', aspectRatio: '1' }}>
            <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <radialGradient id="nexusOrbGrad" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#E9D5FF" />
                  <stop offset="35%" stopColor="#A78BFA" />
                  <stop offset="70%" stopColor="#4F8EF7" />
                  <stop offset="100%" stopColor="#1E3A5F" />
                </radialGradient>
                <filter id="orbGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="12" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx={CX} cy={CY} r={RING_R + 8} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" strokeDasharray="3 6" />
              {PLANET_RING_ORDER.map((id, i) => {
                const planet = planetById(planets, id);
                const color = PLANET_STATUS_COLOR[planet?.status || 'offline'];
                return (
                  <circle
                    key={id}
                    cx={CX}
                    cy={CY}
                    r={RING_R}
                    fill="none"
                    stroke={color}
                    strokeWidth="14"
                    strokeDasharray={`${segmentLen - gap} ${RING_CIRC - (segmentLen - gap)}`}
                    strokeDashoffset={-i * segmentLen}
                    transform={`rotate(-90 ${CX} ${CY})`}
                    opacity={0.95}
                    style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                  />
                );
              })}
              <circle cx={CX} cy={CY} r={86} fill="url(#nexusOrbGrad)" filter="url(#orbGlow)" opacity={0.92} />
              <circle cx={CX} cy={CY} r={86} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            </svg>

            {/* Push-to-talk orb hit target */}
            <button
              type="button"
              aria-label={
                voice.voiceState === 'listening'
                  ? 'Stop recording'
                  : voice.voiceState === 'speaking'
                    ? 'Stop speaking'
                    : 'Talk to Zava'
              }
              onClick={voice.onOrb}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '41%',
                aspectRatio: '1',
                borderRadius: '50%',
                border: voice.voiceState === 'listening' ? '2px solid #5EEAD4' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                zIndex: 4,
                boxShadow:
                  voice.voiceState === 'listening'
                    ? '0 0 28px rgba(45,212,191,0.55)'
                    : voice.voiceState === 'speaking'
                      ? '0 0 28px rgba(167,139,250,0.45)'
                      : 'none',
              }}
            />

            {/* Welcome over orb — health score hidden until defined */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                width: 160,
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25, textShadow: '0 2px 12px rgba(0,0,0,0.55)' }}>
                <div>Welcome back,</div>
                <div>{name}</div>
              </div>
              {shellReady && needs > 0 && (
                <div style={{ marginTop: 12, fontSize: 22, fontWeight: 900, lineHeight: 1.05, color: '#F87171' }}>
                  {needs}
                </div>
              )}
              {shellReady && needs > 0 && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    color: 'rgba(248,113,113,0.9)',
                    textTransform: 'uppercase',
                  }}
                >
                  need you
                </div>
              )}
            </div>

            {/* Planets outside ring */}
            {RING.map((slot) => {
              const planet = planetById(planets, slot.id);
              if (!planet) return null;
              const rad = (slot.angle * Math.PI) / 180;
              const x = CX + ORBIT_R * Math.cos(rad);
              const y = CY + ORBIT_R * Math.sin(rad);
              const color = PLANET_STATUS_COLOR[planet.status];
              const glow = activePlanetId === planet.id || (activeCard && String(activeCard.module || '').toLowerCase().includes(planet.id.split('_')[0]));
              const Icon = PLANET_ICON[planet.id];
              const leftPct = (x / VIEW) * 100;
              const topPct = (y / VIEW) * 100;
              return (
                <button
                  key={planet.id}
                  type="button"
                  title={`${planet.label}: ${planet.metricLabel}`}
                  onClick={() => onPlanet(planet)}
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: 'translate(-50%, -50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    width: 72,
                    zIndex: 3,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      margin: '0 auto',
                      borderRadius: '50%',
                      border: `2px solid ${color}`,
                      background: 'rgba(6,12,24,0.92)',
                      boxShadow: glow ? `0 0 22px ${color}` : `0 0 14px ${color}99`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={18} color={color} strokeWidth={2.25} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: '#E2E8F0', lineHeight: 1.1 }}>
                    {planet.label}
                    {planet.metricLabel ? ` · ${planet.metricLabel}` : ''}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color, marginTop: 2 }}>
                    {planet.status === 'error' ? 'Retry' : planet.orbitValue}
                  </div>
                </button>
              );
            })}
          </div>
          {!loadingExtras && loadMs != null && (
            <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, color: '#64748B' }}>
              {requestCount} requests · {loadMs} ms
            </div>
          )}
        </section>

        {/* RIGHT */}
        <aside style={panelStyle}>
          <SectionTitle>{voice.voiceState === 'speaking' ? 'Zava · speaking' : 'Zava'}</SectionTitle>
          {!shellReady ? (
            <Muted>Loading…</Muted>
          ) : activeCard ? (
            <div style={{ ...cardStyle, borderColor: 'rgba(94,234,212,0.35)', boxShadow: '0 0 24px rgba(45,212,191,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: '#5EEAD4' }}>
                  {speakModule} ({activeIndex} OF {speakable.length || 1})
                </span>
                <Waveform compact />
              </div>
              <strong style={{ fontSize: 16, display: 'block', lineHeight: 1.3 }}>{activeCard.title}</strong>
              <div style={{ fontSize: 20, fontWeight: 800, margin: '10px 0 8px', color: '#F8FAFC' }}>
                {signalFigure(activeCard) || companyAmount(activeCard.money)}
              </div>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 14px', lineHeight: 1.45 }}>
                {signalWhy(activeCard.why)}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={tealBtn} onClick={() => navigate(activeCard.href || '/agent')}>
                  {activeCard.action || 'Open'}
                </button>
                <button type="button" style={ghostBtn} onClick={nextUpdate} disabled={speakable.length < 2}>
                  Next update
                </button>
              </div>
            </div>
          ) : (
            <Muted>
              {attentionFacts.length > 0
                ? welcomeLine
                : cardsLoad.state === 'error'
                  ? "Couldn't load signal details."
                  : 'No extra updates yet.'}
            </Muted>
          )}

          <SectionTitle style={{ marginTop: 22 }}>Coming up</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {upcoming.length === 0 && <Muted>{cardsLoad.state === 'unavailable' ? 'Loading…' : 'None right now.'}</Muted>}
            {upcoming.map((card) => {
                const color =
                  String(card.priority).toLowerCase() === 'urgent'
                    ? PLANET_STATUS_COLOR.needs_you
                    : String(card.priority).toLowerCase() === 'today'
                      ? PLANET_STATUS_COLOR.watch
                      : PLANET_STATUS_COLOR.info;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setActiveCardId(card.id)}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(148,163,184,0.1)',
                      padding: '10px 0',
                      cursor: 'pointer',
                      color: '#E2E8F0',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color,
                        boxShadow: `0 0 8px ${color}`,
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>
                        {card.module ? String(card.module).replace(/^\w/, (c) => c.toUpperCase()) : 'Update'}
                      </span>
                      <span style={{ display: 'block', fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                        {card.title}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </aside>
      </div>

      {/* Timeline */}
      <section style={{ ...panelStyle, marginTop: 14, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Today · 6 AM to 6 PM</SectionTitle>
          {nowMinute >= 360 && nowMinute <= 1080 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#5EEAD4', fontFamily: 'ui-monospace, monospace' }}>
              {formatNowLabel(now)}
            </span>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            fontSize: 10,
            color: '#64748B',
            marginLeft: 64,
            marginBottom: 6,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {['6 AM', '8', '10', '12', '2 PM', '4', '6 PM'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 10 }}>
          {(['money', 'goods', 'team'] as TimelineLaneId[]).map((lane) => {
            const laneEvents = timeline.filter((e) => e.lane === lane);
            const timed = laneEvents.filter((e) => e.minuteOfDay != null);
            const undated = laneEvents.filter((e) => e.timeNotRecorded);
            const dotColor =
              lane === 'money' ? '#34D399' : lane === 'goods' ? '#60A5FA' : '#A78BFA';
            return (
              <div key={lane} style={{ display: 'contents' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', paddingTop: 10 }}>{laneLabel(lane)}</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={trackStyle}>
                    {nowMinute >= 360 && nowMinute <= 1080 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${((nowMinute - 360) / 720) * 100}%`,
                          top: -4,
                          bottom: -4,
                          width: 2,
                          background: '#5EEAD4',
                          boxShadow: '0 0 12px #5EEAD4',
                          zIndex: 2,
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
                            background: ev.expected ? 'transparent' : dotColor,
                            boxShadow: ev.expected ? 'none' : `0 0 10px ${dotColor}`,
                            cursor: ev.href ? 'pointer' : 'default',
                            padding: 0,
                            zIndex: 3,
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
        @keyframes zavaWave {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

function Waveform({ compact }: { compact?: boolean }) {
  const bars = compact ? 8 : 16;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: compact ? 14 : 18 }} aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          style={{
            width: 2,
            height: '100%',
            borderRadius: 1,
            background: '#5EEAD4',
            opacity: 0.55 + (i % 3) * 0.1,
            transformOrigin: 'center',
            animation: `zavaWave ${0.7 + (i % 5) * 0.12}s ease-in-out ${i * 0.05}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

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

const rootStyle: CSSProperties = {
  minHeight: '100%',
  position: 'relative',
  overflow: 'hidden',
  color: '#E8EEF9',
  padding: '16px 18px 28px',
  fontFamily: 'ui-sans-serif, system-ui, Segoe UI, sans-serif',
  background: '#030712',
};

const starsStyle: CSSProperties = {
  pointerEvents: 'none',
  position: 'absolute',
  inset: 0,
  opacity: 0.45,
  backgroundImage:
    'radial-gradient(1px 1px at 8% 18%, #fff 0, transparent 2px), radial-gradient(1px 1px at 22% 72%, #cbd5e1 0, transparent 2px), radial-gradient(1px 1px at 48% 12%, #fff 0, transparent 2px), radial-gradient(1px 1px at 66% 44%, #94a3b8 0, transparent 2px), radial-gradient(1.5px 1.5px at 82% 78%, #fff 0, transparent 2px), radial-gradient(1px 1px at 91% 28%, #e2e8f0 0, transparent 2px)',
};

const nebulaStyle: CSSProperties = {
  pointerEvents: 'none',
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(ellipse 55% 40% at 50% 42%, rgba(79,110,200,0.22) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 70% 60%, rgba(124,58,237,0.12) 0%, transparent 65%)',
};

const dashLinkStyle: CSSProperties = {
  fontSize: 12,
  color: '#93C5FD',
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid rgba(148,163,184,0.25)',
  borderRadius: 999,
  padding: '4px 10px',
};

const gridStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 0.95fr) minmax(360px, 1.35fr) minmax(240px, 0.95fr)',
  gap: 14,
  alignItems: 'stretch',
};

const panelStyle: CSSProperties = {
  background: 'rgba(8, 14, 28, 0.55)',
  border: '1px solid rgba(148,163,184,0.14)',
  borderRadius: 18,
  padding: 16,
  backdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};

const cardStyle: CSSProperties = {
  background: 'rgba(10,18,34,0.75)',
  border: '1px solid rgba(148,163,184,0.16)',
  borderRadius: 14,
  padding: '12px 12px',
};

const voicePanelStyle: CSSProperties = {
  ...cardStyle,
  borderColor: 'rgba(52,211,153,0.25)',
};

const transcriptStyle: CSSProperties = {
  fontSize: 12,
  color: '#CBD5E1',
  lineHeight: 1.45,
};

const whoStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.12em',
  color: '#5EEAD4',
  marginRight: 6,
};

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '8px 12px',
  background: '#22C55E',
  color: '#04120a',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
};

const tealBtn: CSSProperties = {
  ...primaryBtn,
  background: '#2DD4BF',
};

const ghostBtn: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.35)',
  borderRadius: 10,
  padding: '8px 12px',
  background: 'transparent',
  color: '#CBD5E1',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

const chipBtn: CSSProperties = {
  border: '1px solid rgba(94,234,212,0.35)',
  borderRadius: 999,
  padding: '6px 10px',
  background: 'rgba(8,16,32,0.85)',
  color: '#5EEAD4',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  textAlign: 'left',
};

const trackStyle: CSSProperties = {
  position: 'relative',
  height: 40,
  borderRadius: 10,
  background: 'rgba(15,23,42,0.65)',
  border: '1px solid rgba(148,163,184,0.12)',
};
