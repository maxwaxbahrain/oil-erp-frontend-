// VOICE ASSISTANT — mobile floating mic (above bottom nav) + desktop hidden.
//
// Mobile (lg:hidden):
//   * 56px blue FAB centered at bottom: 72px (above 56px nav)
//   * Listening → pulsing blue ring; processing → spinner in circle
//   * Active states → bottom sheet overlay for transcript / response
//   * Same processVoiceCommand pipeline as CommandBar
//
// Desktop (lg+): mic lives in header CommandBar only — this component
// renders nothing visible on large screens.
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send } from 'lucide-react';
import { useDeepgramRecognition as useVoiceRecognition } from './useDeepgramRecognition';
import { processVoiceCommand } from './VoiceCommandProcessor';
import { readStoredVoiceLang, storeVoiceLang, type VoiceLanguageCode } from './voiceLanguages';
import { VoiceMicFabShell } from './VoiceMicFabShell';

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceAssistant({
    voiceLocked = false,
    onSubscriptionRequired,
}: {
    voiceLocked?: boolean;
    onSubscriptionRequired?: () => void;
} = {}) {
    const navigate = useNavigate();
    const [state, setState] = useState<AssistantState>('idle');
    const [lastTranscript, setLastTranscript] = useState<string>('');
    const [responseMessage, setResponseMessage] = useState<string>('');
    const [typedCommand, setTypedCommand] = useState<string>('');
    const [voiceLang, setVoiceLang] = useState<VoiceLanguageCode>(() => readStoredVoiceLang());
    const [ringOpen, setRingOpen] = useState(false);

    const ignoreNextResultRef = useRef<boolean>(false);

    const selectVoiceLang = useCallback((code: VoiceLanguageCode) => {
        setVoiceLang(code);
        storeVoiceLang(code);
    }, []);

    const speakReply = useCallback((text: string) => {
        if (!text) return;
        try {
            const synth = window.speechSynthesis;
            if (!synth) return;
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 1.05;
            synth.cancel();
            synth.speak(utter);
        } catch {
            /* auto-close still runs */
        }
    }, []);

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
        language: voiceLang,
    });

    const handleMicClick = useCallback(() => {
        if (voiceLocked) {
            onSubscriptionRequired?.();
            return;
        }

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

        if (state === 'listening') {
            try {
                recognition.stop();
            } catch {
                /* hook callbacks handle state */
            }
            setState('processing');
        }
    }, [state, recognition, speakReply, voiceLocked, onSubscriptionRequired]);

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

    useEffect(() => {
        return () => {
            try {
                window.speechSynthesis?.cancel();
            } catch {
                /* ignore */
            }
        };
    }, []);

    const isActive = state !== 'idle';
    const inputDisabled = state === 'processing' || state === 'speaking';
    const fabListening = state === 'listening';

    return (
        <div className="lg:hidden print:hidden" data-component="voice-assistant-mobile">
            <VoiceMicFabShell
                variant="mobile"
                voiceLang={voiceLang}
                ringOpen={ringOpen}
                setRingOpen={setRingOpen}
                onSelectLang={selectVoiceLang}
                onMicClick={handleMicClick}
                micDisabled={state === 'processing' || state === 'speaking'}
                fabListening={fabListening}
                showProcessing={state === 'processing'}
                showRingBackdrop={!isActive}
            />

            {/* Bottom transcript overlay */}
            {isActive && (
                <>
                    <div
                        className="fixed inset-0 z-[55] bg-black/40"
                        aria-hidden
                        onClick={handleClose}
                    />
                    <div
                        className="fixed left-3 right-3 z-[56] rounded-2xl border shadow-2xl"
                        style={{
                            bottom: 140,
                            background: '#111827',
                            borderColor: 'rgba(79, 142, 247, 0.35)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                        }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Voice command"
                    >
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                            <span
                                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                                style={{ color: '#93C5FD' }}
                            >
                                {state === 'listening'
                                    ? 'Listening'
                                    : state === 'processing'
                                      ? 'Processing'
                                      : 'Response'}
                            </span>
                            <button
                                type="button"
                                onClick={handleClose}
                                aria-label="Close"
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    color: '#94a3b8',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="px-4 pb-3 min-h-[3rem]">
                            {state === 'listening' && (
                                <p className="text-sm leading-relaxed" style={{ color: '#EEF2FF' }}>
                                    {lastTranscript || 'Speak your command…'}
                                </p>
                            )}
                            {state === 'processing' && (
                                <p className="text-sm leading-relaxed" style={{ color: '#EEF2FF' }}>
                                    {lastTranscript
                                        ? `"${lastTranscript}"`
                                        : 'Processing your command…'}
                                </p>
                            )}
                            {state === 'speaking' && (
                                <div className="space-y-1">
                                    {lastTranscript && (
                                        <p className="text-xs italic" style={{ color: '#94a3b8' }}>
                                            "{lastTranscript}"
                                        </p>
                                    )}
                                    <p className="text-sm leading-relaxed" style={{ color: '#EEF2FF' }}>
                                        {responseMessage || 'Done.'}
                                    </p>
                                </div>
                            )}
                        </div>

                        <form
                            onSubmit={handleTypedSubmit}
                            className="flex gap-2 px-3 pb-3 border-t"
                            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                        >
                            <input
                                type="text"
                                value={typedCommand}
                                onChange={(e) => setTypedCommand(e.target.value)}
                                placeholder="Or type a command…"
                                disabled={inputDisabled}
                                aria-label="Type a command"
                                className="flex-1 text-sm rounded-xl px-3 py-2 focus:outline-none disabled:opacity-50"
                                style={{
                                    background: '#0d1420',
                                    border: '1px solid rgba(79, 142, 247, 0.25)',
                                    color: '#EEF2FF',
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!typedCommand.trim() || inputDisabled}
                                aria-label="Send typed command"
                                className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40"
                                style={{ background: '#4F8EF7', color: '#fff' }}
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}

export default VoiceAssistant;
