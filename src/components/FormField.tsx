import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { radius, spacing } from '@/constants/theme';

type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  tone?: 'default' | 'dark';
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
};

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  {
    label,
    hint,
    icon,
    tone = 'default',
    showPasswordLabel = 'Show password',
    hidePasswordLabel = 'Hide password',
    secureTextEntry,
    onFocus,
    onBlur,
    style,
    ...props
  },
  ref,
) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [passwordHidden, setPasswordHidden] = useState(Boolean(secureTextEntry));
  const isDark = tone === 'dark';
  const labelColor = isDark ? '#F6F6F7' : theme.colors.text;
  const mutedColor = isDark ? '#85858F' : theme.colors.textMuted;
  const borderColor = focused ? theme.colors.primary : isDark ? '#34343B' : theme.colors.border;
  const backgroundColor = isDark ? '#1C1C21' : theme.colors.surface;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <View style={[styles.inputShell, { borderColor, backgroundColor }]}>
        {icon ? (
          <Ionicons name={icon} size={18} color={focused ? theme.colors.primary : mutedColor} />
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={props.accessibilityLabel ?? label}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={mutedColor}
          secureTextEntry={secureTextEntry ? passwordHidden : false}
          selectionColor={theme.colors.primary}
          style={[styles.input, { color: labelColor }, style]}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordHidden ? showPasswordLabel : hidePasswordLabel}
            hitSlop={8}
            onPress={() => setPasswordHidden((value) => !value)}
            style={({ pressed }) => [styles.visibilityButton, pressed && styles.pressed]}
          >
            <Ionicons
              name={passwordHidden ? 'eye-outline' : 'eye-off-outline'}
              size={19}
              color={mutedColor}
            />
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={[styles.hint, { color: mutedColor }]}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: 12, fontWeight: '900', letterSpacing: 0.1 },
  inputShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  input: {
    minWidth: 0,
    minHeight: 52,
    flex: 1,
    padding: 0,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: { fontSize: 12, lineHeight: 17 },
  visibilityButton: { padding: 2 },
  pressed: { opacity: 0.55 },
});
