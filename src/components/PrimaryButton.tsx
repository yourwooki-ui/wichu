import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useAppTheme } from '@/components/ThemeProvider';
import { palette, radius, spacing, typography } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * `primary` 하나만 브랜드 핑크를 쓴다.
 * 브랜드 규칙상 한 화면에서 강한 핑크 CTA는 하나여야 하므로,
 * 나란히 놓이는 두 번째 행동은 `secondary` 또는 `ghost`를 쓴다.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

type PrimaryButtonProps = {
  disabled?: boolean;
  /** 라벨 앞에 놓이는 Ionicons 이름 */
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  loading?: boolean;
  onPress: () => void;
  size?: 'md' | 'sm';
  /** 다크 배경(인증 화면)에서는 `dark`. `FormField`의 tone 규약과 같다. */
  tone?: 'default' | 'dark';
  variant?: ButtonVariant;
};

export function PrimaryButton({
  disabled,
  icon,
  label,
  loading,
  onPress,
  size = 'md',
  tone = 'default',
  variant = 'primary',
}: PrimaryButtonProps) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;
  const { background, border, foreground } = variantColors(variant, tone, theme);
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.get() * 0.08,
    transform: [{ scale: 1 - pressed.get() * 0.025 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: Boolean(isDisabled) }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        if (!isDisabled) {
          pressed.set(reduceMotion ? 1 : withSpring(1, { damping: 18, stiffness: 320 }));
        }
      }}
      onPressOut={() =>
        pressed.set(reduceMotion ? 0 : withSpring(0, { damping: 17, stiffness: 280 }))
      }
      style={[
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: background },
        border ? { borderColor: border, borderWidth: StyleSheet.hairlineWidth } : null,
        isDisabled && styles.disabled,
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons color={foreground} name={icon} size={size === 'sm' ? 15 : 17} /> : null}
          <Text
            style={[
              size === 'sm' ? typography.label : typography.subheading,
              { color: foreground },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

function variantColors(
  variant: ButtonVariant,
  tone: 'default' | 'dark',
  theme: ReturnType<typeof useAppTheme>,
) {
  const onSurface = tone === 'dark' ? palette.white : theme.colors.text;
  const mutedOnSurface = tone === 'dark' ? palette.darkMuted : theme.colors.textMuted;
  const outlineBorder = tone === 'dark' ? palette.darkLine : theme.colors.border;

  if (variant === 'secondary') {
    const background = tone === 'dark' ? palette.darkSurface : theme.colors.surface;
    return { background, border: outlineBorder, foreground: onSurface };
  }
  if (variant === 'outline') {
    return { background: 'transparent', border: outlineBorder, foreground: onSurface };
  }
  if (variant === 'ghost') {
    return { background: 'transparent', border: undefined, foreground: mutedOnSurface };
  }
  if (variant === 'danger') {
    return { background: theme.colors.danger, border: undefined, foreground: palette.white };
  }
  return { background: theme.colors.primary, border: undefined, foreground: palette.white };
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  buttonSm: { borderRadius: radius.sm, minHeight: 44 },
  content: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  disabled: { opacity: 0.48 },
});
