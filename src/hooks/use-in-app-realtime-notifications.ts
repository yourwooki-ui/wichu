import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { matchesService, type MatchConnection } from '@/features/matches/services/matches-service';
import { getSupabaseClient } from '@/lib/supabase';
import { queryClient } from '@/lib/query-client';
import { useInAppNotificationCenter } from '@/services/in-app-notification-center';
import { reportOperationalError } from '@/services/operational-error-service';
import type { Tables } from '@/types/database';

const CONNECTION_DELAY_MS = 750;
const connectionKey = (userId: string) => ['matches', 'connections', userId] as const;

export function useInAppRealtimeNotifications(userId: string) {
  const { i18n, t } = useTranslation();

  useEffect(() => {
    const enqueue = useInAppNotificationCenter.getState().enqueue;
    let active = true;
    let removeRealtimeChannel: (() => void) | undefined;

    const refreshConnections = async () => {
      const connections = await matchesService.listConnections(userId);
      if (active) queryClient.setQueryData(connectionKey(userId), connections);
      return connections;
    };

    const findConnection = async (matchId: string, allowRetry: boolean) => {
      const cached = queryClient.getQueryData<MatchConnection[]>(connectionKey(userId));
      const cachedConnection = cached?.find((item) => item.matchId === matchId);
      if (cachedConnection) {
        void refreshConnections().catch(() => undefined);
        return cachedConnection;
      }

      const attempts = allowRetry ? 3 : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const connections = await refreshConnections();
        const connection = connections.find((item) => item.matchId === matchId);
        if (connection) return connection;
        if (attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
        }
      }
      return null;
    };

    const showMatch = async (row: Tables<'matches'>) => {
      if (row.status !== 'active' || (row.user_a !== userId && row.user_b !== userId)) return;
      const connection = await findConnection(row.id, true).catch(() => null);
      if (!active) return;
      enqueue({
        body: t('inAppNotice.matchBody'),
        id: `match:${row.id}`,
        photo: connection?.profile.photo ?? null,
        route: `/chat/${row.id}`,
        title: connection
          ? t('inAppNotice.matchTitle', { name: connection.profile.display_name })
          : t('inAppNotice.matchFallbackTitle'),
        type: 'match',
      });
    };

    const showMessage = async (row: Tables<'messages'>) => {
      if (row.sender_id === userId) return;
      const connection = await findConnection(row.match_id, false).catch(() => null);
      if (!active) return;
      enqueue({
        body: row.content.trim() || t('inAppNotice.photoMessage'),
        id: `message:${row.id}`,
        photo: connection?.profile.photo ?? null,
        route: `/chat/${row.match_id}`,
        title: connection
          ? t('inAppNotice.messageTitle', { name: connection.profile.display_name })
          : t('inAppNotice.messageFallbackTitle'),
        type: 'message',
      });
    };

    const runHandler = (surface: string, task: Promise<void>) => {
      void task.catch((error) => {
        reportOperationalError(surface, error, '/notification-host');
      });
    };

    // 인증·프로필 복원과 같은 프레임에서 WebSocket을 만들지 않는다.
    // 실시간 알림 실패는 핵심 탐색/채팅 화면의 실행을 중단시키면 안 된다.
    const connectTimer = setTimeout(() => {
      if (!active) return;
      try {
        const supabase = getSupabaseClient();
        const channel = supabase
          .channel(`in-app-notices:${userId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'matches' },
            (payload) =>
              runHandler('in_app_notification_match', showMatch(payload.new as Tables<'matches'>)),
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) =>
              runHandler(
                'in_app_notification_message',
                showMessage(payload.new as Tables<'messages'>),
              ),
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              reportOperationalError(
                'in_app_notification_realtime',
                new Error(`Realtime subscription ${status.toLowerCase()}`),
                '/notification-host',
              );
            }
          });

        removeRealtimeChannel = () => {
          void supabase.removeChannel(channel).catch(() => undefined);
        };
      } catch (error) {
        reportOperationalError('in_app_notification_init', error, '/notification-host');
      }
    }, CONNECTION_DELAY_MS);

    return () => {
      active = false;
      clearTimeout(connectTimer);
      removeRealtimeChannel?.();
    };
  }, [i18n.resolvedLanguage, t, userId]);
}
