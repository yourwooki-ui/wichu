import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useEffect } from 'react';

import i18n from '@/i18n';
import { useInAppNotificationCenter } from '@/services/in-app-notification-center';

const SAFE_NOTIFICATION_ROUTE = /^\/(?:chat\/[0-9a-f-]{36}|matches|chat)$/i;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // 포그라운드에서는 WICHU 자체 3초 배너가 피드백을 담당한다.
    // 백그라운드 알림과 알림함 동작은 OS가 그대로 처리한다.
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
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
    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const { body, data, title } = notification.request.content;
      const url = data?.url;
      const kind = data?.kind;
      if (
        typeof url !== 'string' ||
        !SAFE_NOTIFICATION_ROUTE.test(url) ||
        (kind !== 'match' && kind !== 'message')
      )
        return;

      useInAppNotificationCenter.getState().enqueue({
        body:
          body ??
          (kind === 'match'
            ? i18n.t('inAppNotice.matchBody')
            : i18n.t('inAppNotice.messageFallbackTitle')),
        id: `push:${notification.request.identifier}`,
        photo: null,
        route: url as '/chat' | '/matches' | `/chat/${string}`,
        title:
          title ??
          (kind === 'match'
            ? i18n.t('inAppNotice.matchFallbackTitle')
            : i18n.t('inAppNotice.messageFallbackTitle')),
        type: kind,
      });
    });
    return () => {
      active = false;
      subscription.remove();
      foregroundSubscription.remove();
    };
  }, [enabled]);
}
