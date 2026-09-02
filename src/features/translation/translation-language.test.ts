import { describe, expect, it } from 'vitest';

import { getTranslationLanguage, isSameTranslationLanguage } from './translation-language';

describe('translation language mapping', () => {
  it.each([
    ['ko', 'ko'],
    ['en-US', 'en'],
    ['pt-BR', 'pt'],
    ['pt_BR', 'pt'],
    ['zh-TW', 'zh'],
    ['zh_Hant', 'zh'],
    ['vi', 'vi'],
  ])('maps %s to %s', (appLanguage, expected) => {
    expect(getTranslationLanguage(appLanguage)).toBe(expected);
  });

  it('does not pretend an unsupported UI language can be translated', () => {
    expect(getTranslationLanguage('fa')).toBeNull();
  });

  it('compares locale variants using their translation cache language', () => {
    expect(isSameTranslationLanguage('pt-PT', 'pt-BR')).toBe(true);
    expect(isSameTranslationLanguage('zh-Hans', 'zh-TW')).toBe(true);
    expect(isSameTranslationLanguage('en', 'ko')).toBe(false);
  });
});
