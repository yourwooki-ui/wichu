import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { resolveBottomSheetSnap, type BottomSheetSnap } from '@/components/bottom-sheet-motion';
import { buildNotificationItems } from '@/features/discover/utils/notification-feed';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { ChatRowsSkeleton } from '@/components/Skeleton';
import { listEntering, listExiting, listLayout } from '@/constants/motion';
import { StateView } from '@/components/StateView';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, pressFeedback } from '@/constants/theme';
import { matchesService } from '@/features/matches/services/matches-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import { hapticsService } from '@/services/haptics-service';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NotificationsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { session } = useAuthSession();
  const reduceMotion = useReducedMotion();
  const sheetHeight = Math.min(Math.max(height * 0.62, 360), 620);
  const collapsedOffset = Math.min(height * 0.26, 220);
  const translateY = useSharedValue(sheetHeight);
  const dragStartY = useSharedValue(0);
  const connectionsQuery = useQuery({
    enabled: visible && Boolean(session?.user.id),
    queryFn: () => matchesService.listConnections(session!.user.id),
    queryKey: ['matches', 'connections', session?.user.id],
    staleTime: 20_000,
  });
  const items = buildNotificationItems(connectionsQuery.data);

  const completeClose = useCallback(() => onClose(), [onClose]);

  const dismiss = useCallback(() => {
    hapticsService.selection();
    if (reduceMotion) {
      translateY.set(sheetHeight);
      completeClose();
      return;
    }
    translateY.set(
      withTiming(sheetHeight, { duration: 210 }, (finished) => {
        if (finished) runOnJS(completeClose)();
      }),
    );
  }, [completeClose, reduceMotion, sheetHeight, translateY]);

  const snapTo = useCallback(
    (snap: BottomSheetSnap) => {
      if (snap === 'closed') {
        dismiss();
        return;
      }
      hapticsService.selection();
      const target = snap === 'collapsed' ? collapsedOffset : 0;
      translateY.set(
        reduceMotion
          ? target
          : withSpring(target, {
              damping: 22,
              mass: 0.85,
              stiffness: 240,
            }),
      );
    },
    [collapsedOffset, dismiss, reduceMotion, translateY],
  );

  const toggleSheet = useCallback(() => {
    snapTo(translateY.get() > collapsedOffset * 0.5 ? 'expanded' : 'collapsed');
  }, [collapsedOffset, snapTo, translateY]);

  useEffect(() => {
    if (!visible) return;
    translateY.set(reduceMotion ? 0 : sheetHeight);
    if (!reduceMotion) {
      translateY.set(withSpring(0, { damping: 23, mass: 0.9, stiffness: 230 }));
    }
  }, [reduceMotion, sheetHeight, translateY, visible]);

  const handleGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-7, 7])
      .onBegin(() => {
        dragStartY.set(translateY.get());
      })
      .onUpdate((event) => {
        translateY.set(Math.max(0, Math.min(sheetHeight, dragStartY.get() + event.translationY)));
      })
      .onEnd((event) => {
        const snap = resolveBottomSheetSnap({
          collapsedOffset,
          position: translateY.get(),
          velocityY: event.velocityY,
        });
        runOnJS(snapTo)(snap);
      });
    const tap = Gesture.Tap().onEnd((_event, success) => {
      if (success) runOnJS(toggleSheet)();
    });
    return Gesture.Exclusive(pan, tap);
  }, [collapsedOffset, dragStartY, sheetHeight, snapTo, toggleSheet, translateY]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [0, collapsedOffset, sheetHeight],
      [0.08, 0.035, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <AppModal animationType="none" onRequestClose={dismiss} transparent visible={visible}>
      <View style={styles.overlay}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropAnimatedStyle]} />
        <Pressable
          accessibilityLabel="알림 닫기"
          accessibilityRole="button"
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, { height: sheetHeight }, sheetAnimatedStyle]}
        >
          <SafeAreaView edges={['bottom']} style={styles.safeSheet}>
            <GestureDetector gesture={handleGesture}>
              <Animated.View
                accessibilityActions={[
                  { label: '알림 패널 펼치기', name: 'increment' },
                  { label: '알림 패널 줄이기', name: 'decrement' },
                  { label: '알림 패널 닫기', name: 'escape' },
                ]}
                accessibilityHint="탭하면 높이가 바뀌고, 위아래로 밀어 조절할 수 있어요"
                accessibilityLabel="알림 패널 높이 조절"
                accessibilityRole="adjustable"
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'increment') snapTo('expanded');
                  else if (event.nativeEvent.actionName === 'decrement') snapTo('collapsed');
                  else if (event.nativeEvent.actionName === 'escape') dismiss();
                }}
                style={styles.handleTouch}
              >
                <View style={styles.handle} />
              </Animated.View>
            </GestureDetector>
            <View style={styles.header}>
              <Text style={styles.title}>알림</Text>
              <Pressable
                accessibilityLabel="알림 닫기"
                accessibilityRole="button"
                hitSlop={8}
                onPress={dismiss}
                style={({ pressed }) => [styles.close, pressed && pressFeedback.icon]}
              >
                <Ionicons color={palette.ink} name="close" size={21} />
              </Pressable>
            </View>
            {connectionsQuery.isLoading ? (
              <View style={styles.list}>
                <ChatRowsSkeleton count={4} />
              </View>
            ) : connectionsQuery.isError ? (
              <StateView
                actionLabel="다시 시도"
                body="연결 상태를 확인하고 다시 불러와 주세요."
                container="plain"
                illustration={illustratedIcons.connectionError}
                onAction={() => void connectionsQuery.refetch()}
                title="알림을 불러오지 못했어요"
                tone="error"
              />
            ) : items.length ? (
              <ScrollView
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                style={styles.scroll}
              >
                {items.map((item, index) => (
                  <AnimatedPressable
                    entering={listEntering(index)}
                    exiting={listExiting()}
                    key={item.id}
                    layout={listLayout()}
                    onPress={() => {
                      onClose();
                      router.push(`/chat/${item.matchId}`);
                    }}
                    style={({ pressed }: { pressed: boolean }) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    {item.photo ? (
                      <Image
                        cachePolicy="memory-disk"
                        contentFit="cover"
                        recyclingKey={item.id}
                        source={{ uri: item.photo }}
                        style={styles.avatar}
                        transition={140}
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <IllustratedIcon size={30} source={illustratedIcons.connections} />
                      </View>
                    )}
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text numberOfLines={1} style={styles.rowBody}>
                        {item.body}
                      </Text>
                    </View>
                    <Text style={styles.rowTime}>{formatActivityTime(item.time)}</Text>
                  </AnimatedPressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.empty}>
                <StateView
                  body="새로운 Pick, Match와 메시지가 생기면 여기에 알려드릴게요."
                  container="plain"
                  illustration={illustratedIcons.notification}
                  title="새로운 알림이 없어요"
                />
              </View>
            )}
          </SafeAreaView>
        </Animated.View>
      </View>
    </AppModal>
  );
}

function formatActivityTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}시간`;
  return `${Math.floor(minutes / 1_440)}일`;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: '#111114',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    alignSelf: 'center',
    backgroundColor: '#F8F8FA',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 12,
    maxWidth: 460,
    overflow: 'hidden',
    shadowColor: '#111114',
    shadowOffset: { height: -5, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    width: '100%',
  },
  safeSheet: { flex: 1 },
  scroll: { flex: 1 },
  handleTouch: { alignItems: 'center', height: 44, justifyContent: 'center' },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#C5C5CA',
    borderRadius: 3,
    height: 5,
    width: 42,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  close: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  empty: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  list: { paddingBottom: 18, paddingHorizontal: 12, paddingTop: 12 },
  row: {
    alignItems: 'center',
    borderBottomColor: '#E1E1E5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 76,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: palette.white, borderRadius: 17 },
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#FFE8EF',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  rowBody: { color: palette.inkMuted, fontSize: 10, marginTop: 3 },
  rowTime: { color: palette.inkMuted, fontSize: 10, fontWeight: '700' },
});
