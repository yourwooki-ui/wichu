import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { duration, radius, spacing } from '@/constants/theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * 로딩 중 실제 콘텐츠와 같은 골격을 먼저 그려주는 shimmer 블록.
 *
 * spinner 하나로 화면 전체를 비워두는 대신 최종 레이아웃을 미리 보여줘서
 * 데이터가 도착할 때 화면이 튀지 않게 한다.
 */
export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: duration.shimmer,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: duration.shimmer,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { backgroundColor: theme.isDark ? '#1E1E24' : '#E4E4EA' },
        style,
        { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) },
      ]}
    />
  );
}

/** 텍스트 한 줄 자리. `width`로 자연스러운 길이 편차를 준다. */
export function SkeletonLine({
  height = 12,
  width,
  style,
}: {
  height?: number;
  width?: ViewStyle['width'];
  style?: ViewStyle;
}) {
  return <Skeleton style={{ borderRadius: height / 2, height, width, ...style }} />;
}

/** 아바타 자리. */
export function SkeletonCircle({ size }: { size: number }) {
  return <Skeleton style={{ borderRadius: size / 2, height: size, width: size }} />;
}

/**
 * Matches 그리드 로딩 골격.
 * 실제 타일과 같은 2열·aspectRatio를 써서 데이터 도착 시 위치가 유지된다.
 */
export function ConnectionGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View
      accessibilityLabel="연결을 불러오는 중"
      accessibilityRole="progressbar"
      style={styles.grid}
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} style={styles.gridTile} />
      ))}
    </View>
  );
}

/** Chat 목록 로딩 골격. 실제 행과 같은 높이·간격을 유지한다. */
export function ChatRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View accessibilityLabel="대화를 불러오는 중" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.chatRow}>
          <SkeletonCircle size={58} />
          <View style={styles.chatRowCopy}>
            <SkeletonLine width={index % 2 === 0 ? '42%' : '32%'} />
            <SkeletonLine height={11} style={{ marginTop: spacing.xs }} width="76%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** 채팅방의 상대 프로필 헤더·메시지·입력창을 같은 프레임에 먼저 표시한다. */
export function ChatRoomSkeleton() {
  return (
    <View
      accessibilityLabel="대화방을 불러오는 중"
      accessibilityRole="progressbar"
      style={styles.chatRoom}
    >
      <View style={styles.chatRoomHeader}>
        <SkeletonCircle size={42} />
        <View style={styles.chatRoomHeaderCopy}>
          <SkeletonLine height={14} width="36%" />
          <SkeletonLine height={10} style={{ marginTop: 7 }} width="24%" />
        </View>
        <SkeletonCircle size={34} />
      </View>
      <View style={styles.chatRoomMessages}>
        <Skeleton style={[styles.chatBubble, styles.chatBubbleReceived]} />
        <Skeleton style={[styles.chatBubble, styles.chatBubbleSent]} />
        <Skeleton style={[styles.chatBubbleShort, styles.chatBubbleReceived]} />
      </View>
      <View style={styles.chatRoomComposer}>
        <SkeletonCircle size={42} />
        <Skeleton style={styles.chatRoomInput} />
        <SkeletonCircle size={42} />
      </View>
    </View>
  );
}

/** 단순 세로 목록(차단 목록, 설정 항목 등) 로딩 골격. */
export function ListRowsSkeleton({ count = 4, height = 72 }: { count?: number; height?: number }) {
  return (
    <View
      accessibilityLabel="목록을 불러오는 중"
      accessibilityRole="progressbar"
      style={styles.rows}
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} style={{ borderRadius: radius.md, height }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.sm, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridTile: { aspectRatio: 0.76, borderRadius: 20, width: '48.6%' },
  chatRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    minHeight: 84,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  chatRowCopy: { flex: 1 },
  chatRoom: { flex: 1 },
  chatRoomHeader: {
    alignItems: 'center',
    borderBottomColor: '#E4E4E8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 68,
    paddingHorizontal: 14,
  },
  chatRoomHeaderCopy: { flex: 1 },
  chatRoomMessages: { flex: 1, gap: 16, paddingHorizontal: 16, paddingTop: 28 },
  chatBubble: { borderRadius: 20, height: 58, width: '68%' },
  chatBubbleShort: { borderRadius: 20, height: 46, width: '48%' },
  chatBubbleReceived: { alignSelf: 'flex-start' },
  chatBubbleSent: { alignSelf: 'flex-end' },
  chatRoomComposer: {
    alignItems: 'center',
    borderTopColor: '#E4E4E8',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 70,
    paddingHorizontal: 12,
  },
  chatRoomInput: { borderRadius: 22, flex: 1, height: 42 },
  rows: { gap: spacing.sm },
});
