// VOICE ASSISTANT — floating mic button (bottom-right of the shell).
//
// User clicks → Web Speech API captures speech → transcript sent to
// the backend /ai/chat endpoint (which proxies Claude Haiku) → returns
// a JSON action → executed via VoiceCommandProcessor.
//
// ISOLATION: this file imports only from react, react-router-dom,
// lucide-react (already in the project), and three sibling files in
// this folder.  It does NOT touch any existing component, store, or
// service.  Removing the single mount line in App.tsx restores the
// app to its original state.
//
// Lives at fixed bottom-6 right-52 — to the LEFT of the existing
// "AI Business Advisor" pill (which is at bottom-6 right-6), so the
// two never overlap.
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Loader2, Volume2 } from 'lucide-react';
import { useDeepgramRecognition as useVoiceRecognition } from './useDeepgramRecognition';
import { processVoiceCommand } from './VoiceCommandProcessor';

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceAssistant() {
    const navigate = useNavigate();
    const [state, setState] = useState<AssistantState>('idle');
    const [lastTranscript, setLastTranscript] = useState<string>('');
    const [responseMessage, setResponseMessage] = useState<string>('');
    const popupTimerRef = useRef<number | null>(null);

    // ── Speak the assistant's reply via SpeechSynthesis (browser-native).
    //    Falls back to a 2s timeout if speech synthesis is unavailable
    //    so the UI doesn't get stuck in the 'speaking' state.
    const speakReply = useCallback((text: string) => {
        if (!text) {
            setState('idle');
            return;
        }
        try {
            // Feature-guard the global — some environments (very old
            // browsers, certain webviews) ship without speechSynthesis.
            const synth =
                typeof window !== 'undefined'
                    ? (window as Window & { speechSynthesis?: SpeechSynthesis }).speechSynthesis
                    : undefined;
            if (!synth) {
                setTimeout(() => setState('idle'), 2000);
                return;
            }
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 1.05;
            utter.onend = () => setState('idle');
            utter.onerror = () => setState('idle');
            synth.cancel(); // drop any in-flight speech
            synth.speak(utter);
        } catch {
            setTimeout(() => setState('idle'), 2000);
        }
    }, []);

    // ── Recognition result handler — runs when speech recognition
    //    finalizes a transcript (either auto-end of speech or user
    //    pressed the button again).
    const handleTranscript = useCallback(
        async (transcript: string) => {
            const t = (transcript || '').trim();
            if (!t) {
                setState('idle');
                return;
            }
            setLastTranscript(t);
            setState('processing');
            setResponseMessage('');
            try {
                const result = await processVoiceCommand(t, navigate);
                const reply = result.message || 'Done.';
                setResponseMessage(reply);
                setState('speaking');
                speakReply(reply);
            } catch (e: unknown) {
                const msg =
                    e instanceof Error ? e.message : 'Could not process command.';
                setResponseMessage(`Error: ${msg}`);
                setState('idle');
            }
        },
        [navigate, speakReply]
    );

    const handleListenError = useCallback((message: string) => {
        setResponseMessage(message || 'Microphone error.');
        setState('idle');
    }, []);

    const recognition = useVoiceRecognition({
        onResult: handleTranscript,
        onError: handleListenError,
    });

    const handleClick = useCallback(() => {
        // 'processing' and 'speaking' are non-interactive transient
        // states — clicks are dropped to avoid racey toggling.
        if (state === 'processing' || state === 'speaking') return;

        if (state === 'idle') {
            if (!recognition.isSupported) {
                setLastTranscript('');
                setResponseMessage(
                    'Voice input is not supported in this browser. Try Chrome or Edge.'
                );
                return;
            }
            setLastTranscript('');
            setResponseMessage('');
            setState('listening');
            try {
                recognition.start();
            } catch (e: unknown) {
                const msg =
                    e instanceof Error ? e.message : 'Could not start microphone.';
                setResponseMessage(`Error: ${msg}`);
                setState('idle');
            }
            return;
        }

        // state === 'listening' — user wants to stop early.
        // Option (b): flip to processing immediately so the UI
        // reflects the upload + Deepgram round-trip, not a stale
        // pulsing red mic.
        try {
            recognition.stop();
            setState('processing');
        } catch {
            /* ignore — onend / onresult / onerror will reset state */
        }
    }, [state, recognition]);

    // ── Auto-hide popup after a few idle seconds so it doesn't sit
    //    on the screen forever.
    useEffect(() => {
        if (state !== 'idle') return;
        if (!lastTranscript && !responseMessage) return;
        if (popupTimerRef.current) {
            window.clearTimeout(popupTimerRef.current);
        }
        popupTimerRef.current = window.setTimeout(() => {
            setLastTranscript('');
            setResponseMessage('');
        }, 6000);
        return () => {
            if (popupTimerRef.current) {
                window.clearTimeout(popupTimerRef.current);
            }
        };
    }, [state, lastTranscript, responseMessage]);

    // ── Unmount cleanup — silence any speech still in progress.
    useEffect(() => {
        return () => {
            try {
                window.speechSynthesis?.cancel();
            } catch {
                /* ignore */
            }
        };
    }, []);

    const showPopup = !!(lastTranscript || responseMessage);
    const title =
        state === 'idle'
            ? 'Click to speak a command'
            : state === 'listening'
                ? 'Listening — click to stop'
                : state === 'processing'
                    ? 'Processing…'
                    : 'Speaking…';

    // Per-state visuals.  Brand color #C74634 is used for the
    // processing state (active interaction) and the popup accent.
    const buttonClasses =
        state === 'idle'
            ? 'bg-gray-500 hover:bg-gray-600 text-white'
            : state === 'listening'
                ? 'bg-red-500 text-white animate-pulse'
                : state === 'processing'
                    ? 'bg-[#C74634] text-white opacity-95'
                    : 'bg-emerald-500 text-white';

    const buttonShadow =
        state === 'idle'
            ? '0 8px 24px rgba(0,0,0,0.18)'
            : state === 'listening'
                ? '0 8px 24px rgba(239,68,68,0.5)'
                : state === 'speaking'
                    ? '0 8px 24px rgba(16,185,129,0.5)'
                    : '0 8px 24px rgba(199,70,52,0.5)';

    return (
        <div
            className="fixed bottom-6 right-52 z-50 flex flex-col items-end gap-2 print:hidden"
            data-component="voice-assistant"
        >
            {/* Popup above the button — shows last transcript + reply. */}
            {showPopup && (
                <div className="max-w-[280px] bg-white border border-gray-200 rounded-2xl shadow-2xl px-4 py-3 text-xs">
                    {lastTranscript && (
                        <div className="mb-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                                You said
                            </div>
                            <div className="text-gray-800 font-medium">
                                {lastTranscript}
                            </div>
                        </div>
                    )}
                    {responseMessage && (
                        <div>
                            <div
                                className="text-[10px] font-black uppercase tracking-widest mb-1"
                                style={{ color: '#C74634' }}
                            >
                                Assistant
                            </div>
                            <div className="text-gray-800 leading-relaxed">
                                {responseMessage}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <button
                onClick={handleClick}
                disabled={state === 'processing'}
                title={title}
                aria-label="Voice command assistant"
                className={`w-14 h-14 rounded-full border-2 border-white flex items-center justify-center transition-all ${buttonClasses}`}
                style={{ boxShadow: buttonShadow }}
            >
                {state === 'processing' ? (
                    <Loader2 size={22} className="animate-spin" />
                ) : state === 'speaking' ? (
                    <Volume2 size={22} />
                ) : (
                    <Mic size={22} />
                )}
            </button>
        </div>
    );
}

export default VoiceAssistant;
