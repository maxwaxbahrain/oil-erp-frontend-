// COMMAND BAR — ChatGPT/Spotlight-style floating input at top-center.
//
// Collapsed pill: search icon + placeholder + mic + send.
// Expanded: dropdown with QUICK COMMANDS, RECENT, and RESULT views.
//
// Triggers:
//   * Click the pill / input → expand
//   * Cmd+K (macOS) or Ctrl+K (Win/Linux) → toggle
//   * Escape → close
//   * Enter → submit typed command
//   * Mic icon → toggle Deepgram recording (green-pulsing while listening)
//   * Click outside → close
//
// All typed/spoken/recent-rerun submissions flow through the SAME
// VoiceCommandProcessor used by VoiceAssistant.tsx.  Quick commands
// navigate directly without a Claude call (deterministic paths —
// saves tokens + latency).
//
// Persists last 5 successful commands in localStorage key
// `voice_recent_commands`; shows the top 3 in the dropdown.
//
// ISOLATION: imports only react, react-router-dom, lucide-react
// (already a dep), and the sibling files in this folder.  No new
// project imports.  Does not touch any existing file.
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Mic, Send, Loader2 } from 'lucide-react';
import { useDeepgramRecognition } from './useDeepgramRecognition';
import { processVoiceCommand } from './VoiceCommandProcessor';

type BarState = 'idle' | 'listening' | 'processing' | 'result';

const RECENTS_KEY = 'voice_recent_commands';
const MAX_RECENTS_STORED = 5;
const MAX_RECENTS_SHOWN = 3;
const AUTO_CLOSE_MS = 2000;

const QUICK_COMMANDS: ReadonlyArray<{ label: string; path: string }> = [
    { label: 'Open customers', path: '/customers' },
    { label: 'New invoice', path: '/sales/invoices/new' },
    { label: 'View reports', path: '/reports' },
    { label: 'Add expense', path: '/finance/expenses' },
];

// ── localStorage helpers ────────────────────────────────────────
function loadRecents(): string[] {
    try {
        const raw = localStorage.getItem(RECENTS_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.filter(
            (s): s is string => typeof s === 'string' && !!s.trim()
        );
    } catch {
        return [];
    }
}

function saveRecents(list: string[]): void {
    try {
        localStorage.setItem(
            RECENTS_KEY,
            JSON.stringify(list.slice(0, MAX_RECENTS_STORED))
        );
    } catch {
        /* quota / disabled storage — silently ignore */
    }
}

function pushRecent(command: string, current: string[]): string[] {
    const t = command.trim();
    if (!t) return current;
    const deduped = [t, ...current.filter((c) => c !== t)];
    const truncated = deduped.slice(0, MAX_RECENTS_STORED);
    saveRecents(truncated);
    return truncated;
}

// ── Component ──────────────────────────────────────────────────
export function CommandBar() {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [state, setState] = useState<BarState>('idle');
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [recents, setRecents] = useState<string[]>(() => loadRecents());

    const inputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const ignoreNextResultRef = useRef(false);
    const closeTimerRef = useRef<number | null>(null);

    // ── Open / close primitives ─────────────────────────────────
    const openBar = useCallback(() => {
        setIsOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
    }, []);

    const closeBar = useCallback(() => {
        if (closeTimerRef.current != null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setIsOpen(false);
        setState('idle');
        setQuery('');
        setResponse('');
    }, []);

    // ── Shared command pipeline (typed, spoken, or recent re-run) ─
    const runCommand = useCallback(
        async (text: string) => {
            const t = text.trim();
            if (!t) return;
            setRecents((curr) => pushRecent(t, curr));
            setQuery(t);
            setResponse('');
            setState('processing');
            try {
                const result = await processVoiceCommand(t, navigate);
                const reply = result.message || 'Done.';
                setResponse(reply);
            } catch (e: unknown) {
                const msg =
                    e instanceof Error ? e.message : 'Could not process command.';
                setResponse(`Error: ${msg}`);
            } finally {
                setState('result');
                closeTimerRef.current = window.setTimeout(() => {
                    closeBar();
                }, AUTO_CLOSE_MS);
            }
        },
        [navigate, closeBar]
    );

    // ── Mic hook callbacks ──────────────────────────────────────
    const handleTranscript = useCallback(
        (transcript: string) => {
            if (ignoreNextResultRef.current) {
                ignoreNextResultRef.current = false;
                return;
            }
            const t = transcript.trim();
            if (!t) {
                setState('idle');
                return;
            }
            void runCommand(t);
        },
        [runCommand]
    );

    const handleListenError = useCallback(
        (message: string) => {
            if (ignoreNextResultRef.current) {
                ignoreNextResultRef.current = false;
                return;
            }
            setResponse(message || 'Microphone error.');
            setState('result');
            closeTimerRef.current = window.setTimeout(
                () => closeBar(),
                AUTO_CLOSE_MS
            );
        },
        [closeBar]
    );

    const recognition = useDeepgramRecognition({
        onResult: handleTranscript,
        onError: handleListenError,
    });

    // ── Mic toggle ──────────────────────────────────────────────
    const handleMicToggle = useCallback(() => {
        if (state === 'processing' || state === 'result') return;

        if (state === 'listening') {
            try {
                recognition.stop();
            } catch {
                /* hook callbacks reset state */
            }
            setState('processing');
            return;
        }

        // idle → start listening (and open the dropdown for feedback)
        if (!recognition.isSupported) {
            setResponse('Microphone not supported in this browser.');
            setState('result');
            setIsOpen(true);
            closeTimerRef.current = window.setTimeout(
                () => closeBar(),
                AUTO_CLOSE_MS
            );
            return;
        }
        setIsOpen(true);
        setState('listening');
        try {
            recognition.start();
        } catch (e: unknown) {
            const msg =
                e instanceof Error ? e.message : 'Could not start microphone.';
            setResponse(`Error: ${msg}`);
            setState('result');
            closeTimerRef.current = window.setTimeout(
                () => closeBar(),
                AUTO_CLOSE_MS
            );
        }
    }, [state, recognition, closeBar]);

    // ── Form submit (Enter / Send) ──────────────────────────────
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

    // ── Quick command click — navigate directly, skip Claude ───
    const handleQuickCommand = useCallback(
        (cmd: { label: string; path: string }) => {
            if (state === 'listening') {
                ignoreNextResultRef.current = true;
                try {
                    recognition.stop();
                } catch {
                    /* ignore */
                }
            }
            setResponse(`Opening ${cmd.label.toLowerCase()}`);
            setState('result');
            navigate(cmd.path);
            closeTimerRef.current = window.setTimeout(
                () => closeBar(),
                AUTO_CLOSE_MS
            );
        },
        [navigate, state, recognition, closeBar]
    );

    // ── Recent command click — re-run through Claude ───────────
    const handleRecentClick = useCallback(
        (text: string) => {
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
        [state, recognition, runCommand]
    );

    // ── Cmd+K / Ctrl+K toggle + Escape close ────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isK = e.key === 'k' || e.key === 'K';
            if ((e.metaKey || e.ctrlKey) && isK) {
                e.preventDefault();
                if (isOpen) closeBar();
                else openBar();
                return;
            }
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                closeBar();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, openBar, closeBar]);

    // ── Click outside to close ──────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const onClickOutside = (e: MouseEvent) => {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target as Node)) {
                closeBar();
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [isOpen, closeBar]);

    // ── Cleanup pending timer on unmount ────────────────────────
    useEffect(() => {
        return () => {
            if (closeTimerRef.current != null) {
                window.clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
        };
    }, []);

    // ── Render ──────────────────────────────────────────────────
    const showQuickAndRecent =
        isOpen && (state === 'idle' || state === 'listening');
    const showResult = isOpen && (state === 'processing' || state === 'result');
    const micButtonClasses =
        state === 'listening'
            ? 'bg-emerald-500 text-white animate-pulse'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600';
    const inputDisabled = state === 'processing' || state === 'result';

    return (
        <div
            ref={containerRef}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[480px] px-4 print:hidden"
            data-component="command-bar"
        >
            {/* Always-visible pill */}
            <form
                onSubmit={handleSubmit}
                className="bg-white rounded-full flex items-center gap-2 px-4 py-2 border border-gray-100"
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
            >
                <Search size={16} className="text-gray-400 flex-shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onClick={() => setIsOpen(true)}
                    placeholder="Search or type a command..."
                    disabled={inputDisabled}
                    aria-label="Command input"
                    className="flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-50 min-w-0 text-gray-800 placeholder:text-gray-400"
                />
                <button
                    type="button"
                    onClick={handleMicToggle}
                    disabled={state === 'processing' || state === 'result'}
                    aria-label={
                        state === 'listening' ? 'Stop listening' : 'Speak a command'
                    }
                    title={state === 'listening' ? 'Stop listening' : 'Click to speak'}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0 ${micButtonClasses}`}
                >
                    <Mic size={14} />
                </button>
                <button
                    type="submit"
                    disabled={
                        !query.trim() ||
                        state === 'processing' ||
                        state === 'result'
                    }
                    aria-label="Submit command"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-all hover:opacity-90 flex-shrink-0"
                    style={{ backgroundColor: '#C74634' }}
                >
                    <Send size={14} />
                </button>
            </form>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className="mt-2 bg-white rounded-2xl border border-gray-100 overflow-hidden"
                    style={{ boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}
                >
                    {showResult && (
                        <div className="p-5 flex items-start gap-3">
                            {state === 'processing' ? (
                                <Loader2
                                    size={18}
                                    className="animate-spin flex-shrink-0 mt-0.5"
                                    style={{ color: '#C74634' }}
                                />
                            ) : (
                                <div
                                    className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                                    style={{ backgroundColor: '#C74634' }}
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                {query && (
                                    <div className="text-xs text-gray-500 mb-1 truncate">
                                        "{query}"
                                    </div>
                                )}
                                <div className="text-sm text-gray-800 font-medium leading-relaxed">
                                    {state === 'processing'
                                        ? 'Processing your command…'
                                        : response}
                                </div>
                            </div>
                        </div>
                    )}

                    {showQuickAndRecent && (
                        <>
                            <div className="p-2">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-2">
                                    Quick commands
                                </div>
                                <div className="flex flex-col">
                                    {QUICK_COMMANDS.map((cmd) => (
                                        <button
                                            key={cmd.path}
                                            type="button"
                                            onClick={() => handleQuickCommand(cmd)}
                                            className="text-left text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
                                        >
                                            <span className="text-gray-400 flex-shrink-0">→</span>
                                            <span>{cmd.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {recents.length > 0 && (
                                <div className="p-2 border-t border-gray-100">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-2">
                                        Recent
                                    </div>
                                    <div className="flex flex-col">
                                        {recents
                                            .slice(0, MAX_RECENTS_SHOWN)
                                            .map((text, i) => (
                                                <button
                                                    key={`${text}-${i}`}
                                                    type="button"
                                                    onClick={() => handleRecentClick(text)}
                                                    className="text-left text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 min-w-0"
                                                >
                                                    <span className="text-gray-400 flex-shrink-0">↻</span>
                                                    <span className="truncate">{text}</span>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                            <div className="px-5 py-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between">
                                <span>Enter to submit · Esc to close</span>
                                <span className="font-mono">⌘K</span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default CommandBar;
