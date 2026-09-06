import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { motionDelay, motionDuration } from '@/constants/motion';
import { palette } from '@/constants/theme';
import { useMotionEnabled } from '@/hooks/use-reduce-motion';

type PresenceDotProps = {
  active?: boolean;
  inactiveColor?: string;
  size?: number;
};

/** 온라인 상태만 짧게 호흡하고 충분히 쉬는 공통 presence 표시. */
export function PresenceDot({
  active = true,
  inactiveColor = 'rgba(255,255,255,0.68)',
  size = 7,
}: PresenceDotProps) {
  const motionEnabled = useMotionEnabled(active);
  const pulse = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(pulse);
    pulse.set(0);
    if (!motionEnabled) return;

    pulse.set(
      withRepeat(
        withSequence(
          withDelay(motionDelay.ambientPulse, withTiming(1, { duration: motionDuration.standard })),
          withTiming(0, { duration: motionDuration.fast }),
        ),
        -1,
      ),
    );

    return () => cancelAnimation(pulse);
  }, [motionEnabled, pulse]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.get(), [0, 1], [0.42, 0]),
    transform: [{ scale: interpolate(pulse.get(), [0, 1], [1, 2.4]) }],
  }));
  const color = active ? palette.lime : inactiveColor;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: size, width: size }}
    >
      {active ? (
        <Animated.View
          style={[
            styles.layer,
            { backgroundColor: color, borderRadius: size / 2, height: size, width: size },
            rippleStyle,
          ]}
        />
      ) : null}
      <View
        style={[
          styles.layer,
          { backgroundColor: color, borderRadius: size / 2, height: size, width: size },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { left: 0, position: 'absolute', top: 0 },
});
