import { useState, useRef, useEffect, useCallback } from 'react';
import { authFetch } from '../api/axios';

export interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
}

export interface Decision {
  decision: string;
  context: string;
}

export interface MeetingNote {
  id: string;
  title: string;
  date: string;
  duration: number; // in seconds
  transcript: string;
  summary: string;
  decisions: Decision[];
  action_items: ActionItem[];
  key_topics: string[];
  members: string[];
}

export type RecorderStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export function getSavedNotes(): MeetingNote[] {
  try {
    const data = localStorage.getItem('soltol_meeting_notes');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function deleteNote(id: string) {
  const notes = getSavedNotes();
  const updated = notes.filter((n) => n.id !== id);
  localStorage.setItem('soltol_meeting_notes', JSON.stringify(updated));
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

    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/ai/meeting/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: finalTranscript,
          meeting_title: currentTitleRef.current
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process meeting notes.');
      }

      const data = await response.json();
      
      const note: MeetingNote = {
        id: crypto.randomUUID(),
        title: currentTitleRef.current,
        date: new Date().toISOString(),
        duration,
        transcript: finalTranscript,
        summary: data.summary || '',
        decisions: data.decisions || [],
        action_items: data.action_items || [],
        key_topics: data.key_topics || [],
        members: currentMembersRef.current || [],
      };

      const existingNotes = getSavedNotes();
      localStorage.setItem('soltol_meeting_notes', JSON.stringify([note, ...existingNotes]));
      
      setLastNote(note);
      setStatus('done');
    } catch (err: any) {
      setError(err?.message || 'Error processing meeting notes.');
      setStatus('error');
    }
  }, [status, duration, liveTranscript]);

  const analyzeTranscript = useCallback(async (transcriptText: string, title: string, members: string[] = []) => {
    setStatus('processing');
    setError(null);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/ai/meeting/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          meeting_title: title || 'Team Meeting'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process meeting notes.');
      }

      const data = await response.json();
      
      const note: MeetingNote = {
        id: crypto.randomUUID(),
        title: title || 'Team Meeting',
        date: new Date().toISOString(),
        duration: 0,
        transcript: transcriptText,
        summary: data.summary || '',
        decisions: data.decisions || [],
        action_items: data.action_items || [],
        key_topics: data.key_topics || [],
        members: members,
      };

      const existingNotes = getSavedNotes();
      localStorage.setItem('soltol_meeting_notes', JSON.stringify([note, ...existingNotes]));
      
      setLastNote(note);
      setStatus('done');
    } catch (err: any) {
      setError(err?.message || 'Error processing meeting notes.');
      setStatus('error');
    }
  }, []);

  return {
    status,
    isSupported,
    liveTranscript,
    duration,
    startRecording,
    stopRecording,
    analyzeTranscript,
    lastNote,
    error
  };
}
