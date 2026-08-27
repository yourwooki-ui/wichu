import { Ionicons } from '@expo/vector-icons';
import type { ImageSource } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppTheme } from '@/components/ThemeProvider';
import { elevation, palette, pressFeedback, radius, spacing, typography } from '@/constants/theme';

/** 상태의 성격. 아이콘 배경과 강조색만 달라지고 레이아웃은 같다. */
export type StateTone = 'neutral' | 'error' | 'promo';

type StateViewProps = {
  actionLabel?: string;
  body: string;
  /** `card`는 테두리 있는 surface 위에, `plain`은 배경 없이 렌더링한다. */
  container?: 'card' | 'plain';
  icon?: keyof typeof Ionicons.glyphMap;
  illustration?: ImageSource;
  onAction?: () => void;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
  style?: ViewStyle;
  title: string;
  tone?: StateTone;
};

/**
 * 비어 있음 / 오류 / 잠김 상태를 한 규격으로 그린다.
 *
 * 이전에는 Matches·Chat·차단 목록·Operations가 각자 거의 같은 블록을
 * 조금씩 다른 크기로 들고 있어서 화면을 옮길 때마다 리듬이 흔들렸다.
 */
export function StateView({
  actionLabel,
  body,
  container = 'card',
  icon,
  illustration,
  onAction,
  onSecondaryAction,
  secondaryActionLabel,
  style,
  title,
  tone = 'neutral',
}: StateViewProps) {
  const theme = useAppTheme();
  const accent = toneAccent(tone, theme.colors.primary, theme.colors.danger);

  return (
    <View
      style={[
        styles.container,
        container === 'card' && [
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          elevation.sm,
        ],
        style,
      ]}
    >
      {illustration ? (
        <View style={styles.illustration}>
          <IllustratedIcon size={64} source={illustration} />
        </View>
      ) : icon ? (
        <View style={[styles.icon, { backgroundColor: `${accent}1A` }]}>
          <Ionicons color={accent} name={icon} size={26} />
        </View>
      ) : null}
      <Text style={[typography.subheading, styles.title, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text style={[typography.bodySm, styles.body, { color: theme.colors.textMuted }]}>
        {body}
      </Text>
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <View style={styles.actions}>
          {actionLabel && onAction ? (
            <Pressable
              accessibilityLabel={actionLabel}
              accessibilityRole="button"
              onPress={onAction}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: theme.colors.text },
                pressed && pressFeedback.control,
              ]}
            >
              <Text style={[typography.label, { color: theme.colors.background }]}>
                {actionLabel}
              </Text>
            </Pressable>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Pressable
              accessibilityLabel={secondaryActionLabel}
              accessibilityRole="button"
              onPress={onSecondaryAction}
              style={({ pressed }) => [
                styles.action,
                styles.secondaryAction,
                { borderColor: theme.colors.border },
                pressed && pressFeedback.control,
              ]}
            >
              <Text style={[typography.label, { color: theme.colors.textMuted }]}>
                {secondaryActionLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function toneAccent(tone: StateTone, primary: string, danger: string) {
  if (tone === 'error') return danger;
  if (tone === 'promo') return palette.lime;
  return primary;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 240,
    justifyContent: 'center',
  },
  icon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  illustration: { alignItems: 'center', height: 68, justifyContent: 'center', width: 68 },
  title: { marginTop: spacing.sm, textAlign: 'center' },
  body: { marginTop: spacing.xxs, maxWidth: 280, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  action: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    // 접근성 최소 터치 크기
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  secondaryAction: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth },
});
