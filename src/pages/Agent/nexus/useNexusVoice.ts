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
  RECORD_LIMIT_SECONDS,
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
  VOICE_FALLBACK_CHIPS,
  countVanStatuses,
  customerBalanceSpeech,
  formatCardSpeech,
  formatVanSummary,
  formatWelcomeLine,
  hasSpokenWelcome,
  markWelcomeSpoken,
  parseVoiceIntent,
  planetIdForCardModule,
  resolveCustomerMatches,
} from './voiceIntent';

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
  /** When false, do not play welcome yet (wait for alert-bar numbers). */
  welcomeReady?: boolean;
  /** Prebuilt welcome line (alert-aligned). */
  welcomeLine?: string;
};

export function useNexusVoice(opts: Opts) {
  const {
    firstName,
    cards,
    cardsLoadOk,
    needsYou,
    speakable,
    activeCardId,
    setActiveCardId,
    setActivePlanetId,
    navigate,
    welcomeReady = true,
    welcomeLine,
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

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceUrlRef = useRef('');
  const listenTimers = useRef<{ tick?: number; limit?: number }>({});
  const briefingIndexRef = useRef(0);
  const speakableRef = useRef(speakable);
  const activeCardIdRef = useRef(activeCardId);
  const welcomeArmedRef = useRef(false);
  const pendingConfirmRef = useRef<PendingConfirm | null>(null);

  useEffect(() => {
    pendingConfirmRef.current = pendingConfirm;
  }, [pendingConfirm]);

  useEffect(() => {
    speakableRef.current = speakable;
  }, [speakable]);
  useEffect(() => {
    activeCardIdRef.current = activeCardId;
  }, [activeCardId]);

  const clearListenTimers = useCallback(() => {
    if (listenTimers.current.tick) window.clearInterval(listenTimers.current.tick);
    if (listenTimers.current.limit) window.clearTimeout(listenTimers.current.limit);
    listenTimers.current = {};
  }, []);

  const stopSpeaking = useCallback(() => {
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
  }, []);

  const speakText = useCallback(
    async (text: string) => {
      setZavaLine(text);
      if (capReached) {
        setVoiceState('idle');
        return;
      }
      setVoiceState('speaking');
      const speakWatchdog = window.setTimeout(() => {
        setVoiceState((s) => (s === 'speaking' ? 'idle' : s));
      }, 50_000);
      try {
        const response = await api.post<Blob>(
          '/api/agent/speak',
          { headline: text, note: null },
          { responseType: 'blob', timeout: 45_000 },
        );
        const url = URL.createObjectURL(response.data);
        voiceUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        const finish = () => {
          window.clearTimeout(speakWatchdog);
          setVoiceState('idle');
        };
        audio.onended = finish;
        audio.onerror = finish;
        await audio.play();
      } catch (error) {
        window.clearTimeout(speakWatchdog);
        setVoiceState('idle');
        const message = await voiceFailure(error);
        if (message === ERRORS.limit) {
          setCapReached(true);
          setVoiceNotice(VOICE.cap);
        } else {
          setVoiceNotice(message);
        }
        // Cap / speak failure → text only (already set zavaLine)
      }
    },
    [capReached],
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
          // No pending confirm — treat as unknown
          setFallbackChips([...VOICE_FALLBACK_CHIPS]);
          await speakText("I didn't catch that.");
          return;
        case 'stop':
          stopSpeaking();
          setVoiceState('idle');
          setZavaLine('Stopped.');
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
          setFallbackChips([...VOICE_FALLBACK_CHIPS]);
          await speakText("I didn't catch that.");
      }
    },
    [navigate, setActivePlanetId, speakCardAt, speakCustomerBalance, speakText, stopSpeaking],
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
        const transcript = (heard.data.transcript || '').trim();
        if (!transcript) {
          setVoiceState('idle');
          setVoiceNotice(VOICE.unheard);
          return;
        }
        setVoiceNotice('');
        setYouLine(transcript);
        await runIntent(transcript);
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
    [runIntent],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorderRef.current = null;
    clearListenTimers();
    setCountdown(null);
  }, [clearListenTimers]);

  const startListening = useCallback(async () => {
    stopSpeaking();
    setVoiceNotice('');
    setFallbackChips(null);
    try {
      await api.get('/api/agent/voice');
    } catch (error) {
      const message = failureFromError(error);
      if (message === ERRORS.limit) {
        setCapReached(true);
        setVoiceNotice(VOICE.cap);
      } else {
        setVoiceNotice(message);
      }
      setVoiceState('idle');
      return;
    }
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
        const clip = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
        void sendClip(clip);
      };
      recorderRef.current = recorder;
      const started = Date.now();
      listenTimers.current = {
        tick: window.setInterval(() => {
          setCountdown(recordingCountdown(Date.now() - started));
        }, 200),
        limit: window.setTimeout(() => stopRecording(), RECORD_LIMIT_SECONDS * 1000),
      };
      recorder.start();
      setVoiceState('listening');
    } catch (error) {
      setVoiceState('idle');
      setVoiceNotice(permissionDenied(error) ? VOICE.denied : 'This browser cannot record a voice clip.');
    }
  }, [clearListenTimers, sendClip, stopRecording, stopSpeaking]);

  /** First click/tap this session → welcome once (only after alert numbers are ready). */
  const onFirstInteraction = useCallback(async () => {
    if (!welcomeReady) return;
    if (welcomeArmedRef.current) return;
    if (hasSpokenWelcome()) return;
    welcomeArmedRef.current = true;
    markWelcomeSpoken();
    const line =
      welcomeLine ||
      formatWelcomeLine({
        firstName,
        cardsLoadOk,
        updateCount: cards.length,
        needsYou,
      });
    await speakText(line);
  }, [cards.length, cardsLoadOk, firstName, needsYou, speakText, welcomeLine, welcomeReady]);

  const onOrb = useCallback(() => {
    // First orb tap of the session is welcome only — don't cut it off with listening.
    if (!hasSpokenWelcome()) {
      if (!welcomeReady) {
        setVoiceNotice('Loading your numbers…');
        return;
      }
      void onFirstInteraction();
      return;
    }
    if (voiceState === 'speaking') {
      stopSpeaking();
      return;
    }
    if (voiceState === 'thinking') return;
    if (voiceState === 'listening') {
      stopRecording();
      return;
    }
    void startListening();
  }, [onFirstInteraction, startListening, stopRecording, stopSpeaking, voiceState, welcomeReady]);

  useEffect(() => {
    if (!welcomeReady) return;
    const handler = () => {
      void onFirstInteraction();
    };
    window.addEventListener('pointerdown', handler, { once: true, capture: true });
    return () => window.removeEventListener('pointerdown', handler, true);
  }, [onFirstInteraction, welcomeReady]);

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
    runChip,
    pickCustomer,
    confirmYes,
    confirmNo,
    stopSpeaking,
  };
}
