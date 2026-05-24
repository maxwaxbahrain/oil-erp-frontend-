import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie,
  CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { RefreshCw, Settings, Send } from 'lucide-react';

// ─── Shared styles ───────────────────────────────────────────────
const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 12,
  padding: '14px',
};

const tooltipStyle: CSSProperties = {
  backgroundColor: 'var(--color-redwood-bg-surface)',
  border: '1px solid rgba(79,142,247,0.3)',
  borderRadius: 8,
  color: 'var(--color-redwood-text-main)',
  fontSize: 11,
};

const gridColor = 'rgba(255,255,255,0.04)';
const tickColor = '#3E5678';

const headerBtnGhost: CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: '#4F8EF7',
  border: '1.5px solid #4F8EF7',
  borderRadius: 7,
  fontSize: 10.5,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'inherit',
};

// ─── Hardcoded data (no API per spec) ────────────────────────────

// KPI sparklines
const SPARK_AGENTS    = [2,3,2,4,3,5,6].map((v,i)=>({i,v}));
const SPARK_APPROVAL  = [3,1,2,1,2,2,2].map((v,i)=>({i,v}));
const SPARK_AUTO      = [6,8,9,11,10,13,14].map((v,i)=>({i,v}));
const SPARK_FORECAST  = [84,85,86,87,88,90,91].map((v,i)=>({i,v}));
const SPARK_AMAZON    = [1,2,2,1,3,2,2].map((v,i)=>({i,v}));

// Revenue + Forecast line chart (Section 3 LEFT)
const REVENUE = [
  { m: 'Dec', actual: 210,  forecast: undefined as number | undefined },
  { m: 'Jan', actual: 255,  forecast: undefined },
  { m: 'Feb', actual: 315,  forecast: undefined },
  { m: 'Mar', actual: 270,  forecast: undefined },
  { m: 'Apr', actual: 390,  forecast: undefined },
  { m: 'May', actual: 414,  forecast: 414 },
  { m: 'Jun', actual: undefined as number | undefined, forecast: 460 },
  { m: 'Jul', actual: undefined,                       forecast: 490 },
];

// Automation activity stacked bars (Section 3 CENTRE)
const AUTOMATION = [
  { hr: '8am',  Marcus: 1, ARIA: 0, Email: 0, AutoPO: 0 },
  { hr: '9am',  Marcus: 3, ARIA: 1, Email: 0, AutoPO: 0 },
  { hr: '10am', Marcus: 2, ARIA: 2, Email: 1, AutoPO: 0 },
  { hr: '11am', Marcus: 2, ARIA: 1, Email: 2, AutoPO: 1 },
  { hr: '12pm', Marcus: 1, ARIA: 2, Email: 1, AutoPO: 2 },
  { hr: '1pm',  Marcus: 2, ARIA: 3, Email: 0, AutoPO: 1 },
  { hr: '2pm',  Marcus: 1, ARIA: 1, Email: 0, AutoPO: 0 },
];

// AI Accuracy donut (Section 3 RIGHT)
const ACCURACY = [
  { name: 'Demand',  value: 91, fill: '#22C55E' },
  { name: 'Anomaly', value: 89, fill: '#4F8EF7' },
  { name: 'ARIA',    value: 92, fill: '#7C3AED' },
  { name: 'Amazon',  value: 80, fill: '#F59E0B' },
];

// Demand forecast horizontal bars (Section 4 LEFT)
const DEMAND_DIST = [
  { name: 'OW16 SP',    units: 180, color: '#22C55E' },
  { name: 'Shell HX7',  units: 140, color: '#22C55E' },
  { name: 'OW20 SP',    units: 90,  color: '#4F8EF7' },
  { name: 'Castrol',    units: 75,  color: '#7C3AED' },
  { name: 'Mobil 5W30', units: 35,  color: '#F59E0B' },
  { name: 'Zenol 0W20', units: 8,   color: '#EF4444' },
];

// Amazon BSR Trend (Section 4 CENTRE) — 14 days, 3 SKUs
const AMAZON_BSR = [
  { d: 1,  OW16: 290, Shell: 200, Zenol: 9200  },
  { d: 2,  OW16: 295, Shell: 205, Zenol: 9400  },
  { d: 3,  OW16: 305, Shell: 210, Zenol: 9700  },
  { d: 4,  OW16: 300, Shell: 208, Zenol: 10100 },
  { d: 5,  OW16: 310, Shell: 215, Zenol: 10500 },
  { d: 6,  OW16: 312, Shell: 215, Zenol: 10800 },
  { d: 7,  OW16: 310, Shell: 218, Zenol: 11000 },
  { d: 8,  OW16: 315, Shell: 212, Zenol: 11300 },
  { d: 9,  OW16: 320, Shell: 215, Zenol: 11600 },
  { d: 10, OW16: 335, Shell: 210, Zenol: 11800 },
  { d: 11, OW16: 358, Shell: 212, Zenol: 12000 },
  { d: 12, OW16: 390, Shell: 215, Zenol: 12100 },
  { d: 13, OW16: 420, Shell: 213, Zenol: 12300 },
  { d: 14, OW16: 445, Shell: 215, Zenol: 12400 },
];

// Agent Performance vs Target (Section 4 RIGHT)
const AGENT_PERF = [
  { name: 'Marcus', actual: 91,  target: 88, color: '#4F8EF7' },
  { name: 'Amazon', actual: 80,  target: 83, color: '#FB923C' },
  { name: 'ARIA',   actual: 92,  target: 88, color: '#7C3AED' },
  { name: 'Email',  actual: 97,  target: 94, color: '#22C55E' },
  { name: 'PO',     actual: 100, target: 94, color: '#F59E0B' },
  { name: 'Voice',  actual: 82,  target: 78, color: '#00D4AA' },
];

// Accuracy 7-day trend (Section 6 LEFT)
const ACC_TREND = [
  { d: 'Sat',   v: 74 },
  { d: 'Sun',   v: 83 },
  { d: 'Mon',   v: 79 },
  { d: 'Tue',   v: 88 },
  { d: 'Wed',   v: 86 },
  { d: 'Thu',   v: 90 },
  { d: 'Today', v: 88 },
];

// Automation timeline bubbles (Section 6 RIGHT)
const TIMELINE = [
  { agent: 'Marcus',  h: 9.0,  v: 7, color: '#4F8EF7' },
  { agent: 'ARIA',    h: 10.5, v: 5, color: '#7C3AED' },
  { agent: 'Email',   h: 11.2, v: 3, color: '#22C55E' },
  { agent: 'Auto PO', h: 12.4, v: 2, color: '#F59E0B' },
  { agent: 'Amazon',  h: 13.2, v: 2, color: '#FB923C' },
  { agent: 'Voice',   h: 13.8, v: 1, color: '#00D4AA' },
];

// AI Insights (Section 7 right panel 2)
const INSIGHTS = [
  { icon: '🔴', tone: '#EF4444', toneBg: 'rgba(239,68,68,.10)', label: 'Critical', text: 'OW16 supplier +18% AND BSR dropping. Margin 34%→22% if approved now.',         conf: 94, cta: 'Decide on PO ↑', ctaColor: '#EF4444' },
  { icon: '🟠', tone: '#FB923C', toneBg: 'rgba(251,146,60,.10)', label: 'Amazon',   text: 'Zenol 0W20 ACOS 38.6% — burning $140/mo. Pause immediately.',                  conf: 91, cta: 'Pause Zenol ads →', ctaColor: '#FB923C' },
  { icon: '🟡', tone: '#F59E0B', toneBg: 'rgba(245,158,11,.10)', label: 'Demand',   text: 'Mobil 5W30 demand -40% vs last month. 203 units = 6-month overstock risk.',     conf: 87, cta: 'Create promo →', ctaColor: '#F59E0B' },
  { icon: '🔵', tone: '#4F8EF7', toneBg: 'rgba(79,142,247,.10)', label: 'Opportunity', text: '3 customers asked ARIA about bulk OW16 in 48h. $4,200 potential.',           conf: 79, cta: 'Draft offer →', ctaColor: '#4F8EF7' },
];

// AI Decisions Log (Section 7 right panel 3)
const DECISIONS = [
  { icon: '🟠', text: 'Amazon AI: OW16 BSR drop traced to FastLube UK. Marcus alerted.', time: '13:14', tag: 'Amazon AI',   tagBg: 'rgba(251,146,60,.18)', tagColor: '#FB923C', badge: '⚠ Watch',   badgeBg: 'rgba(245,158,11,.18)', badgeColor: '#FCD34D' },
  { icon: '🟢', text: 'Voice: Desert Auto order $672. Auto-logged CRM + Van 01 dispatch.', time: '12:51', tag: 'Voice',      tagBg: 'rgba(0,212,170,.18)',  tagColor: '#00D4AA', badge: '✓ Done',    badgeBg: 'rgba(34,197,94,.18)',  badgeColor: '#86EFAC' },
  { icon: '🟡', text: 'Auto PO: OW16 × 80 units $3,040 — awaiting approval.',              time: '12:40', tag: 'Auto PO',    tagBg: 'rgba(245,158,11,.18)', tagColor: '#FCD34D', badge: '⚠ Pending', badgeBg: 'rgba(245,158,11,.18)', badgeColor: '#FCD34D' },
  { icon: '🟣', text: 'ARIA: WAQAS bulk pricing — 5% discount offered.',                    time: '13:02', tag: 'ARIA',       tagBg: 'rgba(124,58,237,.18)', tagColor: '#A78BFA', badge: '✓ Done',    badgeBg: 'rgba(34,197,94,.18)',  badgeColor: '#86EFAC' },
];

// Marcus replies
const REPLIES: Record<string, string> = {
  'AI recap?':    'Amazon AI spotted OW16 BSR drop — traced to FastLuke UK. Voice took $672 order. ARIA resolved 5 queries. Auto PO raised. 2 still need your decision.',
  'Approve PO?':  'Hold — supplier 18% above avg AND Amazon BSR falling. Recommend 40 units only to bridge, then negotiate.',
  'BSR drop?':    'Amazon AI traced it to FastLuke UK cutting price 8%. Buy Box still 82%. Recommend ads over price cut given supplier spike.',
};
const DEFAULT_REPLY = 'Analysing against live data. Key crossover: OW16 has stress from supplier (+18%) and Amazon BSR falling. Resolve together.';

// ─── KPI card helper ────────────────────────────────────────────
function KpiCard(cfg: {
  stripe: string;
  icon: string;
  label: string;
  value: string;
  valueColor: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  spark: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--color-redwood-bg-surface)',
      border: '1px solid var(--color-redwood-border)',
      borderRadius: 12,
      padding: '12px 14px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 3,
        background: cfg.stripe,
        borderRadius: '12px 12px 0 0',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
          <span style={{ fontSize: 13 }}>{cfg.icon}</span>{cfg.label}
        </div>
        <span style={{
          fontSize: 8, fontWeight: 700, padding: '2px 6px',
          borderRadius: 999, background: cfg.badgeBg, color: cfg.badgeColor,
        }}>{cfg.badge}</span>
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700,
        color: cfg.valueColor,
        fontFamily: "'Syne',sans-serif",
        lineHeight: 1.05,
        letterSpacing: '-0.5px',
      }}>{cfg.value}</div>
      <div style={{ height: 28, margin: '0 -6px -2px' }}>{cfg.spark}</div>
    </div>
  );
}

// ─── Insight card helper ────────────────────────────────────────
function InsightCard(ins: typeof INSIGHTS[number]) {
  return (
    <div style={{
      background: ins.toneBg,
      border: `1px solid ${ins.tone}33`,
      borderLeft: `3px solid ${ins.tone}`,
      borderRadius: 8,
      padding: '8px 10px',
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: ins.tone, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{ins.icon}</span>{ins.label}
        </span>
        <span style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', fontWeight: 600 }}>{ins.conf}% conf</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--color-redwood-text-main)', lineHeight: 1.35, marginBottom: 6 }}>{ins.text}</div>
      <button
        type="button"
        style={{
          background: 'transparent',
          border: `1px solid ${ins.ctaColor}`,
          color: ins.ctaColor,
          padding: '3px 8px',
          borderRadius: 6,
          fontSize: 9.5,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
        {ins.cta}
      </button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────
export default function AIHubDashboard() {
  const navigate = useNavigate();

  // Responsive
  const [cols, setCols] = useState({
    kpi: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 3 : 2,
    twoCol: typeof window !== 'undefined' && window.innerWidth >= 1024,
    threeCol: typeof window !== 'undefined' && window.innerWidth >= 1024,
  });
  useEffect(() => {
    const update = () => setCols({
      kpi: window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 3 : 2,
      twoCol: window.innerWidth >= 1024,
      threeCol: window.innerWidth >= 1024,
    });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Approval states
  const [poDone, setPoDone] = useState(false);
  const [emailDone, setEmailDone] = useState(false);

  // Marcus chat
  const [chatInput, setChatInput] = useState('');
  const [chat, setChat] = useState<Array<{ from: 'marcus' | 'you'; text: string; time: string }>>([
    { from: 'marcus', time: '09:30',
      text: 'Morning. 2 approvals need you — OW16 PO and Qahir email. OW16 BSR dropping while supplier spiked +18%. I\'d negotiate first.' },
  ]);

  const sendChat = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const reply = REPLIES[t] ?? DEFAULT_REPLY;
    setChat((prev) => [
      ...prev,
      { from: 'you', text: t, time },
      { from: 'marcus', text: reply, time },
    ]);
    setChatInput('');
  };

  // Demand toggle
  const [demandView, setDemandView] = useState<'distribution' | 'amazon' | 'combined'>('distribution');

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80 }}>

      {/* ────────── PAGE HEADER ────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 20, fontWeight: 600,
            color: 'var(--color-redwood-text-main)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: "'Syne',sans-serif", letterSpacing: '-0.5px',
          }}>
            <span style={{ color: '#7C3AED' }}>✦</span> AI Hub — Intelligence Centre
          </h1>
          <p style={{ fontSize: 10.5, color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
            Agent oversight · Approvals · AI insights · Autonomous decisions log
          </p>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button type="button" style={headerBtnGhost}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button type="button" style={headerBtnGhost}>
            <Settings size={12} /> Configure agents
          </button>
        </div>
      </div>

      {/* ────────── SECTION 1 — APPROVAL HERO ────────── */}
      <div style={{
        background: 'rgba(239,68,68,.06)',
        border: '1px solid rgba(239,68,68,.4)',
        borderRadius: 12,
        padding: 14,
        boxShadow: '0 0 24px rgba(239,68,68,.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#EF4444', display: 'inline-block',
          }} className="animate-pulse" />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            color: '#EF4444', textTransform: 'uppercase',
          }}>
            2 AI Decisions Waiting For Your Approval Right Now
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: cols.twoCol ? '1fr 1fr' : '1fr',
          gap: 10,
        }}>
          {/* Card 1 — Auto PO */}
          <div style={{
            background: 'var(--color-redwood-bg-surface)',
            border: '1px solid var(--color-redwood-border)',
            borderRadius: 10,
            padding: 12,
            opacity: poDone ? 0.4 : 1,
            transition: 'opacity 0.2s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                Auto PO — OW16 × 80 units
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px',
                borderRadius: 999,
                background: 'rgba(245,158,11,.18)', color: '#FCD34D',
                flexShrink: 0,
              }}>Auto PO</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', marginBottom: 6 }}>
              $3,040 · Bettano UAE · 3-day lead time · stock at reorder point
            </div>
            <div style={{
              fontSize: 10, color: '#EF4444', fontWeight: 600,
              background: 'rgba(239,68,68,.08)',
              padding: '5px 8px',
              borderRadius: 6,
              marginBottom: 8,
              border: '1px solid rgba(239,68,68,.2)',
            }}>
              ⚠ Supplier +18% above avg — margin 34%→22%
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setPoDone(true)}
                disabled={poDone}
                style={{
                  background: '#22C55E', color: '#fff',
                  border: 'none', borderRadius: 6,
                  padding: '5px 10px', fontSize: 10, fontWeight: 600,
                  cursor: poDone ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}>
                {poDone ? '✓ Done' : 'Approve PO ✓'}
              </button>
              <button type="button" style={{
                background: 'transparent', color: '#4F8EF7',
                border: '1px solid #4F8EF7', borderRadius: 6,
                padding: '5px 10px', fontSize: 10, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>View PO →</button>
              <button type="button" style={{
                background: 'rgba(255,255,255,.06)', color: 'var(--color-redwood-text-muted)',
                border: '1px solid var(--color-redwood-border)', borderRadius: 6,
                padding: '5px 10px', fontSize: 10, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Negotiate</button>
            </div>
          </div>

          {/* Card 2 — Collection Email */}
          <div style={{
            background: 'var(--color-redwood-bg-surface)',
            border: '1px solid var(--color-redwood-border)',
            borderRadius: 10,
            padding: 12,
            opacity: emailDone ? 0.4 : 1,
            transition: 'opacity 0.2s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                Collection Email — Qahir
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px',
                borderRadius: 999,
                background: 'rgba(34,197,94,.18)', color: '#86EFAC',
                flexShrink: 0,
              }}>Email Bot</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', marginBottom: 6 }}>
              $3,875 overdue 32 days · firm tone · draft ready · 97% credit limit
            </div>
            <div style={{
              fontSize: 10, color: '#F59E0B', fontWeight: 600,
              background: 'rgba(245,158,11,.08)',
              padding: '5px 8px',
              borderRadius: 6,
              marginBottom: 8,
              border: '1px solid rgba(245,158,11,.2)',
            }}>
              ⚠ Auto credit hold applies Friday
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setEmailDone(true)}
                disabled={emailDone}
                style={{
                  background: '#22C55E', color: '#fff',
                  border: 'none', borderRadius: 6,
                  padding: '5px 10px', fontSize: 10, fontWeight: 600,
                  cursor: emailDone ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}>
                {emailDone ? '✓ Done' : 'Send Now ✓'}
              </button>
              <button type="button" style={{
                background: 'transparent', color: '#4F8EF7',
                border: '1px solid #4F8EF7', borderRadius: 6,
                padding: '5px 10px', fontSize: 10, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Preview →</button>
              <button type="button" style={{
                background: 'rgba(255,255,255,.06)', color: 'var(--color-redwood-text-muted)',
                border: '1px solid var(--color-redwood-border)', borderRadius: 6,
                padding: '5px 10px', fontSize: 10, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Edit tone</button>
            </div>
          </div>
        </div>
      </div>

      {/* ────────── SECTION 2 — KPI ROW (5 cards) ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.kpi},1fr)`, gap: 9 }}>
        {KpiCard({
          stripe: 'linear-gradient(90deg,#4F8EF7,#7C3AED)',
          icon: '🤖', label: 'AI Agents Live',
          value: '6', valueColor: '#4F8EF7',
          badge: 'Active', badgeBg: 'rgba(79,142,247,.18)', badgeColor: '#93C5FD',
          spark: (
            <ResponsiveContainer width="100%" height={28}>
              <AreaChart data={SPARK_AGENTS}>
                <Area type="monotone" dataKey="v" stroke="#4F8EF7" fill="rgba(79,142,247,0.15)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ),
        })}
        {KpiCard({
          stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
          icon: '⏳', label: 'Awaiting Approval',
          value: '2', valueColor: '#F59E0B',
          badge: 'Urgent', badgeBg: 'rgba(239,68,68,.18)', badgeColor: '#FCA5A5',
          spark: (
            <ResponsiveContainer width="100%" height={28}>
              <BarChart data={SPARK_APPROVAL}>
                <Bar dataKey="v" fill="#F59E0B" fillOpacity={0.7} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ),
        })}
        {KpiCard({
          stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
          icon: '⚡', label: 'Autonomous Actions',
          value: '14', valueColor: '#22C55E',
          badge: 'Today', badgeBg: 'rgba(34,197,94,.18)', badgeColor: '#86EFAC',
          spark: (
            <ResponsiveContainer width="100%" height={28}>
              <AreaChart data={SPARK_AUTO}>
                <Area type="monotone" dataKey="v" stroke="#22C55E" fill="rgba(34,197,94,0.15)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ),
        })}
        {KpiCard({
          stripe: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
          icon: '🎯', label: 'Forecast Accuracy',
          value: '91%', valueColor: '#7C3AED',
          badge: '+3% wk', badgeBg: 'rgba(34,197,94,.18)', badgeColor: '#86EFAC',
          spark: (
            <ResponsiveContainer width="100%" height={28}>
              <AreaChart data={SPARK_FORECAST}>
                <Area type="monotone" dataKey="v" stroke="#7C3AED" fill="rgba(124,58,237,0.15)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ),
        })}
        {KpiCard({
          stripe: 'linear-gradient(90deg,#FB923C,#FCD34D)',
          icon: '📦', label: 'Amazon Alerts',
          value: '2', valueColor: '#FB923C',
          badge: 'Action', badgeBg: 'rgba(245,158,11,.18)', badgeColor: '#FCD34D',
          spark: (
            <ResponsiveContainer width="100%" height={28}>
              <BarChart data={SPARK_AMAZON}>
                <Bar dataKey="v" fill="#FB923C" fillOpacity={0.7} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ),
        })}
      </div>

      {/* ────────── SECTION 3 — Performance Intelligence (3-col) ────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols.threeCol ? '1.8fr 1fr 1fr' : '1fr',
        gap: 10,
      }}>
        {/* LEFT — Revenue + Forecast */}
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
              📈 Revenue + AI Forecast
            </div>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={REVENUE} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="aiRevAct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#4F8EF7" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#4F8EF7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aiRevFcst" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="m"  tick={{ fill: tickColor, fontSize: 10 }} stroke="rgba(255,255,255,0.12)" />
              <YAxis             tick={{ fill: tickColor, fontSize: 10 }} stroke="rgba(255,255,255,0.12)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number | undefined) => v != null ? `$${v}k` : ''} />
              <Line type="monotone" dataKey="actual"   stroke="#4F8EF7" strokeWidth={2}                              dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="forecast" stroke="#22C55E" strokeWidth={2} strokeDasharray="4 4"        dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 9.5, color: 'var(--color-redwood-text-muted)', marginTop: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 2, background: '#4F8EF7', display: 'inline-block' }} /> Actual
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 2, background: '#22C55E', display: 'inline-block' }} /> Forecast
            </span>
          </div>
          {/* 3 stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
            {[
              { label: 'This month',      value: '$414k', color: '#4F8EF7' },
              { label: 'July forecast',   value: '$490k', color: '#22C55E' },
              { label: 'vs last month',   value: '+12%',  color: '#22C55E' },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'var(--color-redwood-row-bg)',
                border: '1px solid var(--color-redwood-border)',
                borderRadius: 6,
                padding: '6px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: "'Syne',sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTRE — Automation stacked bar */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
            ⚡ Automation Activity
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={AUTOMATION} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="hr" tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
              <YAxis             tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="Marcus" stackId="a" fill="#4F8EF7" isAnimationActive={false} />
              <Bar dataKey="ARIA"   stackId="a" fill="#7C3AED" isAnimationActive={false} />
              <Bar dataKey="Email"  stackId="a" fill="#22C55E" isAnimationActive={false} />
              <Bar dataKey="AutoPO" stackId="a" fill="#F59E0B" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, fontSize: 9, color: 'var(--color-redwood-text-muted)', marginTop: 6 }}>
            {[
              { label: 'Marcus', color: '#4F8EF7' },
              { label: 'ARIA',   color: '#7C3AED' },
              { label: 'Email',  color: '#22C55E' },
              { label: 'AutoPO', color: '#F59E0B' },
            ].map((l) => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />{l.label}
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT — Accuracy donut */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
            🎯 AI Accuracy
          </div>
          <div style={{ position: 'relative', height: 120 }}>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={ACCURACY} dataKey="value"
                  innerRadius={34} outerRadius={50}
                  startAngle={90} endAngle={-270}
                  paddingAngle={2} isAnimationActive={false}
                >
                  {ACCURACY.map((e, i) => (
                    <Cell key={i} fill={e.fill} stroke="var(--color-redwood-bg-surface)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number | undefined) => `${v ?? 0}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              fontFamily: "'Syne',sans-serif",
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-redwood-text-main)' }}>88%</div>
                <div style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>avg</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            {ACCURACY.map((a) => (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', width: 50, flexShrink: 0 }}>{a.name}</span>
                <div style={{ flex: 1, height: 4, background: gridColor, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${a.value}%`, background: a.fill, borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: 9, color: a.fill, fontWeight: 600, width: 24, textAlign: 'right' }}>{a.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ────────── SECTION 4 — Charts Row 2 (3-col equal) ────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols.threeCol ? '1fr 1fr 1fr' : '1fr',
        gap: 10,
      }}>
        {/* LEFT — Demand Forecast */}
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
              📊 Demand Forecast (30d)
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['distribution', 'amazon', 'combined'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDemandView(v)}
                  style={{
                    background: demandView === v ? 'rgba(79,142,247,.2)' : 'transparent',
                    border: `1px solid ${demandView === v ? '#4F8EF7' : 'var(--color-redwood-border)'}`,
                    color: demandView === v ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                    borderRadius: 5, padding: '3px 7px',
                    fontSize: 9, cursor: 'pointer',
                    textTransform: 'capitalize',
                    fontFamily: 'inherit',
                  }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={118}>
            <BarChart data={DEMAND_DIST} layout="vertical" margin={{ top: 2, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis type="number"                                  tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
              <YAxis dataKey="name" type="category" width={75}      tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="units" isAnimationActive={false}>
                {DEMAND_DIST.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CENTRE — Amazon BSR Trend */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 4 }}>
            📉 Amazon BSR Trend
          </div>
          <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginBottom: 6 }}>
            BSR (lower = better)
          </div>
          <ResponsiveContainer width="100%" height={142}>
            <LineChart data={AMAZON_BSR} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="d" tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
              <YAxis reversed tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="OW16"  stroke="#FB923C" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="Shell" stroke="#4F8EF7" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="Zenol" stroke="#EF4444" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, fontSize: 9, color: 'var(--color-redwood-text-muted)', marginTop: 4, flexWrap: 'wrap' }}>
            {[
              { l: 'OW16 SP',   c: '#FB923C' },
              { l: 'Shell HX7', c: '#4F8EF7' },
              { l: 'Zenol',     c: '#EF4444' },
            ].map((x) => (
              <span key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 2, background: x.c }} />{x.l}
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT — Agent Performance vs Target */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
            🏁 Agent Performance vs Target
          </div>
          <ResponsiveContainer width="100%" height={142}>
            <BarChart data={AGENT_PERF} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
              <YAxis domain={[70, 105]} tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number | undefined) => `${v ?? 0}%`} />
              <Bar dataKey="actual" isAnimationActive={false}>
                {AGENT_PERF.map((a, i) => (
                  <Cell key={i} fill={a.color} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="target" stroke="rgba(255,255,255,.5)" strokeDasharray="4 4" strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceLine y={88} stroke="rgba(255,255,255,.15)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ────────── SECTION 5 — AI Flow Diagram (full width) ────────── */}
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
              How Your AI Agents Work Together — Live Flow
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', marginTop: 2 }}>
              14 actions today · 0 errors
            </div>
          </div>
        </div>
        <style>{`@keyframes aih-dash { from { stroke-dashoffset: 80; } to { stroke-dashoffset: 0; } }`}</style>
        <svg viewBox="0 0 1200 108" width="100%" height="108" style={{ display: 'block' }}>
          <defs>
            <filter id="purpleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker id="aih-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#4F8EF7" />
            </marker>
          </defs>
          {/* Node helper inlined: rect + stripe + title + subtitle */}
          {[
            { x: 4,    w: 160, stripe: '#4F8EF7', border: '#4F8EF7', title: 'Your Data',     sub: 'All modules · live',     glow: false },
            { x: 200,  w: 170, stripe: '#7C3AED', border: '#7C3AED', title: 'Marcus AI',     sub: '7 insights · 91%',       glow: true  },
            { x: 410,  w: 160, stripe: '#FB923C', border: '#FB923C', title: 'Amazon AI',     sub: '2 alerts',               glow: false, y: 4,  h: 44 },
            { x: 410,  w: 160, stripe: '#22C55E', border: '#22C55E', title: 'ARIA · Email · PO · Voice', sub: '12 actions', glow: false, y: 60, h: 44 },
            { x: 610,  w: 170, stripe: '#F59E0B', border: '#F59E0B', title: 'Your Approval', sub: '2 pending · <30s',       glow: false },
            { x: 820,  w: 170, stripe: '#22C55E', border: '#22C55E', title: 'Action Done',   sub: '14 done · 0 errors',     glow: false },
          ].map((n, i) => {
            const y = n.y ?? 16;
            const h = n.h ?? 76;
            return (
              <g key={i} filter={n.glow ? 'url(#purpleGlow)' : undefined}>
                <rect x={n.x} y={y} width={n.w} height={h} rx={8} fill="var(--color-redwood-bg-surface)" stroke={n.border} strokeWidth={1.5} />
                <rect x={n.x} y={y} width={n.w} height={3} rx={1.5} fill={n.stripe} />
                <text x={n.x + 10} y={y + 22} fill="var(--color-redwood-text-main)" fontSize="11" fontWeight="600" fontFamily="'Syne',sans-serif">{n.title}</text>
                <text x={n.x + 10} y={y + h - 12} fill="var(--color-redwood-text-muted)" fontSize="9" fontFamily="'DM Sans',sans-serif">{n.sub}</text>
              </g>
            );
          })}
          {/* Animated bezier arrows */}
          {[
            { d: 'M 164 54 Q 184 54 200 54',  delay: '0s' },
            { d: 'M 370 38 Q 390 38 410 26',  delay: '.4s' },
            { d: 'M 370 70 Q 390 70 410 82',  delay: '.6s' },
            { d: 'M 570 26 Q 590 26 610 50',  delay: '.8s' },
            { d: 'M 570 82 Q 590 82 610 58',  delay: '1s'  },
            { d: 'M 780 54 Q 800 54 820 54',  delay: '1.2s' },
          ].map((a, i) => (
            <path
              key={i}
              d={a.d}
              fill="none"
              stroke="#4F8EF7"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              markerEnd="url(#aih-arrow)"
              style={{ animation: `aih-dash 1.4s linear infinite`, animationDelay: a.delay }}
            />
          ))}
        </svg>
      </div>

      {/* ────────── SECTION 6 — Accuracy Trend + Timeline (2-col) ────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols.twoCol ? '1fr 1fr' : '1fr',
        gap: 10,
      }}>
        {/* LEFT — AI Accuracy Trend */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
            🌱 AI Accuracy Trend (7d)
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={ACC_TREND} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="aih-acc-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#22C55E" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="d" tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
              <YAxis domain={[60, 100]} tick={{ fill: tickColor, fontSize: 9 }} stroke="rgba(255,255,255,0.12)" tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number | undefined) => `${v ?? 0}%`} />
              <Area type="monotone" dataKey="v" stroke="#22C55E" strokeWidth={2} fill="url(#aih-acc-grad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* RIGHT — Automation Timeline (bubbles) */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
            ⏱ Automation Timeline
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', height: 80, background: 'var(--color-redwood-row-bg)', borderRadius: 6 }}>
              {/* Hour axis at bottom */}
              <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--color-redwood-text-subtle)' }}>
                {['8h','9h','10h','11h','12h','13h','14h'].map((h) => <span key={h}>{h}</span>)}
              </div>
              {/* Bubbles: positioned by hour (8-14 range → 0-100%) */}
              {TIMELINE.map((t, i) => {
                const left = ((t.h - 8) / 6) * 100;
                const size = 8 + t.v * 2;
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    left: `calc(${left}% - ${size/2}px)`,
                    top: `calc(50% - ${size/2}px)`,
                    width: size, height: size,
                    borderRadius: '50%',
                    background: t.color,
                    boxShadow: `0 0 8px ${t.color}66`,
                    opacity: 0.85,
                  }} title={`${t.agent} — ${t.v} actions @ ${Math.floor(t.h)}:${Math.round((t.h % 1) * 60).toString().padStart(2,'0')}`} />
                );
              })}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {TIMELINE.map((t) => (
                <div key={t.agent} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--color-redwood-text-muted)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                  {t.agent}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ────────── SECTION 7 — Agents (left) + Right column ────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols.twoCol ? '1fr 316px' : '1fr',
        gap: 10,
      }}>
        {/* LEFT — Agent Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* 1 — Marcus */}
          <div style={{ ...panel, borderColor: '#4F8EF7', borderLeftWidth: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                🧠 Marcus — Business Advisor
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#93C5FD' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4F8EF7' }} className="animate-pulse" />
                Monitoring live
              </span>
            </div>
            <div style={{ background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 6, padding: '7px 9px', fontSize: 10.5, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
              Cross-referencing OW16 supplier +18% with Amazon BSR drop #312→#445. Combined risk brief ready.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 8 }}>
              {[
                { v: '7',   l: 'Insights' },
                { v: '91%', l: 'Accuracy' },
                { v: '3',   l: 'Actions'  },
                { v: '1',   l: 'Pending'  },
              ].map((s) => (
                <div key={s.l} style={{ background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>{s.v}</div>
                  <div style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Last action: 13:14 — alerted on OW16</span>
              <div style={{ display: 'flex', gap: 5 }}>
                <button type="button" style={{ background: 'transparent', color: '#4F8EF7', border: '1px solid var(--color-redwood-border)', borderRadius: 5, padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit' }}>All activity →</button>
                <button type="button" style={{ background: '#4F8EF7', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Chat →</button>
              </div>
            </div>
          </div>

          {/* 2 — Amazon Channel AI */}
          <div style={{ ...panel, borderColor: '#FB923C', borderLeftWidth: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                🛒 Amazon Channel AI — 100 SKUs
              </div>
              <span style={{ fontSize: 10, color: '#FB923C', fontWeight: 600 }}>2 alerts</span>
            </div>
            <div style={{ background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.25)', borderRadius: 6, padding: '7px 9px', fontSize: 10.5, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
              OW16 BSR #312→#445 — FastLuke UK cut price 8%. Zenol 0W20 ACOS 38.6% burning $140/mo.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 8 }}>
              {[
                { v: '67%↑',  l: 'Buy Box', color: '#22C55E' },
                { v: '18.3%', l: 'ACOS',    color: '#F59E0B' },
                { v: '2.1%',  l: 'Returns', color: 'var(--color-redwood-text-main)' },
                { v: '4.6★',  l: 'Rating',  color: '#F59E0B' },
              ].map((s) => (
                <div key={s.l} style={{ background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.color, fontFamily: "'Syne',sans-serif" }}>{s.v}</div>
                  <div style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div>
              {[
                { sku: 'OW16',  status: '⚠ Watch',  color: '#FCD34D' },
                { sku: 'Zenol', status: '🔴 Action', color: '#FCA5A5' },
                { sku: 'Shell', status: '✓ Good',   color: '#86EFAC' },
              ].map((r) => (
                <div key={r.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'var(--color-redwood-row-bg)', borderRadius: 5, marginBottom: 3, fontSize: 10 }}>
                  <span style={{ color: 'var(--color-redwood-text-main)' }}>{r.sku}</span>
                  <span style={{ color: r.color, fontWeight: 600 }}>{r.status}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" style={{ background: '#FB923C', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Amazon →</button>
            </div>
          </div>

          {/* 3 — ARIA */}
          <div style={{ ...panel, borderColor: '#4F8EF7', borderLeftWidth: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                💬 ARIA — Customer Service AI
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#93C5FD' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4F8EF7' }} className="animate-pulse" />
                1 live chat
              </span>
            </div>
            <div style={{ background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 6, padding: '7px 9px', fontSize: 10.5, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
              WAQAS Trading — bulk OW16 pricing for 50 units. Calculating 5% discount offer.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 8 }}>
              {[
                { v: '5',    l: 'Queries'   },
                { v: '92%',  l: 'Resolved'  },
                { v: '1',    l: 'Escalated' },
                { v: '2.1m', l: 'Avg resp'  },
              ].map((s) => (
                <div key={s.l} style={{ background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>{s.v}</div>
                  <div style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Escalated: Desert Auto 90-day credit request</span>
              <button type="button" style={{ background: 'transparent', color: '#4F8EF7', border: '1px solid var(--color-redwood-border)', borderRadius: 5, padding: '3px 8px', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit' }}>Escalations (1) →</button>
            </div>
          </div>

          {/* 4 — Email Bot + Auto PO (2 cols) */}
          <div style={{ display: 'grid', gridTemplateColumns: cols.twoCol ? '1fr 1fr' : '1fr', gap: 10 }}>
            <div style={{ ...panel, borderColor: '#F59E0B', borderLeftWidth: 3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 6 }}>
                📧 Email Bot
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, marginBottom: 8 }}>
                {[{v:'3',l:'Sent'},{v:'1',l:'Pending'},{v:'2',l:'Tracked'}].map((s) => (
                  <div key={s.l} style={{ background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>{s.v}</div>
                    <div style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <button type="button" style={{ background: '#4F8EF7', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>Approve Draft ↑</button>
            </div>
            <div style={{ ...panel, borderColor: '#F59E0B', borderLeftWidth: 3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 6 }}>
                🤖 Auto PO
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, marginBottom: 8 }}>
                {[{v:'2',l:'Raised'},{v:'9',l:'Low stock'},{v:'$3k',l:'PO value'}].map((s) => (
                  <div key={s.l} style={{ background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>{s.v}</div>
                    <div style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <button type="button" style={{ background: '#4F8EF7', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>Approve PO ↑</button>
            </div>
          </div>

          {/* 5 — Soltol Voice */}
          <div style={{ ...panel, borderColor: '#00D4AA', borderLeftWidth: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                🎤 Soltol Voice — Inbound Call AI
              </div>
              <span style={{ fontSize: 10, color: '#22C55E', fontWeight: 600 }}>Ready</span>
            </div>
            <div style={{ background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 6, padding: '7px 9px', fontSize: 10.5, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
              Desert Auto — OW16 ETA confirmed. Order: 12× $56 = $672. Auto-logged CRM + Van 01 dispatch.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 8 }}>
              {[
                { v: '8',   l: 'Calls'    },
                { v: '82%', l: 'Score'    },
                { v: '88%', l: 'AI res.'  },
                { v: '1',   l: 'Transfer' },
              ].map((s) => (
                <div key={s.l} style={{ background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>{s.v}</div>
                  <div style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => navigate('/voice/calls')} style={{ background: '#00D4AA', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Call log →</button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — 3 stacked panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Ask Marcus */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                🧠 Marcus — AI Advisor
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#22C55E' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} className="animate-pulse" />
                Online · Claude
              </span>
            </div>
            <div style={{
              height: 138, overflowY: 'auto',
              background: 'var(--color-redwood-row-bg)',
              border: '1px solid var(--color-redwood-border)',
              borderRadius: 6, padding: 8, marginBottom: 6,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {chat.map((m, i) => (
                <div key={i} style={{ alignSelf: m.from === 'you' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{
                    fontSize: 10, color: 'var(--color-redwood-text-main)',
                    background: m.from === 'you' ? 'rgba(79,142,247,.18)' : 'var(--color-redwood-bg-surface)',
                    border: m.from === 'you' ? '1px solid rgba(79,142,247,.3)' : '1px solid var(--color-redwood-border)',
                    borderRadius: 6, padding: '5px 8px', lineHeight: 1.35,
                  }}>
                    {m.text}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--color-redwood-text-subtle)', marginTop: 2, textAlign: m.from === 'you' ? 'right' : 'left' }}>
                    {m.from === 'you' ? 'You' : 'Marcus'} · {m.time}
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); sendChat(chatInput); }}
              style={{ display: 'flex', gap: 5, marginBottom: 6 }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Marcus..."
                style={{
                  flex: 1, padding: '5px 8px',
                  background: 'var(--color-redwood-bg-light)',
                  border: '1px solid var(--color-redwood-border)',
                  borderRadius: 6,
                  fontSize: 10.5,
                  color: 'var(--color-redwood-text-main)',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <button type="submit" style={{
                background: '#4F8EF7', border: 'none', borderRadius: 6,
                width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <Send size={12} color="#fff" />
              </button>
            </form>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(['AI recap?', 'Approve PO?', 'BSR drop?'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => sendChat(p)}
                  style={{
                    fontSize: 9,
                    padding: '3px 7px',
                    background: 'rgba(79,142,247,.12)',
                    border: '1px solid rgba(79,142,247,.3)',
                    color: '#93C5FD',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div style={panel}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
              💡 AI Insights
            </div>
            {INSIGHTS.map((ins, i) => <InsightCard key={i} {...ins} />)}
          </div>

          {/* AI Decisions Log */}
          <div style={panel}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
              📜 AI Decisions Log
            </div>
            {DECISIONS.map((d, i) => (
              <div key={i} style={{
                background: 'var(--color-redwood-row-bg)',
                border: '1px solid var(--color-redwood-border)',
                borderRadius: 6, padding: '6px 8px',
                marginBottom: 5,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{d.icon}</span>
                  <div style={{ fontSize: 10, color: 'var(--color-redwood-text-main)', lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                    {d.text}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: d.tagBg, color: d.tagColor }}>{d.tag}</span>
                    <span style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)' }}>{d.time}</span>
                  </div>
                  <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: d.badgeBg, color: d.badgeColor }}>{d.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
