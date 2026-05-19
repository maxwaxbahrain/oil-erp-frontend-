import { useState, useRef, useEffect, useCallback } from 'react';

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

// Ensure SpeechRecognition is available on window for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
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

  const isSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!isSupported) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onresult = (event: any) => {
      let finalStr = '';
      let interimStr = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript + ' ';
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }
      
      if (finalStr) {
        transcriptRef.current += finalStr;
      }
      
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

  const startRecording = useCallback((title: string) => {
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
      const response = await fetch('https://bettano-erp-backend.onrender.com/api/ai/meeting/process', {
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

  return {
    status,
    isSupported,
    liveTranscript,
    duration,
    startRecording,
    stopRecording,
    lastNote,
    error
  };
}
