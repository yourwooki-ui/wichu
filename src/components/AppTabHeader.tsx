import type { ImageSource } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandWordmark } from '@/components/BrandWordmark';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { AmbientIconMotion, type IconMotion } from '@/components/MotionIllustratedIcon';
import { useAppTheme } from '@/components/ThemeProvider';
import { palette, pressFeedback, radius, typography } from '@/constants/theme';

type AppTabHeaderProps = {
  actionAccessibilityLabel?: string;
  actionIcon?: ImageSource;
  actionMotion?: IconMotion;
  eyebrow: string;
  onAction?: () => void;
};

export function AppTabHeader({
  actionAccessibilityLabel,
  actionIcon,
  actionMotion,
  eyebrow,
  onAction,
}: AppTabHeaderProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.header}>
      <View>
        <BrandWordmark color={theme.colors.text} size={23} />
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowKeyline} />
          <Text
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            style={[typography.overline, styles.eyebrow, { color: theme.colors.textMuted }]}
          >
            {eyebrow}
          </Text>
        </View>
      </View>
      {actionIcon && onAction ? (
        <Pressable
          accessibilityLabel={actionAccessibilityLabel}
          accessibilityRole="button"
          hitSlop={4}
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            pressed && pressFeedback.icon,
          ]}
        >
          {actionMotion ? (
            <AmbientIconMotion motion={actionMotion}>
              <IllustratedIcon size={42} source={actionIcon} />
            </AmbientIconMotion>
          ) : (
            <IllustratedIcon size={42} source={actionIcon} />
          )}
        </Pressable>
      ) : actionIcon ? (
        <View
          accessibilityElementsHidden
          style={[
            styles.action,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {actionMotion ? (
            <AmbientIconMotion motion={actionMotion}>
              <IllustratedIcon size={42} source={actionIcon} />
            </AmbientIconMotion>
          ) : (
            <IllustratedIcon size={42} source={actionIcon} />
          )}
        </View>
      ) : (
        <View style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 76,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 3 },
  eyebrowKeyline: { backgroundColor: palette.pink, borderRadius: 2, height: 3, width: 18 },
  eyebrow: { letterSpacing: 1.65 },
  action: {
    alignItems: 'center',
    borderRadius: radius.brand,
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
});
