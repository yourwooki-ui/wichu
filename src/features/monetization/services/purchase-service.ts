import {
  AD_FREE_PRODUCT,
  GOLD_PRODUCT,
  type MonetizationProductId,
} from '@/features/monetization/constants/products';
import { getSupabaseClient } from '@/lib/supabase';

export type PassTier = 'free' | 'ad_free' | 'gold';

export type PassEntitlement = {
  tier: PassTier;
  adsRemoved: boolean;
  canSeeVisitors: boolean;
  hasGoldProfile: boolean;
  discoveryPriority: boolean;
  unlimitedUndo: boolean;
  expiresAt: string | null;
};

export interface PurchaseProvider {
  purchase(productId: MonetizationProductId): Promise<void>;
  restore(): Promise<void>;
}

export const noopPurchaseProvider: PurchaseProvider = {
  purchase: async () => undefined,
  restore: async () => undefined,
};

export const purchaseService = {
  async getEntitlement(userId: string): Promise<PassEntitlement> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('product_id, status, current_period_end')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) throw error;

    const now = Date.now();
    const active = (data ?? []).filter(
      (subscription) =>
        !subscription.current_period_end ||
        new Date(subscription.current_period_end).getTime() > now,
    );
    const gold = active.find((subscription) => subscription.product_id === GOLD_PRODUCT.id);
    if (gold) {
      return {
        tier: 'gold',
        adsRemoved: true,
        canSeeVisitors: true,
        hasGoldProfile: true,
        discoveryPriority: true,
        unlimitedUndo: true,
        expiresAt: gold.current_period_end,
      };
    }

    const adFree = active.find((subscription) => subscription.product_id === AD_FREE_PRODUCT.id);
    if (adFree) {
      return {
        tier: 'ad_free',
        adsRemoved: true,
        canSeeVisitors: false,
        hasGoldProfile: false,
        discoveryPriority: false,
        unlimitedUndo: false,
        expiresAt: adFree.current_period_end,
      };
    }

    return {
      tier: 'free',
      adsRemoved: false,
      canSeeVisitors: false,
      hasGoldProfile: false,
      discoveryPriority: false,
      unlimitedUndo: false,
      expiresAt: null,
    };
  },
};
