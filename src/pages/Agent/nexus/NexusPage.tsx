import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';
import { useErpShell, useErpShellReload } from '../../../contexts/ErpShellContext';
import { isStaging } from '../../../config/appEnv';
import { getPayments, getVanLocations } from '../../../services/api';
import { getExpenseStats } from '../../../services/expenseService';
import { listDeliveryNotes } from '../../../services/deliveryService';
import { deriveVanLiveStatus } from '../../../lib/vanLiveStatus';
import {
  alertShellReady,
  attentionFactsFromAlerts,
  computeAlertCounts,
  shellLoadFailureLines,
} from '../../../utils/alertCounts';
import { firstName } from '../zavaCopy';
import {
  buildTimelineEvents,
  type NexusSignalCard,
  type SourceResult,
  type TimelineEvent,
} from './nexusModel';
import { useNexusVoice } from './useNexusVoice';
import NexusAsk from './NexusAsk';
import NexusHero, { formatHeroSpeakLine } from './NexusHero';
import NexusLiveStrip from './NexusLiveStrip';
import NexusNeedsYou from './NexusNeedsYou';
import NexusOrbit from './NexusOrbit';
import NexusTopMetrics from './NexusTopMetrics';
import type { LoadSlot, LoadSlotState } from './liveStripModel';
import { buildNeedsYouItems, countUrgentNeeds } from './needsYouModel';
import {
  buildHomeModules,
  clearHomeSummaryCache,
  formatUpdatedAgo,
  homeSummaryCacheKey,
  loadHomeSummary,
  readHomeSummaryCache,
  writeHomeSummaryCache,
  type BlockState,
  type HomeModuleId,
  type HomeSummary,
  type ModuleSourceExtras,
} from './homeSummaryApi';

type HealthBody = {
  data_health?: NexusSignalCard[];
};

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function shellToSlot(raw: string): LoadSlotState {
  if (raw === 'ok') return 'ok';
  if (raw === 'failed') return 'error';
  if (raw === 'loading') return 'loading';
  return 'unavailable';
}

export default function NexusPage() {
  const { user, hasRole } = useAuth();
  const shell = useErpShell();
  const reloadShell = useErpShellReload();
  const navigate = useNavigate();
  const name = firstName(user?.full_name || user?.username);
  const [cards, setCards] = useState<NexusSignalCard[]>([]);
  const [cardsLoad, setCardsLoad] = useState<SourceResult<true>>(unavailableResult());
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activePlanetId, setActivePlanetId] = useState<string | null>(null);
  const [dismissed] = useState<Set<string>>(() => new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [moduleExtras, setModuleExtras] = useState<ModuleSourceExtras>({});
  const [pendingExpensesState, setPendingExpensesState] = useState<{
    state: BlockState;
    count?: number;
  }>({ state: 'unavailable' });
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const [paymentsTodayLoad, setPaymentsTodayLoad] = useState<LoadSlotState>('unavailable');
  const [dnsTodayLoad, setDnsTodayLoad] = useState<LoadSlotState>('unavailable');
  const cacheKey = homeSummaryCacheKey(
    (user as { tenant_id?: number | string } | null)?.tenant_id ?? null,
    user?.id ?? null,
  );
  const [homeSummary, setHomeSummary] = useState<HomeSummary | null>(() => readHomeSummaryCache(cacheKey));
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  const [fitMarginBottom, setFitMarginBottom] = useState(0);

  // Fill exactly the visible area below the app header (runtime-measured).
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const measure = () => {
      const top = el.getBoundingClientRect().top;
      const parent = el.parentElement;
      const pb = parent ? parseFloat(getComputedStyle(parent).paddingBottom || '0') || 0 : 0;
      const nextH = Math.max(320, Math.floor(window.innerHeight - top));
      setFitHeight(nextH);
      setFitMarginBottom(pb);
    };

    measure();
    window.addEventListener('resize', measure);
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measure())
        : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    const header = document.querySelector('header');
    if (ro && header) ro.observe(header);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, []);

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
  // Instant cache + background refresh once shell is ready.
  useEffect(() => {
    if (!isStaging || !shellReady) return;
    const cached = readHomeSummaryCache(cacheKey);
    if (cached) setHomeSummary(cached);
    let cancelled = false;
    void loadHomeSummary(shell, moduleExtras).then((summary) => {
      if (cancelled) return;
      setPendingExpensesState(
        summary.modules.expenses.state === 'error'
          ? { state: 'error' }
          : summary.modules.expenses.state === 'unavailable'
            ? { state: 'unavailable' }
            : {
                state: 'ok',
                count:
                  typeof summary.modules.expenses.value === 'number'
                    ? summary.modules.expenses.value
                    : undefined,
              },
      );
      setHomeSummary(summary);
      writeHomeSummaryCache(cacheKey, summary);
    });
    return () => {
      cancelled = true;
    };
    // moduleExtras intentionally omitted — vans patch rebuilds modules below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell, shellReady, cacheKey, summaryRefreshKey]);

  // Rebuild orbit modules when vans / expense extras settle (no invented values).
  useEffect(() => {
    if (!isStaging || !shellReady) return;
    setHomeSummary((prev) => {
      if (!prev) return prev;
      const nextModules = buildHomeModules({
        shell,
        pendingExpenses: pendingExpensesState,
        extras: moduleExtras,
      });
      const updated = { ...prev, modules: nextModules };
      writeHomeSummaryCache(cacheKey, updated);
      return updated;
    });
  }, [shell, shellReady, moduleExtras, pendingExpensesState, cacheKey]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Progressive extras: signals, vans, expenses — settle one-by-one.
  useEffect(() => {
    if (!isStaging) return;
    let cancelled = false;
    setCardsLoad(unavailableResult());

    const run = async <T,>(p: Promise<T>): Promise<PromiseSettledResult<T>> => {
      try {
        const value = await p;
        return { status: 'fulfilled', value };
      } catch (reason) {
        return { status: 'rejected', reason };
      }
    };

    void (async () => {
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
          setModuleExtras((prev) => ({
            ...prev,
            vans: {
              state: 'ok',
              online: list.filter((v) => deriveVanLiveStatus(v.recorded_at, v.speed) !== 'offline')
                .length,
              total: list.length,
            },
          }));
        } else {
          setModuleExtras((prev) => ({
            ...prev,
            vans: { state: 'error' },
          }));
        }
      });

      void run(getExpenseStats()).then((expensesSettled) => {
        if (cancelled) return;
        setPendingExpensesState(
          expensesSettled.status === 'fulfilled'
            ? {
                state: 'ok',
                count: Number(expensesSettled.value.pending_approval_count || 0),
              }
            : { state: 'error' },
        );
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // LIVE strip: today's payments + delivery notes (quiet 60s refresh via liveRefreshKey).
  useEffect(() => {
    if (!isStaging) return;
    let cancelled = false;
    const day = todayIsoLocal();
    const run = async <T,>(p: Promise<T>): Promise<PromiseSettledResult<T>> => {
      try {
        const value = await p;
        return { status: 'fulfilled', value };
      } catch (reason) {
        return { status: 'rejected', reason };
      }
    };
    void (async () => {
      const [paymentsSettled, dnsSettled] = await Promise.all([
        run(getPayments({ start_date: day, end_date: day })),
        run(listDeliveryNotes({ delivery_date: day })),
      ]);
      if (cancelled) return;
      setPaymentsTodayLoad(paymentsSettled.status === 'fulfilled' ? 'ok' : 'error');
      setDnsTodayLoad(dnsSettled.status === 'fulfilled' ? 'ok' : 'error');
      const payments = paymentsSettled.status === 'fulfilled' ? paymentsSettled.value : [];
      const dns = dnsSettled.status === 'fulfilled' ? dnsSettled.value : [];
      setTimeline(
        buildTimelineEvents({
          now: new Date(),
          payments,
          deliveryNotes: dns,
          leaveRequests: [],
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, liveRefreshKey]);

  const needsItems = useMemo(
    () =>
      buildNeedsYouItems({
        alertCounts,
        attentionFacts,
        loadFailures,
        cards,
        cardsLoad,
        dismissed,
      }),
    [alertCounts, attentionFacts, loadFailures, cards, cardsLoad, dismissed],
  );
  const needsCounts = useMemo(
    () => ({
      total: needsItems.length,
      urgent: countUrgentNeeds(needsItems),
    }),
    [needsItems],
  );
  const needs = needsCounts.total;
  const speakable = cards.filter((c) => !dismissed.has(c.id));
  const activeCard = speakable.find((c) => c.id === activeCardId) || speakable[0] || null;

  const loadSlots: LoadSlot[] = useMemo(
    () => [
      { id: 'ar', state: shellToSlot(shell.arLoad) },
      { id: 'invoices', state: shellToSlot(shell.invoicesLoad) },
      { id: 'payments', state: shellToSlot(shell.paymentsLoad) },
      { id: 'products', state: shellToSlot(shell.productsLoad) },
      {
        id: 'signals',
        state:
          cardsLoad.state === 'ok'
            ? 'ok'
            : cardsLoad.state === 'error'
              ? 'error'
              : cardsLoad.state === 'unavailable'
                ? 'unavailable'
                : 'loading',
      },
      {
        id: 'vans',
        state: (moduleExtras.vans?.state as LoadSlotState | undefined) || 'unavailable',
      },
      { id: 'expenses', state: pendingExpensesState.state as LoadSlotState },
      { id: 'paymentsToday', state: paymentsTodayLoad },
      { id: 'deliveryNotes', state: dnsTodayLoad },
    ],
    [
      shell.arLoad,
      shell.invoicesLoad,
      shell.paymentsLoad,
      shell.productsLoad,
      cardsLoad,
      moduleExtras.vans?.state,
      pendingExpensesState.state,
      paymentsTodayLoad,
      dnsTodayLoad,
    ],
  );

  const heroSpeakLine = useMemo(
    () => formatHeroSpeakLine(name, homeSummary, now, needsCounts),
    [name, homeSummary, now, needsCounts],
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

  if (!isStaging) {
    return (
      <div style={{ padding: 40, color: '#94A3B8' }}>
        Nexus is available on staging only. <Link to="/dashboard">Go to dashboard</Link>
      </div>
    );
  }

  const activeOrbitModule = (['sales', 'customers', 'collections', 'purchase', 'inventory', 'warehouse', 'delivery', 'finance', 'expenses', 'payroll'] as HomeModuleId[]).includes(
    activePlanetId as HomeModuleId,
  )
    ? (activePlanetId as HomeModuleId)
    : null;

  return (
    <div
      ref={rootRef}
      className="zava-nexus-root"
      data-testid="nexus-viewport-root"
      style={{
        ...rootStyle,
        height: fitHeight != null ? fitHeight : '100%',
        maxHeight: fitHeight != null ? fitHeight : undefined,
        marginBottom: fitMarginBottom ? -fitMarginBottom : 0,
      }}
    >
      <div aria-hidden style={starsStyle} />
      <div aria-hidden style={nebulaStyle} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, marginBottom: 2 }}>
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
        needsCounts={needsCounts}
      />
      <NexusTopMetrics
        summary={homeSummary}
        onRetry={() => {
          setSummaryRefreshKey((k) => k + 1);
          reloadShell();
        }}
      />

      <div className="zava-nexus-grid" style={gridStyle}>
        {/* LEFT — Needs you (scrolls inside panel) */}
        <NexusNeedsYou
          alertCounts={alertCounts}
          attentionFacts={attentionFacts}
          loadFailures={loadFailures}
          cards={cards}
          cardsLoad={cardsLoad}
          dismissed={dismissed}
          items={needsItems}
          shellReady={shellReady}
          onNavigate={(href) => navigate(href)}
          onRetry={() => {
            setReloadKey((k) => k + 1);
            setSummaryRefreshKey((k) => k + 1);
            reloadShell();
          }}
        />

        {/* CENTER — Orbit (scales to box; never page-scroll) */}
        <section style={{ ...panelStyle, padding: 10, overflow: 'hidden', minHeight: 0 }}>
          <NexusOrbit
            needsYouCount={needs}
            modules={homeSummary?.modules ?? null}
            role={user?.role}
            hasRole={hasRole}
            onOrbTap={voice.onOrb}
            orbActive={voice.voiceState === 'listening' || voice.voiceState === 'speaking'}
            activeModuleId={activeOrbitModule}
            onNavigate={(href) => navigate(href)}
            onRetry={() => {
              setReloadKey((k) => k + 1);
              setSummaryRefreshKey((k) => k + 1);
              reloadShell();
            }}
          />
        </section>

        {/* RIGHT — Ask Zava (scrolls inside panel) */}
        <NexusAsk
          onNavigate={(href) => navigate(href)}
          onMicTap={voice.onMicTap}
          micActive={voice.voiceState === 'listening' || voice.voiceState === 'speaking'}
          voiceYouLine={voice.youLine}
          voiceZavaLine={voice.zavaLine}
          voiceThinking={voice.voiceState === 'thinking'}
          voiceNavHref={activeCard?.href || null}
          voiceNavLabel={activeCard ? 'Open update' : null}
        />
      </div>

      {/* Live strip — one line, stays in viewport */}
      <NexusLiveStrip
        timeline={timeline}
        loadSlots={loadSlots}
        onNavigate={(href) => navigate(href)}
        onRefresh={() => setLiveRefreshKey((k) => k + 1)}
      />

      <style>{`
        @media (max-width: 900px) {
          .zava-nexus-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const rootStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  color: '#E8EEF9',
  padding: '8px 12px 8px',
  fontFamily: 'ui-sans-serif, system-ui, Segoe UI, sans-serif',
  background: '#030712',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  minHeight: 0,
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
  gridTemplateColumns: 'minmax(180px, 0.85fr) minmax(280px, 1.5fr) minmax(180px, 0.85fr)',
  gap: 10,
  alignItems: 'stretch',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

const panelStyle: CSSProperties = {
  background: 'rgba(8, 14, 28, 0.55)',
  border: '1px solid rgba(148,163,184,0.14)',
  borderRadius: 18,
  padding: 16,
  backdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  minHeight: 0,
  height: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};