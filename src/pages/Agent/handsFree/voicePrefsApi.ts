import api from '../../../api/axios';

export type VoicePrefs = {
  hands_free_zava: boolean;
  zava_quiet_hours_start: string | null;
  zava_quiet_hours_end: string | null;
  zava_voice_muted: boolean;
  timezone: string | null;
  hands_free_notice_acked_at: string | null;
};

export type VoicePrefsPatch = Partial<{
  hands_free_zava: boolean;
  zava_quiet_hours_start: string | null;
  zava_quiet_hours_end: string | null;
  zava_voice_muted: boolean;
  timezone: string | null;
  ack_hands_free_notice: boolean;
}>;

export const VOICE_PREFS_DEFAULTS: VoicePrefs = {
  hands_free_zava: false,
  zava_quiet_hours_start: null,
  zava_quiet_hours_end: null,
  zava_voice_muted: false,
  timezone: null,
  hands_free_notice_acked_at: null,
};

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function getVoicePrefs(): Promise<VoicePrefs> {
  const { data } = await api.get<VoicePrefs>('/api/agent/voice-prefs');
  return { ...VOICE_PREFS_DEFAULTS, ...data };
}

/** Partial PUT — send only fields that changed. */
export async function putVoicePrefs(patch: VoicePrefsPatch): Promise<VoicePrefs> {
  const { data } = await api.put<VoicePrefs>('/api/agent/voice-prefs', patch);
  return { ...VOICE_PREFS_DEFAULTS, ...data };
}
