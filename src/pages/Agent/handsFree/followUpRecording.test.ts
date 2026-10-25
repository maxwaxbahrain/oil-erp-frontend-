import { describe, expect, it } from 'vitest';

import {
  FOLLOWUP_MAX_MS,
  FOLLOWUP_NO_SPEECH_MS,
  FOLLOWUP_SILENCE_AFTER_SPEECH_MS,
  evaluateFollowUpStop,
  initialFollowUpMeter,
  updateFollowUpMeter,
} from './followUpRecording';

describe('follow-up recording stop rules', () => {
  it('stops after ~1.5s silence once speech was heard', () => {
    let state = initialFollowUpMeter();
    state = updateFollowUpMeter(state, 0.05, 100);
    expect(state.heardSpeech).toBe(true);
    state = updateFollowUpMeter(state, 0.001, FOLLOWUP_SILENCE_AFTER_SPEECH_MS);
    expect(evaluateFollowUpStop(state)).toBe('silence');
  });

  it('stops with no_speech after 5s if nothing was heard', () => {
    let state = initialFollowUpMeter();
    state = updateFollowUpMeter(state, 0.001, FOLLOWUP_NO_SPEECH_MS);
    expect(state.heardSpeech).toBe(false);
    expect(evaluateFollowUpStop(state)).toBe('no_speech');
  });

  it('stops at max 15s', () => {
    let state = initialFollowUpMeter();
    state = updateFollowUpMeter(state, 0.05, 100);
    state = {
      ...state,
      elapsedMs: FOLLOWUP_MAX_MS,
      silenceAfterSpeechMs: 0,
    };
    expect(evaluateFollowUpStop(state)).toBe('max');
  });

  it('does not silence-stop before speech', () => {
    let state = initialFollowUpMeter();
    state = updateFollowUpMeter(state, 0.001, 1_400);
    expect(evaluateFollowUpStop(state)).toBeNull();
  });
});
