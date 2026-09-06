import { describe, expect, it } from 'vitest';

import {
  getRemainingNotificationTime,
  shouldDismissInAppNotification,
} from './in-app-notification-motion';

describe('in-app notification motion', () => {
  it('keeps only the unconsumed foreground display time', () => {
    expect(getRemainingNotificationTime(3000, 800)).toBe(2200);
    expect(getRemainingNotificationTime(3000, -100)).toBe(3000);
    expect(getRemainingNotificationTime(3000, 4000)).toBe(0);
  });

  it('dismisses after a sufficient upward distance or velocity', () => {
    expect(shouldDismissInAppNotification(-35, 0)).toBe(true);
    expect(shouldDismissInAppNotification(-10, -521)).toBe(true);
    expect(shouldDismissInAppNotification(-20, -300)).toBe(false);
  });
});
