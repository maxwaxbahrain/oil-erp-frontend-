import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic } from 'lucide-react';
import {
    FAB_ARC_ANGLES_DEG,
    FAB_ARC_RADIUS_PX,
    arcPillOffset,
    getRingLanguages,
    getVoiceLanguage,
    type VoiceLanguageCode,
} from './voiceLanguages';

const FAB_SHELL_CSS = `
@keyframes voiceFabPulse {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(79, 142, 247, 0.45), 0 8px 24px rgba(79, 142, 247, 0.35);
    }
    50% {
        box-shadow: 0 0 0 12px rgba(79, 142, 247, 0), 0 8px 28px rgba(79, 142, 247, 0.45);
    }
}
`;

export type VoiceMicFabVariant = 'mobile' | 'desktop';

export interface VoiceMicFabShellProps {
    variant: VoiceMicFabVariant;
    voiceLang: VoiceLanguageCode;
    ringOpen: boolean;
    setRingOpen: (open: boolean) => void;
    onSelectLang: (code: VoiceLanguageCode) => void;
    onMicClick: () => void;
    micDisabled?: boolean;
    fabListening?: boolean;
    showProcessing?: boolean;
    showRingBackdrop?: boolean;
}

export function VoiceMicFabShell({
    variant,
    voiceLang,
    ringOpen,
    setRingOpen,
    onSelectLang,
    onMicClick,
    micDisabled = false,
    fabListening = false,
    showProcessing = false,
    showRingBackdrop = true,
}: VoiceMicFabShellProps) {
    const shellRef = useRef<HTMLDivElement | null>(null);
    const longPressTimerRef = useRef<number | null>(null);
    const [ringAnimated, setRingAnimated] = useState(false);

    const currentLang = getVoiceLanguage(voiceLang);
    const ringLangs = getRingLanguages(voiceLang);

    const closeRing = useCallback(() => setRingOpen(false), [setRingOpen]);

    useEffect(() => {
        if (!ringOpen) {
            setRingAnimated(false);
            return;
        }
        setRingAnimated(false);
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => setRingAnimated(true));
        });
        return () => cancelAnimationFrame(id);
    }, [ringOpen]);

    useEffect(() => {
        if (!ringOpen) return;
        const onDocClick = (e: MouseEvent) => {
            if (!shellRef.current?.contains(e.target as Node)) {
                closeRing();
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [ringOpen, closeRing]);

    const clearLongPress = () => {
        if (longPressTimerRef.current != null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleGlobeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRingOpen(!ringOpen);
    };

    const handleSelect = (code: VoiceLanguageCode) => {
        onSelectLang(code);
        closeRing();
    };

    const positionClass =
        variant === 'mobile'
            ? 'lg:hidden left-1/2 -translate-x-1/2'
            : 'hidden lg:block';

    const bottomPx = variant === 'mobile' ? 72 : 24;
    const rightPx = variant === 'desktop' ? 24 : undefined;

    return (
        <>
            <style>{FAB_SHELL_CSS}</style>
            {ringOpen && showRingBackdrop && (
                <div
                    className="fixed inset-0 z-[58] bg-transparent"
                    aria-hidden
                    onClick={closeRing}
                />
            )}
            <div
                ref={shellRef}
                className={`fixed z-[60] print:hidden ${positionClass}`}
                style={{
                    bottom: bottomPx,
                    right: rightPx,
                    width: 56,
                    height: 56,
                }}
            >
                {ringOpen &&
                    ringLangs.map((lang, i) => {
                        const angleDeg = FAB_ARC_ANGLES_DEG[i] ?? 270;
                        const { x, y } = arcPillOffset(angleDeg, FAB_ARC_RADIUS_PX);
                        const active = lang.code === voiceLang;
                        return (
                            <button
                                key={lang.code}
                                type="button"
                                aria-label={lang.label}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(lang.code);
                                }}
                                className="absolute flex items-center justify-center rounded-full z-[62]"
                                style={{
                                    width: 36,
                                    height: 36,
                                    left: `calc(50% + ${x}px - 18px)`,
                                    bottom: `calc(28px - ${y}px - 18px)`,
                                    background: active
                                        ? 'rgba(79,142,247,0.2)'
                                        : '#0f1f33',
                                    border: active
                                        ? '1px solid #4F8EF7'
                                        : '1px solid rgba(79,142,247,0.4)',
                                    fontSize: 20,
                                    transform: ringAnimated ? 'scale(1)' : 'scale(0)',
                                    opacity: ringAnimated ? 1 : 0,
                                    transition:
                                        'transform 150ms ease, opacity 150ms ease',
                                    transitionDelay: `${i * 50}ms`,
                                }}
                            >
                                {lang.flag}
                            </button>
                        );
                    })}

                {currentLang && (
                    <div
                        className="absolute z-[63] flex items-center justify-center rounded-full pointer-events-none"
                        style={{
                            width: 20,
                            height: 20,
                            bottom: 2,
                            left: 2,
                            background: '#111827',
                            border: '1px solid rgba(79,142,247,0.4)',
                            fontSize: 11,
                        }}
                        aria-hidden
                    >
                        {currentLang.flag}
                    </div>
                )}

                <button
                    type="button"
                    onClick={onMicClick}
                    disabled={micDisabled}
                    onPointerDown={() => {
                        clearLongPress();
                        longPressTimerRef.current = window.setTimeout(() => {
                            setRingOpen(true);
                        }, 500);
                    }}
                    onPointerUp={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onPointerCancel={clearLongPress}
                    aria-label={
                        fabListening ? 'Stop listening and process' : 'Voice command'
                    }
                    title={
                        fabListening ? 'Tap to stop and process' : 'Tap to speak a command'
                    }
                    className="relative w-full h-full flex items-center justify-center rounded-full border-0 disabled:opacity-90"
                    style={{
                        background: '#4F8EF7',
                        color: '#fff',
                        cursor: micDisabled ? 'default' : 'pointer',
                        animation: fabListening
                            ? 'voiceFabPulse 1.4s ease-in-out infinite'
                            : undefined,
                        boxShadow: fabListening
                            ? undefined
                            : '0 8px 24px rgba(79, 142, 247, 0.35)',
                    }}
                >
                    {showProcessing ? (
                        <Loader2 size={26} className="animate-spin" aria-hidden />
                    ) : (
                        <Mic size={26} strokeWidth={2.25} aria-hidden />
                    )}
                </button>

                <button
                    type="button"
                    onClick={handleGlobeClick}
                    aria-label="Choose voice language"
                    title="Voice language"
                    className="absolute z-[63] flex items-center justify-center rounded-full border-0"
                    style={{
                        width: 20,
                        height: 20,
                        bottom: 2,
                        right: 2,
                        background: '#1a2d4e',
                        color: '#fff',
                        fontSize: 10,
                        cursor: 'pointer',
                    }}
                >
                    🌐
                </button>
            </div>
        </>
    );
}

export default VoiceMicFabShell;
