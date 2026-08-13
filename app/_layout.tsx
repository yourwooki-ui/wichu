import '@/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useAppTheme } from '@/components/ThemeProvider';
import { NativePreviewFrame } from '@/components/NativePreviewFrame';
import { AppPermissionOnboarding } from '@/components/AppPermissionOnboarding';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { useAuthSession } from '@/hooks/use-auth-session';
import { queryClient } from '@/lib/query-client';

SplashScreen.setOptions({ duration: 450, fade: true });

function RootNavigator() {
  const theme = useAppTheme();
  const { session, profileCompleted, isLoading } = useAuthSession();

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
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="profile-setup" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session) && profileCompleted}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="chat/[matchId]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="ad-free" />
        </Stack.Protected>
      </Stack>
      {session && profileCompleted ? <AppPermissionOnboarding /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
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
  );
}
