import { describe, expect, it, vi } from 'vitest';

import {
  imageTransition,
  motionDelay,
  motionDuration,
  motionScale,
  motionSpring,
  resolveMotionDuration,
} from './motion';

vi.mock('react-native-reanimated', () => ({
  FadeIn: {},
  FadeInDown: {},
  FadeInLeft: {},
  FadeInRight: {},
  FadeInUp: {},
  FadeOut: {},
  FadeOutLeft: {},
  FadeOutRight: {},
  LinearTransition: {},
  ReduceMotion: { System: 'system' },
}));

describe('motion design contracts', () => {
  it('keeps interaction feedback faster than navigation and exit motion', () => {
    expect(motionDuration.feedback).toBeLessThan(motionDuration.standard);
    expect(motionDuration.standard).toBeLessThan(motionDuration.exit);
  });

  it('keeps press feedback subtle and springs physically valid', () => {
    expect(motionScale.press).toBeGreaterThanOrEqual(0.96);
    expect(motionScale.press).toBeLessThan(1);
    Object.values(motionSpring).forEach((spring) => {
      expect(spring.damping).toBeGreaterThan(0);
      expect(spring.mass).toBeGreaterThan(0);
      expect(spring.stiffness).toBeGreaterThan(0);
    });
  });

  it('limits list staggering and disables durations for reduced motion', () => {
    expect(motionDelay.maxStaggeredItems).toBeLessThanOrEqual(5);
    expect(resolveMotionDuration(true, motionDuration.exit)).toBe(0);
    expect(resolveMotionDuration(false, motionDuration.exit)).toBe(motionDuration.exit);
  });

  it('keeps image fades short enough to avoid sluggish recycling', () => {
    Object.values(imageTransition).forEach((duration) => {
      expect(duration).toBeLessThanOrEqual(180);
    });
  });
});
