export type RewardedAdResult = 'rewarded' | 'dismissed' | 'unavailable';

export interface AdsService {
  initialize(): Promise<void>;
  showInterstitial(placement: string, adsRemoved: boolean): Promise<void>;
  showRewardedUndo(placement: string): Promise<RewardedAdResult>;
}

export const noopAdsService: AdsService = {
  initialize: async () => undefined,
  showInterstitial: async (_placement, adsRemoved) => {
    if (adsRemoved) return;
  },
  showRewardedUndo: async () => 'unavailable',
};

export const developmentAdsService: AdsService = {
  ...noopAdsService,
  showRewardedUndo: async () => 'rewarded',
};

export const adsService: AdsService = __DEV__ ? developmentAdsService : noopAdsService;
