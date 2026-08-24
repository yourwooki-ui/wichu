import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { SwipeAction } from '@/types/profile';

function safely(feedback: Promise<void>) {
  void feedback.catch(() => undefined);
}

export const hapticsService = {
  selection() {
    if (Platform.OS === 'android') {
      safely(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick));
      return;
    }
    safely(Haptics.selectionAsync());
  },
  swipe(action: SwipeAction) {
    if (Platform.OS === 'android') {
      safely(
        Haptics.performAndroidHapticsAsync(
          action === 'like' ? Haptics.AndroidHaptics.Confirm : Haptics.AndroidHaptics.Gesture_End,
        ),
      );
      return;
    }
    safely(
      Haptics.impactAsync(
        action === 'like' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
      ),
    );
  },
  success() {
    if (Platform.OS === 'android') {
      safely(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
      return;
    }
    safely(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
};
