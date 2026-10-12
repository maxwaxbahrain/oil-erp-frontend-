/** Browser microphone helpers. Audio stays in memory until the request is sent. */

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const RECORD_LIMIT_SECONDS = 30;

/** Whole seconds still left, shown only during the last 5 seconds. */
export function recordingCountdown(elapsedMs: number): number | null {
    const remainingMs = RECORD_LIMIT_SECONDS * 1000 - elapsedMs;
    if (remainingMs <= 0 || remainingMs > 5000) return null;
    return Math.ceil(remainingMs / 1000);
}

export function recorderMime(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return '';
}

export function permissionDenied(error: unknown): boolean {
    const name = (error as { name?: string } | null)?.name || '';
    return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError';
}
