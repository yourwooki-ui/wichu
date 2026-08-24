import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppViewport } from '@/components/NativePreviewFrame';
import { Skeleton, SkeletonLine } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { useAppTheme } from '@/components/ThemeProvider';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius, spacing, typography } from '@/constants/theme';
import { ProfileCard } from '@/features/discover/components/ProfileCard';
import { useProfilePrefetch } from '@/features/discover/hooks/use-profile-prefetch';
import { Profile, SwipeAction } from '@/types/profile';

const SWIPE_THRESHOLD = 96;
const SWIPE_VELOCITY_THRESHOLD = 0.65;
const SWIPE_MIN_DISTANCE = 28;
const DOUBLE_TAP_DELAY = 260;

type SwipeDeckProps = {
  profiles: Profile[];
  isLoading: boolean;
  error: string | null;
  onAdjustFilters: () => void;
  onSwipe: (profile: Profile, action: SwipeAction) => void;
  onRetry: () => void;
};

export function SwipeDeck({
  profiles,
  isLoading,
  error,
  onAdjustFilters,
  onSwipe,
  onRetry,
}: SwipeDeckProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const { height, width } = useAppViewport();
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pickPulse = useSharedValue(0);
  const interactionLocked = useSharedValue(false);
  const currentProfile = profiles[0];
  const nextProfile = profiles[1];
  const deckHeight = Math.min(620, Math.max(330, height - 242));

  useProfilePrefetch(profiles);

  useEffect(() => {
    const interval = setInterval(() => setPresenceNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const commitSwipe = useCallback(
    (action: SwipeAction) => {
      if (currentProfile) onSwipe(currentProfile, action);
    },
    [currentProfile, onSwipe],
  );

  const openProfile = useCallback(() => {
    if (currentProfile) router.push(`/profile/${currentProfile.id}`);
  }, [currentProfile, router]);

  const startSwipe = useCallback(
    (action: SwipeAction) => {
      if (interactionLocked.get()) return;
      interactionLocked.set(true);
      translateY.set(withTiming(12, { duration: 210 }));
      translateX.set(
        withTiming(
          action === 'like' ? width * 1.35 : -width * 1.35,
          { duration: 210 },
          (finished) => {
            if (finished) runOnJS(commitSwipe)(action);
          },
        ),
      );
    },
    [commitSwipe, interactionLocked, translateX, translateY, width],
  );

  const handleCardPress = useCallback(() => {
    const tappedAt = Date.now();
    const isDoubleTap = tappedAt - lastTapRef.current <= DOUBLE_TAP_DELAY;
    lastTapRef.current = tappedAt;

    if (isDoubleTap) {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
      lastTapRef.current = 0;
      pickPulse.set(
        withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 150 })),
      );
      startSwipe('like');
      return;
    }

    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      lastTapRef.current = 0;
      openProfile();
    }, DOUBLE_TAP_DELAY);
  }, [openProfile, pickPulse, startSwipe]);

  useEffect(
    () => () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    translateX.set(0);
    translateY.set(0);
    pickPulse.set(0);
    interactionLocked.set(false);
  }, [currentProfile?.id, interactionLocked, pickPulse, translateX, translateY]);

  const gesture = useMemo(() => {
    const finishSwipe = (action: SwipeAction) => {
      'worklet';
      if (interactionLocked.get()) return;
      interactionLocked.set(true);
      translateY.set(withTiming(12, { duration: 210 }));
      translateX.set(
        withTiming(
          action === 'like' ? width * 1.35 : -width * 1.35,
          { duration: 210 },
          (finished) => {
            if (finished) runOnJS(commitSwipe)(action);
          },
        ),
      );
    };

    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onUpdate((event) => {
        if (interactionLocked.get()) return;
        translateX.set(event.translationX);
        translateY.set(event.translationY);
      })
      .onEnd((event) => {
        if (interactionLocked.get()) return;
        const isFastRight =
          event.velocityX > SWIPE_VELOCITY_THRESHOLD * 1000 &&
          event.translationX > SWIPE_MIN_DISTANCE;
        const isFastLeft =
          event.velocityX < -SWIPE_VELOCITY_THRESHOLD * 1000 &&
          event.translationX < -SWIPE_MIN_DISTANCE;

        if (event.translationX > SWIPE_THRESHOLD || isFastRight) finishSwipe('like');
        else if (event.translationX < -SWIPE_THRESHOLD || isFastLeft) finishSwipe('pass');
        else {
          translateX.set(withSpring(0, { damping: 18, stiffness: 210 }));
          translateY.set(withSpring(0, { damping: 18, stiffness: 210 }));
        }
      });

    return Gesture.Simultaneous(pan, Gesture.Native());
  }, [commitSwipe, interactionLocked, translateX, translateY, width]);

  const topCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      {
        rotate: `${interpolate(
          translateX.get(),
          [-width, 0, width],
          [-12, 0, 12],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));
  const nextCardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          translateX.get(),
          [-width, 0, width],
          [0, width * 1.05, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const pickPulseStyle = useAnimatedStyle(() => ({
    opacity: pickPulse.get(),
    transform: [{ scale: interpolate(pickPulse.get(), [0, 1], [0.72, 1]) }],
  }));
  const likeDecisionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [15, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const passDecisionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [-SWIPE_THRESHOLD, -15], [1, 0], Extrapolation.CLAMP),
  }));

  if (isLoading) {
    // 실제 카드와 같은 크기·정보 배치로 골격을 그려 데이터 도착 시 화면이 튀지 않게 한다.
    return (
      <View style={styles.container}>
        <View
          accessibilityLabel="새로운 사람을 찾는 중"
          accessibilityRole="progressbar"
          style={[styles.deck, { height: deckHeight }]}
        >
          <Skeleton style={styles.loadingCard} />
          <View style={styles.loadingCopy}>
            <SkeletonLine height={26} width="62%" />
            <SkeletonLine height={13} style={{ marginTop: spacing.xs }} width="42%" />
            <View style={styles.loadingChips}>
              <SkeletonLine height={26} width={76} />
              <SkeletonLine height={26} width={62} />
              <SkeletonLine height={26} width={84} />
            </View>
          </View>
        </View>
        <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>
          새로운 사람을 찾고 있어요
        </Text>
        <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
          사진을 미리 준비해 바로 넘길 수 있게 할게요.
        </Text>
      </View>
    );
  }

  if (!currentProfile) {
    // 오류와 후보 소진은 해야 할 일이 다르다.
    // 오류면 다시 불러오는 게 먼저고, 후보가 없으면 새로고침해도 그대로이므로
    // 조건을 넓히는 쪽을 주 행동으로 둔다.
    return (
      <View style={styles.finished}>
        <StateView
          actionLabel={error ? '다시 시도' : '조건 넓히기'}
          body={
            error ??
            '지금 조건에 맞는 사람을 다 봤어요. 범위를 조금 넓히면 새로운 사람을 만날 수 있어요.'
          }
          container="plain"
          illustration={error ? illustratedIcons.connectionError : illustratedIcons.searchEmpty}
          onAction={error ? onRetry : onAdjustFilters}
          onSecondaryAction={error ? onAdjustFilters : onRetry}
          secondaryActionLabel={error ? '조건 조정' : '새로고침'}
          title={error ? '프로필을 불러오지 못했어요' : '오늘 볼 수 있는 사람을 다 봤어요'}
          tone={error ? 'error' : 'neutral'}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <Pressable onPress={onRetry} style={styles.errorBanner}>
          <IllustratedIcon size={24} source={illustratedIcons.connectionError} />
          <Text numberOfLines={2} style={styles.errorText}>
            {error}
          </Text>
        </Pressable>
      ) : null}
      <View style={[styles.deck, { height: deckHeight }]}>
        {nextProfile ? (
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.nextCard, nextCardStyle]}
          >
            <ProfileCard now={presenceNow} profile={nextProfile} />
          </Animated.View>
        ) : null}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.topCard, topCardStyle]}>
            <ProfileCard now={presenceNow} onPress={handleCardPress} profile={currentProfile} />
            <Animated.View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.pickPulse, pickPulseStyle]}
            >
              <Ionicons color={palette.white} name="heart" size={44} />
            </Animated.View>
            <Animated.View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.decision, styles.likeDecision, likeDecisionStyle]}
            >
              <Text style={styles.likeText}>PICK</Text>
            </Animated.View>
            <Animated.View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.decision, styles.passDecision, passDecisionStyle]}
            >
              <Text style={styles.passText}>PASS</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
  },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 7,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  errorText: { color: palette.ink, flex: 1, fontSize: 11, fontWeight: '700' },
  deck: {
    alignSelf: 'center',
    flexShrink: 1,
    marginBottom: 16,
    maxWidth: 520,
    minHeight: 0,
    width: '100%',
  },
  topCard: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  nextCard: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
  pickPulse: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: palette.pink,
    borderRadius: 44,
    height: 88,
    justifyContent: 'center',
    pointerEvents: 'none',
    position: 'absolute',
    top: '42%',
    width: 88,
  },
  decision: {
    position: 'absolute',
    top: 68,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 2.5,
    backgroundColor: 'rgba(8,8,12,0.28)',
    pointerEvents: 'none',
  },
  likeDecision: { left: 22, borderColor: palette.pink, transform: [{ rotate: '-8deg' }] },
  passDecision: { right: 22, borderColor: palette.white, transform: [{ rotate: '8deg' }] },
  likeText: { color: palette.pink, fontSize: 22, fontWeight: '900', letterSpacing: 1.8 },
  passText: { color: palette.white, fontSize: 22, fontWeight: '900', letterSpacing: 1.8 },
  finished: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingCard: {
    borderRadius: 28,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  loadingCopy: { bottom: 24, left: 22, position: 'absolute', right: 22 },
  loadingChips: { flexDirection: 'row', gap: 7, marginTop: 13 },
  loadingTitle: { ...typography.heading, marginTop: 18 },
  loadingText: { ...typography.caption, marginTop: 5, textAlign: 'center' },
});
