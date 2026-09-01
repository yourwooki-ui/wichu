import { useEffect } from 'react';

import { INTERSTITIAL_ADS_ENABLED, REWARDED_ADS_ENABLED } from '@/constants/features';

export function useMonetizationBootstrap(userId: string | undefined) {
  useEffect(() => {
    if (userId && (REWARDED_ADS_ENABLED || INTERSTITIAL_ADS_ENABLED)) {
      void import('@/features/monetization/services/ads-service')
        .then(({ adsService }) => adsService.initialize())
        .catch(() => undefined);
    }
  }, [userId]);
}
