import { describe, expect, it } from 'vitest';

import {
  DEFAULT_APP_LANGUAGE,
  getAppTextDirection,
  isAppLanguage,
  resolveAppLanguage,
  supportedLanguages,
} from './languages';

describe('app language metadata', () => {
  it('defaults new installations to Korean', () => {
    expect(DEFAULT_APP_LANGUAGE).toBe('ko');
  });

  it('exposes the ten supported interface languages', () => {
    expect(supportedLanguages.map(({ code }) => code)).toEqual([
      'ko',
      'en',
      'vi',
      'ja',
      'fr',
      'es',
      'pt-BR',
      'zh-TW',
      'id',
      'fa',
    ]);
  });

  it('normalizes device locale tags', () => {
    expect(resolveAppLanguage('ko-KR')).toBe('ko');
    expect(resolveAppLanguage('vi_VN')).toBe('vi');
    expect(resolveAppLanguage('pt-BR')).toBe('pt-BR');
    expect(resolveAppLanguage('pt-PT')).toBe('pt-BR');
    expect(resolveAppLanguage('zh-Hant-TW')).toBe('zh-TW');
    expect(resolveAppLanguage('zh-HK')).toBe('zh-TW');
    expect(resolveAppLanguage('fa-IR')).toBe('fa');
    expect(resolveAppLanguage('de-DE')).toBeNull();
  });

  it('keeps Traditional Chinese exact and marks Persian as RTL', () => {
    expect(isAppLanguage('zh-TW')).toBe(true);
    expect(isAppLanguage('zh-tw')).toBe(false);
    expect(getAppTextDirection('fa')).toBe('rtl');
    expect(getAppTextDirection('ja')).toBe('ltr');
    expect(getAppTextDirection('pt-BR')).toBe('ltr');
  });
});
