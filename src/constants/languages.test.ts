import { describe, expect, it } from 'vitest';

import { getLanguageOptions, getRepresentativeCountryCode, LANGUAGE_CODES } from './languages';

describe('language flag mapping', () => {
  it('maps every selectable language to a real two-letter country flag', () => {
    const options = getLanguageOptions('en');

    expect(options).toHaveLength(LANGUAGE_CODES.length);
    expect(options.every(({ countryCode }) => /^[A-Z]{2}$/.test(countryCode))).toBe(true);
    expect(options.some(({ countryCode }) => countryCode === 'UN')).toBe(false);
  });

  it('normalizes regional language codes without depending on Intl.Locale', () => {
    expect(getRepresentativeCountryCode('ko-KR')).toBe('KR');
    expect(getRepresentativeCountryCode('en-US')).toBe('US');
    expect(getRepresentativeCountryCode('zh-Hans')).toBe('CN');
  });

  it('uses the UN fallback only for truly unsupported codes', () => {
    expect(getRepresentativeCountryCode('not-a-language')).toBe('UN');
  });
});
