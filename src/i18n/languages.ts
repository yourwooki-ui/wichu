export const supportedLanguages = [
  { code: 'ko', label: '한국어', englishLabel: 'Korean', countryCode: 'KR', direction: 'ltr' },
  { code: 'en', label: 'English', englishLabel: 'English', countryCode: 'US', direction: 'ltr' },
  {
    code: 'vi',
    label: 'Tiếng Việt',
    englishLabel: 'Vietnamese',
    countryCode: 'VN',
    direction: 'ltr',
  },
  { code: 'ja', label: '日本語', englishLabel: 'Japanese', countryCode: 'JP', direction: 'ltr' },
  { code: 'fr', label: 'Français', englishLabel: 'French', countryCode: 'FR', direction: 'ltr' },
  { code: 'es', label: 'Español', englishLabel: 'Spanish', countryCode: 'ES', direction: 'ltr' },
  {
    code: 'pt-BR',
    label: 'Português (Brasil)',
    englishLabel: 'Portuguese (Brazil)',
    countryCode: 'BR',
    direction: 'ltr',
  },
  {
    code: 'zh-TW',
    label: '繁體中文',
    englishLabel: 'Chinese (Taiwan)',
    countryCode: 'TW',
    direction: 'ltr',
  },
  {
    code: 'id',
    label: 'Bahasa Indonesia',
    englishLabel: 'Indonesian',
    countryCode: 'ID',
    direction: 'ltr',
  },
  { code: 'fa', label: 'فارسی', englishLabel: 'Persian', countryCode: 'IR', direction: 'rtl' },
] as const;

export type AppLanguage = (typeof supportedLanguages)[number]['code'];
export type AppTextDirection = (typeof supportedLanguages)[number]['direction'];
export const DEFAULT_APP_LANGUAGE: AppLanguage = 'ko';

const supportedLanguageCodes = new Set<string>(supportedLanguages.map((language) => language.code));

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return Boolean(value && supportedLanguageCodes.has(value));
}

export function resolveAppLanguage(languageTag: string | null | undefined): AppLanguage | null {
  if (!languageTag) return null;

  const normalized = languageTag.trim().replaceAll('_', '-');
  if (!normalized) return null;
  if (/^zh(?:-(?:hant|tw|hk|mo))?/i.test(normalized)) return 'zh-TW';
  if (/^pt(?:-|$)/i.test(normalized)) return 'pt-BR';

  const baseLanguage = normalized.split('-')[0]?.toLowerCase();
  return isAppLanguage(baseLanguage) ? baseLanguage : null;
}

export function getAppLanguageMetadata(language: AppLanguage) {
  return supportedLanguages.find(({ code }) => code === language) ?? supportedLanguages[1];
}

export function getAppTextDirection(language: AppLanguage): AppTextDirection {
  return getAppLanguageMetadata(language).direction;
}

export function isRtlAppLanguage(language: AppLanguage) {
  return getAppTextDirection(language) === 'rtl';
}
