import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  getRemainingNotificationTime,
  IN_APP_NOTIFICATION_DISMISS_DISTANCE,
  IN_APP_NOTIFICATION_DISMISS_VELOCITY,
  IN_APP_NOTIFICATION_HIDDEN_OFFSET,
} from '@/components/in-app-notification-motion';
import { MotionIllustratedIcon } from '@/components/MotionIllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { imageTransition, motionDelay, motionDuration, motionSpring } from '@/constants/motion';
import { elevation, palette, radius } from '@/constants/theme';
import { useAppActive } from '@/hooks/use-app-active';
import { useInAppRealtimeNotifications } from '@/hooks/use-in-app-realtime-notifications';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { hapticsService } from '@/services/haptics-service';
import { useInAppNotificationCenter } from '@/services/in-app-notification-center';

const DISPLAY_DURATION_MS = motionDelay.notificationHold;

export function GlobalInAppNotificationHost({
  realtimeEnabled = true,
  userId,
}: {
  realtimeEnabled?: boolean;
  userId: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotion();
  const notice = useInAppNotificationCenter((state) => state.queue[0]);
  const dismissNotice = useInAppNotificationCenter((state) => state.dismiss);
  const clearNotices = useInAppNotificationCenter((state) => state.clear);
  const translateY = useSharedValue(IN_APP_NOTIFICATION_HIDDEN_OFFSET);
  const gestureStartY = useSharedValue(0);
  const progress = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerStartedAtRef = useRef(0);
  const remainingMsRef = useRef<number>(DISPLAY_DURATION_MS);
  const dismissing = useSharedValue(false);

  useInAppRealtimeNotifications(userId, realtimeEnabled);

  const completeDismiss = useCallback(
    (id: string) => {
      dismissNotice(id);
    },
    [dismissNotice],
  );

  const clearDisplayTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const hide = useCallback(
    (id: string) => {
      if (dismissing.get()) return;
      dismissing.set(true);
      clearDisplayTimer();
      cancelAnimation(translateY);
      cancelAnimation(progress);
      if (reduceMotion) {
        translateY.set(IN_APP_NOTIFICATION_HIDDEN_OFFSET);
        completeDismiss(id);
        return;
      }

      translateY.set(
        withTiming(
          IN_APP_NOTIFICATION_HIDDEN_OFFSET,
          { duration: motionDuration.fast },
          (finished) => {
            if (finished) runOnJS(completeDismiss)(id);
          },
        ),
      );
    },
    [clearDisplayTimer, completeDismiss, dismissing, progress, reduceMotion, translateY],
  );

  useEffect(
    () => () => {
      clearDisplayTimer();
      cancelAnimation(translateY);
      cancelAnimation(progress);
      clearNotices();
    },
    [clearDisplayTimer, clearNotices, progress, translateY],
  );

  useEffect(() => {
    if (!notice) return;
    clearDisplayTimer();
    cancelAnimation(translateY);
    cancelAnimation(progress);
    dismissing.set(false);
    remainingMsRef.current = DISPLAY_DURATION_MS;
    translateY.set(reduceMotion ? 0 : IN_APP_NOTIFICATION_HIDDEN_OFFSET);
    progress.set(1);

    if (notice.type === 'match') hapticsService.success();
    else hapticsService.selection();

    if (!reduceMotion) translateY.set(withSpring(0, motionSpring.notification));
  }, [clearDisplayTimer, dismissing, notice, progress, reduceMotion, translateY]);

  useEffect(() => {
    if (!notice || !appActive || dismissing.get()) return;

    const remainingMs = remainingMsRef.current;
    if (remainingMs <= 0) {
      hide(notice.id);
      return;
    }

    timerStartedAtRef.current = Date.now();
    if (!reduceMotion) {
      cancelAnimation(progress);
      progress.set(withTiming(0, { duration: remainingMs }));
    }
    timerRef.current = setTimeout(() => hide(notice.id), remainingMs);

    return () => {
      if (timerRef.current) {
        remainingMsRef.current = getRemainingNotificationTime(
          remainingMsRef.current,
          Date.now() - timerStartedAtRef.current,
        );
      }
      clearDisplayTimer();
      cancelAnimation(progress);
    };
  }, [appActive, clearDisplayTimer, dismissing, hide, notice, progress, reduceMotion]);

  const openNotice = useCallback(() => {
    if (!notice) return;
    hapticsService.selection();
    router.push(notice.route as Href);
    hide(notice.id);
  }, [hide, notice, router]);

  const dismissCurrent = useCallback(() => {
    if (notice) hide(notice.id);
  }, [hide, notice]);

  const noticeId = notice?.id;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .failOffsetX([-20, 20])
        .onBegin(() => {
          cancelAnimation(translateY);
          gestureStartY.set(translateY.get());
        })
        .onUpdate((event) => {
          translateY.set(Math.min(0, gestureStartY.get() + event.translationY));
        })
        .onEnd((event) => {
          const position = translateY.get();
          if (
            position < IN_APP_NOTIFICATION_DISMISS_DISTANCE ||
            event.velocityY < IN_APP_NOTIFICATION_DISMISS_VELOCITY
          ) {
            if (!noticeId || dismissing.get()) return;
            dismissing.set(true);
            cancelAnimation(progress);
            translateY.set(
              withTiming(
                IN_APP_NOTIFICATION_HIDDEN_OFFSET,
                { duration: motionDuration.fast },
                (finished) => {
                  if (finished) runOnJS(completeDismiss)(noticeId);
                },
              ),
            );
            return;
          }
          if (reduceMotion) {
            translateY.set(0);
            return;
          }
          translateY.set(withSpring(0, motionSpring.tab));
        })
        .onFinalize((_event, success) => {
          if (!success) translateY.set(reduceMotion ? 0 : withSpring(0, motionSpring.tab));
        }),
    [completeDismiss, dismissing, gestureStartY, noticeId, progress, reduceMotion, translateY],
  );

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [IN_APP_NOTIFICATION_HIDDEN_OFFSET, -42, 0],
      [0, 0.7, 1],
      'clamp',
    ),
    transform: [{ translateY: translateY.get() }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : 1,
    transform: [{ scaleX: progress.get() }],
  }));

  if (!notice) return null;

  const isMatch = notice.type === 'match';

  return (
    <View
      style={[styles.host, { paddingTop: Math.max(insets.top, 10), pointerEvents: 'box-none' }]}
    >
      <GestureDetector gesture={gesture}>
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
                  transition={imageTransition.icon}
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
            onPress={dismissCurrent}
            style={styles.close}
          >
            <Ionicons color={palette.inkMuted} name="close" size={18} />
          </Pressable>
          <View style={[styles.progressTrack, { pointerEvents: 'none' }]}>
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
