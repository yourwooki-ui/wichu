import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import { sensitiveStorage } from '@/lib/secure-storage';
import { validateSupabaseConfiguration } from '@/lib/supabase-config';
import { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

let client: SupabaseClient<Database> | null = null;
let authLifecycleAttached = false;

function attachAuthLifecycle() {
  if (Platform.OS === 'web' || authLifecycleAttached) return;

  try {
    AppState.addEventListener('change', (state) => {
      if (!client) return;
      try {
        if (state === 'active') client.auth.startAutoRefresh();
        else client.auth.stopAutoRefresh();
      } catch {
        // 세션 자동 갱신 수명주기가 실패해도 앱 렌더링은 계속한다.
      }
    });
    authLifecycleAttached = true;
  } catch {
    // 제한된 네이티브 런타임에서는 AppState 구독 자체가 실패할 수 있다.
  }
}

export function getSupabaseClient(): SupabaseClient<Database> {
  const configuration = validateSupabaseConfiguration(supabaseUrl, supabasePublishableKey);

  client ??= createClient<Database>(configuration.url, configuration.publishableKey, {
    auth: {
      storage: sensitiveStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  });
  attachAuthLifecycle();

  return client;
}
