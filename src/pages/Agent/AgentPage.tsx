import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bell, Clock, Copy, Package, Send, Users, Wallet, X } from 'lucide-react';
import ZavaRail, { focusZavaQuestion, railCounts, scrollToZava, type ZavaRailSection } from './zavaRail';
import api from '../../api/axios';
import { isStaging } from '../../config/appEnv';
import { useAuth } from '../../contexts/AuthContext';
import { RECORD_LIMIT_SECONDS, permissionDenied, recorderMime, recordingCountdown, type VoiceState } from '../../services/zavaVoice';
import { AnswerBody } from './formatAnswer';
import { FollowUps, SpatialStyles, ZavaPanel, type SpatialBlock } from './spatial';
import {
    CREDIT_DETAIL,
    attentionLabel,
    lastCheckedLabel,
    priorityPill,
    signalFigure,
    signalWhy,
} from './signalCards';
import {
    ERRORS,
    INVALID_EMAIL,
    MAILBOX_WARNING,
    SUGGESTIONS,
    VIOLET,
    cannotReceiveMail,
    firstName,
    isValidEmail,
    messageForFailure,
    presentAnswer,
    showMorningBriefing,
    showNewConversation,
    stepView,
    VOICE,
} from './zavaCopy';
import HandsFreeToggle from './handsFree/HandsFreeToggle';

type Step = { kind: string; name: string; input?: string; output?: string };

type Turn = {
    id: number;
    role: 'user' | 'zava';
    text: string;
    headline?: string;
    note?: string | null;
    blocks?: SpatialBlock[];
    followUps?: string[];
    steps?: Step[];
    at?: Date;
    error?: boolean;
};

type BriefingSettings = {
    enabled: boolean;
    send_time: string;
    recipients: string[];
    timezone?: string;
    timezone_label?: string;
};

type SignalCard = {
    id: string;
    watcher_id?: string;
    module?: string;
    title: string;
    why: string;
    action: string;
    money: number;
    priority: string;
    href: string;
};

type HealthBody = {
    data_health?: SignalCard[];
    data_health_checked_at?: string | null;
    data_health_running?: boolean;
};

type DetailRow = {
    date: string;
    document_number: string;
    party: string;
    amount: number;
    href: string;
    note: string;
    demo?: boolean;
};

type DetailBody = {
    watcher_id: string;
    total: number;
    rows: DetailRow[];
    remainder: number;
    truncated: boolean;
};

const MODULE_ICONS = {
    collections: Wallet,
    sales: Users,
    inventory: Package,
    cash: Wallet,
    finance: Wallet,
    customers: Users,
} as const;

const ICONS = {
    attention: AlertCircle,
    overdue: Clock,
    stock: Package,
    customers: Users,
} as const;

let turnId = 1;

function failureFromError(error: unknown): string {
    const err = error as { code?: string; message?: string; response?: { status?: number; data?: { detail?: string } } };
    const timedOut = err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '');
    const network = !err?.response;
    return messageForFailure({
        status: err?.response?.status,
        detail: err?.response?.data?.detail,
        network,
        timedOut,
    });
}

function ZavaOrb({ thinking, size }: { thinking?: boolean; size: number }) {
    return (
        <span className={thinking ? 'zava-orb zava-orb-thinking' : 'zava-orb'} style={{ width: size, height: size }} aria-hidden="true">
            <svg viewBox="0 0 64 64" width={size} height={size}>
                <defs>
                    <radialGradient id="zava-orb-fill" cx="38%" cy="32%" r="70%">
                        <stop offset="0%" stopColor="#F5F3FF" />
                        <stop offset="45%" stopColor={VIOLET} />
                        <stop offset="100%" stopColor="#6D28D9" />
                    </radialGradient>
                </defs>
                <circle cx="32" cy="32" r="22" fill="url(#zava-orb-fill)" />
                <circle cx="26" cy="24" r="6" fill="#FFFFFF" opacity="0.55" />
            </svg>
        </span>
    );
}

export default function AgentPage() {
    const { user } = useAuth();
    const isAdmin = showMorningBriefing(user?.role);
    const [turns, setTurns] = useState<Turn[]>([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [announcement, setAnnouncement] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [briefing, setBriefing] = useState<BriefingSettings>({ enabled: false, send_time: '07:00', recipients: [] });
    const [chipDraft, setChipDraft] = useState('');
    const [chipError, setChipError] = useState('');
    const [briefingNote, setBriefingNote] = useState('');
    const [savingBriefing, setSavingBriefing] = useState(false);
    const [saved, setSaved] = useState(false);
    const [signals, setSignals] = useState<SignalCard[] | null>(null);
    const [health, setHealth] = useState<SignalCard[] | null>(null);
    const [checkedAt, setCheckedAt] = useState<string | null>(null);
    const [runningChecks, setRunningChecks] = useState(false);
    const [healthNote, setHealthNote] = useState('');
    const [signalsError, setSignalsError] = useState('');
    const [healthError, setHealthError] = useState('');
    const [openDetail, setOpenDetail] = useState<string | null>(null);
    const [detail, setDetail] = useState<DetailBody | null>(null);
    const [detailError, setDetailError] = useState('');
    const [detailCopied, setDetailCopied] = useState(false);
    const showDataHealth = user?.role === 'admin' || user?.role === 'accountant';
    const [railSection, setRailSection] = useState<ZavaRailSection>('ask');
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');
    const [voiceNotice, setVoiceNotice] = useState('');
    const [countdown, setCountdown] = useState<number | null>(null);
    const threadRef = useRef<HTMLDivElement>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const listenTimers = useRef<{ tick: number; limit: number } | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const voiceUrlRef = useRef('');
    const questionRef = useRef<HTMLTextAreaElement>(null);

    async function showDetails(watcherId: string) {
        if (openDetail === watcherId) {
            setOpenDetail(null);
            return;
        }
        setOpenDetail(watcherId);
        setDetail(null);
        setDetailError('');
        setDetailCopied(false);
        try {
            const response = await api.get<DetailBody>('/api/agent/data-health/details', {
                params: { watcher_id: watcherId },
            });
            setDetail(response.data);
        } catch {
            setDetailError('Details could not be loaded.');
        }
    }

    async function copyDetailList() {
        if (!detail?.rows.length) return;
        const lines = detail.rows.map((row) => [
            row.date,
            row.document_number,
            row.party,
            row.amount.toFixed(2),
            row.demo ? 'demo customer' : '',
            row.note,
        ].filter((part) => part !== '').join('\t'));
        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setDetailCopied(true);
        } catch {
            setDetailError('The list could not be copied.');
        }
    }

    function resizeQuestion(node: HTMLTextAreaElement | null = questionRef.current) {
        if (!node) return;
        node.style.height = '24px';
        node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
    }

    useEffect(() => {
        if (!sending) return;
        setElapsed(0);
        const started = Date.now();
        const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
        return () => window.clearInterval(timer);
    }, [sending]);

    useEffect(() => {
        threadRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
    }, [turns, sending]);

    useEffect(() => () => {
        const timers = listenTimers.current;
        if (timers) {
            window.clearInterval(timers.tick);
            window.clearTimeout(timers.limit);
            listenTimers.current = null;
        }
        const recorder = recorderRef.current;
        if (recorder && recorder.state === 'recording') {
            recorder.onstop = () => {
                recorder.stream.getTracks().forEach((track) => track.stop());
            };
            recorder.stop();
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        api.get<{ cards: SignalCard[] }>('/api/agent/signals')
            .then((response) => {
                if (cancelled) return;
                setSignals(response.data.cards || []);
            })
            .catch(() => {
                if (!cancelled) setSignalsError('Signals could not be loaded.');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!showDataHealth) {
            setHealth(null);
            setCheckedAt(null);
            setHealthError('');
            return;
        }
        let cancelled = false;
        api.get<HealthBody>('/api/agent/data-health')
            .then((response) => {
                if (cancelled) return;
                setHealth(response.data.data_health || []);
                setCheckedAt(response.data.data_health_checked_at || null);
                setHealthError('');
            })
            .catch(() => {
                if (!cancelled) setHealthError('Data health could not be loaded.');
            });
        return () => {
            cancelled = true;
        };
    }, [showDataHealth]);

    useEffect(() => {
        const ids = ['zava-question', 'zava-signals', ...(showDataHealth ? ['zava-data-health'] : [])];
        const nodes = ids
            .map((id) => document.getElementById(id))
            .filter((node): node is HTMLElement => node !== null);
        if (nodes.length === 0) return;
        const seen = new Map<string, number>();
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                seen.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
            });
            const best = [...seen.entries()].sort((left, right) => right[1] - left[1])[0];
            if (!best || best[1] <= 0) return;
            setRailSection(best[0] === 'zava-signals' ? 'signals' : best[0] === 'zava-data-health' ? 'health' : 'ask');
        }, { threshold: [0.15, 0.4, 0.7] });
        nodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [showDataHealth, signals, health, turns.length]);

    const signalRail = railCounts(signals);
    const healthRail = railCounts(health);

    async function runChecks() {
        setRunningChecks(true);
        setHealthNote('');
        try {
            await api.post<HealthBody>('/api/agent/data-health/run');
            const started = Date.now();
            while (Date.now() - started < 180000) {
                const response = await api.get<HealthBody>('/api/agent/data-health');
                setHealth(response.data.data_health || []);
                setCheckedAt(response.data.data_health_checked_at || null);
                if (!response.data.data_health_running) return;
                await new Promise((resolve) => window.setTimeout(resolve, 2000));
            }
            setHealthNote('Checks are still running. Open the page again in a little while.');
        } catch (error) {
            setHealthNote(failureFromError(error));
        } finally {
            setRunningChecks(false);
        }
    }

    function clearListenTimers() {
        const timers = listenTimers.current;
        if (!timers) return;
        window.clearInterval(timers.tick);
        window.clearTimeout(timers.limit);
        listenTimers.current = null;
    }

    function stopRecording() {
        clearListenTimers();
        setCountdown(null);
        const recorder = recorderRef.current;
        if (recorder && recorder.state === 'recording') recorder.stop();
    }

    function stopSpeaking() {
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
        setVoiceState('idle');
    }

    async function speakAnswer(headline: string, note?: string | null) {
        setVoiceState('speaking');
        const response = await api.post<Blob>(
            '/api/agent/speak',
            { headline, note: note || null },
            { responseType: 'blob', timeout: 45_000 },
        );
        const url = URL.createObjectURL(response.data);
        voiceUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => stopSpeaking();
        await audio.play();
    }

    async function ask(text: string, source: 'typed' | 'voice' = 'typed') {
        const question = text.trim();
        if (!question || sending) return;
        if (source === 'typed') {
            setDraft('');
            if (questionRef.current) questionRef.current.style.height = '24px';
            setTurns((current) => [...current, { id: turnId++, role: 'user', text: question, at: new Date() }]);
        }
        setSending(true);
        if (source === 'voice') setVoiceState('thinking');
        setAnnouncement('Zava is looking this up');
        try {
            const response = await api.post<{
                answer: string;
                headline?: string;
                note?: string | null;
                blocks?: SpatialBlock[];
                follow_ups?: string[];
                steps: Step[];
            }>(
                '/api/agent/chat',
                source === 'voice' ? { message: question, kind: 'voice' } : { message: question },
                { timeout: 70_000 },
            );
            const answer = presentAnswer(response.data.answer || '');
            const blocks = Array.isArray(response.data.blocks) ? response.data.blocks : [];
            const failed = answer === ERRORS.timeout || answer === ERRORS.limit || answer === ERRORS.off;
            setTurns((current) => [...current, {
                id: turnId++,
                role: 'zava',
                text: answer,
                headline: response.data.headline || answer,
                note: response.data.note,
                blocks: failed ? [] : blocks,
                followUps: failed ? [] : (response.data.follow_ups || []).slice(0, 3),
                steps: response.data.steps || [],
                at: new Date(),
                error: failed,
            }]);
            setAnnouncement(`Zava says ${answer}`);
            if (source === 'voice') {
                if (failed) {
                    setVoiceState('idle');
                    if (answer === ERRORS.limit) setVoiceNotice(VOICE.cap);
                } else {
                    try {
                        await speakAnswer(response.data.headline || answer, response.data.note);
                    } catch (speakError) {
                        setVoiceState('idle');
                        const message = await voiceFailure(speakError);
                        setVoiceNotice(message === ERRORS.limit ? VOICE.cap : message);
                    }
                }
            }
        } catch (error) {
            const message = failureFromError(error);
            setTurns((current) => [...current, { id: turnId++, role: 'zava', text: message, at: new Date(), error: true }]);
            setAnnouncement(message);
            if (source === 'voice') {
                setVoiceState('idle');
                setVoiceNotice(message === ERRORS.limit ? VOICE.cap : message);
            }
        } finally {
            setSending(false);
        }
    }

    async function voiceFailure(error: unknown): Promise<string> {
        const err = error as { response?: { data?: Blob | { detail?: string } } };
        const data = err.response?.data;
        if (data instanceof Blob) {
            try {
                const parsed = JSON.parse(await data.text()) as { detail?: string };
                return messageForFailure({ detail: parsed.detail, network: false });
            } catch {
                return ERRORS.network;
            }
        }
        return failureFromError(error);
    }

    async function sendClip(blob: Blob) {
        setVoiceState('thinking');
        const form = new FormData();
        form.append('audio', blob, blob.type.includes('mp4') ? 'clip.mp4' : 'clip.webm');
        try {
            const heard = await api.post<{ transcript: string }>('/api/agent/listen', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 45_000,
            });
            const transcript = (heard.data.transcript || '').trim();
            if (!transcript) {
                setVoiceState('idle');
                setVoiceNotice(VOICE.unheard);
                return;
            }
            setVoiceNotice('');
            setTurns((current) => [...current, { id: turnId++, role: 'user', text: transcript, at: new Date() }]);
            await ask(transcript, 'voice');
        } catch (error) {
            setVoiceState('idle');
            const message = failureFromError(error);
            setVoiceNotice(message === ERRORS.limit ? VOICE.cap : message);
        }
    }

    async function startListening() {
        setVoiceNotice('');
        try {
            await api.get('/api/agent/voice');
        } catch (error) {
            setVoiceNotice(failureFromError(error) === ERRORS.limit ? VOICE.cap : failureFromError(error));
            setVoiceState('idle');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
            const mime = recorderMime();
            const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
            const chunks: Blob[] = [];
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunks.push(event.data);
            };
            recorder.onstop = () => {
                clearListenTimers();
                setCountdown(null);
                stream.getTracks().forEach((track) => track.stop());
                const clip = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
                void sendClip(clip);
            };
            recorderRef.current = recorder;
            const started = Date.now();
            listenTimers.current = {
                tick: window.setInterval(() => {
                    setCountdown(recordingCountdown(Date.now() - started));
                }, 200),
                limit: window.setTimeout(() => stopRecording(), RECORD_LIMIT_SECONDS * 1000),
            };
            recorder.start();
            setVoiceState('listening');
        } catch (error) {
            setVoiceState('idle');
            setVoiceNotice(permissionDenied(error) ? VOICE.denied : 'This browser cannot record a voice clip.');
        }
    }

    function onOrb() {
        if (voiceState === 'speaking') {
            stopSpeaking();
            return;
        }
        if (voiceState === 'thinking' || sending) return;
        if (voiceState === 'listening') {
            stopRecording();
            return;
        }
        void startListening();
    }

    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!sending) void ask(draft);
        }
    }

    async function openBriefing() {
        setPanelOpen(true);
        setBriefingNote('');
        try {
            const response = await api.get<BriefingSettings>('/api/agent/briefing');
            setBriefing({ ...response.data, recipients: response.data.recipients || [] });
            setSaved(false);
        } catch (error) {
            setBriefingNote(failureFromError(error));
        }
    }

    function addChip(raw: string) {
        const email = raw.trim().replace(/,$/, '');
        if (!email) return;
        if (!isValidEmail(email)) {
            setChipError(INVALID_EMAIL);
            return;
        }
        setChipError('');
        setSaved(false);
        setBriefing((current) => (
            current.recipients.includes(email) ? current : { ...current, recipients: [...current.recipients, email] }
        ));
        setChipDraft('');
    }

    async function saveBriefing() {
        let recipients = briefing.recipients;
        const pending = chipDraft.trim();
        if (pending) {
            if (!isValidEmail(pending)) {
                setChipError(INVALID_EMAIL);
                return;
            }
            if (!recipients.includes(pending)) recipients = [...recipients, pending];
            setChipDraft('');
            setChipError('');
        }
        setSavingBriefing(true);
        setBriefingNote('');
        try {
            const response = await api.put<BriefingSettings>('/api/agent/briefing', {
                enabled: briefing.enabled,
                send_time: briefing.send_time,
                recipients,
            });
            setBriefing({ ...response.data, recipients: response.data.recipients || [] });
            setSaved(true);
            setBriefingNote('Saved');
        } catch (error) {
            const err = error as { response?: { data?: { detail?: string } } };
            setBriefingNote(err?.response?.data?.detail || 'The briefing could not be saved.');
        } finally {
            setSavingBriefing(false);
        }
    }

    async function sendTest() {
        setSavingBriefing(true);
        setBriefingNote('');
        try {
            const response = await api.post<{ sent_to: string }>('/api/agent/briefing/test', {}, { timeout: 70_000 });
            const address = response.data.sent_to;
            const warning = cannotReceiveMail(address) ? ` ${MAILBOX_WARNING}` : '';
            setBriefingNote(`Test briefing sent only to ${address}.${warning}`);
        } catch (error) {
            setBriefingNote(failureFromError(error));
        } finally {
            setSavingBriefing(false);
        }
    }

    const welcome = turns.length === 0;

    return (
        <div className="zava-page">
            <style>{`
                .zava-page {
                    box-sizing: border-box;
                    width: 100%;
                    max-width: 760px;
                    margin-left: auto;
                    margin-right: auto;
                    min-width: 0;
                    height: auto;
                    padding: 0 16px 24px;
                    display: flex;
                    flex-direction: column;
                    overflow: visible;
                }
                @media (min-width: 768px) {
                    .zava-page { max-width: 980px; padding-left: 24px; padding-right: 24px; }
                    .zava-shell { display: flex; align-items: flex-start; gap: 16px; }
                    .zava-main { flex: 1; min-width: 0; }
                    .zava-rail { position: sticky; top: 16px; width: 200px; flex: 0 0 200px; }
                }
                .zava-rail.zava-glass { padding: 12px; gap: 6px; }
                .zava-rail-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    min-height: 40px;
                    border: 0;
                    border-radius: 12px;
                    background: transparent;
                    color: #EEF2FF;
                    text-align: left;
                    padding: 8px 10px;
                    cursor: pointer;
                }
                .zava-rail-btn.is-active { background: rgba(196,181,253,0.24); box-shadow: inset 0 0 0 1px #C4B5FD; }
                .zava-rail-btn:disabled { opacity: 0.6; cursor: default; }
                .zava-rail-count {
                    margin-left: auto;
                    min-width: 22px;
                    height: 22px;
                    padding: 0 6px;
                    border-radius: 999px;
                    background: rgba(238,242,255,0.16);
                    color: #EEF2FF;
                    font-size: 12px;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .zava-rail-dot { width: 8px; height: 8px; border-radius: 999px; background: #F87171; flex: 0 0 auto; }
                .zava-rail-checked { margin: 0 10px 4px; color: #C7D2FE; font-size: 12px; line-height: 1.35; }
                .zava-rail-spin {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(238,242,255,0.35);
                    border-top-color: #EEF2FF;
                    border-radius: 999px;
                    animation: zava-spin 0.8s linear infinite;
                }
                @keyframes zava-spin { to { transform: rotate(360deg); } }
                @media (max-width: 767px) {
                    .zava-page { padding-bottom: 88px; }
                    .zava-rail.zava-glass {
                        position: fixed;
                        left: 12px;
                        right: 12px;
                        bottom: 12px;
                        top: auto;
                        width: auto;
                        flex-direction: row;
                        z-index: 30;
                        padding: 8px;
                    }
                    .zava-rail-label, .zava-rail-checked {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        padding: 0;
                        margin: -1px;
                        overflow: hidden;
                        clip: rect(0, 0, 0, 0);
                        white-space: nowrap;
                        border: 0;
                    }
                    .zava-rail-btn { width: auto; flex: 1; justify-content: center; }
                    .zava-rail-count { margin-left: 6px; }
                }
                .zava-suggestions { position: relative; z-index: 1; width: 100%; }
                .zava-signal-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 12px;
                    margin: 12px 0 0;
                    padding: 0;
                    list-style: none;
                }
                @media (min-width: 768px) {
                    .zava-signal-grid { grid-template-columns: 1fr 1fr; }
                }
                .zava-signal-card { color: #EEF2FF; }
                .zava-signal-card .zava-figure { margin: 0; color: #EEF2FF; }
                .zava-signal-title {
                    margin: 0;
                    overflow-wrap: anywhere;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    font-size: 16px;
                    font-weight: 600;
                    line-height: 1.35;
                    color: #EEF2FF;
                }
                .zava-signal-muted { margin: 0; color: #C7D2FE; font-size: 14px; line-height: 1.45; }
                .zava-signal-count, .zava-priority {
                    display: inline-flex;
                    align-items: center;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 700;
                    line-height: 1;
                    padding: 4px 8px;
                }
                .zava-signal-count { background: rgba(255,255,255,0.14); color: #EEF2FF; }
                .zava-signal-open {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 36px;
                    padding: 0 14px;
                    border-radius: 999px;
                    background: #C4B5FD;
                    color: #1E1B4B;
                    font-weight: 600;
                    text-decoration: none;
                }
                .zava-info {
                    margin-left: 6px;
                    width: 18px;
                    height: 18px;
                    border-radius: 999px;
                    border: 1px solid #C7D2FE;
                    background: transparent;
                    color: #EEF2FF;
                    font-size: 12px;
                    line-height: 1;
                    cursor: help;
                }
                .zava-orb { display: inline-flex; position: relative; z-index: 1; filter: drop-shadow(0 0 10px rgba(196,181,253,0.55)); }
                .zava-orb-thinking { animation: zava-glow 1.6s ease-in-out infinite; }
                @keyframes zava-glow { 50% { filter: drop-shadow(0 0 16px rgba(196,181,253,0.95)); transform: scale(1.05); } }
                .zava-spot {
                    position: absolute;
                    left: 50%;
                    top: 28px;
                    width: min(600px, 100%);
                    aspect-ratio: 1;
                    height: auto;
                    transform: translate(-50%, -50%);
                    background: radial-gradient(circle, rgba(196,181,253,0.45) 0%, rgba(196,181,253,0.14) 22%, rgba(196,181,253,0.03) 55%, transparent 100%);
                    pointer-events: none;
                }
                .zava-control:focus-visible:not(#zava-question) { outline: 2px solid #C4B5FD; outline-offset: 2px; }
                .zava-ask {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-radius: 16px;
                    background: var(--color-redwood-bg-surface);
                    padding: 16px 8px 16px 0;
                    box-shadow: 0 0 0 1px rgba(196,181,253,0.65), 0 0 18px rgba(196,181,253,0.22);
                }
                .zava-ask:focus-within {
                    box-shadow: 0 0 0 2px #C4B5FD, 0 0 28px rgba(196,181,253,0.45);
                }
                .zava-page textarea#zava-question,
                .zava-page textarea#zava-question:hover,
                .zava-page textarea#zava-question:focus,
                .zava-page textarea#zava-question:focus-visible,
                .zava-page textarea#zava-question:active {
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    resize: none !important;
                    border-style: none !important;
                    border-width: 0 !important;
                    border-radius: 0 !important;
                    outline: none !important;
                    outline-style: none !important;
                    outline-width: 0 !important;
                    outline-offset: 0 !important;
                    box-shadow: none !important;
                    background: transparent !important;
                    background-color: transparent !important;
                    margin: 0 !important;
                    padding: 0 0 0 16px !important;
                    box-sizing: border-box !important;
                    --tw-ring-shadow: 0 0 #0000;
                    --tw-ring-offset-shadow: 0 0 #0000;
                }
                .zava-card { transition: border-color 0.15s ease; }
                .zava-card:hover { border-color: rgba(238,242,255,0.38); }
                @media (prefers-reduced-motion: reduce) {
                    .zava-orb-thinking { animation: none; }
                    .zava-card { transition: none; }
                    .zava-rail-spin { animation: none; }
                }
            `}</style>
            <div aria-live="polite" className="sr-only">{announcement}</div>
            <SpatialStyles />
            <div className="zava-shell">
            <div className="zava-main">
            <header className="flex h-11 shrink-0 items-center justify-end gap-2">
                {showNewConversation(turns.length) && (
                    <button type="button" className="zava-control h-9 rounded-lg border border-redwood-border px-3 text-sm text-redwood-text-main" onClick={() => { setTurns([]); setAnnouncement(''); }}>
                        New conversation
                    </button>
                )}
                {isAdmin && (
                    <button type="button" className="zava-control inline-flex h-9 items-center gap-2 rounded-lg border border-redwood-border px-3 text-sm text-redwood-text-main" onClick={() => void openBriefing()}>
                        <Clock size={16} />
                        Morning briefing
                    </button>
                )}
            </header>

            <div ref={threadRef} className={`flex w-full flex-col ${welcome ? '' : 'gap-6 py-4'}`}>
                {welcome && (
                    <div className="flex w-full flex-col items-center pt-6 text-center">
                    <div className="relative flex w-full flex-col items-center text-center">
                        <div className="zava-spot" aria-hidden="true" />
                        <div className="relative z-[1] flex h-14 w-14 items-center justify-center">
                            <ZavaOrb size={56} />
                        </div>
                        <p className="relative z-[1] mt-5 text-[15px] text-redwood-text-muted">Hi {firstName(user?.full_name)}, I'm Zava</p>
                        <h1 className="relative z-[1] mt-2 text-[28px] font-semibold leading-tight text-redwood-text-main sm:text-4xl" style={{ fontFamily: "'Syne', sans-serif" }}>
                            How can I help you today?
                        </h1>
                        <p className="relative z-[1] mx-auto mt-3 max-w-[520px] text-[15px] leading-6 text-redwood-text-muted" style={{ textWrap: 'balance' }}>
                            I look up your sales, cash, stock and deliveries. I never change your data.
                        </p>
                        <div id="zava-suggestions" className="zava-suggestions relative z-[1] mt-10 grid w-full grid-cols-1 gap-3 min-[480px]:grid-cols-2 text-left">
                            {SUGGESTIONS.map((item) => {
                                const Icon = ICONS[item.id];
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        disabled={sending}
                                        onClick={() => void ask(item.question)}
                                        className="zava-control zava-card flex min-h-16 items-center gap-3 rounded-2xl border border-redwood-border bg-redwood-bg-surface p-4 text-left text-[15px] leading-5 text-redwood-text-main disabled:opacity-60"
                                    >
                                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(196,181,253,0.16)' }}>
                                            <Icon size={18} color={VIOLET} />
                                        </span>
                                        <span className="line-clamp-2">{item.question}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    </div>
                )}

                {!welcome && turns.map((turn) => (
                    turn.role === 'user' ? (
                        <div key={turn.id} className="flex justify-end">
                            <p className="zava-user-pill">{turn.text}</p>
                        </div>
                    ) : (
                        <article key={turn.id} className="flex min-w-0 items-start gap-3">
                            <ZavaOrb size={28} />
                            <div className="min-w-0 flex-1">
                                {turn.error ? <p className="text-[15px] leading-6 text-redwood-text-main">{turn.text}</p> : null}
                                {!turn.error && turn.blocks?.length ? (
                                    <>
                                        <ZavaPanel
                                            headline={turn.headline || turn.text}
                                            note={turn.note}
                                            blocks={turn.blocks}
                                            onAsk={(question) => void ask(question)}
                                        >
                                            <div className="zava-footer">
                                                <button
                                                    type="button"
                                                    className="zava-control inline-flex items-center gap-1"
                                                    onClick={() => {
                                                        void navigator.clipboard.writeText(turn.text).then(() => setCopiedId(turn.id));
                                                    }}
                                                >
                                                    <Copy size={12} /> {copiedId === turn.id ? 'Copied' : 'Copy'}
                                                </button>
                                                {turn.at && <time dateTime={turn.at.toISOString()}>{turn.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>}
                                                {turn.steps && turn.steps.length > 0 && (
                                                    <details>
                                                        <summary className="zava-control cursor-pointer">How I got this</summary>
                                                        <ul className="mt-2 space-y-1">
                                                            {turn.steps.map((step, index) => {
                                                                const view = stepView(step.name);
                                                                return (
                                                                    <li key={`${step.name}-${index}`} className="text-sm text-redwood-text-main">
                                                                        {view.label}
                                                                        {view.href && (
                                                                            <>
                                                                                {' · '}
                                                                                <Link className="zava-control underline" to={view.href}>Open the page</Link>
                                                                            </>
                                                                        )}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </details>
                                                )}
                                            </div>
                                        </ZavaPanel>
                                        <FollowUps questions={turn.followUps || []} onAsk={(question) => void ask(question)} />
                                    </>
                                ) : (
                                    <>
                                        {!turn.error && <AnswerBody source={turn.text} />}
                                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-redwood-text-muted">
                                            <button
                                                type="button"
                                                className="zava-control inline-flex items-center gap-1"
                                                onClick={() => {
                                                    void navigator.clipboard.writeText(turn.text).then(() => setCopiedId(turn.id));
                                                }}
                                            >
                                                <Copy size={12} /> {copiedId === turn.id ? 'Copied' : 'Copy'}
                                            </button>
                                            {turn.at && <time dateTime={turn.at.toISOString()}>{turn.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>}
                                        </div>
                                        {turn.steps && turn.steps.length > 0 && (
                                            <details className="mt-2">
                                                <summary className="zava-control cursor-pointer text-sm text-redwood-text-muted">How I got this</summary>
                                                <ul className="mt-2 space-y-1">
                                                    {turn.steps.map((step, index) => {
                                                        const view = stepView(step.name);
                                                        return (
                                                            <li key={`${step.name}-${index}`} className="text-sm text-redwood-text-main">
                                                                {view.label}
                                                                {view.href && (
                                                                    <>
                                                                        {' · '}
                                                                        <Link className="zava-control underline" to={view.href}>Open the page</Link>
                                                                    </>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </details>
                                        )}
                                    </>
                                )}
                            </div>
                        </article>
                    )
                ))}

                {sending && (
                    <div className="flex items-center gap-3 text-sm text-redwood-text-muted">
                        <ZavaOrb thinking size={28} />
                        <p>Zava is looking this up{elapsed > 0 ? ` · ${elapsed} ${elapsed === 1 ? 'second' : 'seconds'}` : ''}</p>
                    </div>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-3 pt-3">
                <button
                    type="button"
                    id="zava-orb"
                    className="zava-control inline-flex items-center gap-2"
                    aria-label={voiceState === 'listening' ? 'Send' : voiceState === 'speaking' ? 'Stop' : 'Start talking'}
                    onClick={onOrb}
                >
                    <ZavaOrb thinking={voiceState === 'thinking' || voiceState === 'speaking'} size={40} />
                    <span>{VOICE[voiceState]}</span>
                    {voiceState === 'listening' && countdown !== null && (
                        <span id="zava-voice-countdown">{countdown}</span>
                    )}
                </button>
                {voiceState === 'speaking' && (
                    <button type="button" id="zava-voice-stop" className="zava-control text-sm underline" onClick={stopSpeaking}>
                        Stop
                    </button>
                )}
                {voiceNotice && <p role="alert" className="text-sm text-redwood-text-muted">{voiceNotice}</p>}
            </div>

            <form
                className="shrink-0 pt-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    void ask(draft);
                }}
            >
                <div className="zava-ask">
                    <label className="sr-only" htmlFor="zava-question">Ask Zava</label>
                    <textarea
                        id="zava-question"
                        ref={questionRef}
                        rows={1}
                        value={draft}
                        disabled={sending}
                        maxLength={4000}
                        placeholder="Ask Zava about your business..."
                        onChange={(event) => {
                            setDraft(event.target.value);
                            resizeQuestion(event.target);
                        }}
                        onKeyDown={onKeyDown}
                        className="h-6 max-h-[120px] min-w-0 flex-1 overflow-y-auto text-[15px] leading-6 text-redwood-text-main placeholder:text-redwood-text-muted disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        aria-label="Send"
                        className="zava-control inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-redwood-brand text-white disabled:opacity-40"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </form>

            <section id="zava-signals" aria-labelledby="zava-signals-title" className="zava-signals pt-3">
                <div className="flex items-center gap-2">
                    <h2 id="zava-signals-title" className="text-sm font-semibold text-redwood-text-main">Signals</h2>
                    {signals && signals.length > 0 && (
                        <span className="zava-signal-count">{attentionLabel(signals.length)}</span>
                    )}
                </div>
                {signalsError && <p className="mt-2 text-sm text-redwood-text-muted">{signalsError}</p>}
                {signals && signals.length === 0 && (
                    <p className="mt-2 text-sm text-redwood-text-muted">Nothing needs your attention right now.</p>
                )}
                {signals && signals.length > 0 && (
                    <ul className="zava-signal-grid">
                        {signals.map((card) => {
                            const pill = priorityPill(card.priority);
                            const ModuleIcon = MODULE_ICONS[card.module as keyof typeof MODULE_ICONS] || Bell;
                            const why = signalWhy(card.why);
                            const detail = card.watcher_id === 'near_credit_limit' ? CREDIT_DETAIL : '';
                            return (
                                <li key={card.id} className="zava-glass zava-signal-card">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(196,181,253,0.16)' }}>
                                            <ModuleIcon size={18} color={VIOLET} aria-hidden="true" />
                                        </span>
                                        <span className="zava-priority" style={{ background: pill.background, color: pill.color }}>{pill.label}</span>
                                    </div>
                                    <p className="zava-signal-title" title={card.title}>{card.title}</p>
                                    <p className="zava-figure">{signalFigure(card)}</p>
                                    <p className="zava-signal-muted">
                                        {why}
                                        {detail && (
                                            <button type="button" className="zava-info" title={detail} aria-label={detail}>i</button>
                                        )}
                                    </p>
                                    <p className="zava-signal-muted">{card.action}</p>
                                    <Link className="zava-signal-open zava-control" to={card.href}>Open</Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {showDataHealth && (
                <section id="zava-data-health" aria-labelledby="zava-data-health-title" className="zava-signals pt-3">
                    <div className="flex items-center gap-2">
                        <h2 id="zava-data-health-title" className="text-sm font-semibold text-redwood-text-main">Data health</h2>
                        {health && health.length > 0 && (
                            <span className="zava-signal-count">{attentionLabel(health.length)}</span>
                        )}
                        {isAdmin && isStaging && (
                            <button type="button" className="zava-control" onClick={runChecks} disabled={runningChecks}>
                                {runningChecks ? 'Running…' : 'Run checks now'}
                            </button>
                        )}
                    </div>
                    {checkedAt && (
                        <p className="mt-1 text-xs text-redwood-text-muted">{lastCheckedLabel(checkedAt)}</p>
                    )}
                    {healthError && <p className="mt-2 text-sm text-redwood-text-muted">{healthError}</p>}
                    {healthNote && <p className="mt-1 text-sm text-redwood-text-muted">{healthNote}</p>}
                    {health && health.length === 0 && (
                        <p className="mt-2 text-sm text-redwood-text-muted">No book problems found.</p>
                    )}
                    {health && health.length > 0 && (
                        <ul className="zava-signal-grid">
                            {health.map((card) => {
                                const pill = priorityPill(card.priority);
                                const ModuleIcon = MODULE_ICONS[card.module as keyof typeof MODULE_ICONS] || Bell;
                                const note = card.watcher_id === 'check_failed';
                                return (
                                    <li key={card.id} className="zava-glass zava-signal-card">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(196,181,253,0.16)' }}>
                                                <ModuleIcon size={18} color={VIOLET} aria-hidden="true" />
                                            </span>
                                            <span className="zava-priority" style={{ background: pill.background, color: pill.color }}>{pill.label}</span>
                                        </div>
                                        <p className="zava-signal-title" title={card.title}>{card.title}</p>
                                        {!note && <p className="zava-figure">{signalFigure(card)}</p>}
                                        <p className="zava-signal-muted">{signalWhy(card.why)}</p>
                                        <p className="zava-signal-muted">{card.action}</p>
                                        {note ? (
                                            isAdmin ? (
                                                <button type="button" className="zava-signal-open zava-control" onClick={runChecks} disabled={runningChecks}>
                                                    Try again
                                                </button>
                                            ) : null
                                        ) : (
                                            <Link className="zava-signal-open zava-control" to={card.href}>Open</Link>
                                        )}
                                        {card.watcher_id && (
                                            <button type="button" className="zava-control" onClick={() => showDetails(card.watcher_id || '')}>
                                                {openDetail === card.watcher_id ? 'Hide details' : 'Show details'}
                                            </button>
                                        )}
                                        {openDetail === card.watcher_id && (
                                            <div className="mt-2 text-sm text-redwood-text-muted">
                                                {detailError && <p>{detailError}</p>}
                                                {!detail && !detailError && <p>Loading details…</p>}
                                                {detail && (
                                                    <>
                                                        <button type="button" className="zava-control" onClick={copyDetailList}>
                                                            {detailCopied ? 'Copied' : 'Copy list'}
                                                        </button>
                                                        <ul className="mt-2 space-y-2">
                                                            {detail.rows.map((row, index) => (
                                                                <li key={`${row.document_number}-${index}`}>
                                                                    <span>{row.date} </span>
                                                                    <span>{row.document_number} </span>
                                                                    <span>{row.party} </span>
                                                                    <span>{row.amount.toFixed(2)} </span>
                                                                    {row.demo && <span>Demo customer </span>}
                                                                    {row.href && <Link to={row.href}>Open</Link>}
                                                                    {row.note && <span> {row.note}</span>}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        {detail.truncated && <p className="mt-2">Showing 50 rows.</p>}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}

            {panelOpen && (
                <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="zava-briefing-title">
                    <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close morning briefing" onClick={() => setPanelOpen(false)} />
                    <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-redwood-bg-surface p-5 text-redwood-text-main">
                        <div className="flex items-center justify-between">
                            <h2 id="zava-briefing-title" className="text-lg font-semibold">Morning briefing</h2>
                            <button type="button" className="zava-control" aria-label="Close" onClick={() => setPanelOpen(false)}><X size={18} /></button>
                        </div>
                        <p className="mt-2 text-sm text-redwood-text-muted">Off until you turn it on. A test goes only to the email on your login.</p>
                        <label className="mt-5 flex items-center justify-between gap-3 text-sm">
                            Send the morning briefing
                            <input
                                type="checkbox"
                                role="switch"
                                className="zava-control h-5 w-5"
                                checked={briefing.enabled}
                                onChange={(event) => { setSaved(false); setBriefing((current) => ({ ...current, enabled: event.target.checked })); }}
                            />
                        </label>
                        <label className="mt-4 block text-sm">
                            Send time
                            <span className="mt-1 block text-redwood-text-muted">{briefing.timezone_label || 'Company time'}</span>
                            <input
                                type="time"
                                value={briefing.send_time}
                                onChange={(event) => { setSaved(false); setBriefing((current) => ({ ...current, send_time: event.target.value })); }}
                                className="zava-control mt-2 rounded-xl border border-redwood-border bg-redwood-bg-light px-3 py-2 text-redwood-text-main"
                            />
                        </label>
                        <div className="mt-4">
                            <p className="text-sm">Recipients</p>
                            <p className="text-sm text-redwood-text-muted">Leave this empty to use tenant admins.</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {briefing.recipients.map((email) => (
                                    <span key={email} className="inline-flex items-center gap-1 rounded-full border border-redwood-border px-2 py-1 text-sm">
                                        {email}
                                        <button type="button" className="zava-control" aria-label={`Remove ${email}`} onClick={() => { setSaved(false); setBriefing((current) => ({ ...current, recipients: current.recipients.filter((item) => item !== email) })); }}>
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <input
                                value={chipDraft}
                                onChange={(event) => { setChipDraft(event.target.value); setChipError(''); }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ',') {
                                        event.preventDefault();
                                        addChip(chipDraft);
                                    }
                                }}
                                placeholder="Add an email"
                                className="zava-control mt-2 w-full rounded-xl border border-redwood-border bg-redwood-bg-light px-3 py-2 text-sm text-redwood-text-main"
                            />
                            {chipError && <p className="mt-1 text-sm text-brand-red">{chipError}</p>}
                        </div>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <button type="button" disabled={savingBriefing} className="zava-control rounded-full bg-redwood-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => void saveBriefing()}>
                                {saved ? 'Saved' : 'Save briefing'}
                            </button>
                            <button type="button" disabled={savingBriefing} className="zava-control rounded-full border border-redwood-border px-4 py-2 text-sm disabled:opacity-60" onClick={() => void sendTest()}>
                                Send me a test briefing
                            </button>
                        </div>
                        {briefingNote && <p className="mt-3 text-sm">{briefingNote}</p>}
                        <HandsFreeToggle />
                    </div>
                </div>
            )}
            </div>
            <ZavaRail
                signalCount={signalRail.count}
                healthCount={healthRail.count}
                healthUrgent={healthRail.urgent}
                showDataHealth={showDataHealth}
                showRunChecks={isAdmin && isStaging}
                runningChecks={runningChecks}
                checkedAt={checkedAt}
                active={railSection}
                onSignals={() => scrollToZava('zava-signals')}
                onHealth={() => scrollToZava('zava-data-health')}
                onRunChecks={() => { void runChecks(); }}
                onAsk={focusZavaQuestion}
            />
            </div>
        </div>
    );
}
