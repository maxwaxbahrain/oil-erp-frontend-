import { describe, expect, it } from 'vitest';

import { RECORD_LIMIT_SECONDS, permissionDenied, recorderMime, recordingCountdown } from '../../../services/zavaVoice';

describe('microphone permission', () => {
    it('treats a denied prompt as a permission error', () => {
        expect(permissionDenied({ name: 'NotAllowedError' })).toBe(true);
        expect(permissionDenied({ name: 'PermissionDeniedError' })).toBe(true);
        expect(permissionDenied({ name: 'NotFoundError' })).toBe(false);
        expect(permissionDenied(null)).toBe(false);
    });

    it('picks webm/opus, then webm, then Safari mp4', () => {
        const original = globalThis.MediaRecorder;
        const supported = new Set<string>();
        class FakeRecorder {
            static isTypeSupported(value: string) {
                return supported.has(value);
            }
        }
        Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: FakeRecorder });
        expect(recorderMime()).toBe('');
        supported.add('audio/mp4');
        expect(recorderMime()).toBe('audio/mp4');
        supported.add('audio/webm;codecs=opus');
        expect(recorderMime()).toBe('audio/webm;codecs=opus');
        Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: original });
    });

    it('counts down only in the last 5 seconds of a 30 second recording', () => {
        expect(RECORD_LIMIT_SECONDS).toBe(30);
        expect(recordingCountdown(0)).toBeNull();
        expect(recordingCountdown(24_999)).toBeNull();
        expect(recordingCountdown(25_000)).toBe(5);
        expect(recordingCountdown(26_100)).toBe(4);
        expect(recordingCountdown(29_200)).toBe(1);
        expect(recordingCountdown(30_000)).toBeNull();
    });
});
