import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase';
import { sensitiveStorage } from '@/lib/secure-storage';
import { notificationsService } from '@/services/notifications-service';

const PENDING_GOOGLE_BIRTH_DATE_KEY = 'wichu.auth.pending-google-birth-date';

export function getAuthCallbackUrl() {
  return makeRedirectUri({ scheme: 'wichu', path: 'auth/callback' });
}

export function getPasswordResetUrl() {
  return makeRedirectUri({ scheme: 'wichu', path: 'reset-password' });
}

async function applyPendingGoogleBirthDate() {
  const birthDate = await sensitiveStorage.getItem(PENDING_GOOGLE_BIRTH_DATE_KEY);
  if (!birthDate) return;

  const { error } = await getSupabaseClient().auth.updateUser({ data: { birth_date: birthDate } });
  if (error) throw error;
  await sensitiveStorage.removeItem(PENDING_GOOGLE_BIRTH_DATE_KEY);
}

async function createSessionFromUrl(url: string) {
  const [urlWithoutHash, hash = ''] = url.split('#');
  const query = urlWithoutHash.split('?')[1] ?? '';
  const params = new URLSearchParams([query, hash].filter(Boolean).join('&'));
  const errorDescription = params.get('error_description');
  if (errorDescription) throw new Error(errorDescription);

  const code = params.get('code');
  if (!code) throw new Error('인증 코드가 없거나 만료되었습니다. 다시 로그인해주세요.');
  const result = await getSupabaseClient().auth.exchangeCodeForSession(code);

  if (result?.error) throw result.error;
  if (result?.data.session) await applyPendingGoogleBirthDate();
  return result;
}

export const authService = {
  requestPasswordReset(email: string) {
    return getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetUrl(),
    });
  },
  updatePassword(password: string) {
    return getSupabaseClient().auth.updateUser({ password });
  },
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
    if (birthDate) await sensitiveStorage.setItem(PENDING_GOOGLE_BIRTH_DATE_KEY, birthDate);

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
      if (birthDate) await sensitiveStorage.removeItem(PENDING_GOOGLE_BIRTH_DATE_KEY);
      throw error;
    }

    if (Platform.OS === 'web') return 'redirecting' as const;
    if (!data.url) throw new Error('Google authentication URL was not created.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
      if (birthDate) await sensitiveStorage.removeItem(PENDING_GOOGLE_BIRTH_DATE_KEY);
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
    return supabase.auth.signOut({ scope: 'local' });
  },
  clearLocalSession() {
    return getSupabaseClient().auth.signOut({ scope: 'local' });
  },
};
