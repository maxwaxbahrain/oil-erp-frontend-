/**
 * Browser Web Speech API (Chrome/Edge) — live interim transcript + end on silence.
 * Fallback to record/upload when unavailable.
 */

import { NEXUS_MAX_LISTEN_MS, NEXUS_NO_SPEECH_MS } from './nexusSpeechErrors';

export type LiveSpeechHandlers = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: string) => void;
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
): { stop: () => void } {
  const Ctor = webSpeechRecognitionCtor();
  if (!Ctor) throw new Error('no-speech-api');
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = opts?.lang || 'en-US';

  const silenceMs = opts?.silenceMs ?? 800;
  const noSpeechMs = opts?.noSpeechMs ?? NEXUS_NO_SPEECH_MS;
  const maxListenMs = opts?.maxListenMs ?? NEXUS_MAX_LISTEN_MS;
  let silenceTimer = 0;
  let noSpeechTimer = 0;
  let maxListenTimer = 0;
  let lastHeard = '';
  let heardAny = false;
  let ended = false;

  const finishEnd = () => {
    if (ended) return;
    ended = true;
    window.clearTimeout(silenceTimer);
    window.clearTimeout(noSpeechTimer);
    window.clearTimeout(maxListenTimer);
    handlers.onEnd();
  };

  const bumpSilence = () => {
    window.clearTimeout(silenceTimer);
    silenceTimer = window.setTimeout(() => {
      try {
        rec.stop();
      } catch {
        finishEnd();
      }
    }, silenceMs);
  };

  const markHeard = (text: string) => {
    if (!text.trim()) return;
    heardAny = true;
    window.clearTimeout(noSpeechTimer);
  };

  rec.onresult = (event) => {
    let interim = '';
    let finalChunk = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      const piece = r[0]?.transcript || '';
      if (r.isFinal) finalChunk += piece;
      else interim += piece;
    }
    const combined = (finalChunk || interim).trim();
    if (combined) {
      lastHeard = combined;
      markHeard(combined);
      handlers.onInterim(combined);
      bumpSilence();
    }
    if (finalChunk.trim()) {
      handlers.onFinal(finalChunk.trim());
    }
  };

  rec.onerror = (e) => {
    handlers.onError(e.error || 'error');
    finishEnd();
  };

  rec.onend = () => {
    if (!ended && !heardAny) {
      handlers.onNoSpeech?.();
    }
    if (!ended && lastHeard.trim()) {
      handlers.onFinal(lastHeard.trim());
    }
    finishEnd();
  };

  rec.start();
  bumpSilence();

  noSpeechTimer = window.setTimeout(() => {
    if (heardAny || ended) return;
    handlers.onNoSpeech?.();
    try {
      rec.stop();
    } catch {
      finishEnd();
    }
  }, noSpeechMs);

  maxListenTimer = window.setTimeout(() => {
    if (ended) return;
    try {
      rec.stop();
    } catch {
      finishEnd();
    }
  }, maxListenMs);

  return {
    stop: () => {
      window.clearTimeout(silenceTimer);
      window.clearTimeout(noSpeechTimer);
      window.clearTimeout(maxListenTimer);
      try {
        rec.stop();
      } catch {
        finishEnd();
      }
    },
  };
}
