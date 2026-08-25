import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { palette } from '@/constants/theme';
import { authService } from '@/features/auth/services/auth-service';
import { useAuthSession } from '@/hooks/use-auth-session';

export default function ResetPasswordRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const url = Linking.useURL();
  const { session } = useAuthSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [preparing, setPreparing] = useState(Boolean(url) && !session);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!url || session) return;
    void authService
      .createSessionFromUrl(url)
      .catch(() => setMessage(t('passwordReset.invalidLink')))
      .finally(() => setPreparing(false));
  }, [session, t, url]);

  const submit = async () => {
    if (!session) return setMessage(t('passwordReset.reopenLink'));
    if (password.length < 8) return setMessage(t('passwordReset.shortPassword'));
    if (password !== confirmation) return setMessage(t('passwordReset.mismatch'));

    setBusy(true);
    setMessage(null);
    const { error } = await authService.updatePassword(password);
    if (error) {
      setBusy(false);
      setMessage(t('passwordReset.updateFailed'));
      return;
    }
    await authService.clearLocalSession();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.content}>
          <BrandWordmark size={26} />
          <Text style={styles.title}>{t('passwordReset.title')}</Text>
          <Text style={styles.body}>{t('passwordReset.body')}</Text>
          {preparing ? (
            <View style={styles.preparing}>
              <ActivityIndicator color={palette.pink} />
              <Text style={styles.preparingText}>{t('passwordReset.preparing')}</Text>
            </View>
          ) : (
            <>
              <FormField
                autoCapitalize="none"
                autoComplete="new-password"
                hidePasswordLabel={t('passwordReset.hidePassword')}
                label={t('passwordReset.newPassword')}
                onChangeText={setPassword}
                placeholder={t('passwordReset.passwordPlaceholder')}
                secureTextEntry
                showPasswordLabel={t('passwordReset.showPassword')}
                tone="dark"
                value={password}
              />
              <FormField
                autoCapitalize="none"
                autoComplete="new-password"
                hidePasswordLabel={t('passwordReset.hidePassword')}
                label={t('passwordReset.confirmPassword')}
                onChangeText={setConfirmation}
                placeholder={t('passwordReset.confirmationPlaceholder')}
                secureTextEntry
                showPasswordLabel={t('passwordReset.showPassword')}
                tone="dark"
                value={confirmation}
              />
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <PrimaryButton
                disabled={busy || !session}
                label={t('passwordReset.changePassword')}
                loading={busy}
                onPress={submit}
              />
              {!session ? (
                <PrimaryButton
                  label={t('passwordReset.requestNewLink')}
                  onPress={() => router.replace('/forgot-password')}
                  tone="dark"
                  variant="outline"
                />
              ) : null}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { alignItems: 'center', backgroundColor: '#08080A', flex: 1 },
  page: { flex: 1, maxWidth: 430, width: '100%' },
  content: { flex: 1, gap: 18, justifyContent: 'center', padding: 22, paddingBottom: 74 },
  title: { color: palette.white, fontSize: 29, fontWeight: '900', letterSpacing: -0.8 },
  body: { color: '#9B9BA4', fontSize: 13, lineHeight: 20, marginBottom: 6 },
  preparing: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  preparingText: { color: '#A5A5AE', fontSize: 12, fontWeight: '700' },
  message: { color: '#FF769F', fontSize: 12, fontWeight: '700', lineHeight: 17 },
});
