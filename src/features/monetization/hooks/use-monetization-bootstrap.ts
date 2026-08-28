import { useEffect } from 'react';

import {
  INTERSTITIAL_ADS_ENABLED,
  MONETIZATION_ENABLED,
  REWARDED_ADS_ENABLED,
} from '@/constants/features';

export function useMonetizationBootstrap(userId: string | undefined) {
  useEffect(() => {
    if (REWARDED_ADS_ENABLED || INTERSTITIAL_ADS_ENABLED) {
      void import('@/features/monetization/services/ads-service')
        .then(({ adsService }) => adsService.initialize())
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (MONETIZATION_ENABLED && userId) {
      void import('@/features/monetization/services/purchase-service')
        .then(({ purchaseService }) => purchaseService.initialize(userId))
        .catch(() => undefined);
    }
  }, [userId]);
}
