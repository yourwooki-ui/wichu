import { describe, expect, it, vi } from 'vitest';

import { createAdsService } from './ads-service';
import type { AdsProvider } from './types';

function createProvider(): AdsProvider {
  return {
    initialize: vi.fn(async () => true),
    showInterstitial: vi.fn(async () => undefined),
    showRewardedUndo: vi.fn(async () => 'rewarded' as const),
  };
}

describe('ads service entitlement boundary', () => {
  it('never calls automatic ads for an ad-free entitlement', async () => {
    const provider = createProvider();
    const service = createAdsService(provider);
    await service.showInterstitial('discover_swipe', true);
    expect(provider.showInterstitial).not.toHaveBeenCalled();
  });

  it('passes the authenticated user to rewarded SSV', async () => {
    const provider = createProvider();
    const service = createAdsService(provider);
    await expect(service.showRewardedUndo('discover_undo', 'user-id')).resolves.toBe('rewarded');
    expect(provider.showRewardedUndo).toHaveBeenCalledWith('discover_undo', 'user-id');
  });
});
