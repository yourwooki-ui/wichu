import { beforeAll, describe, expect, it, vi } from 'vitest';

import { operationalResources } from './operational-resources';
import { reliabilityResources } from './reliability-resources';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

type TranslationTree = Record<string, unknown>;

function flatten(value: TranslationTree, prefix = ''): Record<string, string> {
  return Object.entries(value).reduce<Record<string, string>>((result, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      Object.assign(result, flatten(child as TranslationTree, path));
    } else {
      result[path] = String(child);
    }
    return result;
  }, {});
}

function placeholders(value: string) {
  return [...value.matchAll(/{{\s*([^},\s]+)[^}]*}}/g)].map((match) => match[1]).sort();
}

describe('translation coverage', () => {
  let i18n: (typeof import('./index'))['default'];
  let languages: (typeof import('./index'))['supportedLanguages'];

  beforeAll(async () => {
    const module = await import('./index');
    await module.i18nReady;
    i18n = module.default;
    languages = module.supportedLanguages;
  });

  it('resolves every reference key for every supported language', () => {
    const reference = flatten(i18n.getResourceBundle('en', 'translation'));

    for (const { code } of languages) {
      for (const key of Object.keys(reference)) {
        expect(i18n.exists(key, { lng: code }), `${code} cannot resolve ${key}`).toBe(true);
      }
    }
  });

  it('keeps the operational flows complete in all ten languages', () => {
    const reference = flatten(operationalResources.en.translation);

    for (const { code } of languages) {
      const translated = flatten(operationalResources[code].translation);
      expect(Object.keys(translated).sort(), `${code} operational keys`).toEqual(
        Object.keys(reference).sort(),
      );
      for (const [key, value] of Object.entries(reference)) {
        expect(placeholders(translated[key]), `${code} placeholders for ${key}`).toEqual(
          placeholders(value),
        );
      }
    }
  });

  it('keeps recovery messages complete in all ten languages', () => {
    const reference = flatten(reliabilityResources.en.translation);

    for (const { code } of languages) {
      const translated = flatten(reliabilityResources[code].translation);
      expect(Object.keys(translated).sort(), `${code} reliability keys`).toEqual(
        Object.keys(reference).sort(),
      );
    }
  });

  it('keeps Brazilian Portuguese complete without English fallback', () => {
    const reference = flatten(i18n.getResourceBundle('en', 'translation'));
    const portuguese = flatten(i18n.getResourceBundle('pt-BR', 'translation'));

    expect(Object.keys(portuguese).sort()).toEqual(Object.keys(reference).sort());
    for (const [key, value] of Object.entries(reference)) {
      expect(placeholders(portuguese[key]), `pt-BR placeholders for ${key}`).toEqual(
        placeholders(value),
      );
    }
  });
});
