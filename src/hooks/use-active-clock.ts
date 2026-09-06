import { useEffect, useState } from 'react';

import { useAppActive } from '@/hooks/use-app-active';

/**
 * 상대 시간과 재전송 카운트다운처럼 화면에 보이는 시각만 갱신한다.
 * 백그라운드에서는 타이머를 제거하고, 복귀 직후 현재 시각으로 보정한다.
 */
export function useActiveClock(intervalMs = 60_000, enabled = true) {
  const appActive = useAppActive();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!appActive || !enabled) return;

    const refresh = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(refresh);
      clearInterval(interval);
    };
  }, [appActive, enabled, intervalMs]);

  return now;
}
