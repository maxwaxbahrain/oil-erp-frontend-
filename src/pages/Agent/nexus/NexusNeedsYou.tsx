import { useMemo, useState, type CSSProperties } from 'react';
import type { AttentionFact, AlertCounts } from '../../../utils/alertCounts';
import type { NexusSignalCard, SourceResult } from './nexusModel';
import {
  buildNeedsYouItems,
  focusNeedsYouItem,
  moreCount,
  nextUpItems,
  type NeedsYouItem,
} from './needsYouModel';

const GREEN = '#22c55e';
const RED = '#F87171';
const AMBER = '#F59E0B';

type Props = {
  alertCounts: AlertCounts;
  attentionFacts: AttentionFact[];
  loadFailures: string[];
  cards: NexusSignalCard[];
  cardsLoad: SourceResult<true>;
  dismissed?: Set<string>;
  /** Prebuilt list (same source as hero counts). */
  items?: NeedsYouItem[];
  shellReady: boolean;
  onNavigate: (href: string) => void;
  onRetry: () => void;
};

export default function NexusNeedsYou({
  alertCounts,
  attentionFacts,
  loadFailures,
  cards,
  cardsLoad,
  dismissed,
  items: itemsProp,
  shellReady,
  onNavigate,
  onRetry,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  const ranked = useMemo(
    () =>
      itemsProp ||
      buildNeedsYouItems({
        alertCounts,
        attentionFacts,
        loadFailures,
        cards,
        cardsLoad,
        dismissed,
      }),
    [itemsProp, alertCounts, attentionFacts, loadFailures, cards, cardsLoad, dismissed],
  );

  const focus = focusNeedsYouItem(ranked);
  const next = showAll ? ranked.slice(1) : nextUpItems(ranked, 4);
  const extra = moreCount(ranked, 4);
  const total = ranked.length;

  const go = (item: NeedsYouItem, nav: { label: string; href: string }) => {
    if (item.retry) {
      onRetry();
      return;
    }
    if (nav.href && nav.href !== '#') onNavigate(nav.href);
  };

  return (
    <aside style={panel} data-testid="nexus-needs-you">
      <div style={headerRow}>
        <div style={title}>Needs you</div>
        {shellReady && total > 0 && (
          <div style={counter} data-testid="needs-you-counter">
            1 of {total}
          </div>
        )}
      </div>

      {!shellReady && <div style={muted}>Loading…</div>}

      {shellReady && !focus && <div style={muted}>Nothing needs you right now.</div>}

      {shellReady && focus && (
        <div
          style={{
            ...focusCard,
            borderColor: focus.kind === 'error' ? 'rgba(248,113,113,0.5)' : 'rgba(248,113,113,0.35)',
          }}
          data-testid="needs-you-focus"
          data-kind={focus.kind}
        >
          <div style={eyebrow}>Most important right now</div>
          {focus.badge ? <div style={badge}>{focus.badge}</div> : null}
          <div
            style={{
              ...focusValue,
              color: focus.kind === 'error' ? RED : '#F8FAFC',
              fontSize: focus.kind === 'error' || focus.badge ? 22 : 28,
            }}
          >
            {focus.valueLabel}
          </div>
          {focus.sentences.slice(0, 2).map((s) => (
            <p key={s} style={sentence}>
              {s}
            </p>
          ))}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <button type="button" style={primaryBtn} onClick={() => go(focus, focus.primary)}>
              {focus.primary.label}
            </button>
            {focus.secondary && !focus.retry ? (
              <button type="button" style={ghostBtn} onClick={() => go(focus, focus.secondary!)}>
                {focus.secondary.label}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {shellReady && next.length > 0 && (
        <div style={{ marginTop: 16 }} data-testid="needs-you-next">
          <div style={nextTitle}>Next up</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {next.map((item) => {
              const dot =
                item.kind === 'error' ? RED : item.kind === 'money' ? AMBER : '#60A5FA';
              const amountText =
                item.kind === 'error' || item.amount == null
                  ? '—'
                  : `$${Math.round(Math.abs(item.amount)).toLocaleString('en-US')}`;
              return (
                <li key={item.id} style={row}>
                  <span style={{ ...dotStyle, background: dot }} aria-hidden />
                  <span style={rowText}>{item.rowText}</span>
                  <span style={rowAmt}>{amountText}</span>
                  <button type="button" style={rowLink} onClick={() => go(item, item.rowLink)}>
                    {item.rowLink.label}
                  </button>
                </li>
              );
            })}
          </ul>
          {!showAll && extra > 0 && (
            <button type="button" style={moreBtn} onClick={() => setShowAll(true)}>
              + {extra} more · show all
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

const panel: CSSProperties = {
  background: 'rgba(8, 14, 28, 0.55)',
  border: '1px solid rgba(148,163,184,0.14)',
  borderRadius: 18,
  padding: 16,
  backdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
};

const headerRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 12,
};

const title: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#7C8DB5',
};

const counter: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: RED,
  letterSpacing: '0.06em',
};

const muted: CSSProperties = { fontSize: 12, color: '#64748B' };

const focusCard: CSSProperties = {
  background: 'rgba(10,18,34,0.85)',
  border: '1px solid',
  borderRadius: 14,
  padding: 14,
};

const eyebrow: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: RED,
  marginBottom: 8,
};

const badge: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#93C5FD',
  marginBottom: 6,
};

const focusValue: CSSProperties = {
  fontWeight: 900,
  lineHeight: 1.15,
  marginBottom: 8,
};

const sentence: CSSProperties = {
  margin: '0 0 6px',
  fontSize: 13,
  color: '#94A3B8',
  lineHeight: 1.4,
};

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '8px 12px',
  background: GREEN,
  color: '#04120a',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
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

const nextTitle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#64748B',
  marginBottom: 8,
};

const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '10px 1fr auto auto',
  gap: 8,
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid rgba(148,163,184,0.1)',
};

const dotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
};

const rowText: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#E2E8F0',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowAmt: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#94A3B8',
  fontVariantNumeric: 'tabular-nums',
};

const rowLink: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#93C5FD',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
  whiteSpace: 'nowrap',
};

const moreBtn: CSSProperties = {
  marginTop: 10,
  border: 'none',
  background: 'transparent',
  color: '#94A3B8',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
};
