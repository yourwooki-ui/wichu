import type { CustomerInfo, PurchasesError } from 'react-native-purchases';

import { AD_FREE_PRODUCT, GOLD_PRODUCT, type MonetizationProductId } from '../constants/products';
import type { PurchaseUnavailableReason } from '../services/types';

const PRODUCT_IDS = new Set<MonetizationProductId>([AD_FREE_PRODUCT.id, GOLD_PRODUCT.id]);
const GOOGLE_PLAY_PRODUCT_IDS = new Map<MonetizationProductId, string>([
  [AD_FREE_PRODUCT.id, AD_FREE_PRODUCT.googlePlayIdentifier],
  [GOLD_PRODUCT.id, GOLD_PRODUCT.googlePlayIdentifier],
]);

export function normalizeMonetizationProductId(value: string) {
  const productId = value.split(':', 1)[0] as MonetizationProductId;
  return PRODUCT_IDS.has(productId) ? productId : null;
}

export function matchesMonetizationStoreProduct(value: string, productId: MonetizationProductId) {
  return value === productId || value === GOOGLE_PLAY_PRODUCT_IDS.get(productId);
}

export function getGooglePlayStoreIdentifier(productId: MonetizationProductId) {
  return GOOGLE_PLAY_PRODUCT_IDS.get(productId) ?? productId;
}

export function getActiveMonetizationProductIds(
  customerInfo: Pick<CustomerInfo, 'activeSubscriptions'>,
) {
  return Array.from(
    new Set(
      customerInfo.activeSubscriptions.flatMap((value) => {
        const productId = normalizeMonetizationProductId(value);
        return productId ? [productId] : [];
      }),
    ),
  );
}

export function getReplacementProductId(
  currentTier: 'free' | 'ad_free' | 'gold' | undefined,
  targetProductId: MonetizationProductId,
) {
  return currentTier === 'ad_free' && targetProductId === GOLD_PRODUCT.id
    ? AD_FREE_PRODUCT.id
    : undefined;
}

export function classifyPurchaseError(error: unknown): PurchaseUnavailableReason | 'cancelled' {
  const purchaseError = error as Partial<PurchasesError> | null;
  if (purchaseError?.userCancelled || purchaseError?.code === '1') return 'cancelled';

  switch (purchaseError?.code) {
    case '3':
    case '19':
      return 'not_allowed';
    case '5':
      return 'product_not_found';
    case '7':
    case '13':
      return 'account_conflict';
    case '10':
    case '32':
    case '35':
      return 'network';
    case '20':
      return 'payment_pending';
    case '11':
    case '23':
      return 'not_configured';
    case '2':
    case '12':
    case '16':
    case '33':
      return 'store_unavailable';
    default:
      return 'unknown';
  }
}
