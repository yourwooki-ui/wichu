import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppViewport } from '@/components/NativePreviewFrame';
import { Skeleton, SkeletonLine } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { useAppTheme } from '@/components/ThemeProvider';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, pressFeedback, radius, spacing, typography } from '@/constants/theme';
import { ProfileCard } from '@/features/discover/components/ProfileCard';
import { useProfilePrefetch } from '@/features/discover/hooks/use-profile-prefetch';
import { useAdGatedNavigation } from '@/features/monetization/hooks/use-ad-gated-navigation';
import { hapticsService } from '@/services/haptics-service';
import { Profile, SwipeAction } from '@/types/profile';

const SWIPE_THRESHOLD = 96;
const SWIPE_VELOCITY_THRESHOLD = 0.65;
const SWIPE_MIN_DISTANCE = 28;
const DOUBLE_TAP_DELAY = 260;
const SWIPE_EXIT_DURATION = 360;

type SwipeDeckProps = {
  profiles: Profile[];
  isLoading: boolean;
  error: string | null;
  onAdjustFilters: () => void;
  onRestoreAnimationConsumed?: () => void;
  onSwipe: (profile: Profile, action: SwipeAction) => void;
  onRetry: () => void;
  restoredSwipe?: { action: SwipeAction; profileId: string; sequence: number } | null;
};

export function SwipeDeck({
  profiles,
  isLoading,
  error,
  onAdjustFilters,
  onRestoreAnimationConsumed,
  onSwipe,
  onRetry,
  restoredSwipe,
}: SwipeDeckProps) {
  const navigateWithAdGate = useAdGatedNavigation();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { height, width } = useAppViewport();
  const reduceMotion = useReducedMotion();
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pickPulse = useSharedValue(0);
  const interactionLocked = useSharedValue(false);
  const currentProfile = profiles[0];
  const nextProfile = profiles[1];
  const nextCardOffsetX = Math.min(24, width * 0.06);
  // 헤더와 하단 탭은 또렷하게 남기되, 별도 액션 버튼 없이 카드가 중심이 된다.
  const deckHeight = Math.min(600, Math.max(340, height - 260));

  useProfilePrefetch(profiles);

  useEffect(() => {
    const interval = setInterval(() => setPresenceNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const commitSwipe = useCallback(
    (action: SwipeAction) => {
      if (currentProfile) {
        onSwipe(currentProfile, action);
      }
    },
    [currentProfile, onSwipe],
  );

  const signalSwipeDecision = useCallback((action: SwipeAction) => {
    // 손을 놓거나 버튼을 누른 바로 그 순간에 피드백한다. 서버 기록 완료까지
    // 기다리면 카드가 사라진 뒤 진동이 와서 조작과 반응이 따로 느껴진다.
    hapticsService.swipe(action);
  }, []);

  const openProfile = useCallback(() => {
    if (currentProfile) {
      void navigateWithAdGate(`/profile/${currentProfile.id}?context=discover`);
    }
  }, [currentProfile, navigateWithAdGate]);

  const startSwipe = useCallback(
    (action: SwipeAction) => {
      if (interactionLocked.get()) return;
      interactionLocked.set(true);
      signalSwipeDecision(action);
      const exitDuration = reduceMotion ? 0 : SWIPE_EXIT_DURATION;
      translateY.set(withTiming(10, { duration: exitDuration, easing: Easing.in(Easing.cubic) }));
      translateX.set(
        withTiming(
          action === 'like' ? width * 1.35 : -width * 1.35,
          { duration: exitDuration, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(commitSwipe)(action);
          },
        ),
      );
    },
    [
      commitSwipe,
      interactionLocked,
      reduceMotion,
      signalSwipeDecision,
      translateX,
      translateY,
      width,
    ],
  );

  const handleCardPress = useCallback(() => {
    const tappedAt = Date.now();
    const isDoubleTap = tappedAt - lastTapRef.current <= DOUBLE_TAP_DELAY;
    lastTapRef.current = tappedAt;

    if (isDoubleTap) {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
      lastTapRef.current = 0;
      if (!reduceMotion) {
        pickPulse.set(
          withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 150 })),
        );
      }
      startSwipe('like');
      return;
    }

    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      lastTapRef.current = 0;
      openProfile();
    }, DOUBLE_TAP_DELAY);
  }, [openProfile, pickPulse, reduceMotion, startSwipe]);

  useEffect(
    () => () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const isRestoredProfile = restoredSwipe?.profileId === currentProfile?.id;
    const restoredOffset = restoredSwipe?.action === 'like' ? width * 0.72 : -width * 0.72;

    if (isRestoredProfile && !reduceMotion) {
      translateX.set(restoredOffset);
      translateX.set(withSpring(0, { damping: 19, stiffness: 185, mass: 0.82 }));
    } else {
      translateX.set(0);
    }
    translateY.set(0);
    pickPulse.set(0);
    interactionLocked.set(false);
    if (isRestoredProfile) onRestoreAnimationConsumed?.();
  }, [
    currentProfile?.id,
    interactionLocked,
    onRestoreAnimationConsumed,
    pickPulse,
    reduceMotion,
    restoredSwipe?.action,
    restoredSwipe?.profileId,
    restoredSwipe?.sequence,
    translateX,
    translateY,
    width,
  ]);

  const gesture = useMemo(() => {
    const finishSwipe = (action: SwipeAction) => {
      'worklet';
      if (interactionLocked.get()) return;
      interactionLocked.set(true);
      runOnJS(signalSwipeDecision)(action);
      const exitDuration = reduceMotion ? 0 : SWIPE_EXIT_DURATION;
      translateY.set(withTiming(10, { duration: exitDuration, easing: Easing.in(Easing.cubic) }));
      translateX.set(
        withTiming(
          action === 'like' ? width * 1.35 : -width * 1.35,
          { duration: exitDuration, easing: Easing.in(Easing.cubic) },
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
        else if (reduceMotion) {
          translateX.set(withTiming(0, { duration: 0 }));
          translateY.set(withTiming(0, { duration: 0 }));
        } else {
          translateX.set(withSpring(0, { damping: 18, stiffness: 210 }));
          translateY.set(withSpring(0, { damping: 18, stiffness: 210 }));
        }
      });

    return Gesture.Simultaneous(pan, Gesture.Native());
  }, [
    commitSwipe,
    interactionLocked,
    reduceMotion,
    signalSwipeDecision,
    translateX,
    translateY,
    width,
  ]);

  const topCardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(translateX.get()),
      [0, width * 1.25],
      [1, 0.92],
      Extrapolation.CLAMP,
    ),
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
      {
        scale: interpolate(
          Math.abs(translateX.get()),
          [0, SWIPE_THRESHOLD, width],
          [1, 0.992, 0.975],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const nextCardStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      Math.abs(translateX.get()),
      [0, SWIPE_THRESHOLD, width * 1.1],
      [0, 0.46, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity: interpolate(progress, [0, 1], [0.94, 1]),
      transform: [
        {
          translateX: interpolate(progress, [0, 1], [nextCardOffsetX, 0], Extrapolation.CLAMP),
        },
        { translateY: interpolate(progress, [0, 1], [12, 0], Extrapolation.CLAMP) },
        { scale: interpolate(progress, [0, 1], [0.968, 1]) },
      ],
    };
  });
  const pickPulseStyle = useAnimatedStyle(() => ({
    opacity: pickPulse.get(),
    transform: [{ scale: interpolate(pickPulse.get(), [0, 1], [0.72, 1]) }],
  }));
  const likeDecisionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [15, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(translateX.get(), [15, SWIPE_THRESHOLD], [0.82, 1], Extrapolation.CLAMP),
      },
    ],
  }));
  const passDecisionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [-SWIPE_THRESHOLD, -15], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          translateX.get(),
          [-SWIPE_THRESHOLD, -15],
          [1, 0.82],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  if (isLoading) {
    // 실제 카드와 같은 크기·정보 배치로 골격을 그려 데이터 도착 시 화면이 튀지 않게 한다.
    return (
      <View style={styles.container}>
        <View
          accessibilityLabel={t('discoverDeck.loading')}
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
          {t('experience.discover.loadingTitle')}
        </Text>
        <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
          {t('experience.discover.loadingBody')}
        </Text>
      </View>
    );
  }

  if (!currentProfile) {
    return (
      <View style={styles.finished}>
        <StateView
          actionLabel={error ? t('reliability.retry') : t('experience.discover.refresh')}
          body={error ?? undefined}
          container="plain"
          illustration={error ? illustratedIcons.connectionError : illustratedIcons.searchEmpty}
          onAction={onRetry}
          onSecondaryAction={onAdjustFilters}
          secondaryActionLabel={t('experience.discover.adjust')}
          title={error ? t('reliability.discoverTitle') : t('experience.discover.emptyTitle')}
          tone={error ? 'error' : 'neutral'}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <Pressable
          accessibilityLabel={t('reliability.retry')}
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.errorBanner, pressed && pressFeedback.surface]}
        >
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
            <ProfileCard
              accessibilityActions={[
                { label: t('discoverDeck.openProfile'), name: 'activate' },
                { label: 'Pick', name: 'increment' },
                { label: 'Pass', name: 'decrement' },
              ]}
              now={presenceNow}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'activate') openProfile();
                if (event.nativeEvent.actionName === 'increment') startSwipe('like');
                if (event.nativeEvent.actionName === 'decrement') startSwipe('pass');
              }}
              onPress={handleCardPress}
              profile={currentProfile}
            />
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
  errorText: { color: palette.ink, flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  deck: {
    alignSelf: 'center',
    flexShrink: 1,
    marginBottom: 10,
    maxWidth: 520,
    minHeight: 0,
    width: '100%',
  },
  topCard: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 2 },
  nextCard: {
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
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
