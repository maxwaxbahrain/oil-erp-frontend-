import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Mic, Search } from 'lucide-react';
import { createCustomer, updateCustomer } from '../../../services/customerService';
import { askZavaChat } from './nexusAskChat';
import type { AskAnswer } from './nexusAskNav';
import NexusAskCustomerDraft, { NexusAskCustomerCreated } from './NexusAskCustomerDraft';
import {
  ADD_CUSTOMER_CHIP,
  ADD_CUSTOMER_PREFILL,
  ADD_CUSTOMER_PROMPT,
  NO_PERMISSION_MSG,
  UNDO_WINDOW_MS,
  VOICE_CONFIRM_WINDOW_MS,
  classifyCustomerDraftVoice,
  createPayloadFromDraft,
  draftFromExtract,
  draftSpeakScript,
  duplicateBlocksCreate,
  fetchExtractCustomer,
  isAddCustomerPromptOnly,
  isCreateCustomerIntent,
  undoDeactivatePayload,
  UNDO_FAIL_MSG,
  type CustomerDraftView,
} from './nexusAskCreateCustomer';
import type { AskFastContext } from './nexusAskFastPath';
import { queryNexusAsk, ASK_TIMEOUT_MESSAGE } from './nexusAskQuery';
import { speakFirstThenRest } from './nexusSpeechOut';
import { voiceLinesToHistory } from './nexusVoiceCapture';
import { writeNexusCustomerFormDraft } from './nexusCustomerFormBridge';
import { setNexusTranscriptHook } from './nexusVoiceIntercept';

const BLUE = '#4F8EF7';
const GREEN = '#22c55e';

export const ASK_CHIPS = [
  ADD_CUSTOMER_CHIP,
  'What are the vans doing?',
  'Who owes the most?',
  "What should I reorder?",
  "Today's sales",
] as const;

export type { AskAnswer, AskNavButton } from './nexusAskNav';
export { askZavaChat } from './nexusAskChat';
export { navButtonsFromBlocks } from './nexusAskNav';

type AskStatus = 'idle' | 'listening' | 'thinking' | 'ok' | 'error';
type CustomerPhase = 'idle' | 'reading' | 'draft' | 'created';

type Props = {
  onNavigate: (href: string) => void;
  onMicTap: () => void;
  micActive?: boolean;
  voiceYouLine?: string;
  voiceZavaLine?: string;
  voiceThinking?: boolean;
  voiceNavHref?: string | null;
  voiceNavLabel?: string | null;
  canCreateCustomers?: boolean;
  userDisplayName?: string;
  speakZava?: (text: string) => Promise<void>;
  /** Global always-listening hands-free — voice confirm disabled when true. */
  handsFreeActive?: boolean;
  liveTranscript?: string;
  askFastContext?: AskFastContext;
  voiceNavFromIntent?: boolean;
  chatTurns?: { who: 'zava' | 'you'; text: string }[];
  appendChatTurn?: (who: 'zava' | 'you', text: string) => void;
  conversationFollowUp?: boolean;
};

export default function NexusAsk({
  onNavigate,
  onMicTap,
  micActive,
  voiceYouLine,
  voiceZavaLine,
  voiceThinking,
  voiceNavHref,
  voiceNavLabel,
  canCreateCustomers = false,
  userDisplayName = '',
  speakZava,
  handsFreeActive = false,
  liveTranscript = '',
  askFastContext,
  voiceNavFromIntent = false,
  chatTurns = [],
  appendChatTurn,
  conversationFollowUp = false,
}: Props) {
  const [query, setQuery] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<AskStatus>('idle');
  const [slowHint, setSlowHint] = useState(false);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const askGen = useRef(0);

  const [customerPhase, setCustomerPhase] = useState<CustomerPhase>('idle');
  const [draft, setDraft] = useState<CustomerDraftView | null>(null);
  const [duplicateChoice, setDuplicateChoice] = useState<'pending' | 'create_anyway'>('pending');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const createStarted = useRef(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState('');
  const [undoLeft, setUndoLeft] = useState(0);
  const [undoError, setUndoError] = useState<string | null>(null);
  const voiceConfirmUntil = useRef(0);
  const [voiceConfirmEnds, setVoiceConfirmEnds] = useState(0);

  const resetCustomerFlow = useCallback(() => {
    setCustomerPhase('idle');
    setDraft(null);
    setDuplicateChoice('pending');
    setCreateError(null);
    setCreating(false);
    createStarted.current = false;
    voiceConfirmUntil.current = 0;
    setVoiceConfirmEnds(0);
    setUndoError(null);
  }, []);

  const startCreateFlow = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      if (!canCreateCustomers) {
        setAnswer({ headline: NO_PERMISSION_MSG, detail: '', buttons: [] });
        setStatus('ok');
        setCustomerPhase('idle');
        return;
      }
      const gen = ++askGen.current;
      setLastQuestion(q);
      setQuery(q);
      setAnswer(null);
      setCreateError(null);
      setDuplicateChoice('pending');
      setCustomerPhase('reading');
      setStatus('thinking');
      try {
        const apiResult = await fetchExtractCustomer(q);
        if (gen !== askGen.current) return;
        const view = draftFromExtract(q, apiResult);
        if (!view.fields.name.trim()) {
          setCreateError('Zava needs at least a customer name in your sentence.');
          setCustomerPhase('idle');
          setStatus('error');
          return;
        }
        setDraft(view);
        setCustomerPhase('draft');
        setStatus('ok');
        voiceConfirmUntil.current = 0;
        setVoiceConfirmEnds(0);
        if (speakZava && !handsFreeActive) {
          await speakZava(draftSpeakScript(view.fields));
          const ends = Date.now() + VOICE_CONFIRM_WINDOW_MS;
          voiceConfirmUntil.current = ends;
          setVoiceConfirmEnds(ends);
        }
      } catch {
        if (gen !== askGen.current) return;
        setCreateError("Zava couldn't read that — please fill the fields yourself.");
        setCustomerPhase('idle');
        setStatus('error');
      }
    },
    [canCreateCustomers, handsFreeActive, speakZava],
  );

  const runCreate = useCallback(async () => {
    if (!draft || createStarted.current || creating) return;
    if (duplicateBlocksCreate(draft.duplicates, duplicateChoice)) return;
    createStarted.current = true;
    setCreating(true);
    setCreateError(null);
    try {
      const payload = createPayloadFromDraft(draft.fields);
      const row = await createCustomer(payload);
      setCreatedId(String(row.id));
      setCreatedName(row.name || draft.fields.name);
      setCustomerPhase('created');
      setUndoLeft(Math.ceil(UNDO_WINDOW_MS / 1000));
      setUndoError(null);
      if (speakZava) {
        await speakZava(`Done. ${row.name || draft.fields.name} is created.`);
      }
    } catch (err) {
      createStarted.current = false;
      setCreateError(err instanceof Error ? err.message : 'Could not create customer');
    } finally {
      setCreating(false);
    }
  }, [creating, draft, duplicateChoice, speakZava]);

  const promptAddCustomer = useCallback(() => {
    resetCustomerFlow();
    setQuery(ADD_CUSTOMER_PREFILL);
    setAnswer({ headline: ADD_CUSTOMER_PROMPT, detail: '', buttons: [] });
    setStatus('ok');
    setLastQuestion('');
  }, [resetCustomerFlow]);

  const runAsk = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      if (isAddCustomerPromptOnly(q)) {
        promptAddCustomer();
        return;
      }
      if (isCreateCustomerIntent(q)) {
        resetCustomerFlow();
        await startCreateFlow(q);
        return;
      }
      const gen = ++askGen.current;
      resetCustomerFlow();
      setLastQuestion(q);
      setQuery(q);
      setStatus('thinking');
      setSlowHint(false);
      setAnswer(null);
      const ctx = askFastContext || {
        homeSummary: null,
        needsItems: [],
        arSummary: null,
        arLoadedOk: false,
      };
      appendChatTurn?.('you', q);
      const history = voiceLinesToHistory(chatTurns);
      try {
        const { answer, timedOut } = await queryNexusAsk(
          q,
          ctx,
          askZavaChat,
          () => {
            if (gen === askGen.current) setSlowHint(true);
          },
          history,
        );
        if (gen !== askGen.current) return;
        setAnswer(answer);
        setStatus(timedOut ? 'error' : 'ok');
        if (timedOut) setCreateError(ASK_TIMEOUT_MESSAGE);
        const speakLine = [answer.headline, answer.detail].filter(Boolean).join(' ');
        if (speakZava && speakLine) {
          void speakZava(speakLine);
        } else if (speakLine) {
          appendChatTurn?.('zava', speakLine);
          void speakFirstThenRest(speakLine);
        }
      } catch {
        if (gen !== askGen.current) return;
        setAnswer(null);
        setStatus('error');
      }
    },
    [appendChatTurn, askFastContext, chatTurns, promptAddCustomer, resetCustomerFlow, speakZava, startCreateFlow],
  );

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatTurns, liveTranscript, status]);

  useEffect(() => {
    const hook = async (transcript: string): Promise<boolean> => {
      const t = transcript.trim();
      if (!t) return false;
      if (customerPhase === 'draft' && draft && !handsFreeActive) {
        if (voiceConfirmUntil.current > 0 && Date.now() > voiceConfirmUntil.current) return false;
        const kind = classifyCustomerDraftVoice(t);
        if (kind === 'cancel') {
          resetCustomerFlow();
          setStatus('idle');
          setAnswer(null);
          return true;
        }
        if (kind === 'weak_yes') {
          if (speakZava) await speakZava('Say confirm to create it.');
          return true;
        }
        if (kind === 'confirm') {
          await runCreate();
          return true;
        }
        return false;
      }
      if (isCreateCustomerIntent(t)) {
        await startCreateFlow(t);
        return true;
      }
      return false;
    };
    setNexusTranscriptHook(hook);
    return () => setNexusTranscriptHook(null);
  }, [customerPhase, draft, handsFreeActive, resetCustomerFlow, runCreate, speakZava, startCreateFlow]);

  useEffect(() => {
    if (customerPhase !== 'idle') return;
    if (voiceThinking) {
      setStatus('thinking');
      return;
    }
    if (micActive) {
      setStatus('listening');
      return;
    }
    // Mic stopped without a question: don't leave "Listening…" on screen.
    setStatus((s) => (s === 'listening' ? 'idle' : s));
    if (voiceZavaLine && voiceYouLine) {
      const unheard =
        /didn't catch that/i.test(voiceZavaLine) ||
        /I'm not sure what you mean/i.test(voiceZavaLine);
      setLastQuestion(voiceYouLine);
      setQuery(voiceYouLine);
      setAnswer({
        headline: voiceZavaLine,
        detail: '',
        buttons:
          !unheard && voiceNavFromIntent && voiceNavHref
            ? [{ label: voiceNavLabel || 'Open', href: voiceNavHref }]
            : [],
      });
      setStatus('ok');
    }
  }, [
    customerPhase,
    micActive,
    voiceNavFromIntent,
    voiceThinking,
    voiceZavaLine,
    voiceYouLine,
    voiceNavHref,
    voiceNavLabel,
  ]);

  useEffect(() => {
    if (liveTranscript) setQuery(liveTranscript);
  }, [liveTranscript]);

  useEffect(() => {
    if (!voiceConfirmEnds || handsFreeActive) return;
    const t = window.setInterval(() => setVoiceConfirmEnds((v) => v), 1000);
    return () => window.clearInterval(t);
  }, [voiceConfirmEnds, handsFreeActive]);

  useEffect(() => {
    if (customerPhase !== 'created' || undoLeft <= 0) return;
    const t = window.setInterval(() => {
      setUndoLeft((s) => {
        if (s <= 1) {
          window.clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [customerPhase, undoLeft]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runAsk(query);
  };

  const openFullForm = () => {
    if (!draft) return;
    const tagged = ['name', 'email', 'phone', 'address', 'category', 'credit_limit'].filter((k) => {
      const f = draft.fields;
      if (k === 'name') return Boolean(f.name);
      if (k === 'email') return Boolean(f.email);
      if (k === 'phone') return Boolean(f.phone);
      if (k === 'address') return Boolean(f.address);
      if (k === 'category') return Boolean(f.category);
      if (k === 'credit_limit') return f.credit_limit != null;
      return false;
    });
    writeNexusCustomerFormDraft({
      name: draft.fields.name,
      email: draft.fields.email,
      phone: draft.fields.phone,
      address: draft.fields.address,
      category: draft.fields.category,
      credit_limit: draft.fields.credit_limit ?? undefined,
      zavaTagged: tagged,
    });
    onNavigate('/customers/new');
  };

  const voiceExpired =
    customerPhase === 'draft' && voiceConfirmEnds > 0 && Date.now() > voiceConfirmEnds;

  const createDisabled =
    !draft ||
    !draft.fields.name.trim() ||
    duplicateBlocksCreate(draft.duplicates, duplicateChoice);

  return (
    <aside style={panel} data-testid="nexus-ask">
      <style>{`@keyframes nexusAskSpin { to { transform: rotate(360deg); } }`}</style>
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

      <div style={{ marginTop: 12, minHeight: 80 }} data-testid="nexus-ask-answer">
        {chatTurns.length > 0 && (
          <div ref={chatScrollRef} style={chatScroll} data-testid="nexus-ask-chat">
            {chatTurns.map((turn, i) => (
              <div
                key={`${i}-${turn.who}-${turn.text.slice(0, 24)}`}
                style={{
                  ...chatBubble,
                  alignSelf: turn.who === 'you' ? 'flex-end' : 'flex-start',
                  background:
                    turn.who === 'you' ? 'rgba(79,142,247,0.22)' : 'rgba(15,23,42,0.92)',
                  borderColor: turn.who === 'you' ? 'rgba(79,142,247,0.45)' : 'rgba(148,163,184,0.2)',
                }}
              >
                <div style={chatWho}>{turn.who === 'you' ? 'You' : 'Zava'}</div>
                <div style={chatText}>{turn.text}</div>
              </div>
            ))}
          </div>
        )}

        {customerPhase === 'reading' && (
          <div style={thinking} data-testid="nexus-customer-reading">
            Zava is reading your sentence…
          </div>
        )}

        {customerPhase === 'draft' && draft && (
          <NexusAskCustomerDraft
            draft={draft}
            userLabel={userDisplayName}
            duplicateChoice={duplicateChoice}
            createDisabled={createDisabled}
            creating={creating}
            createError={createError}
            voiceConfirmActive={!handsFreeActive && voiceConfirmUntil.current > 0}
            voiceConfirmExpired={voiceExpired}
            onCreate={() => void runCreate()}
            onOpenForm={openFullForm}
            onDismiss={() => {
              resetCustomerFlow();
              setStatus('idle');
            }}
            onOpenDuplicate={(id) => onNavigate(`/customers/${id}`)}
            onCreateAnyway={() => setDuplicateChoice('create_anyway')}
          />
        )}

        {customerPhase === 'created' && createdId && (
          <NexusAskCustomerCreated
            name={createdName}
            userLabel={userDisplayName}
            customerId={createdId}
            undoSecondsLeft={undoLeft}
            undoError={undoError}
            onOpen={() => onNavigate(`/customers/${createdId}`)}
            onInvoice={() => onNavigate('/sales/invoices/new')}
            onUndo={() => {
              void updateCustomer(createdId, undoDeactivatePayload())
                .then(() => {
                  resetCustomerFlow();
                  setStatus('idle');
                  setCreatedId(null);
                })
                .catch(() => {
                  setUndoError(UNDO_FAIL_MSG);
                });
            }}
          />
        )}

        {customerPhase === 'idle' && status === 'listening' && (
          <div style={thinking} data-testid="ask-listening">
            {conversationFollowUp ? 'Listening for your reply…' : 'Listening…'}
          </div>
        )}
        {customerPhase === 'idle' && status === 'thinking' && (
          <div style={thinking} data-testid="ask-thinking">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={spinner} aria-hidden />
              Thinking…
            </div>
            {slowHint ? <div style={{ fontWeight: 600 }}>Still working…</div> : null}
          </div>
        )}
        {customerPhase === 'idle' && status === 'error' && (
          <div style={errorCard} data-testid="ask-error">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {createError || ASK_TIMEOUT_MESSAGE || "Couldn't get an answer"}
            </div>
            <button type="button" style={primaryBtn} onClick={() => void runAsk(lastQuestion || query)}>
              Retry
            </button>
          </div>
        )}
        {customerPhase === 'idle' && status === 'ok' && answer && (chatTurns.length === 0 || answer.buttons.length > 0) && (
          <div style={answerCard} data-testid="ask-ok">
            {/* In a conversation the answer is already in the chat bubbles — don't repeat it. */}
            {chatTurns.length === 0 ? <div style={headline}>{answer.headline}</div> : null}
            {chatTurns.length === 0 && answer.detail ? <p style={detail}>{answer.detail}</p> : null}
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
        {customerPhase === 'idle' && status === 'idle' && (
          <div style={muted}>Ask a question or tap the mic.</div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={chipLabel}>Try asking</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-testid="ask-chips">
          {ASK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              style={chipBtn}
              onClick={() => {
                if (chip === ADD_CUSTOMER_CHIP) {
                  promptAddCustomer();
                  onMicTap();
                  return;
                }
                void runAsk(chip);
              }}
            >
              {chip === ADD_CUSTOMER_CHIP ? `+ ${chip}` : chip}
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
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const spinner: CSSProperties = {
  display: 'inline-block',
  width: 14,
  height: 14,
  marginRight: 8,
  border: '2px solid rgba(148,163,184,0.35)',
  borderTopColor: '#4F8EF7',
  borderRadius: '50%',
  animation: 'nexusAskSpin 0.8s linear infinite',
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

const chatScroll: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 220,
  overflowY: 'auto',
  marginBottom: 10,
  paddingRight: 4,
};

const chatBubble: CSSProperties = {
  maxWidth: '92%',
  borderRadius: 12,
  border: '1px solid',
  padding: '8px 10px',
};

const chatWho: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#64748B',
  marginBottom: 4,
};

const chatText: CSSProperties = {
  fontSize: 13,
  color: '#E2E8F0',
  lineHeight: 1.4,
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
