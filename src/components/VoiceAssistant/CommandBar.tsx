// COMMAND BAR — header-center search/voice pill.
//
// Mounted inside the top <header> in App.tsx, centered between the
// role pill (left cluster) and the icon strip (right cluster).  The
// outer wrapper here is a plain in-flow container (`w-full`); the
// caller provides positioning + max-width via its parent wrapper.
// Three runtime states:
//   * idle/typing — compact dark pill: [search][input][mic]
//   * listening   — same pill, waveform replaces input, mic icon
//                   pulses brand red
//   * processing/result — transcript box appears BELOW the pill,
//                          fades out 2s after result
//
// Triggers:
//   * Click mic → start Deepgram recording
//   * Click mic again (while listening) → stop + process audio
//   * Enter (typed text) → process the typed command via form submit
//   * Cmd+K / Ctrl+K → focus input
//   * Escape → cancel / dismiss (when not idle)
//   * Click outside → cancel / dismiss (when not idle)
//
// ISOLATION: imports only react, react-router-dom, lucide-react, and
// the sibling files in this folder.  Does not touch any other file.
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Mic } from 'lucide-react';
import { useDeepgramRecognition } from './useDeepgramRecognition';
import { processVoiceCommand } from './VoiceCommandProcessor';
import {
    VOICE_LANGUAGES,
    readStoredVoiceLang,
    storeVoiceLang,
    type VoiceLanguageCode,
} from './voiceLanguages';
import { VoiceMicFabShell } from './VoiceMicFabShell';

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

export function CommandBar() {
    const navigate = useNavigate();
    const [state, setState] = useState<BarState>('idle');
    const [query, setQuery] = useState('');
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [voiceLang, setVoiceLang] = useState<VoiceLanguageCode>(() => readStoredVoiceLang());
    const [langMenuOpen, setLangMenuOpen] = useState(false);
    const [ringOpen, setRingOpen] = useState(false);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const langMenuRef = useRef<HTMLDivElement | null>(null);
    const ignoreNextResultRef = useRef(false);

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
                // 2s fade handled by CSS animation on transcript box.
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
                // Empty transcript = silence / zero-byte / Deepgram heard
                // nothing.  Surface it as a result instead of silently
                // returning to idle so the user sees the assistant tried.
                // Mirror the message into `transcript` so the bubble's
                // `!!transcript` visibility gate actually renders it
                // (same fix pattern as handleListenError below).
                setTranscript('No speech detected. Please try again.');
                setResponse('No speech detected. Please try again.');
                setState('result');
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
        // Mirror the message into `transcript` too — the bubble's
        // visibility is gated on `!!transcript`, so without this the
        // error is set but never rendered.  See showTranscriptBox below.
        setTranscript(message || 'Microphone error.');
        setResponse(message || 'Microphone error.');
        setState('result');
    }, []);

    const recognition = useDeepgramRecognition({
        onResult: handleTranscript,
        onError: handleListenError,
        language: voiceLang,
    });

    const selectVoiceLang = useCallback((code: VoiceLanguageCode) => {
        setVoiceLang(code);
        storeVoiceLang(code);
        setLangMenuOpen(false);
    }, []);

    useEffect(() => {
        if (!langMenuOpen) return;
        const onDocClick = (e: MouseEvent) => {
            if (!langMenuRef.current?.contains(e.target as Node)) {
                setLangMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [langMenuOpen]);

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

    // ── Mic toggle — starts listening OR stops and submits ─────
    const handleMicToggle = useCallback(() => {
        if (state === 'processing' || state === 'result') return;

        if (state === 'listening') {
            try {
                recognition.stop();
            } catch {
                /* ignore */
            }
            setState('processing');
            return;
        }

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

    // ── Form submit (Enter for typed text) ─────────────────────
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

    // ── Click outside (only when not idle) ─────────────────────
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

    // ── External fill via custom event (chips bar dispatches this) ──
    // Chips emit `soltol:fill-cmd` with { detail: { text } }; we set the
    // input value and focus.  No public API change — purely additive
    // window listener so the chip bar in App.tsx can drive the input
    // without prop drilling.
    useEffect(() => {
        const onFill = (e: Event) => {
            const detail = (e as CustomEvent<{ text?: string }>).detail;
            const text = detail?.text;
            if (!text) return;
            setQuery(text);
            window.setTimeout(() => inputRef.current?.focus(), 0);
        };
        window.addEventListener('soltol:fill-cmd', onFill as EventListener);
        return () => window.removeEventListener('soltol:fill-cmd', onFill as EventListener);
    }, []);

    // ── Render ──────────────────────────────────────────────────
    const showTranscriptBox =
        (state === 'processing' || state === 'result') && !!transcript;
    const inputDisabled = state === 'processing' || state === 'result';
    const micDisabled = state === 'processing' || state === 'result';

    return (
        <>
        <div
            ref={containerRef}
            className="w-full print:hidden"
            data-component="command-bar"
        >
            <style>{KEYFRAMES_CSS}</style>

            {/* Wrapper for absolute-positioned transcript box above pill */}
            <div className="relative">
                {/* Transcript box ABOVE pill — absolute, doesn't shift pill */}
                {showTranscriptBox && (
                    <div
                        className="absolute top-full left-0 right-0 mt-3 z-[100] bg-gray-800 text-white rounded-2xl px-4 py-3"
                        style={{
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
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
                            <div className="text-xs text-gray-400 mt-1">
                                {state === 'processing'
                                    ? 'Processing…'
                                    : response}
                            </div>
                        )}
                    </div>
                )}

                {/* Outer chrome (background + border + radius + 38px height)
                    lives on the parent wrapper in App.tsx now; the form is
                    just an inner flex strip. */}
                <form
                    onSubmit={handleSubmit}
                    className="flex items-center gap-2 px-3 text-white w-full h-full"
                >
                    {/* Sparkle icon — decorative, blue */}
                    <Sparkles
                        size={14}
                        className="text-[#4F8EF7] flex-shrink-0"
                        aria-hidden="true"
                    />

                    {/* Middle area: input OR waveform.  Both share the
                        same fixed width so the pill doesn't jump in
                        size between states. */}
                    {state === 'listening' ? (
                        <div
                            className="flex items-center justify-center h-[20px] flex-shrink-0"
                            style={{ gap: '5px', width: '160px' }}
                            aria-label="Listening — speak now"
                        >
                            {WAVEFORM_BARS.map((bar, i) => (
                                <div
                                    key={i}
                                    style={{
                                        width: '3px',
                                        height: '20px',
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
                            placeholder={'"Ali bought Bettano OW16 3 cases $56" — or ask anything...'}
                            disabled={inputDisabled}
                            aria-label="Command input"
                            className="bg-transparent text-sm text-white placeholder:text-gray-400 focus:outline-none disabled:opacity-50 flex-1 min-w-0"
                        />
                    )}

                    {/* ⌘K hint badge (idle only).  Visual only — actual focus
                        is handled by the global keydown listener above. */}
                    {state !== 'listening' && (
                        <kbd className="inline-flex items-center text-[10px] font-mono text-redwood-text-muted bg-white/5 border border-redwood-border rounded px-1.5 py-[1px] flex-shrink-0">
                            ⌘K
                        </kbd>
                    )}

                    {/* Send box — 42×38 blue arrow flush to right edge of
                        the wrapper. Always rendered (except while listening,
                        where the waveform replaces the input). Submitting an
                        empty query is a no-op handled by handleSubmit. */}
                    {state !== 'listening' && (
                        <button
                            type="submit"
                            aria-label="Send command"
                            title="Send (Enter)"
                            disabled={inputDisabled}
                            className="hover:brightness-110 transition-all disabled:opacity-40"
                            style={{
                                width: '42px',
                                height: '38px',
                                background: '#4F8EF7',
                                borderRadius: '0 7px 7px 0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: 'none',
                                cursor: 'pointer',
                                marginLeft: '4px',
                                marginRight: '-12px',
                                padding: 0,
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="12" y1="19" x2="12" y2="5" />
                                <polyline points="5 12 12 5 19 12" />
                            </svg>
                        </button>
                    )}

                    {/* Language picker — desktop command bar */}
                    <div className="hidden lg:block relative flex-shrink-0" ref={langMenuRef}>
                        <button
                            type="button"
                            onClick={() => setLangMenuOpen((v) => !v)}
                            aria-label="Voice language"
                            title="Voice recognition language"
                            className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(79,142,247,0.25)',
                            }}
                        >
                            🌐
                        </button>
                        {langMenuOpen && (
                            <div
                                className="absolute top-full right-0 mt-2 z-[120] rounded-xl p-2 shadow-2xl"
                                style={{
                                    width: 200,
                                    background: '#111827',
                                    border: '1px solid rgba(79,142,247,0.35)',
                                }}
                            >
                                <div className="grid grid-cols-2 gap-1 max-h-[220px] overflow-y-auto">
                                    {VOICE_LANGUAGES.map((lang) => {
                                        const active = lang.code === voiceLang;
                                        return (
                                            <button
                                                key={lang.code}
                                                type="button"
                                                onClick={() => selectVoiceLang(lang.code)}
                                                className="rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors"
                                                style={{
                                                    background: active
                                                        ? '#4F8EF7'
                                                        : 'rgba(255,255,255,0.05)',
                                                    color: active ? '#fff' : '#8BA3C7',
                                                }}
                                            >
                                                <span className="mr-1">{lang.flag}</span>
                                                {lang.code.toUpperCase()}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mic — desktop only; mobile uses floating FAB in VoiceAssistant. */}
                    <button
                        type="button"
                        onClick={handleMicToggle}
                        disabled={micDisabled}
                        aria-label={state === 'listening' ? 'Stop and submit' : 'Speak a command'}
                        title={state === 'listening' ? 'Stop and submit' : 'Click to speak'}
                        className={`hidden lg:flex flex-shrink-0 disabled:opacity-40 ${state === 'listening' ? 'animate-pulse' : ''}`}
                        style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: state === 'listening' ? 'rgba(239,68,68,.15)' : 'rgba(79,142,247,.15)',
                            color: state === 'listening' ? '#EF4444' : '#4F8EF7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            border: 'none',
                            padding: 0,
                        }}
                        onMouseEnter={(e) => {
                            if (state === 'listening') return;
                            const el = e.currentTarget;
                            el.style.background = 'rgba(239,68,68,.15)';
                            el.style.boxShadow = '0 0 0 3px rgba(239,68,68,.25)';
                            el.style.transform = 'scale(1.15)';
                            el.style.color = '#EF4444';
                        }}
                        onMouseLeave={(e) => {
                            if (state === 'listening') return;
                            const el = e.currentTarget;
                            el.style.background = 'rgba(79,142,247,.15)';
                            el.style.boxShadow = 'none';
                            el.style.transform = 'scale(1)';
                            el.style.color = '#4F8EF7';
                        }}
                    >
                        <Mic size={14} />
                    </button>
                </form>
            </div>
        </div>

        {/* Desktop floating mic FAB — bottom-right, separate from header pill */}
        <VoiceMicFabShell
            variant="desktop"
            voiceLang={voiceLang}
            ringOpen={ringOpen}
            setRingOpen={setRingOpen}
            onSelectLang={selectVoiceLang}
            onMicClick={handleMicToggle}
            micDisabled={micDisabled}
            fabListening={state === 'listening'}
            showProcessing={state === 'processing'}
        />
        </>
    );
}

export default CommandBar;
