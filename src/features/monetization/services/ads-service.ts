export interface AdsService {
  initialize(): Promise<void>;
  showInterstitial(placement: string): Promise<void>;
}

export const noopAdsService: AdsService = {
  initialize: async () => undefined,
  showInterstitial: async () => undefined,
};
