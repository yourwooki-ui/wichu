import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase';
import { notificationsService } from '@/services/notifications-service';

const PENDING_GOOGLE_BIRTH_DATE_KEY = 'wichu.auth.pending-google-birth-date';

export function getAuthCallbackUrl() {
  return makeRedirectUri({ scheme: 'wichu', path: 'auth/callback' });
}

async function applyPendingGoogleBirthDate() {
  const birthDate = await AsyncStorage.getItem(PENDING_GOOGLE_BIRTH_DATE_KEY);
  if (!birthDate) return;

  const { error } = await getSupabaseClient().auth.updateUser({ data: { birth_date: birthDate } });
  if (error) throw error;
  await AsyncStorage.removeItem(PENDING_GOOGLE_BIRTH_DATE_KEY);
}

async function createSessionFromUrl(url: string) {
  const [urlWithoutHash, hash = ''] = url.split('#');
  const query = urlWithoutHash.split('?')[1] ?? '';
  const params = new URLSearchParams([query, hash].filter(Boolean).join('&'));
  const errorDescription = params.get('error_description');
  if (errorDescription) throw new Error(errorDescription);

  const code = params.get('code');
  const result = code
    ? await getSupabaseClient().auth.exchangeCodeForSession(code)
    : await createImplicitSession(params);

  if (result?.error) throw result.error;
  if (result?.data.session) await applyPendingGoogleBirthDate();
  return result;
}

async function createImplicitSession(params: URLSearchParams) {
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  return getSupabaseClient().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}

export const authService = {
  signInWithEmail(email: string, password: string) {
    return getSupabaseClient().auth.signInWithPassword({ email, password });
  },
  signUpWithEmail(email: string, password: string, birthDate: string) {
    return getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        data: { birth_date: birthDate },
      },
    });
  },
  async signInWithGoogle(birthDate?: string) {
    if (birthDate) await AsyncStorage.setItem(PENDING_GOOGLE_BIRTH_DATE_KEY, birthDate);

    const redirectTo = getAuthCallbackUrl();
    const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: Platform.OS !== 'web',
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });

    if (error) {
      if (birthDate) await AsyncStorage.removeItem(PENDING_GOOGLE_BIRTH_DATE_KEY);
      throw error;
    }

    if (Platform.OS === 'web') return 'redirecting' as const;
    if (!data.url) throw new Error('Google authentication URL was not created.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
      if (birthDate) await AsyncStorage.removeItem(PENDING_GOOGLE_BIRTH_DATE_KEY);
      return 'cancelled' as const;
    }

    await createSessionFromUrl(result.url);
    return 'completed' as const;
  },
  createSessionFromUrl,
  async signOut() {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) await notificationsService.unregister(data.user.id).catch(() => undefined);
    return supabase.auth.signOut();
  },
  clearLocalSession() {
    return getSupabaseClient().auth.signOut({ scope: 'local' });
  },
};
