import type { PurchaseProvider } from '@/features/monetization/services/types';

export const purchaseProvider: PurchaseProvider = {
  initialize: async () => false,
  listProducts: async () => ({ products: [], unavailableReason: 'sdk_unavailable' }),
  purchase: async () => ({ status: 'unavailable', reason: 'sdk_unavailable' }),
  restore: async () => ({ status: 'unavailable', reason: 'sdk_unavailable' }),
  getCustomerState: async () => ({ status: 'unavailable', reason: 'sdk_unavailable' }),
};
