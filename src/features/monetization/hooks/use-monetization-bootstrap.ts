import { useEffect } from 'react';

import {
  INTERSTITIAL_ADS_ENABLED,
  MONETIZATION_ENABLED,
  REWARDED_ADS_ENABLED,
} from '@/constants/features';
import { adsService } from '@/features/monetization/services/ads-service';
import { purchaseService } from '@/features/monetization/services/purchase-service';

export function useMonetizationBootstrap(userId: string | undefined) {
  useEffect(() => {
    if (REWARDED_ADS_ENABLED || INTERSTITIAL_ADS_ENABLED) void adsService.initialize();
  }, []);

  useEffect(() => {
    if (MONETIZATION_ENABLED && userId) void purchaseService.initialize(userId);
  }, [userId]);
}
