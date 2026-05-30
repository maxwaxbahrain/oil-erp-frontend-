export const VOICE_LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇺🇸', native: 'English' },
    { code: 'zh', label: 'Chinese', flag: '🇨🇳', native: '中文' },
    { code: 'hi', label: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
    { code: 'es', label: 'Spanish', flag: '🇪🇸', native: 'Español' },
    { code: 'ar', label: 'Arabic', flag: '🇸🇦', native: 'العربية' },
    { code: 'bn', label: 'Bengali', flag: '🇧🇩', native: 'বাংলা' },
    { code: 'pt', label: 'Portuguese', flag: '🇧🇷', native: 'Português' },
    { code: 'ru', label: 'Russian', flag: '🇷🇺', native: 'Русский' },
    { code: 'ur', label: 'Urdu', flag: '🇵🇰', native: 'اردو' },
    { code: 'id', label: 'Indonesian', flag: '🇮🇩', native: 'Bahasa' },
    { code: 'fr', label: 'French', flag: '🇫🇷', native: 'Français' },
    { code: 'de', label: 'German', flag: '🇩🇪', native: 'Deutsch' },
    { code: 'ja', label: 'Japanese', flag: '🇯🇵', native: '日本語' },
    { code: 'tr', label: 'Turkish', flag: '🇹🇷', native: 'Türkçe' },
    { code: 'ko', label: 'Korean', flag: '🇰🇷', native: '한국어' },
    { code: 'vi', label: 'Vietnamese', flag: '🇻🇳', native: 'Tiếng Việt' },
    { code: 'it', label: 'Italian', flag: '🇮🇹', native: 'Italiano' },
    { code: 'th', label: 'Thai', flag: '🇹🇭', native: 'ภาษาไทย' },
    { code: 'fa', label: 'Persian', flag: '🇮🇷', native: 'فارسی' },
    { code: 'gu', label: 'Gujarati', flag: '🇮🇳', native: 'ગુજરાતી' },
    { code: 'ta', label: 'Tamil', flag: '🇮🇳', native: 'தமிழ்' },
    { code: 'mr', label: 'Marathi', flag: '🇮🇳', native: 'मराठी' },
    { code: 'te', label: 'Telugu', flag: '🇮🇳', native: 'తెలుగు' },
    { code: 'pl', label: 'Polish', flag: '🇵🇱', native: 'Polski' },
    { code: 'nl', label: 'Dutch', flag: '🇳🇱', native: 'Nederlands' },
    { code: 'uk', label: 'Ukrainian', flag: '🇺🇦', native: 'Українська' },
    { code: 'ms', label: 'Malay', flag: '🇲🇾', native: 'Melayu' },
    { code: 'he', label: 'Hebrew', flag: '🇮🇱', native: 'עברית' },
    { code: 'el', label: 'Greek', flag: '🇬🇷', native: 'Ελληνικά' },
    { code: 'tl', label: 'Tagalog', flag: '🇵🇭', native: 'Filipino' },
    { code: 'ps', label: 'Pashto', flag: '🇦🇫', native: 'پښتو' },
] as const;

export type VoiceLanguageCode = (typeof VOICE_LANGUAGES)[number]['code'];

export const DEFAULT_VOICE_LANG: VoiceLanguageCode = 'en';
export const VOICE_LANG_KEY = 'soltol_voice_lang';

const SUPPORTED_CODES = new Set<string>(VOICE_LANGUAGES.map((l) => l.code));

export function readStoredVoiceLang(): VoiceLanguageCode {
    try {
        const stored = localStorage.getItem(VOICE_LANG_KEY);
        if (stored && SUPPORTED_CODES.has(stored)) {
            return stored as VoiceLanguageCode;
        }
    } catch {
        /* ignore */
    }
    return DEFAULT_VOICE_LANG;
}

export function storeVoiceLang(code: string): void {
    try {
        localStorage.setItem(VOICE_LANG_KEY, code);
    } catch {
        /* ignore */
    }
}
