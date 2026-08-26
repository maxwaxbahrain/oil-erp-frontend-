import { useState, useRef, useEffect, useCallback } from 'react';
import {
  createMeeting,
  processMeetingTranscript,
  updateMeeting,
  type Meeting,
  type MeetingActionItem,
  type MeetingDecision,
} from '../services/meetingService';

export type ActionItem = MeetingActionItem;
export type Decision = MeetingDecision;

/** Display shape after record/paste. id is null only when the server save failed. */
export interface MeetingNote {
  id: number | null;
  title: string;
  meeting_date: string;
  duration_seconds: number;
  transcript: string;
  summary: string;
  decisions: Decision[];
  action_items: ActionItem[];
  key_topics: string[];
  members: string[];
}

export type RecorderStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export const TRANSCRIPT_SAVED_RETRY =
  'Transcript was saved. The summary can be retried from history.';

function meetingToNote(row: Meeting): MeetingNote {
  return {
    id: row.id,
    title: row.title,
    meeting_date: row.meeting_date,
    duration_seconds: row.duration_seconds,
    transcript: row.transcript,
    summary: row.summary,
    decisions: row.decisions,
    action_items: row.action_items,
    key_topics: row.key_topics,
    members: row.members,
  };
}

export function useMeetingRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const [lastNote, setLastNote] = useState<MeetingNote | null>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTitleRef = useRef('');
  const currentMembersRef = useRef<string[]>([]);
  const tabHiddenWhileRecordingRef = useRef(false);

  const [tabBackgroundWarning, setTabBackgroundWarning] = useState(false);

  const winAny = window as any;
  const isSupported = typeof window !== 'undefined' && !!(winAny.SpeechRecognition || winAny.webkitSpeechRecognition);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = winAny.SpeechRecognition || winAny.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interimStr = '';
      let newlyFinal = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          newlyFinal += event.results[i][0].transcript + ' ';
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }
      if (newlyFinal) {
        transcriptRef.current += newlyFinal;
      }

      // Force immediate state update with full transcript so far
      setLiveTranscript(transcriptRef.current + interimStr);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error !== 'no-speech') {
        setError(`Recognition error: ${event.error}`);
        setStatus('error');
      }
    };

    // Automatically restart if it stops unexpectedly while status is 'recording'
    recognition.onend = () => {
      setStatus((currentStatus) => {
        if (currentStatus === 'recording') {
          try {
            recognition.start();
          } catch (e) {
             console.error('Failed to restart recognition:', e);
          }
        }
        return currentStatus;
      });
    };

    recognitionRef.current = recognition;

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        recognition.stop();
      } catch (e) {
         // ignore
      }
    };
  }, [isSupported]);

  useEffect(() => {
    if (status !== 'recording') return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        tabHiddenWhileRecordingRef.current = true;
      } else if (
        document.visibilityState === 'visible' &&
        tabHiddenWhileRecordingRef.current
      ) {
        setTabBackgroundWarning(true);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [status]);

  useEffect(() => {
    if (status !== 'recording') return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  const saveThenSummarize = useCallback(async (opts: {
    transcript: string;
    title: string;
    durationSeconds: number;
    members: string[];
  }) => {
    const title = opts.title || 'Team Meeting';
    const meetingDate = new Date().toISOString();
    let saved: Meeting | null = null;

    try {
      saved = await createMeeting({
        title,
        meeting_date: meetingDate,
        duration_seconds: opts.durationSeconds,
        transcript: opts.transcript,
        members: opts.members,
      });
    } catch {
      saved = null;
    }

    try {
      const analysis = await processMeetingTranscript(opts.transcript, title);

      if (saved) {
        try {
          const updated = await updateMeeting(saved.id, {
            summary: analysis.summary,
            decisions: analysis.decisions,
            action_items: analysis.action_items,
            key_topics: analysis.key_topics,
          });
          setLastNote(meetingToNote(updated));
          setError(null);
          setStatus('done');
        } catch {
          setLastNote(null);
          setError(TRANSCRIPT_SAVED_RETRY);
          setStatus('error');
        }
        return;
      }

      setLastNote({
        id: null,
        title,
        meeting_date: meetingDate,
        duration_seconds: opts.durationSeconds,
        transcript: opts.transcript,
        summary: analysis.summary,
        decisions: analysis.decisions,
        action_items: analysis.action_items,
        key_topics: analysis.key_topics,
        members: opts.members,
      });
      setError(
        'Could not save this meeting to the server. The summary is shown below but may be lost if you leave this page.',
      );
      setStatus('done');
    } catch (err: any) {
      if (saved) {
        setLastNote(null);
        setError(TRANSCRIPT_SAVED_RETRY);
        setStatus('error');
        return;
      }
      setError(err?.message || 'Error processing meeting notes.');
      setStatus('error');
    }
  }, []);

  const startRecording = useCallback((title: string, selectedMembers: string[] = []) => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech Recognition is not supported in this browser.');
      return;
    }

    try {
      transcriptRef.current = '';
      setLiveTranscript('');
      setDuration(0);
      setError(null);
      setLastNote(null);
      tabHiddenWhileRecordingRef.current = false;
      setTabBackgroundWarning(false);
      currentTitleRef.current = title || 'Team Meeting';
      currentMembersRef.current = selectedMembers;
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      recognitionRef.current.start();
      setStatus('recording');
    } catch (err: any) {
      setError(err?.message || 'Failed to start recording');
      setStatus('error');
    }
  }, [isSupported]);

  const stopRecording = useCallback(async () => {
    if (!recognitionRef.current || status !== 'recording') return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setStatus('processing');

    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.error('Error stopping recognition:', e);
    }

    const finalTranscript = transcriptRef.current.trim() || liveTranscript.trim();

    if (!finalTranscript) {
      setError('No speech detected.');
      setStatus('error');
      return;
    }

    await saveThenSummarize({
      transcript: finalTranscript,
      title: currentTitleRef.current,
      durationSeconds: duration,
      members: currentMembersRef.current || [],
    });
  }, [status, duration, liveTranscript, saveThenSummarize]);

  const analyzeTranscript = useCallback(async (transcriptText: string, title: string, members: string[] = []) => {
    setStatus('processing');
    setError(null);
    setLastNote(null);
    await saveThenSummarize({
      transcript: transcriptText,
      title: title || 'Team Meeting',
      durationSeconds: 0,
      members,
    });
  }, [saveThenSummarize]);

  return {
    status,
    isSupported,
    liveTranscript,
    duration,
    startRecording,
    stopRecording,
    analyzeTranscript,
    lastNote,
    error,
    tabBackgroundWarning,
  };
}
