import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useEffect } from 'react';

const SAFE_NOTIFICATION_ROUTE = /^\/(?:chat\/[0-9a-f-]{36}|matches|chat)$/i;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotificationObserver(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const redirect = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string' && SAFE_NOTIFICATION_ROUTE.test(url)) {
        router.push(url as Href);
      }
    };

    const initialResponse = Notifications.getLastNotificationResponse();
    if (initialResponse?.notification) redirect(initialResponse.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });
    return () => subscription.remove();
  }, [enabled]);
}
