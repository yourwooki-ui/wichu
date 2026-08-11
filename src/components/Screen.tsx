import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/components/ThemeProvider';

type ScreenProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}>;

export function Screen({ children, style, padded = true }: ScreenProps) {
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.content, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1 },
  padded: { paddingHorizontal: 20 },
});
