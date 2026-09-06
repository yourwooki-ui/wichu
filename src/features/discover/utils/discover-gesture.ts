import type { SwipeAction } from '@/types/profile';

export const DISCOVER_SWIPE_THRESHOLD = 96;
export const DISCOVER_SWIPE_VELOCITY_THRESHOLD = 650;
export const DISCOVER_SWIPE_MIN_DISTANCE = 28;

export function resolveDiscoverSwipe(translationX: number, velocityX: number): SwipeAction | null {
  'worklet';

  const fastRight =
    velocityX > DISCOVER_SWIPE_VELOCITY_THRESHOLD && translationX > DISCOVER_SWIPE_MIN_DISTANCE;
  const fastLeft =
    velocityX < -DISCOVER_SWIPE_VELOCITY_THRESHOLD && translationX < -DISCOVER_SWIPE_MIN_DISTANCE;

  if (translationX > DISCOVER_SWIPE_THRESHOLD || fastRight) return 'like';
  if (translationX < -DISCOVER_SWIPE_THRESHOLD || fastLeft) return 'pass';
  return null;
}
