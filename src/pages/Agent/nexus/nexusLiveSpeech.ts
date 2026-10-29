/**
 * Browser Web Speech API (Chrome/Edge) — live interim transcript + end on silence.
 * Fallback to record/upload when unavailable.
 */

import {
  joinSpeechTranscript,
  NEXUS_SHORT_UTTERANCE_WAIT_MS,
  NEXUS_SILENCE_BEFORE_SUBMIT_MS,
  shouldWaitForMoreWords,
} from './nexusVoiceCapture';
import { NEXUS_MAX_LISTEN_MS, NEXUS_NO_SPEECH_MS, type SpeechErrorContext } from './nexusSpeechErrors';

export type LiveSpeechHandlers = {
  /** Full sentence so far (all finals + interim). */
  onTranscript: (text: string) => void;
  /** Fired once after silence (or explicit commit), with the full utterance. */
  onUtteranceReady: (text: string) => void;
  onError: (code: string, ctx?: SpeechErrorContext) => void;
  onEnd: () => void;
  onNoSpeech?: () => void;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

export function webSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function webSpeechAvailable(): boolean {
  return webSpeechRecognitionCtor() != null;
}

export function startWebSpeechListen(
  handlers: LiveSpeechHandlers,
  opts?: {
    silenceMs?: number;
    lang?: string;
    noSpeechMs?: number;
    maxListenMs?: number;
  },
): { stop: () => void; cancel: () => void } {
  const Ctor = webSpeechRecognitionCtor();
  if (!Ctor) throw new Error('no-speech-api');
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = opts?.lang || 'en-US';
  const log = (...a: unknown[]) => console.info('[ZavaMic]', ...a);
  const recAny = rec as unknown as Record<string, unknown>;
  recAny.onstart = () => log('start');
  recAny.onaudiostart = () => log('audio start (mic is sending sound)');
  recAny.onspeechstart = () => log('speech detected');

  const silenceMs = opts?.silenceMs ?? NEXUS_SILENCE_BEFORE_SUBMIT_MS;
  const noSpeechMs = opts?.noSpeechMs ?? NEXUS_NO_SPEECH_MS;
  const maxListenMs = opts?.maxListenMs ?? NEXUS_MAX_LISTEN_MS;
  let silenceTimer = 0;
  let noSpeechTimer = 0;
  let maxListenTimer = 0;
  const finalParts: string[] = [];
  let currentInterim = '';
  let heardAny = false;
  let ended = false;
  let stoppedByUs = false;
  let cancelled = false;
  let utteranceDelivered = false;
  let shortWaitUsed = false;

  const fullText = () => joinSpeechTranscript(finalParts, currentInterim);

  const stopRecogniser = () => {
    stoppedByUs = true;
    try {
      rec.stop();
    } catch {
      finishEnd();
    }
  };

  const finishEnd = () => {
    if (ended) return;
    ended = true;
    window.clearTimeout(silenceTimer);
    window.clearTimeout(noSpeechTimer);
    window.clearTimeout(maxListenTimer);
    handlers.onEnd();
  };

  const deliverUtterance = (text: string) => {
    const t = text.trim();
    if (!t || utteranceDelivered) return;
    utteranceDelivered = true;
    handlers.onUtteranceReady(t);
  };

  const scheduleSilenceCommit = (waitMs: number) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = window.setTimeout(() => {
      const t = fullText().trim();
      if (!t) {
        stopRecogniser();
        return;
      }
      if (shouldWaitForMoreWords(t) && !shortWaitUsed) {
        shortWaitUsed = true;
        scheduleSilenceCommit(NEXUS_SHORT_UTTERANCE_WAIT_MS);
        return;
      }
      deliverUtterance(t);
      stopRecogniser();
    }, waitMs);
  };

  const bumpSilence = () => {
    shortWaitUsed = false;
    scheduleSilenceCommit(silenceMs);
  };

  const markHeard = (text: string) => {
    if (!text.trim()) return;
    heardAny = true;
    window.clearTimeout(noSpeechTimer);
  };

  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      const piece = r[0]?.transcript || '';
      if (r.isFinal) {
        if (piece.trim()) finalParts.push(piece.trim());
      } else {
        interim += piece;
      }
    }
    currentInterim = interim.trim();
    log('result', fullText());
    const combined = fullText();
    if (combined) {
      markHeard(combined);
      handlers.onTranscript(combined);
      bumpSilence();
    }
  };

  rec.onerror = (e) => {
    const code = e.error || 'error';
    log('error', code);
    if (cancelled || (String(code).toLowerCase() === 'aborted' && stoppedByUs)) {
      finishEnd();
      return;
    }
    // Words already heard: answer them instead of showing an error.
    const heardText = fullText().trim();
    if (heardText && !utteranceDelivered) {
      deliverUtterance(heardText);
      finishEnd();
      return;
    }
    handlers.onError(code, { stoppedByUs });
    finishEnd();
  };

  rec.onend = () => {
    log('end', { heardAny, delivered: utteranceDelivered });
    if (!ended && !cancelled) {
      // Chrome can end the session on its own before our silence timer fires.
      // Never drop words that were already heard.
      const heardText = fullText().trim();
      if (heardText && !utteranceDelivered) {
        deliverUtterance(heardText);
      } else if (!heardAny) {
        handlers.onNoSpeech?.();
      }
    }
    finishEnd();
  };

  rec.start();
  bumpSilence();

  noSpeechTimer = window.setTimeout(() => {
    if (heardAny || ended) return;
    log('no speech after', noSpeechMs, 'ms');
    handlers.onNoSpeech?.();
    stopRecogniser();
  }, noSpeechMs);

  maxListenTimer = window.setTimeout(() => {
    if (ended) return;
    const t = fullText().trim();
    if (t && !utteranceDelivered) deliverUtterance(t);
    stopRecogniser();
  }, maxListenMs);

  const clearTimers = () => {
    window.clearTimeout(silenceTimer);
    window.clearTimeout(noSpeechTimer);
    window.clearTimeout(maxListenTimer);
  };

  return {
    stop: () => {
      clearTimers();
      const t = fullText().trim();
      if (t && !utteranceDelivered) deliverUtterance(t);
      stopRecogniser();
    },
    cancel: () => {
      cancelled = true;
      clearTimers();
      stopRecogniser();
    },
  };
}
