import { beforeEach, describe, expect, it, vi } from 'vitest';

const getItem = vi.fn(async () => null);
const setItem = vi.fn(async () => undefined);

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem, setItem },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

describe('native-safe i18n startup', () => {
  beforeEach(() => {
    getItem.mockClear();
    setItem.mockClear();
    vi.resetModules();
  });

  it('renders bundled Korean copy before touching native storage', async () => {
    const module = await import('./index');

    expect(getItem).not.toHaveBeenCalled();
    expect(module.default.t('auth.createAccount')).toBe('회원가입');

    await module.hydrateAppLanguage();
    expect(getItem).toHaveBeenCalled();
  });
});
