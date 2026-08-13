export interface AdsService {
  initialize(): Promise<void>;
  showInterstitial(placement: string, adsRemoved: boolean): Promise<void>;
}

export const noopAdsService: AdsService = {
  initialize: async () => undefined,
  showInterstitial: async (_placement, adsRemoved) => {
    if (adsRemoved) return;
  },
};
