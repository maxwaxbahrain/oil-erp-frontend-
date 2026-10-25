import { describe, expect, it } from 'vitest';

import {
  LISTEN_FAILED_MESSAGE,
  MIC_BLOCKED_MESSAGE,
  RECOGNITION_BACKOFF_MS,
  nextRecognitionAction,
} from './recognitionErrors';

describe('recognition error handling', () => {
  it('hard-stops on not-allowed / service-not-allowed / audio-capture — no restart', () => {
    for (const err of ['not-allowed', 'service-not-allowed', 'audio-capture']) {
      expect(nextRecognitionAction(err, 0)).toEqual({ action: 'hard_stop' });
    }
    expect(MIC_BLOCKED_MESSAGE).toMatch(/Allow the microphone/);
  });

  it('quietly restarts on no-speech / aborted', () => {
    expect(nextRecognitionAction('no-speech', 0)).toEqual({ action: 'quiet_restart' });
    expect(nextRecognitionAction('aborted', 0)).toEqual({ action: 'quiet_restart' });
  });

  it('backs off on network, then pauses after 3 failures', () => {
    expect(nextRecognitionAction('network', 0)).toEqual({
      action: 'backoff_restart',
      delayMs: RECOGNITION_BACKOFF_MS[0],
      nextFailCount: 1,
    });
    expect(nextRecognitionAction('network', 1)).toEqual({
      action: 'backoff_restart',
      delayMs: RECOGNITION_BACKOFF_MS[1],
      nextFailCount: 2,
    });
    expect(nextRecognitionAction('network', 2)).toEqual({
      action: 'pause_give_up',
      nextFailCount: 3,
    });
    expect(LISTEN_FAILED_MESSAGE).toMatch(/couldn't keep listening/i);
  });
});
