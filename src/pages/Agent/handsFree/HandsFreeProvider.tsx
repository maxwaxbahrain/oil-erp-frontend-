/**
 * Phase 4 Step A — hands-free Zava (admin, Chrome/Edge, staging).
 * Continuous Web Speech; wake must be first whole word; pause ≠ server Off.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';
import { isStaging } from '../../../config/appEnv';
import { permissionDenied, recorderMime } from '../../../services/zavaVoice';
import { showMorningBriefing } from '../zavaCopy';
import {
  HANDS_FREE_PREFS_LOAD_ERROR,
  HANDS_FREE_UNSUPPORTED_HINT,
  handsFreeSupported,
} from './browserSupport';
import type { HandsFreeChipStatus } from './HandsFreeChip';
import HandsFreeChip from './HandsFreeChip';
import HandsFreeNotice from './HandsFreeNotice';
import { dispatchHandsFreeTranscript } from './handsFreeIntent';
import {
  applyLeaderMessage,
  createLeaderState,
  HANDS_FREE_CHANNEL,
  isLeader,
  type LeaderMessage,
  type LeaderState,
} from './leaderTab';
import { isInQuietHours } from './quietHours';
import {
  browserTimeZone,
  getVoicePrefs,
  putVoicePrefs,
  VOICE_PREFS_DEFAULTS,
  type VoicePrefs,
} from './voicePrefsApi';
import { NO_SPEECH_MESSAGE, recordUntilSilence } from './followUpRecording';
import {
  LISTEN_FAILED_MESSAGE,
  MIC_BLOCKED_MESSAGE,
  nextRecognitionAction,
} from './recognitionErrors';
import { matchWakeUtterance } from './wakeWord';

const IDLE_MS = 30 * 60 * 1000;
const HEARTBEAT_MS = 2_500;

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type HandsFreeContextValue = {
  prefs: VoicePrefs;
  prefsLoaded: boolean;
  prefsError: string;
  supported: boolean;
  unsupportedHint: string;
  chipStatus: HandsFreeChipStatus;
  localPaused: boolean;
  micBlocked: boolean;
  statusMessage: string;
  isLeaderTab: boolean;
  noticeOpen: boolean;
  toggleDisabled: boolean;
  toggleTitle: string;
  showUi: boolean;
  setHandsFreeDesired: (on: boolean) => void;
  acceptNoticeAndEnable: () => Promise<void>;
  cancelNotice: () => void;
  turnOff: () => Promise<void>;
  resumeFromPause: () => void;
  chipClick: () => void;
  refreshPrefs: () => Promise<void>;
};

const HandsFreeContext = createContext<HandsFreeContextValue | null>(null);

export function useHandsFree(): HandsFreeContextValue {
  const ctx = useContext(HandsFreeContext);
  if (!ctx) throw new Error('useHandsFree must be used within HandsFreeProvider');
  return ctx;
}

export function useHandsFreeOptional(): HandsFreeContextValue | null {
  return useContext(HandsFreeContext);
}

function makeRecognition(): SpeechRec | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  if (typeof rec.abort !== 'function') {
    rec.abort = () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    };
  }
  return rec;
}

export function HandsFreeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = showMorningBriefing(user?.role);
  const enabledEnv = isStaging;
  const supported = useMemo(() => handsFreeSupported(), []);

  const [prefs, setPrefs] = useState<VoicePrefs>(VOICE_PREFS_DEFAULTS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [prefsError, setPrefsError] = useState('');
  const [localPaused, setLocalPaused] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [hearing, setHearing] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [isLeaderTab, setIsLeaderTab] = useState(true);
  const [zavaLine, setZavaLine] = useState('');

  const prefsRef = useRef(prefs);
  const pausedRef = useRef(localPaused);
  const leaderRef = useRef<LeaderState>(createLeaderState());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const wantListenRef = useRef(false);
  const followupBusyRef = useRef(false);
  const blockRestartRef = useRef(false);
  const networkFailCountRef = useRef(0);
  const backoffTimerRef = useRef<number | undefined>(undefined);
  const lastActivityRef = useRef(Date.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceUrlRef = useRef('');
  const startRecognitionRef = useRef<() => void>(() => {});

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useEffect(() => {
    pausedRef.current = localPaused;
  }, [localPaused]);

  const quietNow = useCallback(() => {
    const p = prefsRef.current;
    return isInQuietHours(new Date(), p.zava_quiet_hours_start, p.zava_quiet_hours_end, p.timezone);
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const refreshPrefs = useCallback(async () => {
    if (!isAdmin || !enabledEnv) {
      setPrefsLoaded(true);
      return;
    }
    try {
      const next = await getVoicePrefs();
      setPrefs(next);
      setPrefsError('');
      setPrefsLoaded(true);
    } catch {
      setPrefsError(HANDS_FREE_PREFS_LOAD_ERROR);
      setPrefsLoaded(true);
    }
  }, [enabledEnv, isAdmin]);

  useEffect(() => {
    void refreshPrefs();
  }, [refreshPrefs]);

  const stopSpeaking = useCallback(() => {
    const playing = audioRef.current;
    if (playing) {
      playing.pause();
      playing.src = '';
    }
    audioRef.current = null;
    if (voiceUrlRef.current) {
      URL.revokeObjectURL(voiceUrlRef.current);
      voiceUrlRef.current = '';
    }
  }, []);

  const assertCap = useCallback(async (): Promise<boolean> => {
    try {
      await api.get('/api/agent/voice');
      return true;
    } catch {
      setZavaLine("This company's monthly Zava limit is reached.");
      return false;
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      setZavaLine(text);
      if (prefsRef.current.zava_voice_muted || quietNow()) return;
      if (!(await assertCap())) return;
      stopSpeaking();
      try {
        const response = await api.post<Blob>(
          '/api/agent/speak',
          { headline: text, note: null },
          { responseType: 'blob', timeout: 45_000 },
        );
        const url = URL.createObjectURL(response.data);
        voiceUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          void audio.play().catch(() => resolve());
        });
      } catch {
        // text already shown
      }
    },
    [assertCap, quietNow, stopSpeaking],
  );

  const runCommand = useCallback(
    async (transcript: string) => {
      bumpActivity();
      await dispatchHandsFreeTranscript(transcript, {
        navigate,
        speak,
        muted: prefsRef.current.zava_voice_muted,
        quiet: quietNow(),
      });
    },
    [bumpActivity, navigate, quietNow, speak],
  );

  const recordFollowUp = useCallback(async () => {
    if (followupBusyRef.current) return;
    followupBusyRef.current = true;
    setHearing(true);
    let stream: MediaStream | null = null;
    try {
      if (!(await assertCap())) return;
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      const mime = recorderMime();
      const { blob, reason } = await recordUntilSilence(stream, { mimeType: mime || undefined });
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      if (!blob || reason === 'no_speech') {
        setZavaLine(NO_SPEECH_MESSAGE);
        return;
      }
      if (blob.size < 64) {
        setZavaLine(NO_SPEECH_MESSAGE);
        return;
      }
      const form = new FormData();
      form.append('audio', blob, blob.type.includes('mp4') ? 'clip.mp4' : 'clip.webm');
      const heard = await api.post<{ transcript: string }>('/api/agent/listen', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 45_000,
      });
      const transcript = (heard.data.transcript || '').trim();
      if (!transcript) {
        setZavaLine(NO_SPEECH_MESSAGE);
        return;
      }
      await runCommand(transcript);
    } catch (error) {
      if (permissionDenied(error)) {
        setMicBlocked(true);
        setLocalPaused(true);
        setStatusMessage(MIC_BLOCKED_MESSAGE);
        setZavaLine(MIC_BLOCKED_MESSAGE);
        blockRestartRef.current = true;
        wantListenRef.current = false;
      } else {
        setZavaLine("I couldn't listen just then.");
      }
    } finally {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setHearing(false);
      followupBusyRef.current = false;
    }
  }, [assertCap, runCommand]);

  const handleFinalTranscript = useCallback(
    async (raw: string) => {
      if (!wantListenRef.current || pausedRef.current || followupBusyRef.current) return;
      if (prefsRef.current.zava_voice_muted || quietNow()) return;
      const match = matchWakeUtterance(raw);
      if (match.kind === 'none') return;
      bumpActivity();
      if (match.kind === 'bare') {
        // Wait until "Yes?" finishes before recording (don't capture Zava's voice).
        await speak('Yes?');
        await recordFollowUp();
        return;
      }
      // Full utterance — strip wake, Phase 3 router, no Deepgram
      await runCommand(match.rest);
    },
    [bumpActivity, quietNow, recordFollowUp, runCommand, speak],
  );

  const clearBackoffTimer = useCallback(() => {
    if (backoffTimerRef.current) {
      window.clearTimeout(backoffTimerRef.current);
      backoffTimerRef.current = undefined;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.stop();
    } catch {
      try {
        rec.abort?.();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const startRecognition = useCallback(() => {
    if (!supported || !wantListenRef.current || pausedRef.current || micBlocked) return;
    if (!isLeader(leaderRef.current)) return;
    if (blockRestartRef.current && recognitionRef.current) return;
    stopRecognition();
    blockRestartRef.current = false;
    const rec = makeRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    rec.onresult = (event) => {
      networkFailCountRef.current = 0;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const row = event.results[i];
        if (!row?.isFinal) continue;
        const text = row[0]?.transcript || '';
        if (text.trim()) void handleFinalTranscript(text);
      }
    };
    rec.onerror = (ev) => {
      const decision = nextRecognitionAction(ev.error || '', networkFailCountRef.current);
      if (decision.action === 'hard_stop') {
        blockRestartRef.current = true;
        wantListenRef.current = false;
        clearBackoffTimer();
        setMicBlocked(true);
        setLocalPaused(true);
        setStatusMessage(MIC_BLOCKED_MESSAGE);
        setZavaLine(MIC_BLOCKED_MESSAGE);
        stopRecognition();
        return;
      }
      if (decision.action === 'quiet_restart') {
        // onend may restart — leave blockRestart false
        return;
      }
      if (decision.action === 'backoff_restart') {
        networkFailCountRef.current = decision.nextFailCount;
        blockRestartRef.current = true;
        clearBackoffTimer();
        backoffTimerRef.current = window.setTimeout(() => {
          blockRestartRef.current = false;
          if (wantListenRef.current && !pausedRef.current && !micBlocked) {
            startRecognitionRef.current();
          }
        }, decision.delayMs);
        return;
      }
      if (decision.action === 'pause_give_up') {
        networkFailCountRef.current = decision.nextFailCount;
        blockRestartRef.current = true;
        clearBackoffTimer();
        setLocalPaused(true);
        setStatusMessage(LISTEN_FAILED_MESSAGE);
        setZavaLine(LISTEN_FAILED_MESSAGE);
        stopRecognition();
      }
    };
    rec.onend = () => {
      if (blockRestartRef.current) return;
      if (
        wantListenRef.current &&
        !pausedRef.current &&
        !micBlocked &&
        isLeader(leaderRef.current) &&
        recognitionRef.current === rec
      ) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    try {
      rec.start();
    } catch {
      /* ignore */
    }
  }, [clearBackoffTimer, handleFinalTranscript, micBlocked, stopRecognition, supported]);

  useEffect(() => {
    startRecognitionRef.current = startRecognition;
  }, [startRecognition]);

  // BroadcastChannel leader
  useEffect(() => {
    if (!enabledEnv || !isAdmin || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(HANDS_FREE_CHANNEL);
    channelRef.current = channel;
    const state = createLeaderState();
    leaderRef.current = state;
    setIsLeaderTab(true);

    const publish = (msg: LeaderMessage) => {
      try {
        channel.postMessage(msg);
      } catch {
        /* ignore */
      }
    };

    publish({ type: 'hello', tabId: state.tabId, ts: Date.now() });

    channel.onmessage = (ev: MessageEvent<LeaderMessage>) => {
      const msg = ev.data;
      if (!msg || !msg.type || !msg.tabId) return;
      leaderRef.current = applyLeaderMessage(leaderRef.current, msg);
      const lead = isLeader(leaderRef.current);
      setIsLeaderTab(lead);
      if (!lead) stopRecognition();
      else if (wantListenRef.current && !pausedRef.current) startRecognition();
    };

    const beat = window.setInterval(() => {
      leaderRef.current = applyLeaderMessage(leaderRef.current, {
        type: 'heartbeat',
        tabId: leaderRef.current.tabId,
        ts: Date.now(),
      });
      publish({ type: 'heartbeat', tabId: leaderRef.current.tabId, ts: Date.now() });
      const lead = isLeader(leaderRef.current);
      setIsLeaderTab(lead);
      if (!lead) stopRecognition();
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(beat);
      publish({ type: 'bye', tabId: leaderRef.current.tabId, ts: Date.now() });
      channel.close();
      channelRef.current = null;
    };
  }, [enabledEnv, isAdmin, startRecognition, stopRecognition]);

  // Start/stop continuous listen from prefs + pause + leader
  useEffect(() => {
    const should =
      enabledEnv &&
      isAdmin &&
      supported &&
      prefsLoaded &&
      !prefsError &&
      prefs.hands_free_zava &&
      !localPaused &&
      !micBlocked;
    wantListenRef.current = should;
    if (should && isLeader(leaderRef.current)) startRecognition();
    else stopRecognition();
    return () => {
      clearBackoffTimer();
      stopRecognition();
    };
  }, [
    enabledEnv,
    isAdmin,
    supported,
    prefsLoaded,
    prefsError,
    prefs.hands_free_zava,
    localPaused,
    micBlocked,
    clearBackoffTimer,
    startRecognition,
    stopRecognition,
  ]);

  // Tab hidden → pause locally (no PUT)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && prefsRef.current.hands_free_zava) {
        setLocalPaused(true);
        stopRecognition();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stopRecognition]);

  // 30 min idle → pause locally
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!prefsRef.current.hands_free_zava || pausedRef.current) return;
      if (Date.now() - lastActivityRef.current >= IDLE_MS) {
        setLocalPaused(true);
        stopRecognition();
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [stopRecognition]);

  const turnOff = useCallback(async () => {
    setLocalPaused(false);
    setMicBlocked(false);
    setStatusMessage('');
    networkFailCountRef.current = 0;
    blockRestartRef.current = false;
    clearBackoffTimer();
    wantListenRef.current = false;
    stopRecognition();
    stopSpeaking();
    try {
      const next = await putVoicePrefs({ hands_free_zava: false });
      setPrefs(next);
    } catch {
      setPrefs((p) => ({ ...p, hands_free_zava: false }));
    }
  }, [clearBackoffTimer, stopRecognition, stopSpeaking]);

  const resumeFromPause = useCallback(() => {
    bumpActivity();
    setMicBlocked(false);
    setStatusMessage('');
    networkFailCountRef.current = 0;
    blockRestartRef.current = false;
    clearBackoffTimer();
    setLocalPaused(false);
  }, [bumpActivity, clearBackoffTimer]);

  const acceptNoticeAndEnable = useCallback(async () => {
    setNoticeOpen(false);
    try {
      const next = await putVoicePrefs({
        hands_free_zava: true,
        ack_hands_free_notice: true,
        timezone: browserTimeZone(),
      });
      setPrefs(next);
      setLocalPaused(false);
      bumpActivity();
    } catch {
      setPrefsError(HANDS_FREE_PREFS_LOAD_ERROR);
    }
  }, [bumpActivity]);

  const cancelNotice = useCallback(() => setNoticeOpen(false), []);

  const setHandsFreeDesired = useCallback(
    (on: boolean) => {
      if (!on) {
        void turnOff();
        return;
      }
      if (!supported || prefsError) return;
      if (!prefs.hands_free_notice_acked_at) {
        setNoticeOpen(true);
        return;
      }
      void (async () => {
        try {
          const next = await putVoicePrefs({
            hands_free_zava: true,
            timezone: browserTimeZone(),
          });
          setPrefs(next);
          setLocalPaused(false);
          bumpActivity();
        } catch {
          setPrefsError(HANDS_FREE_PREFS_LOAD_ERROR);
        }
      })();
    },
    [bumpActivity, prefs.hands_free_notice_acked_at, prefsError, supported, turnOff],
  );

  const chipClick = useCallback(() => {
    if (!prefs.hands_free_zava) return;
    if (localPaused || micBlocked) {
      resumeFromPause();
      return;
    }
    void turnOff();
  }, [localPaused, micBlocked, prefs.hands_free_zava, resumeFromPause, turnOff]);

  const chipStatus: HandsFreeChipStatus = !prefs.hands_free_zava
    ? 'off'
    : micBlocked
      ? 'mic_blocked'
      : localPaused
        ? 'paused'
        : hearing
          ? 'hearing'
          : 'listening';

  const toggleDisabled = !supported || Boolean(prefsError) || !prefsLoaded;
  const toggleTitle = prefsError
    ? HANDS_FREE_PREFS_LOAD_ERROR
    : !supported
      ? HANDS_FREE_UNSUPPORTED_HINT
      : 'Hands-free Zava';

  const showUi = enabledEnv && isAdmin;

  const value: HandsFreeContextValue = {
    prefs,
    prefsLoaded,
    prefsError,
    supported,
    unsupportedHint: HANDS_FREE_UNSUPPORTED_HINT,
    chipStatus,
    localPaused,
    micBlocked,
    statusMessage,
    isLeaderTab,
    noticeOpen,
    toggleDisabled,
    toggleTitle,
    showUi,
    setHandsFreeDesired,
    acceptNoticeAndEnable,
    cancelNotice,
    turnOff,
    resumeFromPause,
    chipClick,
    refreshPrefs,
  };

  return (
    <HandsFreeContext.Provider value={value}>
      {children}
      <HandsFreeNotice open={noticeOpen} onAccept={() => void acceptNoticeAndEnable()} onCancel={cancelNotice} />
      {zavaLine ? (
        <div className="sr-only" aria-live="polite">
          {zavaLine}
        </div>
      ) : null}
    </HandsFreeContext.Provider>
  );
}

/** Header chip — render inside App header. */
export function HandsFreeHeaderChip() {
  const ctx = useHandsFreeOptional();
  if (!ctx || !ctx.showUi || !ctx.prefsLoaded) return null;
  return (
    <HandsFreeChip
      status={ctx.chipStatus}
      onClick={ctx.chipClick}
      visible
      statusMessage={ctx.statusMessage || undefined}
    />
  );
}
