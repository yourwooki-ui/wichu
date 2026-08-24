import type { MonetizationProductId } from '@/features/monetization/constants/products';

export type RewardedAdResult = 'rewarded' | 'dismissed' | 'unavailable';

export interface AdsProvider {
  initialize(): Promise<boolean>;
  showInterstitial(placement: string): Promise<void>;
  showRewardedUndo(placement: string, userId: string): Promise<RewardedAdResult>;
}

export type StoreProduct = {
  id: MonetizationProductId;
  priceLabel: string;
};

export type PurchaseResult = 'purchased' | 'cancelled' | 'unavailable';

export interface PurchaseProvider {
  initialize(userId: string): Promise<boolean>;
  listProducts(userId: string): Promise<StoreProduct[]>;
  purchase(userId: string, productId: MonetizationProductId): Promise<PurchaseResult>;
  restore(userId: string): Promise<PurchaseResult>;
}
