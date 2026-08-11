import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';
import { spacing } from '@/constants/theme';
import { SwipeDeck } from '@/features/discover/components/SwipeDeck';

export function DiscoverScreen() {
  const theme = useAppTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>WICHU</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Discover</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open discovery filters"
          style={[
            styles.filterButton,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Ionicons name="options-outline" size={22} color={theme.colors.text} />
        </Pressable>
      </View>
      <SwipeDeck />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 1.8 },
  title: { marginTop: 1, fontSize: 24, lineHeight: 28, fontWeight: '800' },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockLabel: { marginBottom: spacing.xs },
});
