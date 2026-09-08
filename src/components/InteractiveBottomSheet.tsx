import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { resolveBottomSheetSnap, type BottomSheetSnap } from '@/components/bottom-sheet-motion';
import { motionDuration, motionSpring } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { hapticsService } from '@/services/haptics-service';

type InteractiveBottomSheetProps = {
  accessibilityLabel: string;
  backdropOpacity?: number;
  children: ReactNode;
  collapsedOffset?: number;
  contentStyle?: StyleProp<ViewStyle>;
  dismissEnabled?: boolean;
  handleColor?: string;
  keyboardAvoiding?: boolean;
  onClose: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  visible: boolean;
};

const BottomSheetDismissContext = createContext<() => void>(() => undefined);

export function BottomSheetCloseButton(props: Omit<PressableProps, 'onPress'>) {
  const dismiss = useContext(BottomSheetDismissContext);
  return <Pressable {...props} onPress={dismiss} />;
}

/**
 * 닫혀 있는 패널은 아예 마운트하지 않는다. 앱 시작 시 보이지 않는 패널이
 * 제스처·애니메이션 런타임을 먼저 초기화하지 않게 하는 것이 핵심이다.
 */
export function InteractiveBottomSheet(props: InteractiveBottomSheetProps) {
  if (!props.visible) return null;
  return <VisibleInteractiveBottomSheet {...props} />;
}

function VisibleInteractiveBottomSheet({
  accessibilityLabel,
  backdropOpacity = 0.08,
  children,
  collapsedOffset: collapsedOffsetProp,
  contentStyle,
  dismissEnabled = true,
  handleColor = '#C5C5CA',
  keyboardAvoiding = false,
  onClose,
  sheetStyle,
}: InteractiveBottomSheetProps) {
  const { height } = useWindowDimensions();
  const closeOffset = height + 80;
  const collapsedOffset = collapsedOffsetProp ?? Math.min(height * 0.24, 210);
  const reduceMotion = useReduceMotion();
  const translateY = useSharedValue(closeOffset);
  const gestureStartY = useSharedValue(0);

  const completeClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    cancelAnimation(translateY);
    translateY.set(reduceMotion ? 0 : closeOffset);
    if (!reduceMotion) translateY.set(withSpring(0, motionSpring.sheet));

    return () => {
      cancelAnimation(translateY);
    };
  }, [closeOffset, reduceMotion, translateY]);

  const dismiss = useCallback(() => {
    if (!dismissEnabled) return;
    hapticsService.selection();
    cancelAnimation(translateY);
    if (reduceMotion) {
      translateY.set(closeOffset);
      completeClose();
      return;
    }
    translateY.set(
      withTiming(closeOffset, { duration: motionDuration.standard }, (finished) => {
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
      cancelAnimation(translateY);
      const target = snap === 'collapsed' ? collapsedOffset : 0;
      translateY.set(reduceMotion ? target : withSpring(target, motionSpring.sheet));
    },
    [collapsedOffset, dismiss, reduceMotion, translateY],
  );

  const toggleSheet = useCallback(() => {
    snapTo(translateY.get() > collapsedOffset * 0.5 ? 'expanded' : 'collapsed');
  }, [collapsedOffset, snapTo, translateY]);

  const settleGesture = useCallback(
    (position: number, velocityY: number) => {
      snapTo(
        resolveBottomSheetSnap({
          collapsedOffset,
          position: Math.max(0, Math.min(closeOffset, position)),
          velocityY,
        }),
      );
    },
    [closeOffset, collapsedOffset, snapTo],
  );

  const handleGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dismissEnabled)
        .activeOffsetY([-7, 7])
        .failOffsetX([-18, 18])
        .onBegin(() => {
          cancelAnimation(translateY);
          gestureStartY.set(translateY.get());
        })
        .onUpdate((event) => {
          translateY.set(
            Math.max(0, Math.min(closeOffset, gestureStartY.get() + event.translationY)),
          );
        })
        .onEnd((event) => {
          runOnJS(settleGesture)(translateY.get(), event.velocityY);
        }),
    [closeOffset, dismissEnabled, gestureStartY, settleGesture, translateY],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [0, collapsedOffset, closeOffset],
      [backdropOpacity, backdropOpacity * 0.44, 0],
      'clamp',
    ),
  }));
  const sheetMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  return (
    <AppModal animationType="none" onRequestClose={dismiss} transparent visible>
      <KeyboardResponsiveOverlay enabled={keyboardAvoiding}>
        <Animated.View style={[styles.backdrop, styles.nonInteractive, backdropStyle]} />
        <Pressable
          accessibilityLabel={`${accessibilityLabel} 닫기`}
          accessibilityRole="button"
          disabled={!dismissEnabled}
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, sheetStyle, sheetMotionStyle]}
        >
          <SafeAreaView edges={['bottom']} style={[styles.safeSheet, contentStyle]}>
            <GestureDetector gesture={handleGesture}>
              <Pressable
                accessibilityActions={[
                  { label: `${accessibilityLabel} 펼치기`, name: 'increment' },
                  { label: `${accessibilityLabel} 줄이기`, name: 'decrement' },
                  { label: `${accessibilityLabel} 닫기`, name: 'escape' },
                ]}
                accessibilityHint="탭하면 높이가 바뀌고, 위아래로 밀어 조절할 수 있어요"
                accessibilityLabel={`${accessibilityLabel} 높이 조절`}
                accessibilityRole="adjustable"
                accessibilityState={{ disabled: !dismissEnabled }}
                disabled={!dismissEnabled}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'increment') snapTo('expanded');
                  else if (event.nativeEvent.actionName === 'decrement') snapTo('collapsed');
                  else if (event.nativeEvent.actionName === 'escape') dismiss();
                }}
                onPress={toggleSheet}
                style={styles.handleTouch}
              >
                <View style={[styles.handle, { backgroundColor: handleColor }]} />
              </Pressable>
            </GestureDetector>
            <BottomSheetDismissContext.Provider value={dismiss}>
              {children}
            </BottomSheetDismissContext.Provider>
          </SafeAreaView>
        </Animated.View>
      </KeyboardResponsiveOverlay>
    </AppModal>
  );
}

function KeyboardResponsiveOverlay({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  if (enabled) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  return <View style={styles.overlay}>{children}</View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', minHeight: 0 },
  backdrop: {
    backgroundColor: '#111114',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  nonInteractive: { pointerEvents: 'none' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: '#F8F8FA',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 12,
    maxHeight: '92%',
    maxWidth: 480,
    minHeight: 0,
    overflow: 'hidden',
    shadowColor: '#111114',
    shadowOffset: { height: -5, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    width: '100%',
  },
  safeSheet: { flexGrow: 1, flexShrink: 1, minHeight: 0, width: '100%' },
  handleTouch: { alignItems: 'center', height: 44, justifyContent: 'center' },
  handle: { borderRadius: 3, height: 5, width: 42 },
});
