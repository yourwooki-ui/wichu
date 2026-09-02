import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  INTERSTITIAL_ADS_ENABLED,
  MONETIZATION_ENABLED,
  REWARDED_ADS_ENABLED,
} from '@/constants/features';
import { queryClient } from '@/lib/query-client';

const FOREGROUND_REFRESH_COOLDOWN_MS = 30_000;

export function useMonetizationBootstrap(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    let lastForegroundRefreshAt = 0;

    const refreshPurchases = async () => {
      if (!MONETIZATION_ENABLED) return;
      const now = Date.now();
      if (now - lastForegroundRefreshAt < FOREGROUND_REFRESH_COOLDOWN_MS) return;
      lastForegroundRefreshAt = now;

      try {
        const { purchaseService } =
          await import('@/features/monetization/services/purchase-service');
        await purchaseService.getCustomerState(userId);
      } catch {
        // Store availability must never block app foregrounding.
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['pass-entitlement', userId] });
      }
    };

    if (MONETIZATION_ENABLED) {
      void import('@/features/monetization/services/purchase-service')
        .then(({ purchaseService }) => purchaseService.initialize(userId))
        .catch(() => false);
    }

    if (REWARDED_ADS_ENABLED || INTERSTITIAL_ADS_ENABLED) {
      void import('@/features/monetization/services/ads-service')
        .then(({ adsService }) => adsService.initialize())
        .catch(() => undefined);
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPurchases();
    });
    void refreshPurchases();

    return () => subscription.remove();
  }, [userId]);
}
