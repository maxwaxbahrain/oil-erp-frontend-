// COMMAND BAR — voice-first redesign.
//
// Always-visible pill at top-center.  Three runtime states:
//   * idle/typing — gray pill with mic-on-left, input, send-on-right
//   * listening   — gray-200 pill with animated waveform + cancel + submit
//   * processing/result — pill returns to idle; transcript box appears
//                         BELOW the pill, fades out 2s after result
//
// No dropdown, no quick commands, no recent list — just the pill and
// the transcript box.
//
// Triggers:
//   * Click mic icon (left) → start Deepgram recording
//   * X (during listening) → cancel without processing
//   * Check (during listening) → stop + process the captured audio
//   * Enter or Send (typed text) → process the typed command
//   * Cmd+K / Ctrl+K → focus the input (resets state if not idle)
//   * Escape → cancel / dismiss
//   * Click outside → cancel / dismiss
//
// Pipeline: typed/spoken text → processVoiceCommand → navigation +
// response text shown in transcript box.
//
// ISOLATION: imports only react, react-router-dom, lucide-react, and
// the sibling files in this folder.  Does not touch any other file.
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Send, X, Check } from 'lucide-react';
import { useDeepgramRecognition } from './useDeepgramRecognition';
import { processVoiceCommand } from './VoiceCommandProcessor';

type BarState = 'idle' | 'listening' | 'processing' | 'result';

// ── Waveform bars — 7 staggered, varied durations between 0.85-1.15s
//    and delays between 0-240ms so they look organic (not in lockstep).
const WAVEFORM_BARS: ReadonlyArray<{ delay: string; duration: string }> = [
    { delay: '0ms',   duration: '0.85s' },
    { delay: '120ms', duration: '1.05s' },
    { delay: '80ms',  duration: '0.95s' },
    { delay: '240ms', duration: '1.15s' },
    { delay: '160ms', duration: '0.9s' },
    { delay: '200ms', duration: '1.1s' },
    { delay: '60ms',  duration: '1.0s' },
];

// ── Component-scoped CSS.  Injected once via React's <style> child;
//    browser dedupes identical @keyframes blocks if the component
//    ever remounts.
const KEYFRAMES_CSS = `
@keyframes voiceWave {
    0%, 100% { transform: scaleY(0.3); }
    50%      { transform: scaleY(1); }
}
@keyframes voiceTranscriptFade {
    0%, 75% { opacity: 1; }
    100%    { opacity: 0; }
}
`;

export function CommandBar() {
    const navigate = useNavigate();
    const [state, setState] = useState<BarState>('idle');
    const [query, setQuery] = useState('');         // text user is typing
    const [transcript, setTranscript] = useState(''); // submitted text shown in box
    const [response, setResponse] = useState('');   // Claude's reply

    const inputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const ignoreNextResultRef = useRef(false);
    // Hold the latest state in a ref so closeAndReset stays stable
    // (no churning useEffect deps) but can still read 'state' to
    // decide whether to stop the mic.
    const stateRef = useRef<BarState>('idle');
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // ── Shared command pipeline (typed or spoken).
    const runCommand = useCallback(
        async (text: string) => {
            const t = text.trim();
            if (!t) return;
            setTranscript(t);
            setQuery('');
            setResponse('');
            setState('processing');
            try {
                const result = await processVoiceCommand(t, navigate);
                setResponse(result.message || 'Done.');
            } catch (e: unknown) {
                const msg =
                    e instanceof Error ? e.message : 'Could not process command.';
                setResponse(`Error: ${msg}`);
            } finally {
                setState('result');
                // 2s display + fade is handled by the CSS animation
                // on the transcript box; onAnimationEnd calls
                // closeAndReset.  No setTimeout needed.
            }
        },
        [navigate]
    );

    // ── Mic hook callbacks ──────────────────────────────────────
    const handleTranscript = useCallback(
        (text: string) => {
            if (ignoreNextResultRef.current) {
                ignoreNextResultRef.current = false;
                return;
            }
            const t = text.trim();
            if (!t) {
                // Empty capture — silent return to idle.
                setState('idle');
                return;
            }
            void runCommand(t);
        },
        [runCommand]
    );

    const handleListenError = useCallback((message: string) => {
        if (ignoreNextResultRef.current) {
            ignoreNextResultRef.current = false;
            return;
        }
        setTranscript('');
        setResponse(message || 'Microphone error.');
        setState('result');
    }, []);

    const recognition = useDeepgramRecognition({
        onResult: handleTranscript,
        onError: handleListenError,
    });

    // ── Cancel / dismiss — used by X button, Escape, click-outside,
    //    and onAnimationEnd when the 2s fade completes.
    const closeAndReset = useCallback(() => {
        if (stateRef.current === 'listening') {
            ignoreNextResultRef.current = true;
            try {
                recognition.stop();
            } catch {
                /* ignore */
            }
        }
        setState('idle');
        setQuery('');
        setTranscript('');
        setResponse('');
    }, [recognition]);

    // ── Click the mic icon (idle/typing → start listening).
    const handleMicStart = useCallback(() => {
        if (state !== 'idle') return;
        if (!recognition.isSupported) {
            setTranscript('');
            setResponse('Microphone not supported in this browser.');
            setState('result');
            return;
        }
        setQuery('');
        setTranscript('');
        setResponse('');
        setState('listening');
        try {
            recognition.start();
        } catch (e: unknown) {
            const msg =
                e instanceof Error ? e.message : 'Could not start microphone.';
            setResponse(`Error: ${msg}`);
            setState('result');
        }
    }, [state, recognition]);

    // ── Check button during listening — stop + process.
    const handleMicSubmit = useCallback(() => {
        if (state !== 'listening') return;
        try {
            recognition.stop();
        } catch {
            /* ignore — hook callbacks reset state */
        }
        setState('processing');
        // handleTranscript will arrive with the captured text and
        // continue the pipeline through runCommand.
    }, [state, recognition]);

    // ── Form submit (Enter or Send for typed text).
    const handleSubmit = useCallback(
        (e: FormEvent) => {
            e.preventDefault();
            const text = query.trim();
            if (!text || state === 'processing' || state === 'result') return;
            if (state === 'listening') {
                ignoreNextResultRef.current = true;
                try {
                    recognition.stop();
                } catch {
                    /* ignore */
                }
            }
            void runCommand(text);
        },
        [query, state, recognition, runCommand]
    );

    // ── Cmd+K / Ctrl+K + Escape global handlers.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isK = e.key === 'k' || e.key === 'K';
            if ((e.metaKey || e.ctrlKey) && isK) {
                e.preventDefault();
                if (stateRef.current !== 'idle') closeAndReset();
                window.setTimeout(() => inputRef.current?.focus(), 0);
                return;
            }
            if (e.key === 'Escape' && stateRef.current !== 'idle') {
                e.preventDefault();
                closeAndReset();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [closeAndReset]);

    // ── Click outside to cancel/dismiss (only when not idle).
    useEffect(() => {
        if (state === 'idle') return;
        const onClickOutside = (e: MouseEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(e.target as Node)) return;
            closeAndReset();
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [state, closeAndReset]);

    // ── Render ──────────────────────────────────────────────────
    const pillBg = state === 'listening' ? 'bg-gray-200' : 'bg-gray-100';
    const showTranscriptBox =
        (state === 'processing' || state === 'result') && !!transcript;
    const sendDisabled =
        !query.trim() || state === 'processing' || state === 'result';
    const inputDisabled = state === 'processing' || state === 'result';

    return (
        <div
            ref={containerRef}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[480px] px-4 print:hidden"
            data-component="command-bar"
        >
            <style>{KEYFRAMES_CSS}</style>

            {/* Pill */}
            <form
                onSubmit={handleSubmit}
                className={`rounded-full flex items-center gap-2 px-4 py-2 border border-gray-200 transition-colors ${pillBg}`}
            >
                {state === 'listening' ? (
                    <>
                        {/* Spacer left so waveform stays visually centered */}
                        <div className="w-8 flex-shrink-0" aria-hidden="true" />

                        {/* Waveform */}
                        <div
                            className="flex-1 flex items-center justify-center h-[28px]"
                            style={{ gap: '6px' }}
                            aria-label="Listening — speak now"
                        >
                            {WAVEFORM_BARS.map((bar, i) => (
                                <div
                                    key={i}
                                    style={{
                                        width: '3px',
                                        height: '28px',
                                        backgroundColor: '#C74634',
                                        borderRadius: '9999px',
                                        animation: `voiceWave ${bar.duration} ease-in-out ${bar.delay} infinite`,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Cancel */}
                        <button
                            type="button"
                            onClick={closeAndReset}
                            aria-label="Cancel"
                            title="Cancel"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 bg-white hover:bg-gray-50 transition-colors flex-shrink-0 border border-gray-200"
                        >
                            <X size={14} />
                        </button>

                        {/* Submit (stop + process) */}
                        <button
                            type="button"
                            onClick={handleMicSubmit}
                            aria-label="Submit"
                            title="Stop and submit"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity flex-shrink-0"
                            style={{ backgroundColor: '#C74634' }}
                        >
                            <Check size={14} />
                        </button>
                    </>
                ) : (
                    <>
                        {/* Mic icon — click to start listening */}
                        <button
                            type="button"
                            onClick={handleMicStart}
                            disabled={inputDisabled}
                            aria-label="Speak a command"
                            title="Click to speak"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white/70 transition-colors disabled:opacity-40 flex-shrink-0"
                        >
                            <Mic size={14} />
                        </button>

                        {/* Text input */}
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask anything or speak a command..."
                            disabled={inputDisabled}
                            aria-label="Command input"
                            className="flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-50 min-w-0 text-gray-700 placeholder:text-gray-400"
                        />

                        {/* Send */}
                        <button
                            type="submit"
                            disabled={sendDisabled}
                            aria-label="Submit"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 flex-shrink-0"
                            style={{ backgroundColor: '#C74634' }}
                        >
                            <Send size={14} />
                        </button>
                    </>
                )}
            </form>

            {/* Transcript box — appears during processing & result */}
            {showTranscriptBox && (
                <div
                    className="bg-gray-100 rounded-2xl px-4 py-3 mt-2 text-gray-700"
                    style={{
                        animation:
                            state === 'result'
                                ? 'voiceTranscriptFade 2s ease-out forwards'
                                : undefined,
                    }}
                    onAnimationEnd={
                        state === 'result' ? closeAndReset : undefined
                    }
                >
                    <div className="text-sm">"{transcript}"</div>
                    {(response || state === 'processing') && (
                        <div className="text-xs text-gray-500 mt-1">
                            {state === 'processing'
                                ? 'Processing…'
                                : response}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default CommandBar;
