import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';

type PlaceholderScreenProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

export function PlaceholderScreen({ icon, title, description }: PlaceholderScreenProps) {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{title}</Text>
        <View style={styles.spacer} />
      </View>
      <EmptyState icon={icon} title={title} description={description} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 52, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  spacer: { width: 26 },
});
