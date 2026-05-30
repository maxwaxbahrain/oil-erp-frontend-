// DEEPGRAM RECOGNITION HOOK — drop-in replacement for
// useVoiceRecognition.  Same surface, different transport:
//
//   start() → getUserMedia → new MediaRecorder → record audio
//   stop()  → MediaRecorder.stop() → upload blob → /ai/transcribe
//             → fire onResult(transcript)
//
// Why this exists: the Web Speech API used by useVoiceRecognition
// struggles with non-US accents.  Deepgram Nova-2 (language=en) is
// significantly better at accented English.
//
// Recording is auto-capped at 30 seconds to bound Deepgram cost
// (~$0.0043/min → ~$0.0021 per maxed-out call).
//
// ISOLATION: imports only react.  Uses plain fetch() + browser-native
// MediaRecorder / MediaStream / getUserMedia.  No npm install.
// ============================================

import { useCallback, useEffect, useRef } from 'react';

// Same VITE_API_URL convention as the rest of the project, inlined so
// this file stays isolated.
const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
const TRANSCRIBE_BASE = `${API_HOST}/ai/transcribe`;

const MAX_RECORDING_MS = 30_000;

export interface UseDeepgramRecognitionOptions {
    onResult: (transcript: string) => void;
    onError: (message: string) => void;
    /** BCP-47-ish code sent as ?language= on POST /ai/transcribe (default en). */
    language?: string;
}

export interface UseDeepgramRecognitionApi {
    isSupported: boolean;
    start: () => void;
    stop: () => void;
}

function detectSupport(): boolean {
    if (typeof window === 'undefined') return false;
    if (!window.navigator?.mediaDevices?.getUserMedia) return false;
    if (typeof window.MediaRecorder === 'undefined') return false;
    return true;
}

/** Pick the best MIME type the browser actually supports.  webm/opus
 *  is the de-facto default in Chrome/Edge/Firefox; mp4 is for Safari. */
function pickMimeType(): string {
    if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
        return '';
    }
    const isTypeSupported = window.MediaRecorder.isTypeSupported;
    if (typeof isTypeSupported !== 'function') return '';
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
    ];
    for (const t of candidates) {
        try {
            if (isTypeSupported.call(window.MediaRecorder, t)) return t;
        } catch {
            /* try next */
        }
    }
    return '';
}

function filenameForMime(mimeType: string): string {
    if (mimeType.includes('mp4')) return 'voice.mp4';
    if (mimeType.includes('ogg')) return 'voice.ogg';
    return 'voice.webm';
}

export function useDeepgramRecognition(
    options: UseDeepgramRecognitionOptions
): UseDeepgramRecognitionApi {
    const { onResult, onError, language = 'en' } = options;

    // Latest-callback refs so MediaRecorder event handlers always
    // call the freshest closure without re-creating the recorder.
    const onResultRef = useRef(onResult);
    const onErrorRef = useRef(onError);
    const languageRef = useRef(language);
    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);
    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);
    useEffect(() => {
        languageRef.current = language || 'en';
    }, [language]);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const activeRef = useRef<boolean>(false);
    const capTimerRef = useRef<number | null>(null);

    const isSupported = detectSupport();

    // ── Teardown — stop tracks, drop refs.  Safe to call repeatedly.
    const teardown = useCallback(() => {
        if (capTimerRef.current != null) {
            window.clearTimeout(capTimerRef.current);
            capTimerRef.current = null;
        }
        const stream = streamRef.current;
        if (stream) {
            try {
                stream.getTracks().forEach((t) => t.stop());
            } catch {
                /* ignore */
            }
        }
        streamRef.current = null;
        recorderRef.current = null;
        chunksRef.current = [];
        activeRef.current = false;
    }, []);

    // ── Upload assembled blob to backend.  Always fires exactly one
    //    callback (onResult or onError), then tears down.
    const uploadBlob = useCallback(
        async (blob: Blob, mimeType: string) => {
            if (!blob || blob.size === 0) {
                onResultRef.current('');
                teardown();
                return;
            }
            try {
                const form = new FormData();
                form.append(
                    'audio',
                    new Blob([blob], { type: mimeType || blob.type || 'audio/webm' }),
                    filenameForMime(mimeType)
                );

                const lang = encodeURIComponent(languageRef.current || 'en');
                const response = await fetch(`${TRANSCRIBE_BASE}?language=${lang}`, {
                    method: 'POST',
                    body: form,
                });

                if (!response.ok) {
                    let detail = '';
                    try {
                        const err = (await response.json()) as { detail?: unknown };
                        if (typeof err?.detail === 'string') detail = err.detail;
                    } catch {
                        /* body wasn't JSON */
                    }
                    throw new Error(
                        detail || `Transcription failed (HTTP ${response.status})`
                    );
                }

                const data = (await response.json()) as { transcript?: string };
                const transcript = (data.transcript || '').trim();
                onResultRef.current(transcript);
            } catch (e: unknown) {
                const msg =
                    e instanceof Error ? e.message : 'Could not transcribe audio.';
                onErrorRef.current(msg);
            } finally {
                teardown();
            }
        },
        [teardown]
    );

    // ── Start recording.  Idempotent — duplicate starts are ignored.
    const start = useCallback(() => {
        if (!isSupported) {
            onErrorRef.current(
                'Microphone recording is not supported in this browser.'
            );
            return;
        }
        if (activeRef.current) return;
        activeRef.current = true;

        void (async () => {
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (e: unknown) {
                activeRef.current = false;
                const code = (e as { name?: string })?.name || '';
                if (code === 'NotAllowedError' || code === 'SecurityError') {
                    onErrorRef.current(
                        'Microphone access denied. Allow it in browser settings.'
                    );
                } else if (code === 'NotFoundError') {
                    onErrorRef.current('No microphone found. Check your device.');
                } else {
                    const msg =
                        e instanceof Error ? e.message : 'Could not access microphone.';
                    onErrorRef.current(msg);
                }
                return;
            }

            // Race-condition guard: stop() may have run while we were
            // waiting for the permission prompt.  Bail out cleanly.
            if (!activeRef.current) {
                try {
                    stream.getTracks().forEach((t) => t.stop());
                } catch {
                    /* ignore */
                }
                return;
            }

            streamRef.current = stream;
            const mimeType = pickMimeType();
            let recorder: MediaRecorder;
            try {
                recorder = mimeType
                    ? new MediaRecorder(stream, { mimeType })
                    : new MediaRecorder(stream);
            } catch (e: unknown) {
                const msg =
                    e instanceof Error ? e.message : 'Could not start recorder.';
                onErrorRef.current(msg);
                teardown();
                return;
            }

            recorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (ev: BlobEvent) => {
                if (ev.data && ev.data.size > 0) {
                    chunksRef.current.push(ev.data);
                }
            };

            recorder.onerror = (ev: Event) => {
                const err = (ev as unknown as { error?: { message?: string } }).error;
                const msg = err?.message || 'Recorder error.';
                onErrorRef.current(msg);
                teardown();
            };

            recorder.onstop = () => {
                // ondataavailable fires before onstop, so chunks are
                // fully populated by the time we get here.
                const effectiveType =
                    recorder.mimeType || mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: effectiveType });
                // Fire and forget — uploadBlob handles callbacks +
                // teardown internally.
                void uploadBlob(blob, effectiveType);
            };

            // Final guard before kicking off — stop() may have run
            // between the previous activeRef check and now.
            if (!activeRef.current) {
                teardown();
                return;
            }

            try {
                recorder.start();
            } catch (e: unknown) {
                const msg =
                    e instanceof Error ? e.message : 'Could not start recorder.';
                onErrorRef.current(msg);
                teardown();
                return;
            }

            // Auto-stop after MAX_RECORDING_MS to bound Deepgram cost.
            capTimerRef.current = window.setTimeout(() => {
                const r = recorderRef.current;
                if (r && r.state === 'recording') {
                    try {
                        r.stop();
                    } catch {
                        /* onstop / teardown handles cleanup */
                    }
                }
            }, MAX_RECORDING_MS);
        })();
    }, [isSupported, teardown, uploadBlob]);

    // ── Stop early.  Three paths:
    //    1. Recorder is recording → stop it; onstop fires the upload.
    //    2. Recorder doesn't exist yet (still in getUserMedia or
    //       construction) → flip flag, the async block bails out.
    //       Signal empty result so the component returns to idle.
    //    3. Not active at all → no-op.
    const stop = useCallback(() => {
        if (!activeRef.current) return;
        const rec = recorderRef.current;
        if (rec && rec.state === 'recording') {
            try {
                rec.stop();
            } catch {
                teardown();
                onResultRef.current('');
            }
            return;
        }
        activeRef.current = false;
        teardown();
        onResultRef.current('');
    }, [teardown]);

    // ── Unmount cleanup — stop in-flight recording and release the
    //    mic so the browser's recording indicator goes away.
    useEffect(() => {
        return () => {
            const rec = recorderRef.current;
            if (rec && rec.state === 'recording') {
                try {
                    rec.stop();
                } catch {
                    /* ignore */
                }
            }
            teardown();
        };
    }, [teardown]);

    return { isSupported, start, stop };
}

export default useDeepgramRecognition;
