// VOICE ASSISTANT — floating mic button + full-screen modal.
//
// IDLE state: small mic button at bottom-right (right-52 to avoid
// collision with the AI Business Advisor pill at right-6).
//
// LISTENING / PROCESSING / SPEAKING states: full-screen modal with
// a big circular state icon, status badge, transcript/response text,
// Stop button, and a secondary text-input path for typed commands.
//
// User clicks mic → modal opens, recognition starts.  User can either
// speak (transcript appears after Deepgram returns) or type a command
// in the text box instead (which cancels recognition and processes
// the typed text through the same VoiceCommandProcessor).
//
// After 3 seconds in 'speaking' state, the modal auto-closes and we
// return to the small idle button.  Manual close (×) works any time.
//
// ISOLATION: same import surface as before — react, react-router-dom,
// lucide-react (already in deps), and the three sibling files in this
// folder + the service file.  No new project imports.
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Loader2, Volume2, X, Send, Square } from 'lucide-react';
import { useDeepgramRecognition as useVoiceRecognition } from './useDeepgramRecognition';
import { processVoiceCommand } from './VoiceCommandProcessor';

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceAssistant() {
    const navigate = useNavigate();
    const [state, setState] = useState<AssistantState>('idle');
    const [lastTranscript, setLastTranscript] = useState<string>('');
    const [responseMessage, setResponseMessage] = useState<string>('');
    const [typedCommand, setTypedCommand] = useState<string>('');

    // When the user types a command and submits while recognition is
    // still running, the recognition's eventual onResult would race
    // against the typed flow.  This flag lets us drop that result.
    const ignoreNextResultRef = useRef<boolean>(false);

    // ── Speak the assistant's reply via SpeechSynthesis.  The 3-second
    //    'speaking' auto-close effect handles transitioning back to
    //    idle, so we don't need utter.onend to do it.
    const speakReply = useCallback((text: string) => {
        if (!text) return;
        try {
            const synth =
                typeof window !== 'undefined'
                    ? (window as Window & { speechSynthesis?: SpeechSynthesis }).speechSynthesis
                    : undefined;
            if (!synth) return;
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 1.05;
            synth.cancel();
            synth.speak(utter);
        } catch {
            /* 3s effect closes the modal regardless */
        }
    }, []);

    // ── Single command pipeline — used by BOTH voice transcript and
    //    typed text.  Sets state, calls processor, speaks reply.
    const runCommand = useCallback(
        async (text: string) => {
            const t = (text || '').trim();
            if (!t) {
                const msg = "I didn't catch that.";
                setLastTranscript('');
                setResponseMessage(msg);
                setState('speaking');
                speakReply(msg);
                return;
            }
            setLastTranscript(t);
            setResponseMessage('');
            setState('processing');
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
                setState('speaking');
                speakReply(`Error. ${msg}`);
            }
        },
        [navigate, speakReply]
    );

    const handleTranscript = useCallback(
        async (transcript: string) => {
            if (ignoreNextResultRef.current) {
                ignoreNextResultRef.current = false;
                return;
            }
            await runCommand(transcript);
        },
        [runCommand]
    );

    const handleListenError = useCallback(
        (message: string) => {
            if (ignoreNextResultRef.current) {
                ignoreNextResultRef.current = false;
                return;
            }
            setResponseMessage(message || 'Microphone error.');
            setState('speaking');
            speakReply(message || 'Microphone error.');
        },
        [speakReply]
    );

    const recognition = useVoiceRecognition({
        onResult: handleTranscript,
        onError: handleListenError,
    });

    // ── Click handler used by both the idle mic button AND the Stop
    //    button inside the modal (listening → processing).
    const handleMicClick = useCallback(() => {
        if (state === 'processing' || state === 'speaking') return;

        if (state === 'idle') {
            if (!recognition.isSupported) {
                const msg =
                    'Voice input is not supported in this browser. Try Chrome or Edge.';
                setLastTranscript('');
                setResponseMessage(msg);
                setState('speaking');
                speakReply(msg);
                return;
            }
            setLastTranscript('');
            setResponseMessage('');
            setTypedCommand('');
            setState('listening');
            try {
                recognition.start();
            } catch (e: unknown) {
                const msg =
                    e instanceof Error ? e.message : 'Could not start microphone.';
                setResponseMessage(`Error: ${msg}`);
                setState('speaking');
                speakReply(msg);
            }
            return;
        }

        // state === 'listening' — user clicked Stop.  Flip to processing
        // immediately so the UI reflects the upload + Deepgram round-trip.
        try {
            recognition.stop();
            setState('processing');
        } catch {
            /* hook callbacks will reset state */
        }
    }, [state, recognition, speakReply]);

    // ── Typed command submission.  Cancels in-flight recognition
    //    (with ignore flag) so its result doesn't race the typed flow.
    const handleTypedSubmit = useCallback(
        (e: FormEvent) => {
            e.preventDefault();
            const text = typedCommand.trim();
            if (!text) return;
            if (state === 'processing' || state === 'speaking') return;

            if (state === 'listening') {
                ignoreNextResultRef.current = true;
                try {
                    recognition.stop();
                } catch {
                    /* ignore */
                }
            }
            setTypedCommand('');
            void runCommand(text);
        },
        [typedCommand, state, recognition, runCommand]
    );

    // ── Manual close (× button) — works in any non-idle state.
    const handleClose = useCallback(() => {
        if (state === 'listening') {
            ignoreNextResultRef.current = true;
            try {
                recognition.stop();
            } catch {
                /* ignore */
            }
        }
        try {
            window.speechSynthesis?.cancel();
        } catch {
            /* ignore */
        }
        setLastTranscript('');
        setResponseMessage('');
        setTypedCommand('');
        setState('idle');
    }, [state, recognition]);

    // ── 3-second auto-close from 'speaking' state.
    useEffect(() => {
        if (state !== 'speaking') return;
        const t = window.setTimeout(() => {
            try {
                window.speechSynthesis?.cancel();
            } catch {
                /* ignore */
            }
            setState('idle');
            setLastTranscript('');
            setResponseMessage('');
        }, 3000);
        return () => window.clearTimeout(t);
    }, [state]);

    // ── Unmount cleanup — silence any in-flight speech.
    useEffect(() => {
        return () => {
            try {
                window.speechSynthesis?.cancel();
            } catch {
                /* ignore */
            }
        };
    }, []);

    // ── Per-state modal copy + visuals.
    const isModalOpen = state !== 'idle';
    const statusLabel =
        state === 'listening' ? 'Listening'
        : state === 'processing' ? 'Processing'
        : state === 'speaking' ? 'Speaking'
        : '';
    const StatusIcon =
        state === 'listening' ? Mic
        : state === 'processing' ? Loader2
        : state === 'speaking' ? Volume2
        : Mic;
    const statusIconClasses =
        state === 'listening'
            ? 'bg-emerald-500 text-white animate-pulse'
            : state === 'processing'
                ? 'bg-[#C74634] text-white opacity-95'
                : state === 'speaking'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-500 text-white';
    const iconShadow =
        state === 'listening'
            ? '0 12px 36px rgba(16,185,129,0.4)'
            : state === 'speaking'
                ? '0 12px 36px rgba(59,130,246,0.4)'
                : '0 12px 36px rgba(199,70,52,0.4)';
    const inputDisabled = state === 'processing' || state === 'speaking';

    return (
        <>
            {/* Floating mic button — visible only in idle state. */}
            {!isModalOpen && (
                <div
                    className="fixed bottom-6 right-52 z-50 flex flex-col items-end gap-2 print:hidden"
                    data-component="voice-assistant"
                >
                    <button
                        onClick={handleMicClick}
                        title="Click to speak a command"
                        aria-label="Voice command assistant"
                        className="w-14 h-14 rounded-full border-2 border-white bg-gray-500 hover:bg-gray-600 text-white flex items-center justify-center transition-all"
                        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
                    >
                        <Mic size={22} />
                    </button>
                </div>
            )}

            {/* Modal — visible during listening / processing / speaking. */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm print:hidden p-4"
                    data-component="voice-assistant-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Voice command assistant"
                >
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col">
                        {/* Header — close button */}
                        <div className="flex justify-end p-3">
                            <button
                                onClick={handleClose}
                                aria-label="Close"
                                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body — big icon, status badge, headline, Stop button */}
                        <div className="px-8 pb-6 flex flex-col items-center gap-5">
                            <div
                                className={`w-24 h-24 rounded-full flex items-center justify-center ${statusIconClasses}`}
                                style={{ boxShadow: iconShadow }}
                            >
                                <StatusIcon
                                    size={44}
                                    className={state === 'processing' ? 'animate-spin' : ''}
                                />
                            </div>

                            <div
                                className="text-[11px] font-black uppercase tracking-[0.3em]"
                                style={{ color: '#C74634' }}
                            >
                                {statusLabel}
                            </div>

                            <div className="min-h-[3.5rem] flex flex-col items-center justify-center text-center px-2 gap-2">
                                {state === 'listening' && (
                                    <div className="text-base text-gray-800 leading-relaxed font-medium">
                                        {lastTranscript || 'Listening… speak your command'}
                                    </div>
                                )}
                                {state === 'processing' && (
                                    <div className="text-base text-gray-800 leading-relaxed font-medium">
                                        {lastTranscript
                                            ? `"${lastTranscript}"`
                                            : 'Processing your command…'}
                                    </div>
                                )}
                                {state === 'speaking' && (
                                    <>
                                        {lastTranscript && (
                                            <div className="text-sm text-gray-500 italic">
                                                "{lastTranscript}"
                                            </div>
                                        )}
                                        <div className="text-base text-gray-800 leading-relaxed font-medium">
                                            {responseMessage || 'Done.'}
                                        </div>
                                    </>
                                )}
                            </div>

                            {state === 'listening' && (
                                <button
                                    onClick={handleMicClick}
                                    className="px-6 py-2.5 rounded-full text-white text-sm font-bold flex items-center gap-2 transition-all hover:opacity-90"
                                    style={{ backgroundColor: '#C74634' }}
                                >
                                    <Square size={14} fill="currentColor" />
                                    Stop
                                </button>
                            )}
                        </div>

                        {/* Footer — typed command alternative */}
                        <form
                            onSubmit={handleTypedSubmit}
                            className="border-t border-gray-100 p-4 flex gap-2 bg-gray-50 rounded-b-3xl"
                        >
                            <input
                                type="text"
                                value={typedCommand}
                                onChange={(e) => setTypedCommand(e.target.value)}
                                placeholder="Or type a command... e.g. make invoice for Ali, 5 units at $48"
                                disabled={inputDisabled}
                                aria-label="Type a command"
                                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#C74634] disabled:opacity-50 bg-white"
                            />
                            <button
                                type="submit"
                                disabled={!typedCommand.trim() || inputDisabled}
                                aria-label="Send typed command"
                                className="w-10 h-10 rounded-xl text-white flex items-center justify-center disabled:opacity-40 transition-all hover:opacity-90"
                                style={{ backgroundColor: '#C74634' }}
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

export default VoiceAssistant;
