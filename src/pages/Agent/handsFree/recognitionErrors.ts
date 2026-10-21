/** Web Speech onerror handling — no restart loops on hard mic failures. */

export const RECOGNITION_BACKOFF_MS = [2_000, 5_000, 15_000] as const;

export const MIC_BLOCKED_MESSAGE =
  'Allow the microphone for this site, then click to resume.';
export const LISTEN_FAILED_MESSAGE = "Zava couldn't keep listening — click to resume.";

const HARD_STOP = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);
const QUIET = new Set(['no-speech', 'aborted']);

export type RecognitionErrorAction =
  | { action: 'hard_stop' }
  | { action: 'quiet_restart' }
  | { action: 'backoff_restart'; delayMs: number; nextFailCount: number }
  | { action: 'pause_give_up'; nextFailCount: number };

/**
 * Classify a SpeechRecognition error.
 * `priorNetworkFailures` = how many network/repeated errors already counted.
 * Third network/repeated error → pause (no further restart).
 */
export function nextRecognitionAction(
  error: string,
  priorNetworkFailures: number = 0,
): RecognitionErrorAction {
  const code = (error || '').toLowerCase();
  if (HARD_STOP.has(code)) return { action: 'hard_stop' };
  if (QUIET.has(code)) return { action: 'quiet_restart' };

  // network or any other repeated error → backoff, then pause
  const nextFailCount = priorNetworkFailures + 1;
  if (nextFailCount >= 3) {
    return { action: 'pause_give_up', nextFailCount };
  }
  const delayMs = RECOGNITION_BACKOFF_MS[nextFailCount - 1] ?? RECOGNITION_BACKOFF_MS[2];
  return { action: 'backoff_restart', delayMs, nextFailCount };
}

export function isHardMicError(error: string): boolean {
  return HARD_STOP.has((error || '').toLowerCase());
}
