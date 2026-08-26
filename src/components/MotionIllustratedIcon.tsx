import { Ionicons } from '@expo/vector-icons';
import type { ImageSource } from 'expo-image';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { IllustratedIcon } from '@/components/IllustratedIcon';

export type IconMotion = 'bell' | 'float' | 'pulse' | 'shine';

type AmbientIconMotionProps = {
  active?: boolean;
  children: ReactNode;
  motion: IconMotion;
  style?: StyleProp<ViewStyle>;
};

/**
 * 짧은 동작 뒤 충분히 쉬는 아이콘 모션.
 * 무한히 꿈틀거리는 장식 대신 상태를 알아차릴 정도로만 반복한다.
 */
export function AmbientIconMotion({
  active = true,
  children,
  motion,
  style,
}: AmbientIconMotionProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.set(0);
    if (!active || reduceMotion) return;

    if (motion === 'bell') {
      progress.set(
        withRepeat(
          withSequence(
            withDelay(3000, withTiming(1, { duration: 90 })),
            withTiming(-0.8, { duration: 100 }),
            withTiming(0.55, { duration: 90 }),
            withTiming(-0.3, { duration: 80 }),
            withTiming(0, { duration: 80 }),
          ),
          -1,
          false,
        ),
      );
    } else if (motion === 'pulse') {
      progress.set(
        withRepeat(
          withSequence(
            withDelay(3200, withTiming(1, { duration: 170 })),
            withTiming(0, { duration: 220 }),
          ),
          -1,
          false,
        ),
      );
    } else {
      progress.set(
        withRepeat(
          withSequence(
            withDelay(motion === 'shine' ? 2800 : 2400, withTiming(1, { duration: 520 })),
            withTiming(0, { duration: 620 }),
          ),
          -1,
          false,
        ),
      );
    }

    return () => cancelAnimation(progress);
  }, [active, motion, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    if (motion === 'bell') {
      return { transform: [{ rotate: `${progress.get() * 9}deg` }] };
    }
    if (motion === 'pulse' || motion === 'shine') {
      return {
        transform: [{ scale: interpolate(progress.get(), [0, 1], [1, 1.08]) }],
      };
    }
    return {
      transform: [
        { translateY: interpolate(progress.get(), [0, 1], [0, -4]) },
        { rotate: `${interpolate(progress.get(), [0, 1], [0, 1.5])}deg` },
      ],
    };
  });
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: motion === 'shine' ? interpolate(progress.get(), [0, 0.35, 1], [0, 1, 0]) : 0,
    transform: [
      { translateX: interpolate(progress.get(), [0, 1], [-4, 3]) },
      { translateY: interpolate(progress.get(), [0, 1], [3, -4]) },
      { scale: interpolate(progress.get(), [0, 0.5, 1], [0.65, 1.15, 0.8]) },
    ],
  }));

  return (
    <View style={[styles.frame, style]}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
      {motion === 'shine' ? (
        <Animated.View pointerEvents="none" style={[styles.sparkle, sparkleStyle]}>
          <Ionicons color="#FFF7CC" name="sparkles" size={14} />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function MotionIllustratedIcon({
  active = true,
  motion,
  size = 40,
  source,
  style,
}: {
  active?: boolean;
  motion: IconMotion;
  size?: number;
  source: ImageSource;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <AmbientIconMotion
      active={active}
      motion={motion}
      style={[{ height: size, width: size }, style]}
    >
      <IllustratedIcon size={size} source={source} />
    </AmbientIconMotion>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  sparkle: { position: 'absolute', right: -3, top: -3 },
});
