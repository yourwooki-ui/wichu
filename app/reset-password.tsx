import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
      .catch(() => setMessage('변경 링크가 만료되었거나 이미 사용됐어요.'))
      .finally(() => setPreparing(false));
  }, [session, url]);

  const submit = async () => {
    if (!session) return setMessage('이메일의 변경 링크를 다시 열어 주세요.');
    if (password.length < 8) return setMessage('새 비밀번호는 8자 이상이어야 해요.');
    if (password !== confirmation) return setMessage('두 비밀번호가 서로 달라요.');

    setBusy(true);
    setMessage(null);
    const { error } = await authService.updatePassword(password);
    if (error) {
      setBusy(false);
      setMessage('비밀번호를 변경하지 못했어요. 새 링크를 요청해 주세요.');
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
          <Text style={styles.title}>새 비밀번호를 정해요.</Text>
          <Text style={styles.body}>
            다른 서비스에서 사용하지 않는 8자 이상의 비밀번호를 권장해요.
          </Text>
          {preparing ? (
            <View style={styles.preparing}>
              <ActivityIndicator color={palette.pink} />
              <Text style={styles.preparingText}>안전한 변경 링크를 확인하는 중…</Text>
            </View>
          ) : (
            <>
              <FormField
                autoCapitalize="none"
                autoComplete="new-password"
                hidePasswordLabel="비밀번호 숨기기"
                label="새 비밀번호"
                onChangeText={setPassword}
                placeholder="8자 이상 입력"
                secureTextEntry
                showPasswordLabel="비밀번호 보기"
                tone="dark"
                value={password}
              />
              <FormField
                autoCapitalize="none"
                autoComplete="new-password"
                hidePasswordLabel="비밀번호 숨기기"
                label="새 비밀번호 확인"
                onChangeText={setConfirmation}
                placeholder="한 번 더 입력"
                secureTextEntry
                showPasswordLabel="비밀번호 보기"
                tone="dark"
                value={confirmation}
              />
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <PrimaryButton
                disabled={busy || !session}
                label="비밀번호 변경"
                loading={busy}
                onPress={submit}
              />
              {!session ? (
                <PrimaryButton
                  label="새 변경 링크 요청"
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
