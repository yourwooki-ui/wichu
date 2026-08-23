import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { palette } from '@/constants/theme';
import { authService } from '@/features/auth/services/auth-service';

export default function ForgotPasswordRoute() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      setMessage('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await authService.requestPasswordReset(normalizedEmail);
    setBusy(false);
    if (error) {
      setMessage('메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
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
          accessibilityLabel="뒤로"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons color={palette.white} name="arrow-back" size={20} />
        </Pressable>
        <View style={styles.content}>
          <BrandWordmark size={26} />
          <Text style={styles.title}>
            {sent ? '메일을 확인해 주세요.' : '비밀번호를 다시 설정해요.'}
          </Text>
          <Text style={styles.body}>
            {sent
              ? '가입한 이메일로 비밀번호 변경 링크를 보냈어요. 링크는 한 번만 사용할 수 있습니다.'
              : '가입한 이메일을 입력하면 안전한 비밀번호 변경 링크를 보내드려요.'}
          </Text>
          {sent ? (
            <PrimaryButton label="로그인으로 돌아가기" onPress={() => router.replace('/login')} />
          ) : (
            <>
              <FormField
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                label="이메일"
                onChangeText={setEmail}
                placeholder="you@example.com"
                tone="dark"
                value={email}
              />
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <PrimaryButton
                disabled={busy}
                label="변경 링크 보내기"
                loading={busy}
                onPress={submit}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { alignItems: 'center', backgroundColor: '#08080A', flex: 1 },
  page: { flex: 1, maxWidth: 430, width: '100%' },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: 10, width: 44 },
  content: { flex: 1, gap: 18, justifyContent: 'center', padding: 22, paddingBottom: 84 },
  title: { color: palette.white, fontSize: 29, fontWeight: '900', letterSpacing: -0.8 },
  body: { color: '#9B9BA4', fontSize: 13, lineHeight: 20, marginBottom: 6 },
  message: { color: '#FF769F', fontSize: 12, fontWeight: '700', lineHeight: 17 },
});
