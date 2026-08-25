import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppViewport } from '@/components/NativePreviewFrame';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius, typography } from '@/constants/theme';

type DiscoverUndoCoachProps = {
  onClose: () => void;
  visible: boolean;
};

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function DiscoverUndoCoach({ onClose, visible }: DiscoverUndoCoachProps) {
  const insets = useSafeAreaInsets();
  const viewport = useAppViewport();
  const [enter] = useState(() => new Animated.Value(0));
  const width = Math.min(viewport.width, 620);
  const target = {
    height: 58,
    width: 58,
    x: 5,
    y: Math.max(insets.top, 8) + 6,
  };

  useEffect(() => {
    if (!visible) {
      enter.setValue(0);
      return;
    }

    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        enter.setValue(1);
        return;
      }
      Animated.spring(enter, {
        bounciness: 6,
        speed: 16,
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });

    return () => {
      cancelled = true;
      enter.stopAnimation();
    };
  }, [enter, visible]);

  if (!visible) return null;

  const targetRight = target.x + target.width;
  const targetBottom = target.y + target.height;
  const calloutStyle = {
    opacity: enter,
    top: targetBottom + 14,
    transform: [
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
    ],
  };

  return (
    <AppModal animationType="fade" onRequestClose={onClose} transparent visible>
      <View accessibilityViewIsModal style={styles.modalRoot}>
        <View style={[styles.stage, { height: viewport.height, width }]}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.dim, { height: target.y, left: 0, top: 0, width }]} />
            <View
              style={[
                styles.dim,
                { height: target.height, left: 0, top: target.y, width: target.x },
              ]}
            />
            <View
              style={[
                styles.dim,
                {
                  height: target.height,
                  left: targetRight,
                  top: target.y,
                  width: Math.max(0, width - targetRight),
                },
              ]}
            />
            <View
              style={[
                styles.dim,
                {
                  height: Math.max(0, viewport.height - targetBottom),
                  left: 0,
                  top: targetBottom,
                  width,
                },
              ]}
            />
          </View>

          <View
            pointerEvents="none"
            style={[
              styles.focusRing,
              {
                height: target.height,
                left: target.x,
                top: target.y,
                width: target.width,
              },
            ]}
          />

          <Animated.View style={[styles.callout, calloutStyle]}>
            <View style={styles.identityRow}>
              <IllustratedIcon size={45} source={illustratedIcons.rewind} />
              <View style={styles.identityCopy}>
                <Text style={styles.eyebrow}>방금 선택</Text>
                <Text style={styles.title}>마음이 바뀌면 되돌릴 수 있어요</Text>
              </View>
            </View>
            <Text style={styles.body}>
              왼쪽 위 버튼을 누르면 마지막 선택을 다시 가져와요. 이 안내는 이번 한 번만
              보여드릴게요.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text style={styles.actionText}>알겠어요</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  stage: { maxWidth: 620, position: 'relative' },
  dim: { backgroundColor: 'rgba(13,13,17,0.72)', position: 'absolute' },
  focusRing: {
    borderColor: palette.pink,
    borderRadius: 22,
    borderWidth: 2,
    position: 'absolute',
    ...Platform.select({
      web: { boxShadow: '0 0 12px rgba(255,45,111,0.34)' },
      default: {
        elevation: 5,
        shadowColor: palette.pink,
        shadowOffset: { height: 0, width: 0 },
        shadowOpacity: 0.34,
        shadowRadius: 12,
      },
    }),
  },
  callout: {
    backgroundColor: '#FAFAFC',
    borderRadius: 25,
    left: 15,
    padding: 19,
    position: 'absolute',
    right: 15,
  },
  identityRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  identityCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...typography.overline, color: palette.pink },
  title: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.55,
    lineHeight: 25,
    marginTop: 2,
  },
  body: { color: palette.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 12 },
  action: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 20,
  },
  actionText: { color: palette.white, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.68 },
});
