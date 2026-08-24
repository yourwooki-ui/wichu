import type { PurchaseProvider } from '@/features/monetization/services/types';

export const purchaseProvider: PurchaseProvider = {
  initialize: async () => false,
  listProducts: async () => [],
  purchase: async () => 'unavailable',
  restore: async () => 'unavailable',
};
