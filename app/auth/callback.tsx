import { Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { authService } from '@/features/auth/services/auth-service';
import { useAuthSession } from '@/hooks/use-auth-session';

export default function AuthCallbackRoute() {
  const theme = useAppTheme();
  const { session, profileCompleted } = useAuthSession();
  const url = Linking.useURL();
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!url) return;
    void authService
      .createSessionFromUrl(url)
      .catch(() => undefined)
      .finally(() => setFinished(true));
  }, [url]);

  if (session) {
    return <Redirect href={profileCompleted ? '/(tabs)/discover' : '/profile-setup'} />;
  }
  if (finished) return <Redirect href="/login" />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>
        Confirming your account…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { fontSize: 14, fontWeight: '700' },
});
