/** Browser microphone helpers. Audio stays in memory until the request is sent. */

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

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
