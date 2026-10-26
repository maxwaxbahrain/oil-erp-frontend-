/**
 * Single microphone owner — push-to-talk and other voice UIs must not
 * capture the mic at the same time (SpeechRecognition / getUserMedia).
 */

export type MicOwnerId =
  | 'nexus-zava-ptt'
  | 'hands-free-zava'
  | 'command-bar-deepgram'
  | 'voice-assistant-deepgram'
  | 'ai-advisor-speech'
  | 'tell-zava-form'
  | 'agent-page-record'
  | 'web-speech-generic';

const stoppers = new Map<MicOwnerId, () => void>();
let activeOwner: MicOwnerId | null = null;
const listeners = new Set<(owner: MicOwnerId | null) => void>();

function notify(): void {
  for (const fn of listeners) fn(activeOwner);
}

/** Register how to stop this consumer (abort recognition / stop tracks). */
export function registerMicConsumer(id: MicOwnerId, stop: () => void): () => void {
  stoppers.set(id, stop);
  return () => {
    if (stoppers.get(id) === stop) stoppers.delete(id);
    if (activeOwner === id) activeOwner = null;
  };
}

/** Stop every other consumer, then take the mic for `requester`. */
export function claimMicSession(requester: MicOwnerId): void {
  for (const [id, stop] of stoppers) {
    if (id !== requester) {
      try {
        stop();
      } catch {
        /* ignore */
      }
    }
  }
  activeOwner = requester;
  notify();
}

export function releaseMicSession(requester: MicOwnerId): void {
  if (activeOwner === requester) {
    activeOwner = null;
    notify();
  }
}

export function getActiveMicOwner(): MicOwnerId | null {
  return activeOwner;
}

export function isMicOwnedByOther(requester: MicOwnerId): boolean {
  return activeOwner != null && activeOwner !== requester;
}

export function onMicOwnerChange(fn: (owner: MicOwnerId | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
