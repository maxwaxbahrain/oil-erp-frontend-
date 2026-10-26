import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Mic, Search } from 'lucide-react';
import api from '../../../api/axios';
import type { SpatialBlock } from '../spatial';

const BLUE = '#4F8EF7';
const GREEN = '#22c55e';

export const ASK_CHIPS = [
  'What are the vans doing?',
  'Who owes the most?',
  "What should I reorder?",
  "Today's sales",
] as const;

export type AskNavButton = { label: string; href: string };

export type AskAnswer = {
  headline: string;
  detail: string;
  buttons: AskNavButton[];
};

type AskStatus = 'idle' | 'thinking' | 'ok' | 'error';

type Props = {
  onNavigate: (href: string) => void;
  onMicTap: () => void;
  micActive?: boolean;
  /** Voice intent router lines — mirror into the same answer card (no action cards). */
  voiceYouLine?: string;
  voiceZavaLine?: string;
  voiceThinking?: boolean;
  voiceNavHref?: string | null;
  voiceNavLabel?: string | null;
};

/** Pull up to 2 navigate buttons from chat spatial blocks (href only). */
export function navButtonsFromBlocks(blocks: SpatialBlock[] | undefined): AskNavButton[] {
  const out: AskNavButton[] = [];
  const seen = new Set<string>();
  const push = (label: string, href?: string) => {
    if (!href || seen.has(href) || out.length >= 2) return;
    seen.add(href);
    out.push({ label, href });
  };
  for (const block of blocks || []) {
    if (block.view_all?.href) push(block.view_all.label || 'Open', block.view_all.href);
    if (block.href) push(block.headline || 'Open', block.href);
    for (const tile of block.tiles || []) {
      push(tile.label ? `Open ${tile.label}` : 'Open', tile.href);
    }
    for (const item of block.items || []) {
      push(item.name ? `Open ${item.name}` : 'Open', item.href);
    }
    for (const d of block.debtors || []) {
      push(d.name ? `Open ${d.name}` : 'Open customer', d.href);
    }
    for (const row of block.rows || []) {
      push('Open', row.href);
    }
    for (const g of block.groups || []) {
      push(g.type ? `Open ${g.type}` : 'Open', g.href);
    }
  }
  return out.slice(0, 2);
}

export async function askZavaChat(message: string): Promise<AskAnswer> {
  const response = await api.post<{
    answer?: string;
    headline?: string;
    note?: string | null;
    blocks?: SpatialBlock[];
  }>('/api/agent/chat', { message }, { timeout: 70_000 });
  const headline = (response.data.headline || response.data.answer || '').trim();
  if (!headline) throw new Error('empty');
  const detail = String(response.data.note || response.data.answer || '').trim();
  const buttons = navButtonsFromBlocks(response.data.blocks);
  return {
    headline,
    detail: detail && detail !== headline ? detail : '',
    buttons,
  };
}

export default function NexusAsk({
  onNavigate,
  onMicTap,
  micActive,
  voiceYouLine,
  voiceZavaLine,
  voiceThinking,
  voiceNavHref,
  voiceNavLabel,
}: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AskStatus>('idle');
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const askGen = useRef(0);

  const runAsk = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q) return;
    const gen = ++askGen.current;
    setLastQuestion(q);
    setQuery(q);
    setStatus('thinking');
    setAnswer(null);
    try {
      const result = await askZavaChat(q);
      if (gen !== askGen.current) return;
      setAnswer(result);
      setStatus('ok');
    } catch {
      if (gen !== askGen.current) return;
      setAnswer(null);
      setStatus('error');
    }
  }, []);

  // Voice → same answer card (navigate-only buttons; no action cards).
  useEffect(() => {
    if (voiceThinking) {
      setStatus('thinking');
      return;
    }
    if (voiceZavaLine && voiceYouLine) {
      setLastQuestion(voiceYouLine);
      setAnswer({
        headline: voiceZavaLine,
        detail: '',
        buttons:
          voiceNavHref
            ? [{ label: voiceNavLabel || 'Open', href: voiceNavHref }]
            : [],
      });
      setStatus('ok');
    }
  }, [voiceThinking, voiceZavaLine, voiceYouLine, voiceNavHref, voiceNavLabel]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runAsk(query);
  };

  return (
    <aside style={panel} data-testid="nexus-ask">
      <div style={title}>Ask Zava</div>

      <form onSubmit={onSubmit} style={searchRow}>
        <div style={searchBox}>
          <Search size={14} color="#64748B" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask Zava…"
            aria-label="Ask Zava"
            style={input}
          />
        </div>
        <button
          type="button"
          aria-label={micActive ? 'Stop listening' : 'Talk to Zava'}
          onClick={onMicTap}
          style={{
            ...micBtn,
            borderColor: micActive ? BLUE : 'rgba(79,142,247,0.45)',
            boxShadow: micActive ? `0 0 14px ${BLUE}66` : 'none',
          }}
        >
          <Mic size={16} color={BLUE} />
        </button>
      </form>

      <div style={{ marginTop: 12, minHeight: 120 }} data-testid="nexus-ask-answer">
        {status === 'thinking' && (
          <div style={thinking} data-testid="ask-thinking">
            Thinking…
          </div>
        )}
        {status === 'error' && (
          <div style={errorCard} data-testid="ask-error">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Couldn't get an answer</div>
            <button type="button" style={primaryBtn} onClick={() => void runAsk(lastQuestion || query)}>
              Retry
            </button>
          </div>
        )}
        {status === 'ok' && answer && (
          <div style={answerCard} data-testid="ask-ok">
            <div style={headline}>{answer.headline}</div>
            {answer.detail ? <p style={detail}>{answer.detail}</p> : null}
            {answer.buttons.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {answer.buttons.map((b) => (
                  <button
                    key={b.href + b.label}
                    type="button"
                    style={navBtn}
                    onClick={() => onNavigate(b.href)}
                  >
                    {b.label.startsWith('Open') ? b.label : `Open · ${b.label}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {status === 'idle' && <div style={muted}>Ask a question or tap the mic.</div>}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={chipLabel}>Try asking</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-testid="ask-chips">
          {ASK_CHIPS.map((chip) => (
            <button key={chip} type="button" style={chipBtn} onClick={() => void runAsk(chip)}>
              {chip}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

const panel: CSSProperties = {
  background: 'rgba(8, 14, 28, 0.55)',
  border: '1px solid rgba(148,163,184,0.14)',
  borderRadius: 18,
  padding: 14,
  backdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
};

const title: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#7C8DB5',
  marginBottom: 12,
};

const searchRow: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };

const searchBox: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 40,
  padding: '0 10px',
  borderRadius: 10,
  border: `1.5px solid rgba(79,142,247,0.4)`,
  background: 'rgba(15,23,42,0.85)',
  minWidth: 0,
};

const input: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: '#E2E8F0',
  fontSize: 13,
  minWidth: 0,
};

const micBtn: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: '1.5px solid',
  background: 'rgba(15,23,42,0.9)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const thinking: CSSProperties = {
  fontSize: 13,
  color: '#94A3B8',
  fontStyle: 'italic',
};

const errorCard: CSSProperties = {
  background: 'rgba(10,18,34,0.85)',
  border: '1px solid rgba(248,113,113,0.4)',
  borderRadius: 12,
  padding: 12,
  color: '#FECACA',
  fontSize: 13,
};

const answerCard: CSSProperties = {
  background: 'rgba(10,18,34,0.85)',
  border: '1px solid rgba(79,142,247,0.35)',
  borderRadius: 12,
  padding: 12,
};

const headline: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: '#F8FAFC',
  lineHeight: 1.35,
};

const detail: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12,
  color: '#94A3B8',
  lineHeight: 1.45,
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

const navBtn: CSSProperties = {
  ...primaryBtn,
  background: BLUE,
  color: '#F8FAFC',
};

const muted: CSSProperties = { fontSize: 12, color: '#64748B' };

const chipLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#64748B',
  marginBottom: 8,
};

const chipBtn: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.25)',
  borderRadius: 999,
  padding: '6px 10px',
  background: 'rgba(8,16,32,0.85)',
  color: '#CBD5E1',
  fontWeight: 600,
  fontSize: 11,
  cursor: 'pointer',
  textAlign: 'left',
};
