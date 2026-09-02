type DisplayNameType = 'language' | 'region';

const displayNameCache = new Map<string, Intl.DisplayNames>();

function normalizeLocale(locale: string | null | undefined) {
  const normalized = typeof locale === 'string' ? locale.trim().replace('_', '-') : '';
  if (!normalized) return 'en';
  if (normalized.toLowerCase().startsWith('zh')) return 'zh-Hant';
  if (normalized.toLowerCase().startsWith('pt')) return 'pt';
  return normalized.split('-')[0] || 'en';
}

function getDisplayNames(locale: string | null | undefined, type: DisplayNameType) {
  const supportedLocale = normalizeLocale(locale);
  const key = `${supportedLocale}:${type}`;
  const cached = displayNameCache.get(key);
  if (cached) return cached;

  try {
    const formatter = new Intl.DisplayNames([supportedLocale, 'en'], { type });
    displayNameCache.set(key, formatter);
    return formatter;
  } catch {
    return null;
  }
}

export function getRegionDisplayName(
  locale: string | null | undefined,
  countryCode: string | null | undefined,
) {
  const code = typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : '';
  if (!code) return '';
  try {
    return getDisplayNames(locale, 'region')?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function getLanguageDisplayName(
  locale: string | null | undefined,
  languageCode: string | null | undefined,
) {
  const code = typeof languageCode === 'string' ? languageCode.trim().toLowerCase() : '';
  if (!code) return '';
  try {
    return getDisplayNames(locale, 'language')?.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
