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

  return client;
}

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (!client) return;
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}
