type DisplayNameType = 'language' | 'region';

const displayNameCache = new Map<string, Intl.DisplayNames>();

function normalizeLocale(locale: string) {
  const normalized = locale.replace('_', '-');
  if (normalized.toLowerCase().startsWith('zh')) return 'zh-Hant';
  if (normalized.toLowerCase().startsWith('pt')) return 'pt';
  return normalized.split('-')[0] || 'en';
}

function getDisplayNames(locale: string, type: DisplayNameType) {
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

export function getRegionDisplayName(locale: string, countryCode: string) {
  const code = countryCode.toUpperCase();
  try {
    return getDisplayNames(locale, 'region')?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function getLanguageDisplayName(locale: string, languageCode: string) {
  const code = languageCode.toLowerCase();
  try {
    return getDisplayNames(locale, 'language')?.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
