import { describe, expect, it, vi } from 'vitest';

import { createAdsService } from './ads-service';
import type { AdsProvider } from './types';

function createProvider(): AdsProvider {
  return {
    initialize: vi.fn(async () => true),
    showInterstitial: vi.fn(async () => undefined),
    showRewardedUndo: vi.fn(async () => 'rewarded' as const),
    getPrivacyOptionsStatus: vi.fn(async () => 'required' as const),
    showPrivacyOptions: vi.fn(async () => true),
  };
}

describe('ads service entitlement boundary', () => {
  it('never calls automatic ads for an ad-free entitlement', async () => {
    const provider = createProvider();
    const service = createAdsService(provider);
    await service.showInterstitial('discover_swipe', true);
    expect(provider.showInterstitial).not.toHaveBeenCalled();
  });

  it('records profile and chat transitions for a free entitlement', async () => {
    const provider = createProvider();
    const service = createAdsService(provider);
    await service.showInterstitial('browse_transition', false);
    expect(provider.showInterstitial).toHaveBeenCalledWith('browse_transition');
  });

  it('passes the authenticated user to rewarded SSV', async () => {
    const provider = createProvider();
    const service = createAdsService(provider);
    await expect(service.showRewardedUndo('discover_undo', 'user-id')).resolves.toBe('rewarded');
    expect(provider.showRewardedUndo).toHaveBeenCalledWith('discover_undo', 'user-id');
  });

  it('delegates the privacy options form to the native provider', async () => {
    const provider = createProvider();
    const service = createAdsService(provider);
    await expect(service.getPrivacyOptionsStatus()).resolves.toBe('required');
    await expect(service.showPrivacyOptions()).resolves.toBe(true);
  });
});
