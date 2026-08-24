import Purchases, {
  LOG_LEVEL,
  type PurchasesError,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import { monetizationConfig } from '@/features/monetization/config';
import {
  AD_FREE_PRODUCT,
  GOLD_PRODUCT,
  type MonetizationProductId,
} from '@/features/monetization/constants/products';
import type {
  PurchaseProvider,
  PurchaseResult,
  StoreProduct,
} from '@/features/monetization/services/types';

const productIds: MonetizationProductId[] = [AD_FREE_PRODUCT.id, GOLD_PRODUCT.id];
let configured = false;

function isCancelled(error: unknown) {
  return Boolean((error as Partial<PurchasesError> | null)?.userCancelled);
}

async function initializeForUser(userId: string) {
  if (!monetizationConfig.purchasesEnabled || !monetizationConfig.revenueCatApiKey || !userId) {
    return false;
  }
  try {
    if (!configured) {
      Purchases.configure({ apiKey: monetizationConfig.revenueCatApiKey, appUserID: userId });
      configured = true;
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    } else if ((await Purchases.getAppUserID()) !== userId) {
      await Purchases.logIn(userId);
    }
    return true;
  } catch {
    return false;
  }
}

async function getStoreProducts(userId: string) {
  if (!(await initializeForUser(userId))) return [];
  return Purchases.getProducts(productIds);
}

function toStoreProduct(product: PurchasesStoreProduct): StoreProduct | null {
  if (!productIds.includes(product.identifier as MonetizationProductId)) return null;
  return {
    id: product.identifier as MonetizationProductId,
    priceLabel: product.priceString,
  };
}

export const purchaseProvider: PurchaseProvider = {
  initialize: initializeForUser,
  listProducts: async (userId) =>
    (await getStoreProducts(userId)).flatMap((product) => {
      const mapped = toStoreProduct(product);
      return mapped ? [mapped] : [];
    }),
  purchase: async (userId, productId): Promise<PurchaseResult> => {
    try {
      const product = (await getStoreProducts(userId)).find(
        (candidate) => candidate.identifier === productId,
      );
      if (!product) return 'unavailable';
      await Purchases.purchaseStoreProduct(product);
      return 'purchased';
    } catch (error) {
      return isCancelled(error) ? 'cancelled' : 'unavailable';
    }
  },
  restore: async (userId): Promise<PurchaseResult> => {
    try {
      if (!(await initializeForUser(userId))) return 'unavailable';
      await Purchases.restorePurchases();
      return 'purchased';
    } catch (error) {
      return isCancelled(error) ? 'cancelled' : 'unavailable';
    }
  },
};
