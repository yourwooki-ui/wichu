import type { MatchConnection } from '@/features/matches/services/matches-service';

export type NotificationItem = {
  body: string;
  id: string;
  matchId: string;
  photo: string | null;
  time: string;
  title: string;
};

/**
 * 앱 안 알림 목록.
 *
 * 헤더 배지와 알림 시트가 각자 조건을 들고 있으면 어긋난다.
 * 실제로 배지는 안 읽은 메시지만 보고, 시트는 새 매치까지 보여줘서
 * "새 매치가 생겼는데 배지가 안 켜지는" 상태가 있었다.
 * 두 곳이 반드시 같은 목록을 쓰도록 판정을 여기로 모은다.
 */
export function buildNotificationItems(
  connections: readonly MatchConnection[] | undefined,
): NotificationItem[] {
  return (connections ?? []).flatMap((connection) => {
    if (connection.unreadCount > 0) {
      return [
        {
          body: connection.lastMessage?.content ?? '새 메시지가 도착했어요.',
          id: `message:${connection.matchId}`,
          matchId: connection.matchId,
          photo: connection.profile.photo,
          time: connection.lastMessage?.created_at ?? connection.matchedAt,
          title: `${connection.profile.display_name}님의 새 메시지`,
        },
      ];
    }

    // 아직 아무도 말을 걸지 않은 새 매치도 알림이다.
    if (!connection.lastMessage) {
      return [
        {
          body: '지금 첫 인사를 보내보세요.',
          id: `match:${connection.matchId}`,
          matchId: connection.matchId,
          photo: connection.profile.photo,
          time: connection.matchedAt,
          title: `${connection.profile.display_name}님과 매치됐어요`,
        },
      ];
    }

    return [];
  });
}
