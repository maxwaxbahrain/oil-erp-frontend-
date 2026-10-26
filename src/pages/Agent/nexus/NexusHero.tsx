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
            <Search size={14} color="#94A3B8" />
            <span style={{ flex: 1, textAlign: 'left', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Ask Zava…
            </span>
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
            <Mic size={16} color={BLUE} />
          </button>
        </div>
      </div>
    </header>
  );
}

const wrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'nowrap',
  padding: '4px 2px 8px',
  borderBottom: '1px solid rgba(148,163,184,0.12)',
  marginBottom: 8,
  flexShrink: 0,
  minHeight: 0,
};

const leftCol: CSSProperties = { flex: '1 1 auto', minWidth: 0 };
const rightCol: CSSProperties = {
  flex: '0 1 320px',
  minWidth: 180,
  display: 'flex',
  flexDirection: 'row',
  gap: 8,
  alignItems: 'center',
};

const orbRow: CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 };
const orb: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  flexShrink: 0,
  background: `radial-gradient(circle at 35% 30%, #E0E7FF, ${BLUE} 55%, #1E3A8A)`,
  boxShadow: `0 0 14px ${BLUE}88`,
};

const titleRow: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#F1F5F9',
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const greetingText: CSSProperties = { color: '#E2E8F0' };
const subRow: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  color: '#94A3B8',
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 8,
  alignItems: 'baseline',
  overflow: 'hidden',
};
const ago: CSSProperties = { color: '#64748B', fontSize: 11, flexShrink: 0 };
const clock: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  color: '#94A3B8',
  textAlign: 'right',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};
const searchRow: CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 };
const searchBtn: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 32,
  padding: '0 10px',
  borderRadius: 8,
  border: '1.5px solid rgba(79,142,247,0.4)',
  background: 'rgba(15,23,42,0.85)',
  cursor: 'pointer',
  color: '#E2E8F0',
  fontSize: 12,
  minWidth: 0,
};
const kbd: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: '#64748B',
  border: '1px solid rgba(148,163,184,0.25)',
  borderRadius: 5,
  padding: '1px 5px',
  flexShrink: 0,
};
const micBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1.5px solid rgba(79,142,247,0.45)',
  background: 'rgba(15,23,42,0.9)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
