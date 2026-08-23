import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { ConsentRow } from '@/components/ConsentRow';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { palette, spacing } from '@/constants/theme';
import { AuthWelcome } from '@/features/auth/components/AuthWelcome';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { LanguagePicker } from '@/features/auth/components/LanguagePicker';
import { authService } from '@/features/auth/services/auth-service';
import { isAdult } from '@/features/auth/utils/age';
import { formatBirthDateInput } from '@/features/auth/utils/format-birth-date';

type AuthStage = 'welcome' | 'sign-in' | 'sign-up';
type LoadingMethod = 'email' | 'google' | null;

export default function LoginRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [stage, setStage] = useState<AuthStage>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [consented, setConsented] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<LoadingMethod>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isSignUp = stage === 'sign-up';
  const loading = loadingMethod !== null;

  function openStage(nextStage: Exclude<AuthStage, 'welcome'>) {
    setStage(nextStage);
    setMessage(null);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  }

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    setMessage(null);

    if (!normalizedEmail.includes('@')) return setMessage(t('auth.invalidEmail'));
    if (password.length < 8) return setMessage(t('auth.invalidPassword'));
    if (isSignUp && !isAdult(birthDate)) return setMessage(t('auth.adultOnly'));
    if (isSignUp && !consented) return setMessage(t('auth.consentRequired'));

    setLoadingMethod('email');
    try {
      if (isSignUp) {
        const { data, error } = await authService.signUpWithEmail(
          normalizedEmail,
          password,
          birthDate,
        );
        if (error) throw error;
        if (!data.session) setMessage(t('auth.checkInbox'));
      } else {
        const { error } = await authService.signInWithEmail(normalizedEmail, password);
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('auth.authFailed'));
    } finally {
      setLoadingMethod(null);
    }
  }

  async function submitGoogle() {
    setMessage(null);
    if (isSignUp && !isAdult(birthDate)) return setMessage(t('auth.adultOnly'));
    if (isSignUp && !consented) return setMessage(t('auth.consentRequired'));

    setLoadingMethod('google');
    try {
      await authService.signInWithGoogle(isSignUp ? birthDate : undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('auth.authFailed'));
    } finally {
      setLoadingMethod(null);
    }
  }

  if (stage === 'welcome') {
    return (
      <AuthWelcome
        onCreateAccount={() => openStage('sign-up')}
        onSignIn={() => openStage('sign-in')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('auth.back')}
                disabled={loading}
                hitSlop={10}
                onPress={() => {
                  setStage('welcome');
                  setMessage(null);
                }}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.pressed,
                  loading && styles.disabled,
                ]}
              >
                <Ionicons name="arrow-back" size={20} color={palette.white} />
              </Pressable>
              <LanguagePicker dark />
            </View>

            <View style={styles.hero}>
              <BrandWordmark size={27} />
              <Text style={styles.title}>
                {t(isSignUp ? 'auth.signUpTitle' : 'auth.signInTitle')}
              </Text>
              <Text style={styles.subtitle}>
                {t(isSignUp ? 'auth.signUpBody' : 'auth.signInBody')}
              </Text>
            </View>

            <View style={styles.formPanel}>
              {isSignUp ? (
                <>
                  <FormField
                    tone="dark"
                    label={t('auth.birthDate')}
                    value={birthDate}
                    onChangeText={(value) => setBirthDate(formatBirthDateInput(value))}
                    placeholder={t('auth.birthDatePlaceholder')}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    maxLength={10}
                    hint={t('auth.birthDateHint')}
                  />
                  <ConsentRow
                    dark
                    checked={consented}
                    onPress={() => setConsented((value) => !value)}
                    label={t('auth.consent')}
                  />
                  <View style={styles.policyLinks}>
                    <Pressable onPress={() => router.push('/legal/terms')}>
                      <Text style={styles.policyLink}>이용약관 보기</Text>
                    </Pressable>
                    <Text style={styles.policyDot}>·</Text>
                    <Pressable onPress={() => router.push('/legal/privacy')}>
                      <Text style={styles.policyLink}>개인정보처리방침 보기</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              <GoogleAuthButton
                disabled={loading}
                label={t(isSignUp ? 'auth.signUpWithGoogle' : 'auth.signInWithGoogle')}
                loading={loadingMethod === 'google'}
                onPress={submitGoogle}
              />
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>{t('auth.orContinueWithEmail')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <FormField
                tone="dark"
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <FormField
                tone="dark"
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.passwordPlaceholder')}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                showPasswordLabel={t('auth.showPassword')}
                hidePasswordLabel={t('auth.hidePassword')}
              />

              {!isSignUp ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => router.push('/forgot-password')}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
                </Pressable>
              ) : null}

              {message ? <Text style={styles.message}>{message}</Text> : null}
              <PrimaryButton
                label={t(isSignUp ? 'auth.createAccount' : 'auth.signIn')}
                disabled={loading}
                loading={loadingMethod === 'email'}
                onPress={submit}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchPrompt}>
                  {t(isSignUp ? 'auth.haveAccount' : 'auth.noAccount')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => openStage(isSignUp ? 'sign-in' : 'sign-up')}
                >
                  <Text style={styles.switchAction}>
                    {t(isSignUp ? 'auth.signIn' : 'auth.createAccount')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#08080A',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    maxHeight: Platform.select({ web: 900 }),
    backgroundColor: '#08080A',
  },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 42,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  pressed: { opacity: 0.58 },
  disabled: { opacity: 0.42 },
  hero: { marginBottom: 28 },
  title: {
    maxWidth: 400,
    marginTop: 26,
    color: palette.white,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  subtitle: {
    maxWidth: 390,
    marginTop: 6,
    color: '#9898A2',
    fontSize: 13,
    lineHeight: 19,
  },
  formPanel: { gap: spacing.md },
  policyLinks: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  policyLink: {
    color: '#B8B8C0',
    fontSize: 10,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  policyDot: { color: '#5F5F68', fontSize: 10 },
  forgotButton: { alignSelf: 'flex-end', marginTop: -5 },
  forgotText: { color: '#B8B8C0', fontSize: 11, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#2A2A30' },
  dividerLabel: { color: '#74747D', fontSize: 10, fontWeight: '800' },
  message: { color: '#FF769F', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  switchPrompt: { color: '#85858F', fontSize: 12 },
  switchAction: { color: palette.pink, fontSize: 12, fontWeight: '900' },
});
