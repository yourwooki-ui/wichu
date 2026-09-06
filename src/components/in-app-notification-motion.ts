export const IN_APP_NOTIFICATION_HIDDEN_OFFSET = -132;
export const IN_APP_NOTIFICATION_DISMISS_DISTANCE = -34;
export const IN_APP_NOTIFICATION_DISMISS_VELOCITY = -520;

export function getRemainingNotificationTime(remainingMs: number, elapsedMs: number) {
  return Math.max(0, remainingMs - Math.max(0, elapsedMs));
}

export function shouldDismissInAppNotification(position: number, velocityY: number) {
  'worklet';
  return (
    position < IN_APP_NOTIFICATION_DISMISS_DISTANCE ||
    velocityY < IN_APP_NOTIFICATION_DISMISS_VELOCITY
  );
}
