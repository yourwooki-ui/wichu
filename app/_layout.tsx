import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { ThemeProvider, useAppTheme } from '@/components/ThemeProvider';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { BrandWordmark } from '@/components/BrandWordmark';
import { NativePreviewFrame } from '@/components/NativePreviewFrame';
import { QueryLifecycleManager } from '@/components/QueryLifecycleManager';
import { GlobalInAppNotificationHost } from '@/components/GlobalInAppNotificationHost';
import { StateView } from '@/components/StateView';
import { palette } from '@/constants/theme';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useProfileLocationSync } from '@/features/profile/hooks/use-profile-location-sync';
import { queryClient } from '@/lib/query-client';
import { useNotificationObserver } from '@/services/use-notification-observer';
import { PostProfileOnboardingCoordinator } from '@/features/onboarding/components/PostProfileOnboardingCoordinator';
import { useMonetizationBootstrap } from '@/features/monetization/hooks/use-monetization-bootstrap';
import i18n, { getAppLanguage, getAppTextDirection, hydrateAppLanguage, i18nReady } from '@/i18n';
import { productAnalyticsService } from '@/services/product-analytics-service';

// 스플래시 설정도 모듈 평가 시점의 네이티브 호출이다. 여기서 예외가 나면
// 화면이 뜨기 전에 앱이 죽으므로, 실패해도 앱은 계속 열리게 감싼다.
try {
  SplashScreen.setOptions({ duration: 240, fade: true });
} catch {
  // 스플래시 연출은 없어도 앱 실행에 지장이 없다.
}
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppLaunchSurface() {
  const theme = useAppTheme();

  return (
    <View
      accessibilityLabel="WICHU를 여는 중"
      accessibilityRole="progressbar"
      style={[styles.launchSurface, { backgroundColor: theme.colors.background }]}
    >
      <BrandWordmark color={theme.colors.text} size={34} />
      <ActivityIndicator color={palette.pink} size="small" style={styles.launchIndicator} />
    </View>
  );
}

function RootNavigator() {
  const theme = useAppTheme();
  const { session, profileCompleted, profileLoadError, refreshProfile, adminRole, isLoading } =
    useAuthSession();
  const { t } = useTranslation();
  const openedForUserRef = useRef<string | null>(null);
  useProfileLocationSync();
  useNotificationObserver(Boolean(session) && profileCompleted);
  useMonetizationBootstrap(session?.user.id);

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync().catch(() => undefined);
  }, [isLoading]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!profileCompleted || !userId || openedForUserRef.current === userId) return;
    openedForUserRef.current = userId;
    productAnalyticsService.track('app_opened', undefined, '/');
  }, [profileCompleted, session?.user.id]);

  if (isLoading) return <AppLaunchSurface />;

  if (session && profileLoadError) {
    return (
      <View style={[styles.recoverySurface, { backgroundColor: theme.colors.background }]}>
        <StateView
          actionLabel={t('reliability.retry')}
          body={t('reliability.authBody')}
          illustration={illustratedIcons.connectionError}
          onAction={() => void refreshProfile()}
          title={t('reliability.authTitle')}
          tone="error"
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="legal/[document]" />
        {/* Play Console 데이터 안전 섹션에 등록하는 공개 삭제 안내. 인증 밖이어야 한다. */}
        <Stack.Screen name="account-deletion" />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="profile-setup" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session) && profileCompleted}>
          <Stack.Screen name="tutorial" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile-edit" />
          <Stack.Screen name="profile-preview" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="chat/[matchId]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="blocked-users" />
          <Stack.Screen name="support" />
          <Stack.Screen name="ad-free" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session) && Boolean(adminRole)}>
          <Stack.Screen name="operations" />
        </Stack.Protected>
      </Stack>
      <PostProfileOnboardingCoordinator
        key={session?.user.id ?? 'signed-out'}
        profileCompleted={profileCompleted}
        userId={session?.user.id}
      />
      {session?.user.id && profileCompleted ? (
        <GlobalInAppNotificationHost userId={session.user.id} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  launchIndicator: { marginTop: 22, opacity: 0.78 },
  launchSurface: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  recoverySurface: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
});

export default function RootLayout() {
  const [languageReady, setLanguageReady] = useState(false);
  const [language, setLanguage] = useState(getAppLanguage());

  useEffect(() => {
    let mounted = true;
    let hydrationTimer: ReturnType<typeof setTimeout> | undefined;
    const syncLanguage = () => setLanguage(getAppLanguage());

    i18n.on('languageChanged', syncLanguage);
    void i18nReady.then(() => {
      if (!mounted) return;
      syncLanguage();
      setLanguageReady(true);

      // 번역 리소스가 React에 연결되고 첫 화면이 그려진 뒤에만 네이티브
      // 저장소를 읽는다. 저장 언어 복원 실패가 앱 시작을 막지 않게 분리한다.
      hydrationTimer = setTimeout(() => {
        void hydrateAppLanguage().then(() => {
          if (mounted) syncLanguage();
        });
      }, 0);
    });

    return () => {
      mounted = false;
      if (hydrationTimer) clearTimeout(hydrationTimer);
      i18n.off('languageChanged', syncLanguage);
    };
  }, []);

  if (!languageReady) return <AppLaunchSurface />;

  return (
    <GestureHandlerRootView style={{ direction: getAppTextDirection(language), flex: 1 }}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
              <QueryLifecycleManager />
              <AuthProvider>
                <ThemeProvider>
                  <NativePreviewFrame>
                    <RootNavigator />
                  </NativePreviewFrame>
                </ThemeProvider>
              </AuthProvider>
            </QueryClientProvider>
          </I18nextProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
