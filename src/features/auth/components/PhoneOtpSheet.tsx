import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { InteractiveBottomSheet } from '@/components/InteractiveBottomSheet';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { palette, radius, spacing, touchSlop, typography } from '@/constants/theme';
import { authService } from '@/features/auth/services/auth-service';
import { getDefaultCallingCode, normalizePhoneNumber } from '@/features/auth/utils/phone-number';
import { useActiveClock } from '@/hooks/use-active-clock';
import { getAppLanguage } from '@/i18n';
import { reportOperationalError } from '@/services/operational-error-service';
import { productAnalyticsService } from '@/services/product-analytics-service';

type PhoneOtpSheetProps = {
  birthDate?: string;
  mode: 'sign-in' | 'sign-up';
  onClose: () => void;
  onVerified: () => void;
  visible: boolean;
};

type OtpStep = 'number' | 'code';

function isRateLimitError(error: unknown) {
  const candidate = error as { message?: unknown; status?: unknown };
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';
  return candidate?.status === 429 || message.includes('rate limit') || message.includes('seconds');
}

export function PhoneOtpSheet({
  birthDate,
  mode,
  onClose,
  onVerified,
  visible,
}: PhoneOtpSheetProps) {
  const { t } = useTranslation();
  const codeRef = useRef<TextInput>(null);
  const [step, setStep] = useState<OtpStep>('number');
  const [callingCode, setCallingCode] = useState(() => getDefaultCallingCode(getAppLanguage()));
  const [nationalNumber, setNationalNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const countdownNow = useActiveClock(500, Boolean(resendAvailableAt));
  const remainingSeconds = Math.max(0, Math.ceil((resendAvailableAt - countdownNow) / 1000));

  async function requestCode(isResend = false) {
    if (loading) return;
    const normalizedPhone = isResend ? phone : normalizePhoneNumber(callingCode, nationalNumber);
    if (!normalizedPhone) {
      setErrorMessage(t('phoneAuth.invalidPhone'));
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const { error } = await authService.requestPhoneOtp({
        birthDate: mode === 'sign-up' ? birthDate : undefined,
        phone: normalizedPhone,
        shouldCreateUser: mode === 'sign-up',
      });
      if (error) throw error;

      setPhone(normalizedPhone);
      setCode('');
      setStep('code');
      setResendAvailableAt(Date.now() + 60_000);
      productAnalyticsService.track('phone_otp_requested', { mode }, '/login');
      requestAnimationFrame(() => codeRef.current?.focus());
    } catch (requestError) {
      reportOperationalError('phone_otp_request', requestError, '/login');
      setErrorMessage(
        t(isRateLimitError(requestError) ? 'phoneAuth.rateLimited' : 'phoneAuth.requestFailed'),
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (loading) return;
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage(t('phoneAuth.invalidCode'));
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const { error } = await authService.verifyPhoneOtp(phone, code);
      if (error) throw error;
      productAnalyticsService.track('phone_otp_verified', { mode }, '/login');
      onVerified();
    } catch (verifyError) {
      reportOperationalError('phone_otp_verify', verifyError, '/login');
      setErrorMessage(t('phoneAuth.verifyFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <InteractiveBottomSheet
      accessibilityLabel={t(mode === 'sign-up' ? 'phoneAuth.signUpTitle' : 'phoneAuth.signInTitle')}
      dismissEnabled={!loading}
      onClose={onClose}
      visible={visible}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardFocusOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <Ionicons color={palette.pink} name="chatbubble-ellipses-outline" size={20} />
          </View>
          <Pressable
            accessibilityLabel={t('phoneAuth.close')}
            accessibilityRole="button"
            disabled={loading}
            hitSlop={touchSlop.icon}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons color={palette.inkMuted} name="close" size={22} />
          </Pressable>
        </View>

        <Text style={styles.title}>
          {t(
            step === 'code'
              ? 'phoneAuth.codeTitle'
              : mode === 'sign-up'
                ? 'phoneAuth.signUpTitle'
                : 'phoneAuth.signInTitle',
          )}
        </Text>
        <Text style={styles.body}>
          {step === 'code' ? t('phoneAuth.codeBody', { phone }) : t('phoneAuth.numberBody')}
        </Text>

        {step === 'number' ? (
          <View style={styles.fields}>
            <FormField
              autoCapitalize="none"
              inputMode="tel"
              keyboardType="phone-pad"
              label={t('phoneAuth.callingCode')}
              maxLength={4}
              onChangeText={(value) => {
                setCallingCode(value.startsWith('+') ? value : `+${value.replaceAll(/\D/g, '')}`);
                setErrorMessage(null);
              }}
              placeholder={t('phoneAuth.callingCodePlaceholder')}
              value={callingCode}
            />
            <FormField
              autoComplete="tel"
              inputMode="tel"
              keyboardType="phone-pad"
              label={t('phoneAuth.phoneNumber')}
              maxLength={22}
              onChangeText={(value) => {
                setNationalNumber(value);
                setErrorMessage(null);
              }}
              onSubmitEditing={() => void requestCode()}
              placeholder={t('phoneAuth.phoneNumberPlaceholder')}
              returnKeyType="send"
              value={nationalNumber}
            />
          </View>
        ) : (
          <View style={styles.fields}>
            <FormField
              ref={codeRef}
              autoComplete="sms-otp"
              inputMode="numeric"
              keyboardType="number-pad"
              label={t('phoneAuth.verificationCode')}
              maxLength={6}
              onChangeText={(value) => {
                setCode(value.replaceAll(/\D/g, '').slice(0, 6));
                setErrorMessage(null);
              }}
              onSubmitEditing={() => void verifyCode()}
              placeholder={t('phoneAuth.codePlaceholder')}
              returnKeyType="done"
              textContentType="oneTimeCode"
              value={code}
            />
            <View style={styles.secondaryActions}>
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                hitSlop={touchSlop.link}
                onPress={() => {
                  setStep('number');
                  setCode('');
                  setErrorMessage(null);
                }}
              >
                <Text style={styles.link}>{t('phoneAuth.changeNumber')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={loading || remainingSeconds > 0}
                hitSlop={touchSlop.link}
                onPress={() => void requestCode(true)}
              >
                <Text style={[styles.link, remainingSeconds > 0 && styles.linkDisabled]}>
                  {remainingSeconds > 0
                    ? t('phoneAuth.resendIn', { seconds: remainingSeconds })
                    : t('phoneAuth.resend')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {errorMessage ? (
          <View accessibilityLiveRegion="polite" style={styles.errorRow}>
            <Ionicons color={palette.danger} name="alert-circle" size={15} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <PrimaryButton
          disabled={loading}
          label={t(step === 'number' ? 'phoneAuth.sendCode' : 'phoneAuth.verify')}
          loading={loading}
          onPress={() => void (step === 'number' ? requestCode() : verifyCode())}
        />
      </KeyboardAwareScrollView>
    </InteractiveBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  closeButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  pressed: { opacity: 0.56 },
  title: { ...typography.title, color: palette.ink },
  body: { ...typography.bodySm, color: palette.inkMuted },
  fields: { gap: spacing.md },
  secondaryActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  link: { ...typography.label, color: palette.pink },
  linkDisabled: { color: palette.inkMuted },
  errorRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.xs },
  errorText: { ...typography.caption, color: palette.danger, flex: 1 },
});
