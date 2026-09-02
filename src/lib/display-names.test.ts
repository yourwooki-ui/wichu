import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('display name compatibility', () => {
  it('returns localized names when Intl.DisplayNames is available', async () => {
    const { getLanguageDisplayName, getRegionDisplayName } = await import('./display-names');

    expect(getRegionDisplayName('ko', 'KR')).toBe('대한민국');
    expect(getLanguageDisplayName('ko', 'en')).toBe('영어');
  });

  it('falls back safely when the native runtime does not provide Intl.DisplayNames', async () => {
    const originalIntl = Intl;
    vi.stubGlobal('Intl', { ...originalIntl, DisplayNames: undefined });
    const { getLanguageDisplayName, getRegionDisplayName } = await import('./display-names');

    expect(getRegionDisplayName('ko', 'kr')).toBe('KR');
    expect(getLanguageDisplayName('ko', 'en')).toBe('EN');
  });

  it('does not throw when persisted profile locale values are empty', async () => {
    const { getLanguageDisplayName, getRegionDisplayName } = await import('./display-names');

    expect(getRegionDisplayName(undefined, null)).toBe('');
    expect(getRegionDisplayName('', 'kr')).toBeTruthy();
    expect(getLanguageDisplayName(null, undefined)).toBe('');
  });
});
