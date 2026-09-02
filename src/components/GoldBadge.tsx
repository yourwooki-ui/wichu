import { StyleSheet, Text, View } from 'react-native';

import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius, typography } from '@/constants/theme';

type GoldBadgeProps = {
  /** 작은 카드 우측 상단처럼 공간이 좁은 곳에서는 등급 심볼만 표시한다. */
  iconOnly?: boolean;
  /** `sm`은 목록 타일, `md`는 상세/스와이프 카드처럼 큰 표면에 쓴다. */
  size?: 'sm' | 'md';
  /** 상세 화면처럼 공간이 넉넉하면 전체 명칭을 쓴다. */
  label?: 'GOLD' | 'GOLD PASS';
};

/**
 * Gold Pass 표시.
 *
 * 이전에는 Discover 카드·Matches 타일·프로필 상세가 각자 배지를 들고 있어
 * 배경, 테두리 유무, 금색, 라벨이 화면마다 달랐다. 규격을 하나로 모은다.
 */
export function GoldBadge({ iconOnly = false, label = 'GOLD', size = 'sm' }: GoldBadgeProps) {
  const compact = size === 'sm';

  return (
    <View
      accessibilityLabel="Gold Pass 사용자"
      style={[
        styles.badge,
        compact ? styles.badgeSm : styles.badgeMd,
        iconOnly && (compact ? styles.iconOnlySm : styles.iconOnlyMd),
      ]}
    >
      <IllustratedIcon size={compact ? 20 : 24} source={illustratedIcons.goldPremium} />
      {!iconOnly ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: palette.goldSurface,
    borderColor: palette.goldLine,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  badgeSm: { gap: 4, height: 26, paddingLeft: 4, paddingRight: 9 },
  badgeMd: { gap: 5, height: 32, paddingLeft: 5, paddingRight: 11 },
  iconOnlySm: { justifyContent: 'center', paddingHorizontal: 2, width: 26 },
  iconOnlyMd: { justifyContent: 'center', paddingHorizontal: 3, width: 32 },
  label: { ...typography.overline, color: palette.goldText, letterSpacing: 0.9 },
});
