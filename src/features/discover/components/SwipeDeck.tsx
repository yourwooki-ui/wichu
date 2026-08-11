import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { radius, spacing } from '@/constants/theme';
import { ProfileCard } from '@/features/discover/components/ProfileCard';
import { useProfilePrefetch } from '@/features/discover/hooks/use-profile-prefetch';
import { useDiscoverStore } from '@/features/discover/stores/discover-store';
import { SwipeAction } from '@/types/profile';

const SWIPE_THRESHOLD = 105;

export function SwipeDeck() {
  const router = useRouter();
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const profiles = useDiscoverStore((state) => state.profiles);
  const recordSwipe = useDiscoverStore((state) => state.recordSwipe);
  const resetMockDeck = useDiscoverStore((state) => state.resetMockDeck);
  const [position] = useState(() => new Animated.ValueXY());
  const currentProfile = profiles[0];
  const nextProfile = profiles[1];

  useProfilePrefetch(profiles);

  const completeSwipe = useCallback(
    (action: SwipeAction) => {
      if (!currentProfile) return;
      Animated.timing(position, {
        toValue: { x: action === 'like' ? width * 1.35 : -width * 1.35, y: 12 },
        duration: 190,
        useNativeDriver: true,
      }).start(() => {
        recordSwipe(currentProfile.id, action);
        position.setValue({ x: 0, y: 0 });
      });
    },
    [currentProfile, position, recordSwipe, width],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6,
        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > SWIPE_THRESHOLD) completeSwipe('like');
          else if (gesture.dx < -SWIPE_THRESHOLD) completeSwipe('pass');
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
    [completeSwipe, position],
  );

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

  if (!currentProfile) {
    return (
      <View style={styles.finished}>
        <View style={[styles.finishedIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
          <Ionicons name="sparkles-outline" size={32} color={theme.colors.primary} />
        </View>
        <Text style={[styles.finishedTitle, { color: theme.colors.text }]}>
          You&apos;re all caught up
        </Text>
        <Text style={[styles.finishedText, { color: theme.colors.textMuted }]}>
          More people will appear as the candidate pool refills.
        </Text>
        <Pressable
          style={[styles.resetButton, { backgroundColor: theme.colors.primary }]}
          onPress={resetMockDeck}
        >
          <Text style={styles.resetButtonText}>Replay mock profiles</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.deck}>
        {nextProfile && (
          <View style={styles.nextCard} pointerEvents="none">
            <ProfileCard profile={nextProfile} />
          </View>
        )}
        <Animated.View
          style={[styles.topCard, { transform: [...position.getTranslateTransform(), { rotate }] }]}
          {...panResponder.panHandlers}
        >
          <ProfileCard
            profile={currentProfile}
            onPress={() => router.push(`/profile/${currentProfile.id}`)}
          />
          <Animated.View
            style={[styles.decision, styles.likeDecision, { opacity: likeOpacity }]}
            pointerEvents="none"
          >
            <Text style={styles.likeText}>LIKE</Text>
          </Animated.View>
          <Animated.View
            style={[styles.decision, styles.passDecision, { opacity: passOpacity }]}
            pointerEvents="none"
          >
            <Text style={styles.passText}>PASS</Text>
          </Animated.View>
        </Animated.View>
      </View>
      <View style={styles.actions}>
        <ActionButton
          label="Pass"
          icon="close"
          color={theme.colors.textMuted}
          onPress={() => completeSwipe('pass')}
        />
        <ActionButton
          label="Like"
          icon="arrow-up"
          color={theme.colors.primary}
          featured
          onPress={() => completeSwipe('like')}
        />
      </View>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  featured?: boolean;
  onPress: () => void;
};

function ActionButton({ label, icon, color, featured, onPress }: ActionButtonProps) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.actionButton,
        featured && styles.featuredAction,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={featured ? 29 : 27} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  deck: { flex: 1, marginTop: 4 },
  topCard: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  nextCard: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    transform: [{ scale: 0.96 }, { translateY: 9 }],
    opacity: 0.78,
  },
  decision: {
    position: 'absolute',
    top: 52,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 3,
    backgroundColor: 'rgba(10,10,14,0.2)',
  },
  likeDecision: { left: 22, borderColor: '#70E1BE', transform: [{ rotate: '-8deg' }] },
  passDecision: { right: 22, borderColor: '#FF8A78', transform: [{ rotate: '8deg' }] },
  likeText: { color: '#70E1BE', fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
  passText: { color: '#FF8A78', fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
  actions: {
    height: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111117',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  featuredAction: { width: 64, height: 64, borderRadius: 24 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
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
  resetButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  resetButtonText: { color: '#FFFFFF', fontWeight: '800' },
});
