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
import { palette, radius, spacing, touchSlop } from '@/constants/theme';
import { AuthWelcome } from '@/features/auth/components/AuthWelcome';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { LanguagePicker } from '@/features/auth/components/LanguagePicker';
import { authService } from '@/features/auth/services/auth-service';
import { getAge, isAdult } from '@/features/auth/utils/age';
import { formatBirthDateInput } from '@/features/auth/utils/format-birth-date';

type AuthStage = 'welcome' | 'sign-in' | 'sign-up';
type LoadingMethod = 'email' | 'google' | null;
type FieldKey = 'birthDate' | 'consent' | 'email' | 'password';
type FieldErrors = Partial<Record<FieldKey, string>>;

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
  // 실패는 message, 성공 안내는 notice로 나눈다. 같은 붉은 스타일로 섞이지 않게 한다.
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const isSignUp = stage === 'sign-up';
  const loading = loadingMethod !== null;
  const age = getAge(birthDate);
  // 날짜가 완성되는 즉시 판정한다. 제출까지 기다렸다가 알려주지 않는다.
  const birthDateError =
    fieldErrors.birthDate ?? (age !== null && age < 18 ? t('auth.adultOnly') : null);

  /** 사용자가 해당 필드를 고치면 그 필드 오류만 즉시 지운다. */
  function clearFieldError(field: FieldKey) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  /** 모든 필드를 한 번에 검사해 잘못된 곳을 동시에 보여준다. */
  function collectFieldErrors(): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim().toLowerCase().includes('@')) errors.email = t('auth.invalidEmail');
    if (password.length < 8) errors.password = t('auth.invalidPassword');
    if (isSignUp && !isAdult(birthDate)) errors.birthDate = t('auth.adultOnly');
    if (isSignUp && !consented) errors.consent = t('auth.consentRequired');
    return errors;
  }

  function openStage(nextStage: Exclude<AuthStage, 'welcome'>) {
    setStage(nextStage);
    setMessage(null);
    setNotice(null);
    setFieldErrors({});
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  }

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    setMessage(null);
    setNotice(null);

    const errors = collectFieldErrors();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoadingMethod('email');
    try {
      if (isSignUp) {
        const { data, error } = await authService.signUpWithEmail(
          normalizedEmail,
          password,
          birthDate,
        );
        if (error) throw error;
        if (!data.session) setNotice(t('auth.checkInbox'));
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
    setNotice(null);

    if (isSignUp) {
      const errors: FieldErrors = {};
      if (!isAdult(birthDate)) errors.birthDate = t('auth.adultOnly');
      if (!consented) errors.consent = t('auth.consentRequired');
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }

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
                <Ionicons name="arrow-back" size={20} color={palette.ink} />
              </Pressable>
              <LanguagePicker />
            </View>

            <View style={styles.hero}>
              <BrandWordmark color={palette.ink} size={27} />
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
                    label={t('auth.birthDate')}
                    value={birthDate}
                    onChangeText={(value) => {
                      setBirthDate(formatBirthDateInput(value));
                      clearFieldError('birthDate');
                    }}
                    placeholder={t('auth.birthDatePlaceholder')}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    maxLength={10}
                    error={birthDateError}
                    success={age !== null && age >= 18 ? t('auth.ageConfirmed', { age }) : null}
                    hint={t('auth.birthDateHint')}
                  />
                  <ConsentRow
                    dark
                    checked={consented}
                    error={fieldErrors.consent}
                    onPress={() => {
                      setConsented((value) => !value);
                      clearFieldError('consent');
                    }}
                    label={t('auth.consent')}
                  />
                  <View style={styles.policyLinks}>
                    <Pressable hitSlop={touchSlop.link} onPress={() => router.push('/legal/terms')}>
                      <Text style={styles.policyLink}>이용약관 보기</Text>
                    </Pressable>
                    <Text style={styles.policyDot}>·</Text>
                    <Pressable
                      hitSlop={touchSlop.link}
                      onPress={() => router.push('/legal/privacy')}
                    >
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
                label={t('auth.email')}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  clearFieldError('email');
                }}
                error={fieldErrors.email}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <FormField
                label={t('auth.password')}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  clearFieldError('password');
                }}
                error={fieldErrors.password}
                hint={isSignUp ? t('auth.passwordHint') : undefined}
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
                  hitSlop={touchSlop.link}
                  onPress={() => router.push('/forgot-password')}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
                </Pressable>
              ) : null}

              {message ? (
                <View style={styles.messageRow}>
                  <Ionicons color="#FF769F" name="alert-circle" size={15} />
                  <Text style={styles.message}>{message}</Text>
                </View>
              ) : null}
              {notice ? (
                <View style={styles.noticeRow}>
                  <Ionicons color={palette.lime} name="mail-unread-outline" size={15} />
                  <Text style={styles.notice}>{notice}</Text>
                </View>
              ) : null}
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
                  hitSlop={touchSlop.link}
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
    backgroundColor: '#E9E7E4',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    maxHeight: Platform.select({ web: 900 }),
    backgroundColor: '#F8F7F5',
  },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.58 },
  disabled: { opacity: 0.42 },
  hero: { marginBottom: 22, paddingHorizontal: 2 },
  title: {
    maxWidth: 400,
    marginTop: 22,
    color: palette.ink,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  subtitle: {
    maxWidth: 390,
    marginTop: 6,
    color: palette.inkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  formPanel: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: 18,
  },
  policyLinks: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  policyLink: {
    color: palette.inkMuted,
    fontSize: 10,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  policyDot: { color: palette.inkMuted, fontSize: 10 },
  forgotButton: { alignSelf: 'flex-end', marginTop: -5 },
  forgotText: { color: palette.inkMuted, fontSize: 11, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.line },
  dividerLabel: { color: palette.inkMuted, fontSize: 10, fontWeight: '800' },
  messageRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 6 },
  message: { color: '#FF769F', flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  noticeRow: {
    alignItems: 'flex-start',
    backgroundColor: '#F4FBE4',
    borderColor: '#D5E9A7',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 7,
    padding: spacing.sm,
  },
  notice: { color: '#496300', flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  switchPrompt: { color: palette.inkMuted, fontSize: 12 },
  switchAction: { color: palette.pink, fontSize: 12, fontWeight: '900' },
});
