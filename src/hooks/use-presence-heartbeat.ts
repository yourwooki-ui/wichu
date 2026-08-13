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
      void getSupabaseClient()
        .rpc('touch_presence')
        .then(({ error }) => {
          if (__DEV__ && error) console.warn('Could not update presence', error.message);
        });
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
