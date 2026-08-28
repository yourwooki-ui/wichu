import type { AdsProvider } from '@/features/monetization/services/types';

export const adsProvider: AdsProvider = {
  initialize: async () => false,
  showInterstitial: async () => undefined,
  showRewardedUndo: async () => 'unavailable',
};
