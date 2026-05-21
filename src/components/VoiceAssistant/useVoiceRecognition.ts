// VOICE RECOGNITION HOOK — wraps the Web Speech API.
//
// Browser-native; no npm package needed.  Returns:
//   isSupported  : whether window.SpeechRecognition exists
//   start()      : begin listening (one utterance, then auto-stop)
//   stop()       : stop listening early
//
// The hook is "fire-and-forget": speech events resolve through the
// provided onResult / onError callbacks.  Caller state lives in
// VoiceAssistant.tsx — this file is purely speech-to-text plumbing.
//
// ISOLATION: imports only from react.  No project files.
// ============================================

import { useCallback, useEffect, useRef } from 'react';

// ── Minimal Web Speech API type declarations ──────────────────────
// lib.dom.d.ts doesn't ship these on every TS version, so we declare
// the surface we touch locally.  Module-scoped — won't merge with or
// pollute any global types.
interface WSAlternative {
    readonly transcript: string;
    readonly confidence: number;
}
interface WSResult {
    readonly isFinal: boolean;
    readonly length: number;
    [index: number]: WSAlternative;
}
interface WSResultList {
    readonly length: number;
    [index: number]: WSResult;
}
interface WSEvent extends Event {
    readonly resultIndex: number;
    readonly results: WSResultList;
}
interface WSErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}
interface WSRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((this: WSRecognition, ev: WSEvent) => void) | null;
    onerror: ((this: WSRecognition, ev: WSErrorEvent) => void) | null;
    onend: ((this: WSRecognition, ev: Event) => void) | null;
    onstart: ((this: WSRecognition, ev: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}
type WSConstructor = new () => WSRecognition;

function getRecognitionConstructor(): WSConstructor | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
        SpeechRecognition?: WSConstructor;
        webkitSpeechRecognition?: WSConstructor;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// Mapped to friendly messages.  '' = silent (no popup).
const ERROR_MESSAGES: Record<string, string> = {
    'no-speech': 'No speech detected. Try again.',
    'audio-capture': 'No microphone found. Check your device.',
    'not-allowed': 'Microphone access denied. Allow it in browser settings.',
    'service-not-allowed': 'Speech service is disabled in this browser.',
    'network': 'Network error. Speech recognition needs internet.',
    'aborted': '',
    'language-not-supported': 'Language not supported.',
};

export interface UseVoiceRecognitionOptions {
    onResult: (transcript: string) => void;
    onError: (message: string) => void;
    /** BCP-47 tag; defaults to en-US. */
    lang?: string;
}

export interface UseVoiceRecognitionApi {
    isSupported: boolean;
    start: () => void;
    stop: () => void;
}

export function useVoiceRecognition(
    options: UseVoiceRecognitionOptions
): UseVoiceRecognitionApi {
    const { onResult, onError, lang = 'en-US' } = options;

    // Latest-callback pattern: the SR instance is created once but its
    // event handlers must always see the current onResult/onError.
    const onResultRef = useRef(onResult);
    const onErrorRef = useRef(onError);
    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);
    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    const Ctor = getRecognitionConstructor();
    const isSupported = Ctor != null;

    const recognitionRef = useRef<WSRecognition | null>(null);
    const activeRef = useRef<boolean>(false);
    const finalizedRef = useRef<boolean>(false);

    // Lazy-create one SpeechRecognition instance for the lifetime of
    // the hook.  Re-creates only if lang changes (rare).
    useEffect(() => {
        if (!Ctor) return;
        const rec = new Ctor();
        rec.lang = lang;
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
            activeRef.current = true;
            finalizedRef.current = false;
        };

        rec.onresult = (ev: WSEvent) => {
            try {
                // continuous=false → exactly one result group; take alt[0].
                const result = ev.results[0];
                const alt = result?.[0];
                const transcript = (alt?.transcript || '').trim();
                if (transcript) {
                    finalizedRef.current = true;
                    onResultRef.current(transcript);
                }
            } catch {
                onErrorRef.current('Could not read speech result.');
            }
        };

        rec.onerror = (ev: WSErrorEvent) => {
            activeRef.current = false;
            const code = ev.error || '';
            // Unknown codes get a generic message; '' suppresses the popup
            // (e.g. 'aborted' when we call stop/abort ourselves).
            const msg = code in ERROR_MESSAGES
                ? ERROR_MESSAGES[code]
                : `Speech error: ${code || 'unknown'}`;
            if (msg) onErrorRef.current(msg);
        };

        rec.onend = () => {
            activeRef.current = false;
            // Surface an empty transcript so the caller can return to
            // idle when recognition ended without ever producing one
            // (e.g. user clicked stop before speaking).
            if (!finalizedRef.current) {
                onResultRef.current('');
            }
        };

        recognitionRef.current = rec;

        return () => {
            try {
                rec.abort();
            } catch {
                /* ignore */
            }
            recognitionRef.current = null;
            activeRef.current = false;
        };
    }, [Ctor, lang]);

    const start = useCallback(() => {
        const rec = recognitionRef.current;
        if (!rec) {
            onErrorRef.current('Voice input is not supported in this browser.');
            return;
        }
        if (activeRef.current) {
            // Already listening — ignore duplicate starts so we don't
            // hit InvalidStateError from the underlying SR API.
            return;
        }
        try {
            rec.start();
        } catch (e) {
            // Common race: previous session not fully torn down.  Abort
            // it cleanly then retry once.
            try {
                rec.abort();
                rec.start();
            } catch (e2) {
                const msg =
                    e2 instanceof Error ? e2.message : 'Could not start microphone.';
                onErrorRef.current(msg);
            }
        }
    }, []);

    const stop = useCallback(() => {
        const rec = recognitionRef.current;
        if (!rec || !activeRef.current) return;
        try {
            rec.stop();
        } catch {
            try {
                rec.abort();
            } catch {
                /* ignore */
            }
        }
    }, []);

    return { isSupported, start, stop };
}

export default useVoiceRecognition;
