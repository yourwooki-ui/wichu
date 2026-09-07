import { describe, expect, it } from 'vitest';

import {
  shouldInsertProfileNativeAdAfter,
  shouldShowProfileNativeAd,
} from './profile-native-ad-policy';

const eligible = {
  enabled: true,
  entitlementReady: true,
  isPreview: false,
  photoCount: 3,
  tier: 'free' as const,
};

describe('profile native ad policy', () => {
  it('shows one ad only for public free-tier profiles with at least three photos', () => {
    expect(shouldShowProfileNativeAd(eligible)).toBe(true);
    expect(shouldShowProfileNativeAd({ ...eligible, photoCount: 2 })).toBe(false);
    expect(shouldShowProfileNativeAd({ ...eligible, isPreview: true })).toBe(false);
  });

  it('never guesses entitlement or shows to an ad-free tier', () => {
    expect(shouldShowProfileNativeAd({ ...eligible, entitlementReady: false })).toBe(false);
    expect(shouldShowProfileNativeAd({ ...eligible, tier: 'ad_free' })).toBe(false);
    expect(shouldShowProfileNativeAd({ ...eligible, tier: 'gold' })).toBe(false);
  });

  it('stays hidden when the placement is not configured', () => {
    expect(shouldShowProfileNativeAd({ ...eligible, enabled: false })).toBe(false);
  });

  it('inserts exactly once between photos two and three', () => {
    expect([0, 1].filter((index) => shouldInsertProfileNativeAdAfter(index, 3))).toEqual([0]);
    expect([0, 1, 2, 3, 4].filter((index) => shouldInsertProfileNativeAdAfter(index, 6))).toEqual([
      0,
    ]);
    expect(shouldInsertProfileNativeAdAfter(0, 2)).toBe(false);
  });
});
