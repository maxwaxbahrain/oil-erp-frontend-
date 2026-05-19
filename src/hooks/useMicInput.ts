// src/hooks/useMicInput.ts
// Voice input hook using the Web Speech API.
// No external dependencies — pure browser API.

import { useState, useRef, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';

export interface UseMicInputReturn {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  interimTranscript: string;
}

/**
 * useMicInput
 *
 * Provides voice-to-text via the Web Speech API.
 * When the user speaks, the final transcript is appended to the
 * current input value via `setInputValue`.
 * Interim (in-progress) words are exposed as `interimTranscript`
 * so the UI can show a live preview.
 *
 * @param setInputValue - React state setter for the chat input string.
 *                        Pass the setter from useState directly.
 * @param lang          - BCP-47 language tag. Defaults to 'en-US'.
 */
export function useMicInput(
  setInputValue: Dispatch<SetStateAction<string>>,
  lang = 'en-US',
): UseMicInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);

  // Detect browser support once on mount
  const isSupported =
    typeof window !== 'undefined' &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    if (isListening) {
      stopListening();
      return;
    }

    const SpeechRecognitionClass =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = false; // stop after first pause
    recognition.interimResults = true; // stream partial results

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      if (final) {
        // Append final words to whatever the user already typed
        setInputValue((prev) => {
          const trimmed = prev.trimEnd();
          return trimmed ? `${trimmed} ${final.trim()}` : final.trim();
        });
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[useMicInput] SpeechRecognition error:', event.error);
      stopListening();
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, isListening, lang, setInputValue, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    interimTranscript,
  };
}
