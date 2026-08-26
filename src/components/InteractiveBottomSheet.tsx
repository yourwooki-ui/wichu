import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type PressableProps,
  type ViewStyle,
  View,
} from 'react-native';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { resolveBottomSheetSnap, type BottomSheetSnap } from '@/components/bottom-sheet-motion';
import { hapticsService } from '@/services/haptics-service';

type InteractiveBottomSheetProps = {
  accessibilityLabel: string;
  backdropOpacity?: number;
  children: ReactNode;
  collapsedOffset?: number;
  contentStyle?: StyleProp<ViewStyle>;
  dismissEnabled?: boolean;
  handleColor?: string;
  onClose: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  visible: boolean;
};

const SPRING = { damping: 23, mass: 0.9, stiffness: 230 };
const BottomSheetDismissContext = createContext<() => void>(() => undefined);

export function BottomSheetCloseButton(props: Omit<PressableProps, 'onPress'>) {
  const dismiss = useContext(BottomSheetDismissContext);
  return <Pressable {...props} onPress={dismiss} />;
}

export function InteractiveBottomSheet({
  accessibilityLabel,
  backdropOpacity = 0.08,
  children,
  collapsedOffset: collapsedOffsetProp,
  contentStyle,
  dismissEnabled = true,
  handleColor = '#C5C5CA',
  onClose,
  sheetStyle,
  visible,
}: InteractiveBottomSheetProps) {
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const closeOffset = height + 80;
  const collapsedOffset = collapsedOffsetProp ?? Math.min(height * 0.24, 210);
  const translateY = useSharedValue(closeOffset);
  const dragStartY = useSharedValue(0);

  const completeClose = useCallback(() => onClose(), [onClose]);

  const dismiss = useCallback(() => {
    if (!dismissEnabled) return;
    hapticsService.selection();
    if (reduceMotion) {
      translateY.set(closeOffset);
      completeClose();
      return;
    }
    translateY.set(
      withTiming(closeOffset, { duration: 210 }, (finished) => {
        if (finished) runOnJS(completeClose)();
      }),
    );
  }, [closeOffset, completeClose, dismissEnabled, reduceMotion, translateY]);

  const snapTo = useCallback(
    (snap: BottomSheetSnap) => {
      if (snap === 'closed') {
        dismiss();
        return;
      }
      hapticsService.selection();
      const target = snap === 'collapsed' ? collapsedOffset : 0;
      translateY.set(reduceMotion ? target : withSpring(target, SPRING));
    },
    [collapsedOffset, dismiss, reduceMotion, translateY],
  );

  const toggleSheet = useCallback(() => {
    snapTo(translateY.get() > collapsedOffset * 0.5 ? 'expanded' : 'collapsed');
  }, [collapsedOffset, snapTo, translateY]);

  useEffect(() => {
    if (!visible) return;
    translateY.set(reduceMotion ? 0 : closeOffset);
    if (!reduceMotion) translateY.set(withSpring(0, SPRING));
  }, [closeOffset, reduceMotion, translateY, visible]);

  const handleGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(dismissEnabled)
      .activeOffsetY([-7, 7])
      .onBegin(() => {
        dragStartY.set(translateY.get());
      })
      .onUpdate((event) => {
        translateY.set(Math.max(0, Math.min(closeOffset, dragStartY.get() + event.translationY)));
      })
      .onEnd((event) => {
        const snap = resolveBottomSheetSnap({
          collapsedOffset,
          position: translateY.get(),
          velocityY: event.velocityY,
        });
        runOnJS(snapTo)(snap);
      });
    const tap = Gesture.Tap()
      .enabled(dismissEnabled)
      .onEnd((_event, success) => {
        if (success) runOnJS(toggleSheet)();
      });
    return Gesture.Exclusive(pan, tap);
  }, [closeOffset, collapsedOffset, dismissEnabled, dragStartY, snapTo, toggleSheet, translateY]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [0, collapsedOffset, closeOffset],
      [backdropOpacity, backdropOpacity * 0.44, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <AppModal animationType="none" onRequestClose={dismiss} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropAnimatedStyle]} />
        <Pressable
          accessibilityLabel={`${accessibilityLabel} 닫기`}
          accessibilityRole="button"
          disabled={!dismissEnabled}
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, sheetStyle, sheetAnimatedStyle]}
        >
          <SafeAreaView edges={['bottom']} style={[styles.safeSheet, contentStyle]}>
            <GestureDetector gesture={handleGesture}>
              <Animated.View
                accessibilityActions={[
                  { label: `${accessibilityLabel} 펼치기`, name: 'increment' },
                  { label: `${accessibilityLabel} 줄이기`, name: 'decrement' },
                  { label: `${accessibilityLabel} 닫기`, name: 'escape' },
                ]}
                accessibilityHint="탭하면 높이가 바뀌고, 위아래로 밀어 조절할 수 있어요"
                accessibilityLabel={`${accessibilityLabel} 높이 조절`}
                accessibilityRole="adjustable"
                accessibilityState={{ disabled: !dismissEnabled }}
                onAccessibilityAction={(event) => {
                  if (!dismissEnabled) return;
                  if (event.nativeEvent.actionName === 'increment') snapTo('expanded');
                  else if (event.nativeEvent.actionName === 'decrement') snapTo('collapsed');
                  else if (event.nativeEvent.actionName === 'escape') dismiss();
                }}
                style={styles.handleTouch}
              >
                <View style={[styles.handle, { backgroundColor: handleColor }]} />
              </Animated.View>
            </GestureDetector>
            <BottomSheetDismissContext.Provider value={dismiss}>
              {children}
            </BottomSheetDismissContext.Provider>
          </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>
    </AppModal>
  );
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
    maxHeight: '92%',
    maxWidth: 480,
    overflow: 'hidden',
    shadowColor: '#111114',
    shadowOffset: { height: -5, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    width: '100%',
  },
  safeSheet: { flexGrow: 1 },
  handleTouch: { alignItems: 'center', height: 44, justifyContent: 'center' },
  handle: { borderRadius: 3, height: 5, width: 42 },
});
