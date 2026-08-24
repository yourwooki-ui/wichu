import { describe, expect, it } from 'vitest';

import {
  DISCOVER_INTERSTITIAL_POLICY,
  getLocalDayKey,
  recordInterstitialShown,
  registerDiscoverAction,
  type InterstitialFrequencyState,
} from './ad-frequency-policy';

describe('discover interstitial frequency policy', () => {
  const now = new Date('2026-08-25T12:00:00+09:00').getTime();

  it('waits for twelve completed actions', () => {
    let state: InterstitialFrequencyState | null = null;
    for (let index = 0; index < DISCOVER_INTERSTITIAL_POLICY.actionsPerAd - 1; index += 1) {
      const result = registerDiscoverAction(state, now + index);
      state = result.state;
      expect(result.shouldShow).toBe(false);
    }
    expect(registerDiscoverAction(state, now + 20).shouldShow).toBe(true);
  });

  it('enforces the interval and daily cap', () => {
    const state: InterstitialFrequencyState = {
      actionsSinceLastAd: 20,
      dailyCount: 1,
      dayKey: getLocalDayKey(now),
      lastShownAt: now - 60_000,
    };
    expect(registerDiscoverAction(state, now).shouldShow).toBe(false);
    expect(
      registerDiscoverAction(
        {
          ...state,
          dailyCount: DISCOVER_INTERSTITIAL_POLICY.dailyLimit,
          lastShownAt: now - DISCOVER_INTERSTITIAL_POLICY.minimumIntervalMs,
        },
        now,
      ).shouldShow,
    ).toBe(false);
  });

  it('resets the counter only after an ad was actually shown', () => {
    const state: InterstitialFrequencyState = {
      actionsSinceLastAd: 14,
      dailyCount: 0,
      dayKey: getLocalDayKey(now),
      lastShownAt: null,
    };
    expect(recordInterstitialShown(state, now)).toMatchObject({
      actionsSinceLastAd: 0,
      dailyCount: 1,
      lastShownAt: now,
    });
  });
});
