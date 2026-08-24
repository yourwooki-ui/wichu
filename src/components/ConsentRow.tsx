import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { spacing, typography } from '@/constants/theme';

type ConsentRowProps = {
  checked: boolean;
  dark?: boolean;
  /** 동의가 필요한데 체크되지 않았을 때의 안내. 지정하면 오류 상태로 그린다. */
  error?: string | null;
  label: string;
  onPress: () => void;
};

export function ConsentRow({ checked, dark = false, error, label, onPress }: ConsentRowProps) {
  const theme = useAppTheme();
  const markColor = error
    ? theme.colors.danger
    : checked
      ? theme.colors.primary
      : theme.colors.textMuted;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons
          name={checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={markColor}
        />
        <Text style={[styles.label, { color: dark ? '#A1A1AA' : theme.colors.textMuted }]}>
          {label}
        </Text>
      </Pressable>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons color={theme.colors.danger} name="alert-circle" size={14} />
          <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  label: { flex: 1, paddingTop: 2, fontSize: 13, lineHeight: 19 },
  errorRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    paddingLeft: 24 + spacing.sm,
  },
  error: { ...typography.caption, flex: 1, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.68 },
});
