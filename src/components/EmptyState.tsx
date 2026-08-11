import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { spacing } from '@/constants/theme';

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.icon, { backgroundColor: `${theme.colors.primary}16` }]}>
        <Ionicons name={icon} size={30} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.textMuted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  description: {
    marginTop: spacing.xs,
    maxWidth: 280,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
