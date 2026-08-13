import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { spacing } from '@/constants/theme';

type ConsentRowProps = {
  checked: boolean;
  dark?: boolean;
  label: string;
  onPress: () => void;
};

export function ConsentRow({ checked, dark = false, label, onPress }: ConsentRowProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Ionicons
        name={checked ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={checked ? theme.colors.primary : theme.colors.textMuted}
      />
      <Text style={[styles.label, { color: dark ? '#A1A1AA' : theme.colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  label: { flex: 1, paddingTop: 2, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.68 },
});
