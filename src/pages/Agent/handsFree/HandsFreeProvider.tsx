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
import { matchWakeUtterance } from './wakeWord';

const IDLE_MS = 30 * 60 * 1000;
const FOLLOWUP_SECONDS = 15;
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
  const lastActivityRef = useRef(Date.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceUrlRef = useRef('');
  const recorderRef = useRef<MediaRecorder | null>(null);

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
        await audio.play();
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
    try {
      if (!(await assertCap())) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      const mime = recorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        };
      });
      recorder.start();
      await new Promise<void>((r) => window.setTimeout(r, FOLLOWUP_SECONDS * 1000));
      if (recorder.state !== 'inactive') recorder.stop();
      const blob = await done;
      recorderRef.current = null;
      if (blob.size < 64) {
        setZavaLine("I didn't hear a question.");
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
        setZavaLine("I didn't hear a question.");
        return;
      }
      await runCommand(transcript);
    } catch (error) {
      if (permissionDenied(error)) {
        setZavaLine('The microphone is off. Allow the microphone for this site.');
      } else {
        setZavaLine("I couldn't listen just then.");
      }
    } finally {
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
        setZavaLine('Yes?');
        if (!prefsRef.current.zava_voice_muted && !quietNow()) {
          void speak('Yes?');
        }
        await recordFollowUp();
        return;
      }
      // Full utterance — strip wake, Phase 3 router, no Deepgram
      await runCommand(match.rest);
    },
    [bumpActivity, quietNow, recordFollowUp, runCommand, speak],
  );

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
    if (!supported || !wantListenRef.current || pausedRef.current) return;
    if (!isLeader(leaderRef.current)) return;
    stopRecognition();
    const rec = makeRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const row = event.results[i];
        if (!row?.isFinal) continue;
        const text = row[0]?.transcript || '';
        if (text.trim()) void handleFinalTranscript(text);
      }
    };
    rec.onerror = () => {
      /* restart via onend */
    };
    rec.onend = () => {
      if (wantListenRef.current && !pausedRef.current && isLeader(leaderRef.current) && recognitionRef.current === rec) {
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
  }, [handleFinalTranscript, stopRecognition, supported]);

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
      !localPaused;
    wantListenRef.current = should;
    if (should && isLeader(leaderRef.current)) startRecognition();
    else stopRecognition();
    return () => stopRecognition();
  }, [
    enabledEnv,
    isAdmin,
    supported,
    prefsLoaded,
    prefsError,
    prefs.hands_free_zava,
    localPaused,
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
    wantListenRef.current = false;
    stopRecognition();
    stopSpeaking();
    try {
      const next = await putVoicePrefs({ hands_free_zava: false });
      setPrefs(next);
    } catch {
      setPrefs((p) => ({ ...p, hands_free_zava: false }));
    }
  }, [stopRecognition, stopSpeaking]);

  const resumeFromPause = useCallback(() => {
    bumpActivity();
    setLocalPaused(false);
  }, [bumpActivity]);

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
    if (localPaused) {
      resumeFromPause();
      return;
    }
    void turnOff();
  }, [localPaused, prefs.hands_free_zava, resumeFromPause, turnOff]);

  const chipStatus: HandsFreeChipStatus = !prefs.hands_free_zava
    ? 'off'
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
  return <HandsFreeChip status={ctx.chipStatus} onClick={ctx.chipClick} visible />;
}
