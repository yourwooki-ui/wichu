import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  INTERSTITIAL_ADS_ENABLED,
  MONETIZATION_ENABLED,
  REWARDED_ADS_ENABLED,
} from '@/constants/features';
import { queryClient } from '@/lib/query-client';
import { reportOperationalError } from '@/services/operational-error-service';

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
      } catch (error) {
        reportOperationalError('purchase_foreground_refresh', error, '/monetization');
        // Store availability must never block app foregrounding.
      } finally {
        await queryClient
          .invalidateQueries({ queryKey: ['pass-entitlement', userId] })
          .catch(() => undefined);
      }
    };

    if (MONETIZATION_ENABLED) {
      void import('@/features/monetization/services/purchase-service')
        .then(({ purchaseService }) => purchaseService.initialize(userId))
        .catch((error) => {
          reportOperationalError('purchase_bootstrap', error, '/monetization');
          return false;
        });
    }

    if (REWARDED_ADS_ENABLED || INTERSTITIAL_ADS_ENABLED) {
      void import('@/features/monetization/services/ads-service')
        .then(({ adsService }) => adsService.initialize())
        .catch((error) => reportOperationalError('ad_bootstrap', error, '/monetization'));
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPurchases();
    });
    void refreshPurchases();

    return () => subscription.remove();
  }, [userId]);
}
