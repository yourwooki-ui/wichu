import { adsProvider } from './ads-provider';
import type { AdsProvider, RewardedAdResult } from './types';

export type { RewardedAdResult } from './types';

export interface AdsService {
  initialize(): Promise<void>;
  showInterstitial(placement: string, adsRemoved: boolean): Promise<void>;
  showRewardedUndo(placement: string, userId: string): Promise<RewardedAdResult>;
}

export function createAdsService(provider: AdsProvider): AdsService {
  return {
    initialize: async () => {
      await provider.initialize();
    },
    showInterstitial: async (placement, adsRemoved) => {
      if (adsRemoved) return;
      await provider.showInterstitial(placement);
    },
    showRewardedUndo: (placement, userId) => provider.showRewardedUndo(placement, userId),
  };
}

export const adsService = createAdsService(adsProvider);
