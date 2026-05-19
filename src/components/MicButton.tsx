// src/components/MicButton.tsx
// Reusable microphone button for voice input.
// Uses only lucide-react icons and Tailwind CSS v4 utilities.

import type { FC } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface MicButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onToggle: () => void;
  /** Optional size in pixels. Defaults to 18. */
  iconSize?: number;
  /** Optional extra className for the button wrapper */
  className?: string;
}

/**
 * MicButton
 *
 * Renders a microphone toggle button that:
 * - Shows Mic icon when idle (green tint on hover)
 * - Shows MicOff icon + red pulsing ring when actively listening
 * - Renders as disabled with a tooltip when Web Speech API is unsupported
 */
export const MicButton: FC<MicButtonProps> = ({
  isListening,
  isSupported,
  onToggle,
  iconSize = 18,
  className = '',
}) => {
  const title = !isSupported
    ? 'Voice input requires Chrome, Edge or Safari'
    : isListening
      ? 'Stop listening'
      : 'Speak your question';

  return (
    <button
      type="button"
      onClick={isSupported ? onToggle : undefined}
      disabled={!isSupported}
      title={title}
      aria-label={title}
      aria-pressed={isListening}
      className={[
        'relative flex items-center justify-center rounded-lg transition-all duration-200',
        'w-9 h-9 flex-shrink-0',
        isSupported
          ? isListening
            ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
            : 'text-gray-400 hover:text-green-500 hover:bg-green-500/10'
          : 'text-gray-600 opacity-40 cursor-not-allowed',
        className,
      ].join(' ')}
    >
      {/* Pulsing ring shown only while listening */}
      {isListening && (
        <span className="absolute inset-0 rounded-lg animate-ping bg-red-500/20 pointer-events-none" />
      )}

      {isListening ? <MicOff size={iconSize} /> : <Mic size={iconSize} />}
    </button>
  );
};
