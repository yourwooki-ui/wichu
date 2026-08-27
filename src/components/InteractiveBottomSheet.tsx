import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
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
  onClose,
  sheetStyle,
}: InteractiveBottomSheetProps) {
  const { height } = useWindowDimensions();
  const closeOffset = height + 80;
  const collapsedOffset = collapsedOffsetProp ?? Math.min(height * 0.24, 210);
  const [translateY] = useState(() => new Animated.Value(closeOffset));

  const completeClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    Animated.spring(translateY, {
      damping: 23,
      mass: 0.9,
      stiffness: 230,
      toValue: 0,
      useNativeDriver: true,
    }).start();

    return () => {
      translateY.stopAnimation();
    };
  }, [translateY]);

  const dismiss = useCallback(() => {
    if (!dismissEnabled) return;
    hapticsService.selection();
    Animated.timing(translateY, {
      duration: 210,
      toValue: closeOffset,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) completeClose();
    });
  }, [closeOffset, completeClose, dismissEnabled, translateY]);

  const snapTo = useCallback(
    (snap: BottomSheetSnap) => {
      if (snap === 'closed') {
        dismiss();
        return;
      }

      hapticsService.selection();
      Animated.spring(translateY, {
        damping: 23,
        mass: 0.9,
        stiffness: 230,
        toValue: snap === 'collapsed' ? collapsedOffset : 0,
        useNativeDriver: true,
      }).start();
    },
    [collapsedOffset, dismiss, translateY],
  );

  const toggleSheet = useCallback(() => {
    translateY.stopAnimation((position) => {
      snapTo(position > collapsedOffset * 0.5 ? 'expanded' : 'collapsed');
    });
  }, [collapsedOffset, snapTo, translateY]);

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          dismissEnabled &&
          Math.abs(gestureState.dy) > 7 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          translateY.stopAnimation(() => {
            translateY.extractOffset();
          });
        },
        onPanResponderMove: (_event, gestureState) => {
          translateY.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_event, gestureState) => {
          translateY.flattenOffset();
          translateY.stopAnimation((position) => {
            snapTo(
              resolveBottomSheetSnap({
                collapsedOffset,
                position: Math.max(0, Math.min(closeOffset, position)),
                velocityY: gestureState.vy * 1000,
              }),
            );
          });
        },
        onPanResponderTerminate: () => {
          translateY.flattenOffset();
          snapTo('expanded');
        },
      }),
    [closeOffset, collapsedOffset, dismissEnabled, snapTo, translateY],
  );

  const backdropOpacityValue = translateY.interpolate({
    extrapolate: 'clamp',
    inputRange: [0, collapsedOffset, closeOffset],
    outputRange: [backdropOpacity, backdropOpacity * 0.44, 0],
  });

  return (
    <AppModal animationType="none" onRequestClose={dismiss} transparent visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, { opacity: backdropOpacityValue }]}
        />
        <Pressable
          accessibilityLabel={`${accessibilityLabel} 닫기`}
          accessibilityRole="button"
          disabled={!dismissEnabled}
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, sheetStyle, { transform: [{ translateY }] }]}
        >
          <SafeAreaView edges={['bottom']} style={[styles.safeSheet, contentStyle]}>
            <Pressable
              {...handlePanResponder.panHandlers}
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
