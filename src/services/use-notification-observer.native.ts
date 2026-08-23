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

    const redirect = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return false;
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && SAFE_NOTIFICATION_ROUTE.test(url)) {
        router.push(url as Href);
        return true;
      }
      return false;
    };

    let active = true;
    void Notifications.getLastNotificationResponseAsync().then(async (initialResponse) => {
      if (active && initialResponse && redirect(initialResponse)) {
        await Notifications.clearLastNotificationResponseAsync();
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [enabled]);
}
