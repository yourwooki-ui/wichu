import type { MonetizationProductId } from '@/features/monetization/constants/products';

export type RewardedAdResult = 'rewarded' | 'dismissed' | 'unavailable';
export type AdsPrivacyOptionsStatus = 'required' | 'not_required' | 'unavailable';
export type InterstitialPlacement = 'browse_transition' | 'discover_swipe';

export interface AdsProvider {
  initialize(): Promise<boolean>;
  showInterstitial(placement: InterstitialPlacement): Promise<void>;
  showRewardedUndo(placement: string, userId: string): Promise<RewardedAdResult>;
  getPrivacyOptionsStatus(): Promise<AdsPrivacyOptionsStatus>;
  showPrivacyOptions(): Promise<boolean>;
}

export type StoreProduct = {
  id: MonetizationProductId;
  priceLabel: string;
};

export type PurchaseUnavailableReason =
  | 'account_conflict'
  | 'network'
  | 'not_allowed'
  | 'not_configured'
  | 'payment_pending'
  | 'product_not_found'
  | 'sdk_unavailable'
  | 'store_unavailable'
  | 'unknown';

export type StoreProductsResult = {
  products: StoreProduct[];
  unavailableReason: PurchaseUnavailableReason | null;
};

export type PurchaseResult =
  | {
      status: 'purchased';
      activeProductIds: MonetizationProductId[];
      managementUrl: string | null;
    }
  | { status: 'cancelled' }
  | { status: 'unavailable'; reason: PurchaseUnavailableReason };

export interface PurchaseProvider {
  initialize(userId: string): Promise<boolean>;
  listProducts(userId: string): Promise<StoreProductsResult>;
  purchase(
    userId: string,
    productId: MonetizationProductId,
    replacingProductId?: MonetizationProductId,
  ): Promise<PurchaseResult>;
  restore(userId: string): Promise<PurchaseResult>;
  getCustomerState(userId: string): Promise<PurchaseResult>;
}
