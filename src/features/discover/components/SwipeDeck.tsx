import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { palette, radius, spacing } from '@/constants/theme';
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
  onSwipe: (profile: Profile, action: SwipeAction) => void;
  onRetry: () => void;
};

export function SwipeDeck({ profiles, isLoading, error, onSwipe, onRetry }: SwipeDeckProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const { height, width } = useWindowDimensions();
  const [position] = useState(() => new Animated.ValueXY());
  const [pickPulse] = useState(() => new Animated.Value(0));
  const [isAnimating, setIsAnimating] = useState(false);
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const lastTapAtRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentProfile = profiles[0];
  const nextProfile = profiles[1];
  const deckHeight = Math.min(620, Math.max(330, height - 242));

  useProfilePrefetch(profiles);

  useEffect(() => {
    const interval = setInterval(() => setPresenceNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const completeSwipe = useCallback(
    (action: SwipeAction) => {
      if (!currentProfile || isAnimating) return;
      setIsAnimating(true);
      Animated.timing(position, {
        toValue: { x: action === 'like' ? width * 1.35 : -width * 1.35, y: 12 },
        duration: 210,
        useNativeDriver: true,
      }).start(() => {
        position.setValue({ x: 0, y: 0 });
        onSwipe(currentProfile, action);
        setIsAnimating(false);
      });
    },
    [currentProfile, isAnimating, onSwipe, position, width],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !isAnimating && Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          const isFastRight =
            gesture.vx > SWIPE_VELOCITY_THRESHOLD && gesture.dx > SWIPE_MIN_DISTANCE;
          const isFastLeft =
            gesture.vx < -SWIPE_VELOCITY_THRESHOLD && gesture.dx < -SWIPE_MIN_DISTANCE;

          if (gesture.dx > SWIPE_THRESHOLD || isFastRight) completeSwipe('like');
          else if (gesture.dx < -SWIPE_THRESHOLD || isFastLeft) completeSwipe('pass');
          else {
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              friction: 6,
              tension: 70,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        },
      }),
    [completeSwipe, isAnimating, position],
  );

  const handleCardPress = useCallback(() => {
    if (!currentProfile || isAnimating) return;
    const now = Date.now();
    const isDoubleTap = now - lastTapAtRef.current <= DOUBLE_TAP_DELAY;

    if (isDoubleTap) {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
      lastTapAtRef.current = 0;
      pickPulse.setValue(0);
      Animated.sequence([
        Animated.timing(pickPulse, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(pickPulse, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
      completeSwipe('like');
      return;
    }

    lastTapAtRef.current = now;
    singleTapTimerRef.current = setTimeout(() => {
      lastTapAtRef.current = 0;
      singleTapTimerRef.current = null;
      router.push(`/profile/${currentProfile.id}`);
    }, DOUBLE_TAP_DELAY);
  }, [completeSwipe, currentProfile, isAnimating, pickPulse, router]);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
      lastTapAtRef.current = 0;
    };
  }, [currentProfile?.id]);

  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [15, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -15],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const nextTranslateX = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [0, width * 1.05, 0],
    extrapolate: 'clamp',
  });
  const pickPulseScale = pickPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  if (isLoading) {
    return (
      <View style={styles.finished}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>후보를 찾는 중…</Text>
      </View>
    );
  }

  if (!currentProfile) {
    return (
      <View style={styles.finished}>
        <View style={[styles.finishedIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
          <Ionicons name="sparkles-outline" size={32} color={theme.colors.primary} />
        </View>
        <Text style={[styles.finishedTitle, { color: theme.colors.text }]}>
          새로운 프로필 준비 중
        </Text>
        <Text style={[styles.finishedText, { color: theme.colors.textMuted }]}>
          {error ?? '조건에 맞는 새로운 프로필이 생기면 여기에 표시돼요.'}
        </Text>
        <Pressable
          style={[styles.resetButton, { backgroundColor: theme.colors.primary }]}
          onPress={onRetry}
        >
          <Text style={styles.resetButtonText}>다시 확인</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <Pressable onPress={onRetry} style={styles.errorBanner}>
          <Ionicons color={palette.pink} name="alert-circle-outline" size={17} />
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
            style={[styles.nextCard, { transform: [{ translateX: nextTranslateX }] }]}
          >
            <ProfileCard now={presenceNow} profile={nextProfile} />
          </Animated.View>
        ) : null}
        <Animated.View
          style={[styles.topCard, { transform: [...position.getTranslateTransform(), { rotate }] }]}
          {...panResponder.panHandlers}
        >
          <ProfileCard now={presenceNow} profile={currentProfile} onPress={handleCardPress} />
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.pickPulse,
              { opacity: pickPulse, transform: [{ scale: pickPulseScale }] },
            ]}
          >
            <Ionicons color={palette.white} name="heart" size={44} />
          </Animated.View>
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.decision, styles.likeDecision, { opacity: likeOpacity }]}
          >
            <Text style={styles.likeText}>PICK</Text>
          </Animated.View>
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.decision, styles.passDecision, { opacity: passOpacity }]}
          >
            <Text style={styles.passText}>PASS</Text>
          </Animated.View>
        </Animated.View>
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
  finishedIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  finishedTitle: { fontSize: 23, fontWeight: '800' },
  finishedText: { marginTop: 8, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  loadingText: { fontSize: 13, marginTop: 12 },
  resetButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  resetButtonText: { color: '#FFFFFF', fontWeight: '800' },
});
