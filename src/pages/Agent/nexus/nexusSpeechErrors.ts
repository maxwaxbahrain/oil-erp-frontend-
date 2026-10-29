/** Plain-English Web Speech / mic errors for Nexus Zava. */

export const NO_SPEECH_HEARD_MSG = "I didn't hear anything. Tap the mic and try again.";

export const NEXUS_NO_SPEECH_MS = 6_000;
export const NEXUS_MAX_LISTEN_MS = 15_000;

export function plainSpeechError(code: string): string {
  const c = String(code || '')
    .trim()
    .toLowerCase();
  if (c === 'not-allowed' || c === 'permission-denied' || c === 'permission_denied') {
    return 'Microphone blocked — allow it in the browser';
  }
  if (c === 'audio-capture' || c === 'audio_capture') {
    return 'No microphone found';
  }
  if (c === 'network' || c === 'service-not-allowed' || c === 'service_not_allowed' || c === 'aborted') {
    return 'Speech service unavailable — using backup';
  }
  if (c === 'no-speech' || c === 'no_speech') {
    return NO_SPEECH_HEARD_MSG;
  }
  if (c) return `Speech error (${c}) — try again or use the keyboard`;
  return NO_SPEECH_HEARD_MSG;
}

export type SpeechErrorContext = { stoppedByUs?: boolean };

/** Fall back to record + POST /api/agent/listen for this utterance. */
export function shouldFallbackToUpload(code: string, ctx?: SpeechErrorContext): boolean {
  const c = String(code || '')
    .trim()
    .toLowerCase();
  if (ctx?.stoppedByUs && c === 'aborted') return false;
  return c === 'network' || c === 'service-not-allowed' || c === 'service_not_allowed' || c === 'aborted';
}

/** User/system stop — do not treat as a speech failure. */
export function isIgnorableAborted(code: string, ctx?: SpeechErrorContext): boolean {
  const c = String(code || '')
    .trim()
    .toLowerCase();
  return c === 'aborted' && Boolean(ctx?.stoppedByUs);
}
