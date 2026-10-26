/**
 * Browser Web Speech API (Chrome/Edge) — live interim transcript + end on silence.
 * Fallback to record/upload when unavailable.
 */

export type LiveSpeechHandlers = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: string) => void;
  onEnd: () => void;
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
  opts?: { silenceMs?: number; lang?: string },
): { stop: () => void } {
  const Ctor = webSpeechRecognitionCtor();
  if (!Ctor) throw new Error('no-speech-api');
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = opts?.lang || 'en-US';

  const silenceMs = opts?.silenceMs ?? 800;
  let silenceTimer = 0;
  let lastHeard = '';
  let ended = false;

  const finishEnd = () => {
    if (ended) return;
    ended = true;
    window.clearTimeout(silenceTimer);
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
    if (!ended && lastHeard.trim()) {
      handlers.onFinal(lastHeard.trim());
    }
    finishEnd();
  };

  rec.start();
  bumpSilence();

  return {
    stop: () => {
      window.clearTimeout(silenceTimer);
      try {
        rec.stop();
      } catch {
        finishEnd();
      }
    },
  };
}
