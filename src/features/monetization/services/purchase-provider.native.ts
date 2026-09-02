import type { PurchasesStoreProduct } from 'react-native-purchases';
import { Platform } from 'react-native';

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
  StoreProductsResult,
} from '@/features/monetization/services/types';
import {
  classifyPurchaseError,
  getActiveMonetizationProductIds,
  getGooglePlayStoreIdentifier,
  matchesMonetizationStoreProduct,
} from '@/features/monetization/utils/purchase-state';

type PurchasesModule = typeof import('react-native-purchases');

const productIds: MonetizationProductId[] = [AD_FREE_PRODUCT.id, GOLD_PRODUCT.id];
const storeProductIds =
  Platform.OS === 'android' ? productIds.map(getGooglePlayStoreIdentifier) : productIds;
let sdkLoading: Promise<PurchasesModule | null> | null = null;
let configuredUserId: string | null = null;
let initialization: Promise<boolean> | null = null;

/** 결제 SDK도 사용자 인증 이후 실제 호출 시점에만 평가한다. */
function loadPurchasesSdk() {
  sdkLoading ??= import('react-native-purchases').catch(() => null);
  return sdkLoading;
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
      await Purchases.setLogLevel(__DEV__ ? sdk.LOG_LEVEL.DEBUG : sdk.LOG_LEVEL.ERROR);
      Purchases.configure({
        apiKey: monetizationConfig.revenueCatApiKey,
        appUserID: userId,
        automaticDeviceIdentifierCollectionEnabled: false,
        diagnosticsEnabled: __DEV__,
      });
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

async function loadStoreProducts(userId: string): Promise<{
  products: PurchasesStoreProduct[];
  unavailableReason: StoreProductsResult['unavailableReason'];
}> {
  if (!monetizationConfig.purchasesEnabled) {
    return { products: [], unavailableReason: 'not_configured' };
  }
  if (!(await initializeForUser(userId))) {
    return { products: [], unavailableReason: 'sdk_unavailable' };
  }
  const sdk = await loadPurchasesSdk();
  if (!sdk) return { products: [], unavailableReason: 'sdk_unavailable' };

  try {
    const products = await sdk.default.getProducts(
      storeProductIds,
      sdk.PRODUCT_CATEGORY.SUBSCRIPTION,
    );
    return {
      products,
      unavailableReason: products.length > 0 ? null : 'product_not_found',
    };
  } catch (error) {
    const reason = classifyPurchaseError(error);
    return {
      products: [],
      unavailableReason: reason === 'cancelled' ? 'unknown' : reason,
    };
  }
}

async function getStoreProducts(userId: string): Promise<StoreProductsResult> {
  const catalog = await loadStoreProducts(userId);
  const products = catalog.products.flatMap((product) => {
    const mapped = toStoreProduct(product);
    return mapped ? [mapped] : [];
  });
  return {
    products,
    unavailableReason:
      products.length > 0 ? null : (catalog.unavailableReason ?? 'product_not_found'),
  };
}

function toStoreProduct(product: PurchasesStoreProduct): StoreProduct | null {
  const productId = productIds.find((candidate) =>
    matchesMonetizationStoreProduct(product.identifier, candidate),
  );
  if (!productId) return null;
  return {
    id: productId,
    priceLabel: product.priceString,
  };
}

export const purchaseProvider: PurchaseProvider = {
  initialize: initializeForUser,
  listProducts: getStoreProducts,
  purchase: async (userId, productId, replacingProductId): Promise<PurchaseResult> => {
    try {
      const sdk = await loadPurchasesSdk();
      if (!sdk) return { status: 'unavailable', reason: 'sdk_unavailable' };
      const catalog = await loadStoreProducts(userId);
      const product = catalog.products.find((candidate) =>
        matchesMonetizationStoreProduct(candidate.identifier, productId),
      );
      if (!product) {
        return {
          status: 'unavailable',
          reason: catalog.unavailableReason ?? 'product_not_found',
        };
      }
      const productChangeInfo =
        replacingProductId && Platform.OS === 'android'
          ? {
              oldProductIdentifier: getGooglePlayStoreIdentifier(replacingProductId),
              replacementMode: sdk.STORE_REPLACEMENT_MODE.WITH_TIME_PRORATION,
            }
          : undefined;
      const result = await sdk.default.purchaseStoreProduct(product, productChangeInfo);
      return {
        status: 'purchased',
        activeProductIds: getActiveMonetizationProductIds(result.customerInfo),
        managementUrl: result.customerInfo.managementURL,
      };
    } catch (error) {
      const reason = classifyPurchaseError(error);
      return reason === 'cancelled' ? { status: 'cancelled' } : { status: 'unavailable', reason };
    }
  },
  restore: async (userId): Promise<PurchaseResult> => {
    try {
      if (!(await initializeForUser(userId))) {
        return { status: 'unavailable', reason: 'sdk_unavailable' };
      }
      const sdk = await loadPurchasesSdk();
      if (!sdk) return { status: 'unavailable', reason: 'sdk_unavailable' };
      const customerInfo = await sdk.default.restorePurchases();
      return {
        status: 'purchased',
        activeProductIds: getActiveMonetizationProductIds(customerInfo),
        managementUrl: customerInfo.managementURL,
      };
    } catch (error) {
      const reason = classifyPurchaseError(error);
      return reason === 'cancelled' ? { status: 'cancelled' } : { status: 'unavailable', reason };
    }
  },
  getCustomerState: async (userId): Promise<PurchaseResult> => {
    try {
      if (!(await initializeForUser(userId))) {
        return { status: 'unavailable', reason: 'sdk_unavailable' };
      }
      const sdk = await loadPurchasesSdk();
      if (!sdk) return { status: 'unavailable', reason: 'sdk_unavailable' };
      const customerInfo = await sdk.default.getCustomerInfo();
      return {
        status: 'purchased',
        activeProductIds: getActiveMonetizationProductIds(customerInfo),
        managementUrl: customerInfo.managementURL,
      };
    } catch (error) {
      const reason = classifyPurchaseError(error);
      return reason === 'cancelled' ? { status: 'cancelled' } : { status: 'unavailable', reason };
    }
  },
};
