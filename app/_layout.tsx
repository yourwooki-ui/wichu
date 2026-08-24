import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, useAppTheme } from '@/components/ThemeProvider';
import { NativePreviewFrame } from '@/components/NativePreviewFrame';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useProfileLocationSync } from '@/features/profile/hooks/use-profile-location-sync';
import { queryClient } from '@/lib/query-client';
import { useNotificationObserver } from '@/services/use-notification-observer';
import { PostProfileOnboardingCoordinator } from '@/features/onboarding/components/PostProfileOnboardingCoordinator';
import i18n, { getAppLanguage, getAppTextDirection, i18nReady } from '@/i18n';

SplashScreen.setOptions({ duration: 450, fade: true });
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const theme = useAppTheme();
  const { session, profileCompleted, adminRole, isLoading } = useAuthSession();
  useProfileLocationSync();
  useNotificationObserver(Boolean(session) && profileCompleted);

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync().catch(() => undefined);
  }, [isLoading]);

  if (isLoading) return null;

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
    </>
  );
}

export default function RootLayout() {
  const [languageReady, setLanguageReady] = useState(false);
  const [language, setLanguage] = useState(getAppLanguage());

  useEffect(() => {
    let mounted = true;
    const syncLanguage = () => setLanguage(getAppLanguage());

    void i18nReady.finally(() => {
      if (!mounted) return;
      syncLanguage();
      setLanguageReady(true);
    });
    i18n.on('languageChanged', syncLanguage);

    return () => {
      mounted = false;
      i18n.off('languageChanged', syncLanguage);
    };
  }, []);

  if (!languageReady) return null;

  return (
    <GestureHandlerRootView style={{ direction: getAppTextDirection(language), flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider>
              <NativePreviewFrame>
                <RootNavigator />
              </NativePreviewFrame>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
