import { adsProvider } from './ads-provider';
import type {
  AdsPrivacyOptionsStatus,
  AdsProvider,
  InterstitialPlacement,
  RewardedAdResult,
} from './types';

export type { RewardedAdResult } from './types';

export interface AdsService {
  initialize(): Promise<void>;
  showInterstitial(placement: InterstitialPlacement, adsRemoved: boolean): Promise<void>;
  showRewardedUndo(placement: string, userId: string): Promise<RewardedAdResult>;
  getPrivacyOptionsStatus(): Promise<AdsPrivacyOptionsStatus>;
  showPrivacyOptions(): Promise<boolean>;
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
    getPrivacyOptionsStatus: () => provider.getPrivacyOptionsStatus(),
    showPrivacyOptions: () => provider.showPrivacyOptions(),
  };
}

export const adsService = createAdsService(adsProvider);
