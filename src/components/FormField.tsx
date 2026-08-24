import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { radius, spacing, touchSlop, typography } from '@/constants/theme';

type FormFieldProps = TextInputProps & {
  /** 이 필드에서 잘못된 값. 지정하면 테두리와 안내문이 오류 상태로 바뀐다. */
  error?: string | null;
  hidePasswordLabel?: string;
  hint?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  label: string;
  /** 값이 유효할 때 보여줄 확인 문구 (예: 만 나이). */
  success?: string | null;
  showPasswordLabel?: string;
  tone?: 'default' | 'dark';
};

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  {
    error,
    label,
    hint,
    icon,
    success,
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
  const backgroundColor = isDark ? '#1C1C21' : theme.colors.surface;
  const idleBorder = isDark ? '#34343B' : theme.colors.border;
  // 오류는 포커스보다 우선한다. 입력 중에도 무엇이 잘못됐는지 계속 보이게 한다.
  const borderColor = error ? theme.colors.danger : focused ? theme.colors.primary : idleBorder;

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
          aria-invalid={Boolean(error)}
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
            hitSlop={touchSlop.icon}
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
      {error ? (
        <View style={styles.noteRow}>
          <Ionicons color={theme.colors.danger} name="alert-circle" size={14} />
          <Text style={[styles.note, { color: theme.colors.danger }]}>{error}</Text>
        </View>
      ) : success ? (
        <View style={styles.noteRow}>
          <Ionicons color={theme.colors.primary} name="checkmark-circle" size={14} />
          <Text style={[styles.note, { color: theme.colors.primary }]}>{success}</Text>
        </View>
      ) : hint ? (
        <Text style={[styles.note, { color: mutedColor }]}>{hint}</Text>
      ) : null}
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
  noteRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 5 },
  note: { ...typography.caption, flex: 1, fontSize: 12, lineHeight: 17 },
  visibilityButton: { padding: 2 },
  pressed: { opacity: 0.55 },
});
