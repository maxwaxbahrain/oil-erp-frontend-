/**
 * Nexus push-to-talk + deterministic intents (Phase 3).
 * Voice never creates/posts/approves/sends/deletes — open / read / speak only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import api from '../../../api/axios';
import { getVanLocations, getVans } from '../../../services/api';
import { getArSummary, searchCustomers } from '../../../services/customerService';
import {
  permissionDenied,
  recorderMime,
  recordingCountdown,
  type VoiceState,
} from '../../../services/zavaVoice';
import { ERRORS, VOICE, messageForFailure } from '../zavaCopy';
import { buildOpsVans } from '../opsMap/opsMapModel';
import { companyAmount, signalFigure, signalWhy } from '../signalCards';
import type { NexusSignalCard } from './nexusModel';
import {
  countVanStatuses,
  customerBalanceSpeech,
  formatCardSpeech,
  formatVanSummary,
  hasSpokenWelcome,
  markWelcomeSpoken,
  parseVoiceIntent,
  planetIdForCardModule,
  resolveCustomerMatches,
} from './voiceIntent';
import { tryNexusTranscriptHook } from './nexusVoiceIntercept';
import { askZavaChat } from './nexusAskChat';
import { queryNexusAsk } from './nexusAskQuery';
import type { AskFastContext } from './nexusAskFastPath';
import { startWebSpeechListen, webSpeechAvailable } from './nexusLiveSpeech';
import {
  NEXUS_CONVERSATION_FOLLOWUP_MS,
  NEXUS_POST_TTS_LISTEN_DELAY_MS,
  NEXUS_SILENCE_BEFORE_SUBMIT_MS,
  historyBeforeCurrentQuestion,
  cleanSpokenQuestion, isSmallTalk, SMALL_TALK_REPLY
} from './nexusVoiceCapture';
import { cancelSynth, speakFirstThenRest, speakWithSynth, synthAvailable } from './nexusSpeechOut';
import { createStreamSentenceSpeaker } from './nexusAskStreamSpeech';
import { playMicAck } from './nexusMicAck';
import { logVoiceTiming } from './nexusVoiceTimings';
import {
  NO_SPEECH_HEARD_MSG,
  NEXUS_MAX_LISTEN_MS,
  plainSpeechError,
  isIgnorableAborted,
  shouldFallbackToUpload,
} from './nexusSpeechErrors';
import {
  claimMicSession,
  registerMicConsumer,
  releaseMicSession,
} from '../../../lib/micSessionOwner';

const NEXUS_MIC_OWNER = 'nexus-zava-ptt' as const;

export type VoiceLine = { who: 'zava' | 'you'; text: string };

export type CustomerChoice = {
  id: number;
  name: string;
  /** Present when AR loaded; null only while AR failed (UI may hide amount). */
  balance: number | null;
  arLoadedOk: boolean;
};

export type PendingConfirm = {
  id: number;
  name: string;
  arLoadedOk: boolean;
  balanceById: Map<number, number>;
};

function failureFromError(error: unknown): string {
  const err = error as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { detail?: string } };
  };
  const timedOut = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
  const network = !err.response && !timedOut;
  return messageForFailure({
    status: err.response?.status,
    detail: err.response?.data?.detail,
    network,
    timedOut,
  });
}

async function voiceFailure(error: unknown): Promise<string> {
  const err = error as { response?: { data?: Blob | { detail?: string } } };
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { detail?: string };
      return messageForFailure({ detail: parsed.detail, network: false });
    } catch {
      return ERRORS.network;
    }
  }
  return failureFromError(error);
}

type Opts = {
  firstName: string;
  cards: NexusSignalCard[];
  cardsLoadOk: boolean;
  needsYou: number;
  speakable: NexusSignalCard[];
  activeCardId: string | null;
  setActiveCardId: (id: string | null) => void;
  setActivePlanetId: (id: string | null) => void;
  navigate: NavigateFunction;
  /** On-screen hero line — spoken once on the first mic tap of the tab session. */
  heroLine?: string;
  /** Data for instant Ask fast-path when voice phrase is not a Phase-3 intent. */
  getAskContext: () => AskFastContext;
  /** Live interim transcript → Ask input while listening. */
  onLiveTranscript?: (text: string) => void;
};

export function useNexusVoice(opts: Opts) {
  const {
    speakable,
    activeCardId,
    setActiveCardId,
    setActivePlanetId,
    navigate,
    heroLine = '',
    getAskContext,
    onLiveTranscript,
  } = opts;

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceNotice, setVoiceNotice] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [youLine, setYouLine] = useState('');
  const [zavaLine, setZavaLine] = useState('');
  const [fallbackChips, setFallbackChips] = useState<string[] | null>(null);
  const [customerChoices, setCustomerChoices] = useState<CustomerChoice[] | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [capReached, setCapReached] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [chatTurns, setChatTurns] = useState<VoiceLine[]>([]);
  const [conversationFollowUp, setConversationFollowUp] = useState(false);
  const [voiceNavIntent, setVoiceNavIntent] = useState(false);
  const [voiceNavHref, setVoiceNavHref] = useState<string | null>(null);
  const [voiceNavLabel, setVoiceNavLabel] = useState<string | null>(null);
  const transcriptHandledRef = useRef(false);
  const uploadFallbackRef = useRef(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const webSpeechSessionRef = useRef<{ stop: () => void; cancel: () => void } | null>(null);
  const listenModeRef = useRef<'tap' | 'followUp'>('tap');
  const chatTurnsRef = useRef<VoiceLine[]>([]);
  const speechEndAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceUrlRef = useRef('');
  const listenTimers = useRef<{ tick?: number; limit?: number }>({});
  const briefingIndexRef = useRef(0);
  const speakableRef = useRef(speakable);
  const activeCardIdRef = useRef(activeCardId);
  const pendingConfirmRef = useRef<PendingConfirm | null>(null);
  const heroLineRef = useRef(heroLine);
  const speakDoneRef = useRef<(() => void) | null>(null);
  /** Bumped on interrupt so an in-flight first-mic speak does not start listening. */
  const micGenRef = useRef(0);
  const startListeningRef = useRef<(opts?: { followUp?: boolean }) => Promise<void>>(() => Promise.resolve());
  const streamAskGenRef = useRef(0);
  const streamSpeakerRef = useRef<ReturnType<typeof createStreamSentenceSpeaker> | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    pendingConfirmRef.current = pendingConfirm;
  }, [pendingConfirm]);

  useEffect(() => {
    speakableRef.current = speakable;
  }, [speakable]);
  useEffect(() => {
    activeCardIdRef.current = activeCardId;
  }, [activeCardId]);
  useEffect(() => {
    heroLineRef.current = heroLine;
  }, [heroLine]);

  useEffect(() => {
    chatTurnsRef.current = chatTurns;
  }, [chatTurns]);

  const pushChatTurn = useCallback((who: VoiceLine['who'], text: string) => {
    const line = String(text || '').trim();
    if (!line) return;
    const next = [...chatTurnsRef.current, { who, text: line }].slice(-6);
    chatTurnsRef.current = next;
    setChatTurns(next);
  }, []);

  const upsertZavaChatTurn = useCallback((text: string) => {
    const line = String(text || '').trim();
    if (!line) return;
    const prev = chatTurnsRef.current;
    const last = prev[prev.length - 1];
    const next =
      last?.who === 'zava'
        ? [...prev.slice(0, -1), { who: 'zava' as const, text: line }].slice(-6)
        : [...prev, { who: 'zava' as const, text: line }].slice(-6);
    chatTurnsRef.current = next;
    setChatTurns(next);
  }, []);

  const clearListenTimers = useCallback(() => {
    if (listenTimers.current.tick) window.clearInterval(listenTimers.current.tick);
    if (listenTimers.current.limit) window.clearTimeout(listenTimers.current.limit);
    listenTimers.current = {};
  }, []);

  const resolveSpeakDone = useCallback(() => {
    const done = speakDoneRef.current;
    speakDoneRef.current = null;
    done?.();
  }, []);

  const listenGenRef = useRef(0);
  const cancelListening = useCallback(() => {
    listenGenRef.current += 1;
    webSpeechSessionRef.current?.cancel();
    webSpeechSessionRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    clearListenTimers();
    setCountdown(null);
    setLiveTranscript('');
    onLiveTranscript?.('');
    setConversationFollowUp(false);
    setVoiceState((s) => (s === 'listening' ? 'idle' : s));
    releaseMicSession(NEXUS_MIC_OWNER);
  }, [clearListenTimers, onLiveTranscript]);

  const stopSpeaking = useCallback(() => {
    cancelSynth();
    const playing = audioRef.current;
    if (playing) {
      playing.pause();
      playing.src = '';
    }
    audioRef.current = null;
    if (voiceUrlRef.current) {
      URL.revokeObjectURL(voiceUrlRef.current);
      voiceUrlRef.current = '';
    }
    setVoiceState((s) => (s === 'speaking' ? 'idle' : s));
    resolveSpeakDone();
  }, [resolveSpeakDone]);

  const speakText = useCallback(
    async (text: string, mode: 'local' | 'split' = 'local') => {
      const line = String(text || '').trim();
      if (!line) return;
      cancelListening();
      pushChatTurn('zava', line);
      setZavaLine(line);
      if (capReached) {
        setVoiceState('idle');
        return;
      }
      setVoiceState('speaking');
      const t0 = Date.now();
      try {
        if (synthAvailable()) {
          if (mode === 'split') await speakFirstThenRest(line);
          else await speakWithSynth(line);
        } else {
          const response = await api.post<Blob>(
            '/api/agent/speak',
            { headline: line, note: null },
            { responseType: 'blob', timeout: 45_000 },
          );
          const url = URL.createObjectURL(response.data);
          voiceUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            void audio.play();
          });
        }
        logVoiceTiming('answer→speaking', Date.now() - t0);
      } catch (error) {
        const message = await voiceFailure(error);
        if (message === ERRORS.limit) {
          setCapReached(true);
          setVoiceNotice(VOICE.cap);
        } else if (message !== ERRORS.limit) {
          setVoiceNotice(message);
        }
      } finally {
        setVoiceState((s) => (s === 'speaking' ? 'idle' : s));
        resolveSpeakDone();
      }
    },
    [cancelListening, capReached, pushChatTurn, resolveSpeakDone],
  );

  const answerUnknownQuestion = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) {
        setVoiceNotice(VOICE.unheard);
        await speakText("I didn't catch that.");
        return;
      }
      setVoiceState('thinking');
      const t0 = speechEndAtRef.current || Date.now();
      streamSpeakerRef.current?.cancel();
      streamAbortRef.current?.abort();
      const streamGen = ++streamAskGenRef.current;
      const streamAbort = new AbortController();
      streamAbortRef.current = streamAbort;
      const streamSpeaker = createStreamSentenceSpeaker();
      streamSpeakerRef.current = streamSpeaker;
      try {
        const history = historyBeforeCurrentQuestion(chatTurnsRef.current, q);
        const { answer, fromFastPath } = await queryNexusAsk(
          q,
          getAskContext(),
          askZavaChat,
          undefined,
          history,
          {
            onPartial: (partial) => {
              if (streamGen !== streamAskGenRef.current) return;
              upsertZavaChatTurn(partial);
              setZavaLine(partial);
              streamSpeaker.onText(partial);
            },
          },
          streamAbort.signal,
        );
        if (streamGen !== streamAskGenRef.current) return;
        setZavaLine(answer.headline);
        const btn = answer.buttons[0];
        setVoiceNavIntent(Boolean(btn?.href));
        setVoiceNavHref(btn?.href ?? null);
        setVoiceNavLabel(btn?.label ?? null);
        logVoiceTiming('speech end→answer shown', Date.now() - t0);
        const speakLine = [answer.headline, answer.detail].filter(Boolean).join(' ');
        if (fromFastPath) {
          await speakText(speakLine, 'local');
        } else {
          // Show Zava's final answer in chat/history even when streaming fell back to JSON.
          upsertZavaChatTurn(speakLine);
          // Mark as speaking so the mic tap can interrupt (onMicTap ignores 'thinking').
          setVoiceState('speaking');
          streamSpeaker.flush(speakLine);
          await streamSpeaker.wait();
        }
      } catch {
        setZavaLine("Couldn't get an answer.");
        await speakText("Couldn't get an answer.");
      } finally {
        setVoiceState('idle');
      }
    },
    [getAskContext, speakText, upsertZavaChatTurn],
  );

  const highlightCard = useCallback(
    (card: NexusSignalCard | undefined) => {
      if (!card) return;
      setActiveCardId(card.id);
      const planet = planetIdForCardModule(card.module);
      if (planet) setActivePlanetId(planet);
    },
    [setActiveCardId, setActivePlanetId],
  );

  const speakCardAt = useCallback(
    async (index: number) => {
      const list = speakableRef.current;
      if (!list.length) {
        await speakText('There are no updates to read right now.');
        return;
      }
      const i = ((index % list.length) + list.length) % list.length;
      briefingIndexRef.current = i;
      const card = list[i];
      highlightCard(card);
      const figure = signalFigure(card) || companyAmount(card.money);
      await speakText(
        formatCardSpeech({
          title: card.title,
          money: card.money,
          why: signalWhy(card.why),
          figure,
        }),
      );
    },
    [highlightCard, speakText],
  );

  const speakCustomerBalance = useCallback(
    async (name: string, customerId: number, arLoadedOk: boolean, balanceById: Map<number, number>) => {
      await speakText(
        customerBalanceSpeech({ name, customerId, arLoadedOk, balanceById }),
      );
    },
    [speakText],
  );

  const runIntent = useCallback(
    async (raw: string) => {
      setFallbackChips(null);
      const intent = parseVoiceIntent(raw);

      // Pending "Did you mean …?" — yes/no only (or clear and continue)
      const pending = pendingConfirmRef.current;
      if (pending) {
        if (intent.type === 'yes') {
          setPendingConfirm(null);
          setCustomerChoices(null);
          navigate(`/customers/${pending.id}`);
          await speakCustomerBalance(pending.name, pending.id, pending.arLoadedOk, pending.balanceById);
          return;
        }
        if (intent.type === 'no') {
          setPendingConfirm(null);
          setCustomerChoices(null);
          await speakText('Okay.');
          return;
        }
        // Other intents cancel the confirm prompt
        setPendingConfirm(null);
      }

      setCustomerChoices(null);

      switch (intent.type) {
        case 'yes':
        case 'no':
          await speakText("I'm not sure what you mean.");
          return;
        case 'stop':
          setConversationFollowUp(false);
          stopSpeaking();
          setVoiceState('idle');
          setZavaLine('Stopped.');
          pushChatTurn('zava', 'Stopped.');
          return;
        case 'updates':
          briefingIndexRef.current = 0;
          await speakCardAt(0);
          return;
        case 'next':
          await speakCardAt(briefingIndexRef.current + 1);
          return;
        case 'repeat': {
          const list = speakableRef.current;
          const idx = list.findIndex((c) => c.id === activeCardIdRef.current);
          await speakCardAt(idx >= 0 ? idx : briefingIndexRef.current);
          return;
        }
        case 'vans': {
          setActivePlanetId('delivery');
          navigate('/agent/ops-map');
          try {
            const [locations, fleet] = await Promise.all([getVanLocations(), getVans()]);
            const rows = buildOpsVans(
              Array.isArray(locations) ? locations : [],
              Array.isArray(fleet) ? fleet : [],
              new Date(),
            );
            const summary = formatVanSummary(countVanStatuses(rows.map((r) => r.status)));
            await speakText(summary);
          } catch {
            await speakText("I couldn't load van locations right now.");
          }
          return;
        }
        case 'open_module':
          setActivePlanetId(intent.module);
          navigate(intent.href);
          setVoiceNavIntent(true);
          setVoiceNavHref(intent.href);
          setVoiceNavLabel(`Open ${intent.label}`);
          await speakText(`Opening ${intent.label}.`);
          return;
        case 'go_nexus':
          setActivePlanetId(null);
          navigate('/agent/nexus');
          await speakText('Back to Nexus.');
          return;
        case 'customer': {
          try {
            const found = await searchCustomers(intent.query);
            let arLoadedOk = false;
            let balanceById = new Map<number, number>();
            try {
              const ar = await getArSummary();
              arLoadedOk = true;
              balanceById = new Map(
                (ar.per_customer || []).map((r) => [Number(r.id), Number(r.balance)]),
              );
            } catch {
              arLoadedOk = false;
            }

            const resolved = resolveCustomerMatches(
              (found || []).map((c) => ({ id: Number(c.id), name: String(c.name) })),
              intent.query,
            );
            if (resolved.kind === 'none') {
              await speakText(`I couldn't find a customer named ${intent.query}.`);
              return;
            }
            if (resolved.kind === 'many') {
              const label = intent.query;
              const n = resolved.matches.length;
              setCustomerChoices(
                resolved.matches.map((m) => ({
                  id: m.id,
                  name: m.name,
                  balance: arLoadedOk
                    ? balanceById.has(m.id)
                      ? balanceById.get(m.id)!
                      : 0
                    : null,
                  arLoadedOk,
                })),
              );
              await speakText(`I found ${n} customers named ${label} — which one?`);
              return;
            }
            if (resolved.kind === 'confirm') {
              setPendingConfirm({
                id: resolved.id,
                name: resolved.name,
                arLoadedOk,
                balanceById,
              });
              await speakText(`Did you mean ${resolved.name}?`);
              return;
            }
            await speakCustomerBalance(resolved.name, resolved.id, arLoadedOk, balanceById);
          } catch {
            await speakText("I couldn't look that customer up right now.");
          }
          return;
        }
        case 'unknown':
        default:
          await answerUnknownQuestion(raw);
      }
    },
    [
      answerUnknownQuestion,
      navigate,
      setActivePlanetId,
      speakCardAt,
      speakCustomerBalance,
      speakText,
      stopSpeaking,
      pushChatTurn,
    ],
  );

  const processTranscript = useCallback(
    async (transcript: string) => {
      if (transcriptHandledRef.current) return;
      transcriptHandledRef.current = true;
      const t = transcript.trim();
      speechEndAtRef.current = Date.now();
      setLiveTranscript('');
      onLiveTranscript?.('');
      setVoiceNavIntent(false);
      setVoiceNavHref(null);
      setVoiceNavLabel(null);
      setConversationFollowUp(false);
      if (!t) {
        setVoiceState('idle');
        if (listenModeRef.current === 'tap') {
          setVoiceNotice(NO_SPEECH_HEARD_MSG);
          setZavaLine(NO_SPEECH_HEARD_MSG);
        }
        return;
      }
      setVoiceNotice('');
      setYouLine(t);
      pushChatTurn('you', t);
      if (await tryNexusTranscriptHook(t)) {
        setVoiceState('idle');
        logVoiceTiming('speech end→answer shown', Date.now() - speechEndAtRef.current);
        return;
      }
      if (isSmallTalk(t)) {
        // "hey", "hello Zava", "how are you" — reply instantly, no AI call.
        await speakText(SMALL_TALK_REPLY);
      } else {
        await runIntent(cleanSpokenQuestion(t) || t);
      }
      if (parseVoiceIntent(t).type !== 'stop') {
        setConversationFollowUp(true);
        window.setTimeout(() => {
          void startListeningRef.current?.({ followUp: true });
        }, NEXUS_POST_TTS_LISTEN_DELAY_MS);
      }
      logVoiceTiming('speech end→answer shown', Date.now() - speechEndAtRef.current);
    },
    [onLiveTranscript, pushChatTurn, runIntent, speakText],
  );

  const sendClip = useCallback(
    async (blob: Blob) => {
      setVoiceState('thinking');
      const form = new FormData();
      form.append('audio', blob, blob.type.includes('mp4') ? 'clip.mp4' : 'clip.webm');
      try {
        const heard = await api.post<{ transcript: string }>('/api/agent/listen', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 45_000,
        });
        await processTranscript(heard.data.transcript || '');
      } catch (error) {
        setVoiceState('idle');
        const message = failureFromError(error);
        if (message === ERRORS.limit) {
          setCapReached(true);
          setVoiceNotice(VOICE.cap);
        } else {
          setVoiceNotice(message === ERRORS.limit ? VOICE.cap : message);
        }
      }
    },
    [processTranscript],
  );

  const stopRecording = useCallback(() => {
    uploadFallbackRef.current = false;
    webSpeechSessionRef.current?.stop();
    webSpeechSessionRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorderRef.current = null;
    clearListenTimers();
    setCountdown(null);
    setLiveTranscript('');
    onLiveTranscript?.('');
    setConversationFollowUp(false);
    setVoiceState((s) => (s === 'listening' ? 'idle' : s));
    releaseMicSession(NEXUS_MIC_OWNER);
  }, [clearListenTimers, onLiveTranscript]);

  useEffect(() => {
    return registerMicConsumer(NEXUS_MIC_OWNER, () => cancelListening());
  }, [cancelListening]);

  const startMediaRecorderListen = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      const mime = recorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        clearListenTimers();
        setCountdown(null);
        stream.getTracks().forEach((track) => track.stop());
        releaseMicSession(NEXUS_MIC_OWNER);
        uploadFallbackRef.current = false;
        const clip = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
        void sendClip(clip);
      };
      recorderRef.current = recorder;
      const started = Date.now();
      listenTimers.current = {
        tick: window.setInterval(() => {
          setCountdown(recordingCountdown(Date.now() - started));
        }, 200),
        limit: window.setTimeout(() => stopRecording(), NEXUS_MAX_LISTEN_MS),
      };
      recorder.start();
      setVoiceState('listening');
    } catch (error) {
      uploadFallbackRef.current = false;
      setVoiceState('idle');
      releaseMicSession(NEXUS_MIC_OWNER);
      const msg = permissionDenied(error)
        ? plainSpeechError('not-allowed')
        : plainSpeechError('audio-capture');
      setVoiceNotice(msg);
      setZavaLine(msg);
    }
  }, [clearListenTimers, sendClip, stopRecording]);

  const startListening = useCallback(
    async (opts?: { followUp?: boolean }) => {
      const followUp = Boolean(opts?.followUp);
      listenModeRef.current = followUp ? 'followUp' : 'tap';
      setConversationFollowUp(followUp);
      cancelListening();
      stopSpeaking();
      setVoiceNotice('');
      setFallbackChips(null);
      uploadFallbackRef.current = false;
      transcriptHandledRef.current = false;
      const myGen = ++listenGenRef.current;
      const isCurrent = () => myGen === listenGenRef.current;

      // Start listening at once; the voice-limit check runs alongside it
      // (a slow or cold backend must not block the mic).
      void api.get('/api/agent/voice').catch((error) => {
        if (failureFromError(error) !== ERRORS.limit || !isCurrent()) return;
        cancelListening();
        setCapReached(true);
        setVoiceNotice(VOICE.cap);
        setVoiceState('idle');
      });

      claimMicSession(NEXUS_MIC_OWNER);

      const noSpeechMs = followUp ? NEXUS_CONVERSATION_FOLLOWUP_MS : undefined;
      const maxListenMs = followUp ? NEXUS_CONVERSATION_FOLLOWUP_MS : undefined;

      if (webSpeechAvailable()) {
        try {
          const session = startWebSpeechListen(
            {
              onTranscript: (text) => {
                if (!isCurrent()) return;
                setLiveTranscript(text);
                onLiveTranscript?.(text);
              },
              onUtteranceReady: (text) => {
                if (!isCurrent()) return;
                void processTranscript(text);
              },
              onNoSpeech: () => {
                if (!isCurrent() || transcriptHandledRef.current) return;
                transcriptHandledRef.current = true;
                setConversationFollowUp(false);
                setVoiceState('idle');
                if (listenModeRef.current === 'tap') {
                  setVoiceNotice(NO_SPEECH_HEARD_MSG);
                  setZavaLine(NO_SPEECH_HEARD_MSG);
                }
              },
              onError: (code, ctx) => {
                if (!isCurrent() || isIgnorableAborted(code, ctx)) return;
                if (shouldFallbackToUpload(code, ctx) && !uploadFallbackRef.current) {
                  uploadFallbackRef.current = true;
                  setVoiceNotice(plainSpeechError(code));
                  webSpeechSessionRef.current?.cancel();
                  webSpeechSessionRef.current = null;
                  void startMediaRecorderListen();
                  return;
                }
                const msg = plainSpeechError(code);
                setVoiceNotice(msg);
                setZavaLine(msg);
                setVoiceState('idle');
                setConversationFollowUp(false);
              },
              onEnd: () => {
                if (!isCurrent()) return;
                webSpeechSessionRef.current = null;
                if (uploadFallbackRef.current) return;
                setVoiceState((s) => (s === 'listening' ? 'idle' : s));
                releaseMicSession(NEXUS_MIC_OWNER);
              },
            },
            { silenceMs: NEXUS_SILENCE_BEFORE_SUBMIT_MS, noSpeechMs, maxListenMs },
          );
          webSpeechSessionRef.current = session;
          setVoiceState('listening');
          return;
        } catch {
          /* fall through to MediaRecorder */
        }
      }

      await startMediaRecorderListen();
    },
    [
      cancelListening,
      onLiveTranscript,
      processTranscript,
      startMediaRecorderListen,
      stopSpeaking,
    ],
  );

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  /**
   * Mic tap only — never speak without a mic tap.
   * First tap of the tab session: speak the on-screen hero line, then listen.
   * Later taps: listen only.
   * Tap while speaking: stop speaking and start listening.
   */
  const onMicTap = useCallback(() => {
    streamSpeakerRef.current?.cancel();
    streamAbortRef.current?.abort();
    streamAskGenRef.current += 1;
    if (voiceState === 'speaking') {
      micGenRef.current += 1;
      setConversationFollowUp(false);
      stopSpeaking();
      void startListening({ followUp: false });
      return;
    }
    if (voiceState === 'thinking') return;
    if (voiceState === 'listening') {
      stopRecording();
      return;
    }
    const tapAt = Date.now();
    playMicAck();
    setVoiceState('listening');
    logVoiceTiming('tap→listening', Date.now() - tapAt);
    const gen = ++micGenRef.current;
    void (async () => {
      if (!hasSpokenWelcome()) {
        markWelcomeSpoken();
        const line = heroLineRef.current.trim();
        if (line && !webSpeechAvailable()) {
          await speakText(line);
        }
      }
      if (gen !== micGenRef.current) return;
      listenModeRef.current = 'tap';
      await startListening({ followUp: false });
    })();
  }, [speakText, startListening, stopRecording, stopSpeaking, voiceState]);

  const onOrb = useCallback(() => {
    // Orb mirrors mic: push-to-talk / stop — never auto-speak without a tap.
    onMicTap();
  }, [onMicTap]);

  useEffect(
    () => () => {
      stopSpeaking();
      clearListenTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    },
    [clearListenTimers, stopSpeaking],
  );

  const runChip = useCallback(
    async (phrase: string) => {
      setYouLine(phrase);
      setFallbackChips(null);
      await runIntent(phrase);
    },
    [runIntent],
  );

  const pickCustomer = useCallback(
    async (choice: CustomerChoice) => {
      setCustomerChoices(null);
      setPendingConfirm(null);
      setYouLine(choice.name);
      navigate(`/customers/${choice.id}`);
      const balanceById = new Map<number, number>();
      if (choice.arLoadedOk && choice.balance != null) {
        balanceById.set(choice.id, choice.balance);
      } else if (choice.arLoadedOk) {
        balanceById.set(choice.id, 0);
      }
      await speakCustomerBalance(choice.name, choice.id, choice.arLoadedOk, balanceById);
    },
    [navigate, speakCustomerBalance],
  );

  const confirmYes = useCallback(async () => {
    const pending = pendingConfirmRef.current;
    if (!pending) return;
    setYouLine('yes');
    setPendingConfirm(null);
    navigate(`/customers/${pending.id}`);
    await speakCustomerBalance(pending.name, pending.id, pending.arLoadedOk, pending.balanceById);
  }, [navigate, speakCustomerBalance]);

  const confirmNo = useCallback(async () => {
    if (!pendingConfirmRef.current) return;
    setYouLine('no');
    setPendingConfirm(null);
    await speakText('Okay.');
  }, [speakText]);

  const statusLabel =
    voiceState === 'listening'
      ? VOICE.listening
      : voiceState === 'thinking'
        ? VOICE.thinking
        : voiceState === 'speaking'
          ? VOICE.speaking
          : VOICE.idle;

  return {
    voiceState,
    voiceNotice,
    countdown,
    youLine,
    zavaLine,
    fallbackChips,
    customerChoices,
    pendingConfirm,
    statusLabel,
    onOrb,
    onMicTap,
    runChip,
    pickCustomer,
    confirmYes,
    confirmNo,
    stopSpeaking,
    speakText,
    liveTranscript,
    voiceNavIntent,
    voiceNavHref,
    voiceNavLabel,
    chatTurns,
    conversationFollowUp,
    appendChatTurn: pushChatTurn,
    upsertZavaChatTurn,
  };
}
