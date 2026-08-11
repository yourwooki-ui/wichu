export interface PurchaseService {
  getAdFreeStatus(): Promise<boolean>;
  purchaseAdFree(): Promise<void>;
  restorePurchases(): Promise<void>;
}

export const noopPurchaseService: PurchaseService = {
  getAdFreeStatus: async () => false,
  purchaseAdFree: async () => undefined,
  restorePurchases: async () => undefined,
};
