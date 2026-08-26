import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MotionIllustratedIcon } from '@/components/MotionIllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { elevation, palette, radius } from '@/constants/theme';
import { useInAppRealtimeNotifications } from '@/hooks/use-in-app-realtime-notifications';
import { hapticsService } from '@/services/haptics-service';
import { useInAppNotificationCenter } from '@/services/in-app-notification-center';

const DISPLAY_DURATION_MS = 3000;
const HIDDEN_OFFSET = -132;

export function GlobalInAppNotificationHost({
  enabled,
  userId,
}: {
  enabled: boolean;
  userId?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const notice = useInAppNotificationCenter((state) => state.queue[0]);
  const dismissNotice = useInAppNotificationCenter((state) => state.dismiss);
  const clearNotices = useInAppNotificationCenter((state) => state.clear);
  const translateY = useSharedValue(HIDDEN_OFFSET);
  const progress = useSharedValue(1);

  useInAppRealtimeNotifications(enabled, userId);

  const completeDismiss = useCallback(
    (id: string) => {
      dismissNotice(id);
    },
    [dismissNotice],
  );

  const hide = useCallback(() => {
    if (!notice) return;
    if (reduceMotion) {
      translateY.set(HIDDEN_OFFSET);
      completeDismiss(notice.id);
      return;
    }
    translateY.set(
      withTiming(HIDDEN_OFFSET, { duration: 170 }, (finished) => {
        if (finished) runOnJS(completeDismiss)(notice.id);
      }),
    );
  }, [completeDismiss, notice, reduceMotion, translateY]);

  useEffect(() => {
    if (enabled) return;
    clearNotices();
  }, [clearNotices, enabled, userId]);

  useEffect(() => {
    if (!notice) return;
    if (notice.type === 'match') hapticsService.success();
    else hapticsService.selection();
    translateY.set(reduceMotion ? 0 : HIDDEN_OFFSET);
    progress.set(1);
    if (!reduceMotion) {
      translateY.set(withSpring(0, { damping: 20, mass: 0.76, stiffness: 245 }));
      progress.set(withTiming(0, { duration: DISPLAY_DURATION_MS }));
    }
    const timer = setTimeout(hide, DISPLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [hide, notice, progress, reduceMotion, translateY]);

  const openNotice = useCallback(() => {
    if (!notice) return;
    hapticsService.selection();
    router.push(notice.route as Href);
    hide();
  }, [hide, notice, router]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-5, 8])
        .failOffsetX([-20, 20])
        .onUpdate((event) => {
          if (event.translationY < 0) translateY.set(event.translationY);
        })
        .onEnd((event) => {
          if (event.translationY < -34 || event.velocityY < -520) {
            runOnJS(hide)();
            return;
          }
          translateY.set(reduceMotion ? 0 : withSpring(0, { damping: 19, stiffness: 260 }));
        }),
    [hide, reduceMotion, translateY],
  );

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [HIDDEN_OFFSET, -42, 0],
      [0, 0.7, 1],
      Extrapolation.CLAMP,
    ),
    transform: [{ translateY: translateY.get() }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : 1,
    transform: [{ scaleX: progress.get() }],
  }));

  if (!notice || !enabled) return null;

  const isMatch = notice.type === 'match';

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: Math.max(insets.top, 10) }]}>
      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          accessibilityLiveRegion="polite"
          accessibilityViewIsModal={false}
          style={[styles.banner, elevation.lg, bannerStyle]}
        >
          <Pressable
            accessibilityHint={t('inAppNotice.openHint')}
            accessibilityLabel={`${notice.title}. ${notice.body}`}
            accessibilityRole="button"
            onPress={openNotice}
            style={styles.mainAction}
          >
            <View style={styles.visual}>
              {notice.photo ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: notice.photo }}
                  style={[styles.photo, isMatch && styles.matchPhoto]}
                  transition={120}
                />
              ) : (
                <MotionIllustratedIcon
                  motion={isMatch ? 'pulse' : 'float'}
                  size={42}
                  source={isMatch ? illustratedIcons.matches : illustratedIcons.chatEmpty}
                />
              )}
              {notice.photo ? (
                <View style={[styles.kindBadge, isMatch && styles.kindBadgeMatch]}>
                  <Ionicons
                    color={palette.white}
                    name={isMatch ? 'heart' : 'chatbubble'}
                    size={11}
                  />
                </View>
              ) : null}
            </View>
            <View style={styles.copy}>
              <Text numberOfLines={1} style={styles.title}>
                {notice.title}
              </Text>
              <Text numberOfLines={2} style={styles.body}>
                {notice.body}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel={t('inAppNotice.dismiss')}
            accessibilityRole="button"
            hitSlop={10}
            onPress={hide}
            style={styles.close}
          >
            <Ionicons color={palette.inkMuted} name="close" size={18} />
          </Pressable>
          <View pointerEvents="none" style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    left: 12,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 12,
    top: 0,
    zIndex: 900,
  },
  banner: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: 'rgba(17,17,17,0.07)',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 520,
    minHeight: 76,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  mainAction: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 76,
    paddingBottom: 11,
    paddingLeft: 12,
    paddingRight: 44,
    paddingTop: 11,
  },
  visual: { height: 48, justifyContent: 'center', position: 'relative', width: 48 },
  photo: { borderRadius: 16, height: 46, width: 46 },
  matchPhoto: { borderColor: '#D8B43D', borderWidth: 2 },
  kindBadge: {
    alignItems: 'center',
    backgroundColor: '#4A8CE8',
    borderColor: palette.white,
    borderRadius: 10,
    borderWidth: 2,
    bottom: -1,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    width: 20,
  },
  kindBadgeMatch: { backgroundColor: palette.pink },
  copy: { flex: 1, marginLeft: 11 },
  title: { color: palette.ink, fontSize: 13, fontWeight: '900', lineHeight: 18 },
  body: { color: palette.inkMuted, fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 2 },
  close: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    top: 3,
    width: 40,
  },
  progressTrack: {
    backgroundColor: '#F1F1F4',
    bottom: 0,
    height: 3,
    left: 18,
    overflow: 'hidden',
    position: 'absolute',
    right: 18,
  },
  progressFill: {
    backgroundColor: palette.pink,
    height: 3,
    width: '100%',
  },
});
