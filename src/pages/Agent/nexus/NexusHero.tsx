import type { CSSProperties } from 'react';
import { Mic, Search } from 'lucide-react';
import { openGlobalCommandBar, type HomeSummary } from './homeSummaryApi';

const BLUE = '#4F8EF7';
const GREEN = '#22c55e';

export function timeGreeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export type HeroNeedsCounts = { total: number; urgent: number };

/** Title + subline pieces — keep UI and first-mic speech identical. */
export function heroLineParts(
  firstName: string,
  summary: HomeSummary | null,
  now = new Date(),
  needsCounts?: HeroNeedsCounts | null,
): { greeting: string; needsLine: string; needs: number; biggest: string } {
  const greeting = `${timeGreeting(now)}, ${firstName}.`;
  let needsLine: string;
  let needs: number;
  if (needsCounts) {
    needs = needsCounts.total;
    if (needs <= 0) {
      needsLine = summary ? 'Nothing needs you right now.' : 'Loading…';
    } else if (needsCounts.urgent > 0 && needsCounts.urgent < needs) {
      needsLine = `${needsCounts.urgent} urgent · ${needs} total`;
    } else {
      needsLine = `${needs} thing${needs === 1 ? '' : 's'} need you.`;
    }
  } else {
    needs = summary?.needs_you_count ?? 0;
    needsLine =
      needs > 0
        ? `${needs} thing${needs === 1 ? '' : 's'} need you.`
        : summary
          ? 'Nothing needs you right now.'
          : 'Loading…';
  }
  return { greeting, needsLine, needs, biggest: summary?.biggest_line?.trim() || '' };
}

/** Same words as the hero title + biggest line (spoken on first mic tap). */
export function formatHeroSpeakLine(
  firstName: string,
  summary: HomeSummary | null,
  now = new Date(),
  needsCounts?: HeroNeedsCounts | null,
): string {
  const { greeting, needsLine, biggest } = heroLineParts(firstName, summary, now, needsCounts);
  if (biggest) return `${greeting} ${needsLine} ${biggest}`;
  return `${greeting} ${needsLine}`;
}

function formatClock(d: Date): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${hh}:${mm}`;
}

type Props = {
  firstName: string;
  summary: HomeSummary | null;
  updatedLabel?: string | null;
  now?: Date;
  onMicTap: () => void;
  micActive?: boolean;
  /** Same source as left Needs-you list (required for count parity). */
  needsCounts?: HeroNeedsCounts | null;
};

export default function NexusHero({
  firstName,
  summary,
  updatedLabel,
  now = new Date(),
  onMicTap,
  micActive,
  needsCounts,
}: Props) {
  const { greeting, needsLine, needs, biggest } = heroLineParts(firstName, summary, now, needsCounts);

  return (
    <header style={wrap}>
      <div style={leftCol}>
        <div style={orbRow}>
          <div style={orb} aria-hidden />
          <div>
            <div style={titleRow}>
              <span style={greetingText}>{greeting}</span>{' '}
              <span style={{ color: needs > 0 ? '#F87171' : GREEN, fontWeight: 800 }}>{needsLine}</span>
            </div>
            <div style={subRow}>
              <span>{biggest || '…'}</span>
              {updatedLabel ? <span style={ago}>{updatedLabel}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div style={rightCol}>
        <div style={clock}>{formatClock(now)}</div>
        <div style={searchRow}>
          <button type="button" style={searchBtn} onClick={() => openGlobalCommandBar()} title="Open command bar (Ctrl K)">
            <Search size={16} color="#94A3B8" />
            <span style={{ flex: 1, textAlign: 'left', color: '#64748B' }}>Ask Zava or jump to anything…</span>
            <kbd style={kbd}>Ctrl K</kbd>
          </button>
          <button
            type="button"
            style={{
              ...micBtn,
              borderColor: micActive ? BLUE : 'rgba(79,142,247,0.45)',
              boxShadow: micActive ? `0 0 16px ${BLUE}66` : 'none',
            }}
            aria-label={micActive ? 'Stop listening' : 'Talk to Zava'}
            onClick={onMicTap}
          >
            <Mic size={18} color={BLUE} />
          </button>
        </div>
      </div>
    </header>
  );
}

const wrap: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 20,
  flexWrap: 'wrap',
  padding: '8px 4px 16px',
  borderBottom: '1px solid rgba(148,163,184,0.12)',
  marginBottom: 16,
};

const leftCol: CSSProperties = { flex: '1 1 320px', minWidth: 0 };
const rightCol: CSSProperties = { flex: '1 1 280px', minWidth: 220, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' };

const orbRow: CSSProperties = { display: 'flex', gap: 14, alignItems: 'flex-start' };
const orb: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  flexShrink: 0,
  background: `radial-gradient(circle at 35% 30%, #E0E7FF, ${BLUE} 55%, #1E3A8A)`,
  boxShadow: `0 0 24px ${BLUE}88`,
};

const titleRow: CSSProperties = { fontSize: 20, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.3 };
const greetingText: CSSProperties = { color: '#E2E8F0' };
const subRow: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: '#94A3B8',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'baseline',
};
const ago: CSSProperties = { color: '#64748B', fontSize: 12 };
const clock: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  color: '#94A3B8',
  textAlign: 'right',
};
const searchRow: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };
const searchBtn: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: 42,
  padding: '0 12px',
  borderRadius: 10,
  border: '1.5px solid rgba(79,142,247,0.4)',
  background: 'rgba(15,23,42,0.85)',
  cursor: 'pointer',
  color: '#E2E8F0',
  fontSize: 13,
};
const kbd: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: '#64748B',
  border: '1px solid rgba(148,163,184,0.25)',
  borderRadius: 6,
  padding: '2px 6px',
};
const micBtn: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 10,
  border: '1.5px solid rgba(79,142,247,0.45)',
  background: 'rgba(15,23,42,0.9)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
