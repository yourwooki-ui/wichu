import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useEffect } from 'react';

const SAFE_NOTIFICATION_ROUTE = /^\/(?:chat\/[0-9a-f-]{36}|matches|chat)$/i;

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // 알림 초기화가 실패해도 앱의 인증·탐색 화면은 계속 열려야 한다.
}

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
    void Notifications.getLastNotificationResponseAsync()
      .then(async (initialResponse) => {
        if (active && initialResponse && redirect(initialResponse)) {
          await Notifications.clearLastNotificationResponseAsync();
        }
      })
      .catch(() => undefined);

    let removeResponseListener: (() => void) | undefined;
    try {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        redirect(response);
      });
      removeResponseListener = () => subscription.remove();
    } catch {
      // 알림 응답 리스너 실패는 앱의 나머지 기능을 중단시키지 않는다.
    }

    return () => {
      active = false;
      try {
        removeResponseListener?.();
      } catch {
        // 네이티브 구독 정리 실패는 무시한다.
      }
    };
  }, [enabled]);
}
