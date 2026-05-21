// COMMAND BAR — centered, large, frosted-glass voice-first input.
//
// Always-visible toggle button at bottom-52 right-6 lets the user
// hide/show the pill (preference persists in localStorage).  When
// shown, the pill sits at the EXACT center of the viewport
// (top-1/2 left-1/2 -translate-x/y-1/2).  Four runtime states:
//   * idle/typing — frosted pill with [search][input][mic][send]
//   * listening   — pill shows centered waveform; mic icon pulses
//                   in brand red; "Listening..." text below pill
//   * processing/result — transcript box appears below pill, fades
//                          out 2s after result
//
// Triggers:
//   * Click mic → start Deepgram recording
//   * Click mic again (while listening) → stop + process audio
//   * Enter or Send (typed text) → process the typed command
//   * Cmd+K / Ctrl+K → focus input.  If bar is hidden, restore it.
//   * Escape → cancel / dismiss (only when bar is visible)
//   * Click outside → cancel / dismiss (only when bar is visible)
//   * Click toggle button → hide / show the pill
//
// ISOLATION: imports only react, react-router-dom, lucide-react, and
// the sibling files in this folder.  Does not touch any other file.
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Mic, Send, ChevronUp, ChevronDown } from 'lucide-react';
import { useDeepgramRecognition } from './useDeepgramRecognition';
import { processVoiceCommand } from './VoiceCommandProcessor';

type BarState = 'idle' | 'listening' | 'processing' | 'result';

// ── Waveform bars — 7 staggered (durations 0.85-1.15s, delays 0-240ms).
const WAVEFORM_BARS: ReadonlyArray<{ delay: string; duration: string }> = [
    { delay: '0ms',   duration: '0.85s' },
    { delay: '120ms', duration: '1.05s' },
    { delay: '80ms',  duration: '0.95s' },
    { delay: '240ms', duration: '1.15s' },
    { delay: '160ms', duration: '0.9s' },
    { delay: '200ms', duration: '1.1s' },
    { delay: '60ms',  duration: '1.0s' },
];

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

// ── Persisted UI preference — whether the pill is shown on screen.
//    Default: true.  Survives page reloads.
const VISIBLE_KEY = 'command_bar_visible';

function loadVisible(): boolean {
    try {
        // Only the explicit string 'false' counts as hidden — anything
        // else (missing, malformed, 'true') means visible.
        return localStorage.getItem(VISIBLE_KEY) !== 'false';
    } catch {
        return true;
    }
}

function saveVisible(visible: boolean): void {
    try {
        localStorage.setItem(VISIBLE_KEY, visible ? 'true' : 'false');
    } catch {
        /* quota / disabled storage — ignore */
    }
}

export function CommandBar() {
    const navigate = useNavigate();
    const [state, setState] = useState<BarState>('idle');
    const [query, setQuery] = useState('');
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');

    const inputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const ignoreNextResultRef = useRef(false);

    // ── Bar visibility — persisted across reloads.  When hidden,
    //    only the small toggle button is rendered.
    const [isVisible, setIsVisible] = useState<boolean>(() => loadVisible());
    // visibleRef keeps the latest value accessible to global keydown
    // listeners without re-binding them on every toggle.
    const visibleRef = useRef<boolean>(isVisible);
    useEffect(() => {
        visibleRef.current = isVisible;
    }, [isVisible]);

    // stateRef lets stable callbacks read the current state without
    // becoming dependencies (avoids re-attaching window listeners).
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
                // 2s fade handled by CSS animation on transcript box;
                // onAnimationEnd calls closeAndReset.
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

    // ── Cancel / dismiss ────────────────────────────────────────
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

    // ── Hide / show toggle ──────────────────────────────────────
    const toggleVisibility = useCallback(() => {
        if (isVisible) {
            // About to hide — cancel any in-flight recognition first,
            // then reset state so the bar reopens fresh next time.
            if (stateRef.current === 'listening') {
                ignoreNextResultRef.current = true;
                try {
                    recognition.stop();
                } catch {
                    /* ignore */
                }
            }
            if (stateRef.current !== 'idle') {
                setState('idle');
                setQuery('');
                setTranscript('');
                setResponse('');
            }
            setIsVisible(false);
            saveVisible(false);
        } else {
            setIsVisible(true);
            saveVisible(true);
        }
    }, [isVisible, recognition]);

    // ── Mic toggle — starts listening OR stops and submits ─────
    const handleMicToggle = useCallback(() => {
        if (state === 'processing' || state === 'result') return;

        if (state === 'listening') {
            try {
                recognition.stop();
            } catch {
                /* ignore — hook callbacks reset state */
            }
            setState('processing');
            return;
        }

        // idle → start listening
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

    // ── Form submit (Enter or Send for typed text) ─────────────
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

    // ── Cmd+K / Ctrl+K + Escape global handlers ────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isK = e.key === 'k' || e.key === 'K';
            if ((e.metaKey || e.ctrlKey) && isK) {
                e.preventDefault();
                // If hidden, restore the bar and focus the input.
                if (!visibleRef.current) {
                    setIsVisible(true);
                    saveVisible(true);
                    window.setTimeout(() => inputRef.current?.focus(), 50);
                    return;
                }
                if (stateRef.current !== 'idle') closeAndReset();
                window.setTimeout(() => inputRef.current?.focus(), 0);
                return;
            }
            if (
                e.key === 'Escape' &&
                visibleRef.current &&
                stateRef.current !== 'idle'
            ) {
                e.preventDefault();
                closeAndReset();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [closeAndReset]);

    // ── Click outside (only when not idle AND bar is visible) ──
    useEffect(() => {
        if (state === 'idle' || !isVisible) return;
        const onClickOutside = (e: MouseEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(e.target as Node)) return;
            closeAndReset();
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [state, isVisible, closeAndReset]);

    // ── Render ──────────────────────────────────────────────────
    const showTranscriptBox =
        (state === 'processing' || state === 'result') && !!transcript;
    const sendDisabled =
        !query.trim() ||
        state === 'processing' ||
        state === 'result' ||
        state === 'listening';
    const inputDisabled = state === 'processing' || state === 'result';
    const micDisabled = state === 'processing' || state === 'result';

    return (
        <>
            {/* Toggle button — always visible.  Sits at bottom-52 right-6
                (above the AI Business Advisor in the right column). */}
            <button
                type="button"
                onClick={toggleVisibility}
                aria-label={isVisible ? 'Hide command bar' : 'Show command bar'}
                title={isVisible ? 'Hide command bar' : 'Show command bar'}
                className="fixed bottom-52 right-6 z-[100] w-8 h-8 rounded-full backdrop-blur-sm bg-white/30 border border-white/40 text-gray-600 hover:bg-white/50 flex items-center justify-center transition-colors print:hidden"
                data-component="command-bar-toggle"
            >
                {isVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Bar — only when visible */}
            {isVisible && (
                <div
                    ref={containerRef}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-full max-w-[600px] px-4 print:hidden"
                    data-component="command-bar"
                >
                    <style>{KEYFRAMES_CSS}</style>

                    {/* Wrapper makes the transcript box / hint position
                        absolutely below the pill so the pill itself stays
                        rock-solid centered when those appear. */}
                    <div className="relative">
                        {/* Pill */}
                        <form
                            onSubmit={handleSubmit}
                            className="rounded-full flex items-center gap-3 px-6 py-4 backdrop-blur-md bg-white/20 border border-white/30 transition-colors"
                            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                        >
                            {/* Search icon — decorative */}
                            <Search
                                size={20}
                                className="text-gray-600 flex-shrink-0"
                                aria-hidden="true"
                            />

                            {/* Middle area: input OR waveform */}
                            {state === 'listening' ? (
                                <div
                                    className="flex-1 flex items-center justify-center h-[36px]"
                                    style={{ gap: '8px' }}
                                    aria-label="Listening — speak now"
                                >
                                    {WAVEFORM_BARS.map((bar, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                width: '4px',
                                                height: '36px',
                                                backgroundColor: '#C74634',
                                                borderRadius: '9999px',
                                                animation: `voiceWave ${bar.duration} ease-in-out ${bar.delay} infinite`,
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Ask anything or speak a command..."
                                    disabled={inputDisabled}
                                    aria-label="Command input"
                                    className="flex-1 bg-white/40 rounded-full px-3 py-1 text-base focus:outline-none disabled:opacity-50 min-w-0 text-gray-800 placeholder:text-gray-500"
                                />
                            )}

                            {/* Mic — toggle: click to start, click to stop+submit.
                                Pulses brand red during listening. */}
                            <button
                                type="button"
                                onClick={handleMicToggle}
                                disabled={micDisabled}
                                aria-label={
                                    state === 'listening'
                                        ? 'Stop and submit'
                                        : 'Speak a command'
                                }
                                title={
                                    state === 'listening'
                                        ? 'Stop and submit'
                                        : 'Click to speak'
                                }
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0 ${
                                    state === 'listening'
                                        ? 'text-[#C74634] animate-pulse'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/30'
                                }`}
                            >
                                <Mic size={20} />
                            </button>

                            {/* Send */}
                            <button
                                type="submit"
                                disabled={sendDisabled}
                                aria-label="Submit"
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 flex-shrink-0"
                                style={{ backgroundColor: '#C74634' }}
                            >
                                <Send size={18} />
                            </button>
                        </form>

                        {/* "Listening..." hint — absolute, doesn't shift pill */}
                        {state === 'listening' && (
                            <div className="absolute top-full left-0 right-0 mt-3 text-center text-sm text-gray-500">
                                Listening…
                            </div>
                        )}

                        {/* Transcript box — absolute, doesn't shift pill */}
                        {showTranscriptBox && (
                            <div
                                className="absolute top-full left-0 right-0 mt-3 backdrop-blur-md bg-white/30 border border-white/30 rounded-2xl px-5 py-4 text-gray-700"
                                style={{
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                    animation:
                                        state === 'result'
                                            ? 'voiceTranscriptFade 2s ease-out forwards'
                                            : undefined,
                                }}
                                onAnimationEnd={
                                    state === 'result' ? closeAndReset : undefined
                                }
                            >
                                <div className="text-base">"{transcript}"</div>
                                {(response || state === 'processing') && (
                                    <div className="text-sm text-gray-500 mt-2">
                                        {state === 'processing'
                                            ? 'Processing…'
                                            : response}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default CommandBar;
