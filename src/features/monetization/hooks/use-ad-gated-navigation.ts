import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

import { adsService } from '@/features/monetization/services/ads-service';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';

/**
 * 프로필/채팅 탐색 횟수를 기록하되, 광고는 미리 로드된 경우에만 화면 전환 전에 표시한다.
 * 이용권 상태를 확인하지 못한 동안에는 Gold/Ad-Free 사용자를 오인해 광고를 띄우지 않는다.
 */
export function useAdGatedNavigation() {
  const router = useRouter();
  const entitlement = usePassEntitlement();
  const navigating = useRef(false);

  return useCallback(
    async (href: Href) => {
      if (navigating.current) return;
      navigating.current = true;
      try {
        await adsService.showInterstitial(
          'browse_transition',
          entitlement.data?.adsRemoved ?? true,
        );
      } finally {
        navigating.current = false;
        router.push(href);
      }
    },
    [entitlement.data?.adsRemoved, router],
  );
}
