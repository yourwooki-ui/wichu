import type { PurchasesError, PurchasesStoreProduct } from 'react-native-purchases';

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

type PurchasesModule = typeof import('react-native-purchases');

const productIds: MonetizationProductId[] = [AD_FREE_PRODUCT.id, GOLD_PRODUCT.id];
let sdkLoading: Promise<PurchasesModule | null> | null = null;
let configuredUserId: string | null = null;
let initialization: Promise<boolean> | null = null;

/** 결제 SDK도 사용자 인증 이후 실제 호출 시점에만 평가한다. */
function loadPurchasesSdk() {
  sdkLoading ??= import('react-native-purchases').catch(() => null);
  return sdkLoading;
}

function isCancelled(error: unknown) {
  return Boolean((error as Partial<PurchasesError> | null)?.userCancelled);
}

async function configureForUser(userId: string) {
  if (!monetizationConfig.purchasesEnabled || !monetizationConfig.revenueCatApiKey || !userId) {
    return false;
  }

  try {
    const sdk = await loadPurchasesSdk();
    if (!sdk) return false;
    const Purchases = sdk.default;
    if (!configuredUserId) {
      Purchases.configure({
        apiKey: monetizationConfig.revenueCatApiKey,
        appUserID: userId,
        automaticDeviceIdentifierCollectionEnabled: false,
        diagnosticsEnabled: __DEV__,
      });
      await Purchases.setLogLevel(__DEV__ ? sdk.LOG_LEVEL.DEBUG : sdk.LOG_LEVEL.ERROR);
      configuredUserId = userId;
    } else if (configuredUserId !== userId || (await Purchases.getAppUserID()) !== userId) {
      await Purchases.logIn(userId);
      configuredUserId = userId;
    }
    return true;
  } catch {
    return false;
  }
}

async function initializeForUser(userId: string) {
  if (configuredUserId === userId) return true;
  if (!initialization) {
    initialization = configureForUser(userId).finally(() => {
      initialization = null;
    });
  }
  return initialization;
}

async function getStoreProducts(userId: string) {
  if (!(await initializeForUser(userId))) return [];
  const sdk = await loadPurchasesSdk();
  if (!sdk) return [];
  return sdk.default.getProducts(productIds);
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
      const sdk = await loadPurchasesSdk();
      if (!sdk) return 'unavailable';
      const product = (await getStoreProducts(userId)).find(
        (candidate) => candidate.identifier === productId,
      );
      if (!product) return 'unavailable';
      await sdk.default.purchaseStoreProduct(product);
      return 'purchased';
    } catch (error) {
      return isCancelled(error) ? 'cancelled' : 'unavailable';
    }
  },
  restore: async (userId): Promise<PurchaseResult> => {
    try {
      if (!(await initializeForUser(userId))) return 'unavailable';
      const sdk = await loadPurchasesSdk();
      if (!sdk) return 'unavailable';
      await sdk.default.restorePurchases();
      return 'purchased';
    } catch (error) {
      return isCancelled(error) ? 'cancelled' : 'unavailable';
    }
  },
};
