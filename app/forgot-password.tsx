import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { palette } from '@/constants/theme';
import { authService } from '@/features/auth/services/auth-service';

export default function ForgotPasswordRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      setMessage(t('passwordReset.invalidEmail'));
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await authService.requestPasswordReset(normalizedEmail);
    setBusy(false);
    if (error) {
      setMessage(t('passwordReset.sendFailed'));
      return;
    }
    setSent(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.page}
      >
        <Pressable
          accessibilityLabel={t('passwordReset.back')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons color={palette.white} name="arrow-back" size={20} />
        </Pressable>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <BrandWordmark size={26} />
          <Text style={styles.title}>
            {t(sent ? 'passwordReset.sentTitle' : 'passwordReset.requestTitle')}
          </Text>
          <Text style={styles.body}>
            {t(sent ? 'passwordReset.sentBody' : 'passwordReset.requestBody')}
          </Text>
          {sent ? (
            <PrimaryButton
              label={t('passwordReset.backToLogin')}
              onPress={() => router.replace('/login')}
            />
          ) : (
            <>
              <FormField
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                label={t('passwordReset.email')}
                onChangeText={setEmail}
                placeholder="you@example.com"
                tone="dark"
                value={email}
              />
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <PrimaryButton
                disabled={busy}
                label={t('passwordReset.sendLink')}
                loading={busy}
                onPress={submit}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { alignItems: 'center', backgroundColor: '#08080A', flex: 1 },
  page: { flex: 1, maxWidth: 430, width: '100%' },
  scroll: { flex: 1, minHeight: 0 },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: 10, width: 44 },
  content: { flexGrow: 1, gap: 18, justifyContent: 'center', padding: 22, paddingBottom: 84 },
  title: { color: palette.white, fontSize: 29, fontWeight: '900', letterSpacing: -0.8 },
  body: { color: '#9B9BA4', fontSize: 13, lineHeight: 20, marginBottom: 6 },
  message: { color: '#FF769F', fontSize: 12, fontWeight: '700', lineHeight: 17 },
});
