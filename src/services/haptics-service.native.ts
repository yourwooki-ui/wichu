import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { SwipeAction } from '@/types/profile';

type FeedbackChannel = 'decision' | 'selection' | 'status';

const lastFeedbackAt: Record<FeedbackChannel, number> = {
  decision: 0,
  selection: 0,
  status: 0,
};

function safely(channel: FeedbackChannel, feedback: () => Promise<void>) {
  const now = Date.now();
  const cooldown = channel === 'selection' ? 45 : 80;
  if (now - lastFeedbackAt[channel] < cooldown) return;
  lastFeedbackAt[channel] = now;

  try {
    void feedback().catch(() => undefined);
  } catch {
    // 제한된 네이티브 런타임에서 모듈 호출이 동기적으로 실패해도 UI를 유지한다.
  }
}

export const hapticsService = {
  selection() {
    if (Platform.OS === 'android') {
      safely('selection', () =>
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick),
      );
      return;
    }
    safely('selection', Haptics.selectionAsync);
  },
  swipe(action: SwipeAction) {
    if (Platform.OS === 'android') {
      safely('decision', () =>
        Haptics.performAndroidHapticsAsync(
          action === 'like' ? Haptics.AndroidHaptics.Confirm : Haptics.AndroidHaptics.Gesture_End,
        ),
      );
      return;
    }
    safely('decision', () =>
      Haptics.impactAsync(
        action === 'like' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
      ),
    );
  },
  success() {
    if (Platform.OS === 'android') {
      safely('status', () => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
      return;
    }
    safely('status', () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  error() {
    if (Platform.OS === 'android') {
      safely('status', () => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject));
      return;
    }
    safely('status', () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};
