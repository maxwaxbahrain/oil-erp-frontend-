/** Bare-"Zava" follow-up clip: silence stop, no-speech timeout, 15 s max. */

export const FOLLOWUP_MAX_MS = 15_000;
export const FOLLOWUP_NO_SPEECH_MS = 5_000;
export const FOLLOWUP_SILENCE_AFTER_SPEECH_MS = 1_500;
/** RMS above this counts as speech (0–1 scale from AnalyserByteTimeDomain). */
export const FOLLOWUP_SPEECH_RMS = 0.02;

export type FollowUpStopReason = 'silence' | 'no_speech' | 'max';

export type FollowUpMeterState = {
  elapsedMs: number;
  heardSpeech: boolean;
  /** Consecutive quiet ms after speech was heard (ignored until then). */
  silenceAfterSpeechMs: number;
};

export function initialFollowUpMeter(): FollowUpMeterState {
  return { elapsedMs: 0, heardSpeech: false, silenceAfterSpeechMs: 0 };
}

export function rmsFromTimeDomain(samples: Uint8Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

export function updateFollowUpMeter(
  state: FollowUpMeterState,
  rms: number,
  dtMs: number,
  speechRms: number = FOLLOWUP_SPEECH_RMS,
): FollowUpMeterState {
  const speaking = rms >= speechRms;
  const elapsedMs = state.elapsedMs + dtMs;
  if (speaking) {
    return { elapsedMs, heardSpeech: true, silenceAfterSpeechMs: 0 };
  }
  if (state.heardSpeech || speaking) {
    return {
      elapsedMs,
      heardSpeech: state.heardSpeech || speaking,
      silenceAfterSpeechMs: state.silenceAfterSpeechMs + dtMs,
    };
  }
  return { elapsedMs, heardSpeech: false, silenceAfterSpeechMs: 0 };
}

export function evaluateFollowUpStop(state: FollowUpMeterState): FollowUpStopReason | null {
  if (state.elapsedMs >= FOLLOWUP_MAX_MS) return 'max';
  if (!state.heardSpeech && state.elapsedMs >= FOLLOWUP_NO_SPEECH_MS) return 'no_speech';
  if (state.heardSpeech && state.silenceAfterSpeechMs >= FOLLOWUP_SILENCE_AFTER_SPEECH_MS) {
    return 'silence';
  }
  return null;
}

export const NO_SPEECH_MESSAGE = "I didn't hear a question.";

/**
 * Record until silence / no-speech / max. Uses AudioContext analyser for levels.
 * Returns null blob when no speech was detected (caller shows NO_SPEECH_MESSAGE).
 */
export async function recordUntilSilence(
  stream: MediaStream,
  opts: {
    mimeType?: string;
    tickMs?: number;
    speechRms?: number;
    now?: () => number;
  } = {},
): Promise<{ blob: Blob | null; reason: FollowUpStopReason }> {
  const tickMs = opts.tickMs ?? 100;
  const speechRms = opts.speechRms ?? FOLLOWUP_SPEECH_RMS;
  const mimeType = opts.mimeType || '';
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);

  let meter = initialFollowUpMeter();
  const outcome: { reason: FollowUpStopReason | null } = { reason: null };

  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    };
  });

  recorder.start(tickMs);

  await new Promise<void>((resolve) => {
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      const rms = rmsFromTimeDomain(samples);
      meter = updateFollowUpMeter(meter, rms, tickMs, speechRms);
      const stop = evaluateFollowUpStop(meter);
      if (stop) {
        outcome.reason = stop;
        resolve();
        return;
      }
      window.setTimeout(tick, tickMs);
    };
    window.setTimeout(tick, tickMs);
  });

  if (recorder.state !== 'inactive') recorder.stop();
  const blob = await stopped;
  try {
    source.disconnect();
    await audioCtx.close();
  } catch {
    /* ignore */
  }

  if (!meter.heardSpeech) {
    return { blob: null, reason: 'no_speech' };
  }
  return { blob, reason: outcome.reason ?? 'max' };
}
