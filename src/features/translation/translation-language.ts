import type { AppLanguage } from '@/i18n/languages';

export type TranslationLanguage = 'en' | 'es' | 'fr' | 'id' | 'ja' | 'ko' | 'pt' | 'vi' | 'zh';

const APP_LANGUAGE_TARGETS: Record<AppLanguage, TranslationLanguage | null> = {
  en: 'en',
  es: 'es',
  fa: null,
  fr: 'fr',
  id: 'id',
  ja: 'ja',
  ko: 'ko',
  'pt-BR': 'pt',
  vi: 'vi',
  'zh-TW': 'zh',
};

export function getTranslationLanguage(appLanguage: string): TranslationLanguage | null {
  const normalized = appLanguage.trim().replaceAll('_', '-');
  const exact = APP_LANGUAGE_TARGETS[normalized as AppLanguage];
  if (exact !== undefined) return exact;
  if (/^zh(?:-|$)/i.test(normalized)) return 'zh';
  if (/^pt(?:-|$)/i.test(normalized)) return 'pt';
  const base = normalized.split('-')[0]?.toLowerCase() as AppLanguage | undefined;
  return base ? (APP_LANGUAGE_TARGETS[base] ?? null) : null;
}

export function isSameTranslationLanguage(left: string | null | undefined, right: string) {
  if (!left) return false;
  return getTranslationLanguage(left) === getTranslationLanguage(right);
}
