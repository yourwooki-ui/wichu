import { Redirect, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppTheme } from '@/components/ThemeProvider';
import { authService } from '@/features/auth/services/auth-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import { reportOperationalError } from '@/services/operational-error-service';

type CallbackState = 'confirming' | 'error' | 'success';

export default function AuthCallbackRoute() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { session, profileCompleted } = useAuthSession();
  const url = Linking.useURL();
  const [state, setState] = useState<CallbackState>('confirming');

  useEffect(() => {
    // Run after mount so a browser helper can never prevent the app root from rendering.
    void WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (!url) return;
    void authService
      .createSessionFromUrl(url)
      .then(() => setState('success'))
      .catch((error) => {
        reportOperationalError('auth_callback', error, '/auth/callback');
        setState('error');
      });
  }, [url]);

  if (session) {
    return <Redirect href={profileCompleted ? '/(tabs)/discover' : '/profile-setup'} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {state === 'error' ? (
        <View style={styles.errorContent}>
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
            {t('auth.authFailed')}
          </Text>
          <PrimaryButton label={t('auth.back')} onPress={() => router.replace('/login')} />
        </View>
      ) : (
        <>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>
            {state === 'success' ? t('auth.signIn') : t('auth.signInWithGoogle')}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorContent: { gap: 18, maxWidth: 320, paddingHorizontal: 24, width: '100%' },
  errorTitle: { fontSize: 18, fontWeight: '800', lineHeight: 25, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '700' },
});
