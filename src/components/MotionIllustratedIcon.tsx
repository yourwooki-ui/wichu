import { Ionicons } from '@expo/vector-icons';
import type { ImageSource } from 'expo-image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

export type IconMotion = 'bell' | 'float' | 'pulse' | 'shine';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

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
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (!active || reduceMotion) return;

    const timing = (toValue: number, duration: number) =>
      Animated.timing(progress, {
        duration,
        easing: Easing.inOut(Easing.quad),
        toValue,
        useNativeDriver: USE_NATIVE_DRIVER,
      });
    const animation = Animated.loop(
      motion === 'bell'
        ? Animated.sequence([
            Animated.delay(3000),
            timing(1, 90),
            timing(-0.8, 100),
            timing(0.55, 90),
            timing(-0.3, 80),
            timing(0, 80),
          ])
        : Animated.sequence([
            Animated.delay(motion === 'shine' ? 2800 : motion === 'pulse' ? 3200 : 2400),
            timing(1, motion === 'pulse' ? 170 : 520),
            timing(0, motion === 'pulse' ? 220 : 620),
          ]),
    );

    animation.start();
    return () => {
      animation.stop();
      progress.stopAnimation();
      progress.setValue(0);
    };
  }, [active, motion, progress, reduceMotion]);

  const animatedStyle = useMemo(() => {
    if (motion === 'bell') {
      return {
        transform: [
          {
            rotate: progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ['-9deg', '0deg', '9deg'],
            }),
          },
        ],
      };
    }
    if (motion === 'pulse' || motion === 'shine') {
      return {
        transform: [
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
        ],
      };
    }
    return {
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
        {
          rotate: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '1.5deg'],
          }),
        },
      ],
    };
  }, [motion, progress]);

  const sparkleStyle = useMemo(
    () => ({
      opacity:
        motion === 'shine'
          ? progress.interpolate({
              inputRange: [0, 0.35, 1],
              outputRange: [0, 1, 0],
            })
          : 0,
      transform: [
        { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-4, 3] }) },
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [3, -4] }) },
        {
          scale: progress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.65, 1.15, 0.8],
          }),
        },
      ],
    }),
    [motion, progress],
  );

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
