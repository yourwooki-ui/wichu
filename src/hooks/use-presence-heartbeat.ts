import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

export function usePresenceHeartbeat(userId?: string) {
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;

    let isActive = AppState.currentState === 'active';
    const touchPresence = () => {
      if (!isActive) return;
      try {
        void getSupabaseClient()
          .rpc('touch_presence')
          .then(
            ({ error }) => {
              if (__DEV__ && error) console.warn('Could not update presence', error.message);
            },
            () => undefined,
          );
      } catch {
        // Presence는 보조 신호다. 초기화 실패가 세션 복원이나 앱 실행을 막지 않는다.
      }
    };

    touchPresence();
    const interval = setInterval(touchPresence, HEARTBEAT_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasActive = isActive;
      isActive = nextState === 'active';
      if (isActive && !wasActive) touchPresence();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [userId]);
}
