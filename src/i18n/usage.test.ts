import { beforeAll, describe, expect, it, vi } from 'vitest';

declare global {
  interface ImportMeta {
    glob(
      patterns: string | string[],
      options: { eager: true; import: 'default'; query: '?raw' },
    ): Record<string, unknown>;
  }
}

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ko-KR' }] }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

const LITERAL_TRANSLATION_CALL = /\b(?:i18n\.)?t\(\s*(['"`])([A-Za-z0-9_.:-]+)\1/g;
const sourceModules = import.meta.glob(
  ['../../app/**/*.{js,jsx,ts,tsx}', '../**/*.{js,jsx,ts,tsx}'],
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;

describe('translation key usage', () => {
  let i18n: (typeof import('./index'))['default'];
  let languages: (typeof import('./index'))['supportedLanguages'];

  beforeAll(async () => {
    const module = await import('./index');
    await module.initializeAppLanguage();
    i18n = module.default;
    languages = module.supportedLanguages;
  });

  it('never exposes a literal translation key used by app code', () => {
    const usages = Object.entries(sourceModules)
      .filter(([file]) => !file.includes('.test.'))
      .flatMap(([file, source]) => {
        return [...source.matchAll(LITERAL_TRANSLATION_CALL)].map((match) => ({
          file,
          key: match[2],
        }));
      });

    expect(usages.length).toBeGreaterThan(0);
    for (const { file, key } of usages) {
      for (const { code } of languages) {
        expect(i18n.exists(key, { lng: code }), `${file} exposes ${key} in ${code}`).toBe(true);
        expect(i18n.t(key, { lng: code }), `${file} renders ${key} in ${code}`).not.toBe(key);
      }
    }
  });
});
