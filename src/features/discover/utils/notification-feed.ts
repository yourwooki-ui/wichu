import type { MatchConnection } from '@/features/matches/services/matches-service';

export type NotificationItem = {
  body: string;
  id: string;
  matchId: string;
  photo: string | null;
  time: string;
  title: string;
};

type NotificationCopy = {
  matchBody: string;
  matchTitle: (name: string) => string;
  messageFallback: string;
  messageTitle: (name: string) => string;
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
  copy: NotificationCopy = {
    matchBody: 'Send the first hello.',
    matchTitle: (name) => `You matched with ${name}`,
    messageFallback: 'You received a new message.',
    messageTitle: (name) => `New message from ${name}`,
  },
): NotificationItem[] {
  return (connections ?? []).flatMap((connection) => {
    if (connection.unreadCount > 0) {
      return [
        {
          body: connection.lastMessage?.content ?? copy.messageFallback,
          id: `message:${connection.matchId}`,
          matchId: connection.matchId,
          photo: connection.profile.photo,
          time: connection.lastMessage?.created_at ?? connection.matchedAt,
          title: copy.messageTitle(connection.profile.display_name),
        },
      ];
    }

    // 아직 아무도 말을 걸지 않은 새 매치도 알림이다.
    if (!connection.lastMessage) {
      return [
        {
          body: copy.matchBody,
          id: `match:${connection.matchId}`,
          matchId: connection.matchId,
          photo: connection.profile.photo,
          time: connection.matchedAt,
          title: copy.matchTitle(connection.profile.display_name),
        },
      ];
    }

    return [];
  });
}
