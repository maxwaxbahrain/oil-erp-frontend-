export const VOICE_LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇺🇸', native: 'English' },
    { code: 'zh', label: 'Chinese', flag: '🇨🇳', native: '中文' },
    { code: 'hi', label: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
    { code: 'es', label: 'Spanish', flag: '🇪🇸', native: 'Español' },
    { code: 'ar', label: 'Arabic', flag: '🇸🇦', native: 'العربية' },
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
export const VOICE_LANG_RECENT_KEY = 'soltol_voice_lang_recent';

/** Semicircle arc above FAB — fan from upper-left to upper-right. */
export const FAB_ARC_ANGLES_DEG = [210, 240, 270, 300, 330, 0] as const;
export const FAB_ARC_RADIUS_PX = 80;

const SUPPORTED_CODES = new Set<string>(VOICE_LANGUAGES.map((l) => l.code));

const langByCode = new Map(VOICE_LANGUAGES.map((l) => [l.code, l]));

export function getVoiceLanguage(code: string) {
    return langByCode.get(code as VoiceLanguageCode);
}

/** Pill offset from FAB center (standard math: 0° = right, 90° = up). */
export function arcPillOffset(angleDeg: number, radiusPx: number = FAB_ARC_RADIUS_PX) {
    const rad = (angleDeg * Math.PI) / 180;
    const x = Math.cos(rad) * radiusPx;
    const y = Math.sin(rad) * radiusPx;
    return { x, y };
}

function readRecentVoiceLangCodes(): VoiceLanguageCode[] {
    try {
        const raw = localStorage.getItem(VOICE_LANG_RECENT_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (c): c is VoiceLanguageCode =>
                typeof c === 'string' && SUPPORTED_CODES.has(c)
        );
    } catch {
        return [];
    }
}

function writeRecentVoiceLangCodes(codes: VoiceLanguageCode[]): void {
    try {
        localStorage.setItem(VOICE_LANG_RECENT_KEY, JSON.stringify(codes.slice(0, 6)));
    } catch {
        /* ignore */
    }
}

/** Six languages for the FAB arc: current + recents + first six in list. */
export function getRingLanguages(current: VoiceLanguageCode) {
    const firstSix = VOICE_LANGUAGES.slice(0, 6).map((l) => l.code);
    const ordered: VoiceLanguageCode[] = [];
    const add = (code: VoiceLanguageCode) => {
        if (!SUPPORTED_CODES.has(code) || ordered.includes(code)) return;
        ordered.push(code);
    };
    add(current);
    for (const code of readRecentVoiceLangCodes()) add(code);
    for (const code of firstSix) add(code);
    return ordered
        .slice(0, 6)
        .map((code) => langByCode.get(code)!)
        .filter(Boolean);
}

export function getArcLanguages(current: VoiceLanguageCode) {
    return getRingLanguages(current);
}

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
        if (!SUPPORTED_CODES.has(code)) return;
        const recent = readRecentVoiceLangCodes().filter((c) => c !== code);
        writeRecentVoiceLangCodes([code as VoiceLanguageCode, ...recent]);
    } catch {
        /* ignore */
    }
}
