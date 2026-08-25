import { getLanguageDisplayName } from '@/lib/display-names';

export const LANGUAGE_CODES = `
aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co
cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn
gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj
kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr
ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn
ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk
tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu
`
  .trim()
  .split(/\s+/);

export type LanguageOption = {
  code: string;
  countryCode: string;
  name: string;
};

const REPRESENTATIVE_COUNTRY_BY_LANGUAGE: Record<string, string> = {
  ar: 'SA',
  de: 'DE',
  en: 'US',
  es: 'ES',
  fa: 'IR',
  fr: 'FR',
  hi: 'IN',
  id: 'ID',
  it: 'IT',
  ja: 'JP',
  ko: 'KR',
  ms: 'MY',
  pt: 'BR',
  ru: 'RU',
  th: 'TH',
  tl: 'PH',
  tr: 'TR',
  vi: 'VN',
  zh: 'TW',
};

export function getRepresentativeCountryCode(languageCode: string) {
  const normalizedCode = languageCode.toLowerCase().split('-')[0];
  const knownCountry = REPRESENTATIVE_COUNTRY_BY_LANGUAGE[normalizedCode];
  if (knownCountry) return knownCountry;

  try {
    const region = new Intl.Locale(languageCode).maximize().region;
    return region && /^[A-Z]{2}$/.test(region) ? region : 'UN';
  } catch {
    return 'UN';
  }
}

export function getLanguageOptions(locale: string): LanguageOption[] {
  return LANGUAGE_CODES.map((code) => ({
    code,
    countryCode: getRepresentativeCountryCode(code),
    name: getLanguageDisplayName(locale, code),
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}
