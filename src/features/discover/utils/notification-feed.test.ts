import { describe, expect, it } from 'vitest';

import { buildNotificationItems } from './notification-feed';
import type { MatchConnection } from '@/features/matches/services/matches-service';

function connection(overrides: Partial<MatchConnection>): MatchConnection {
  return {
    matchId: 'match-1',
    matchedAt: '2026-08-24T00:00:00Z',
    unreadCount: 0,
    lastMessage: null,
    profile: {
      id: 'p1',
      display_name: '지호',
      country_code: 'KR',
      last_active_at: null,
      age: 24,
      photo: null,
    },
    ...overrides,
  } as MatchConnection;
}

describe('앱 내 알림 목록', () => {
  it('안 읽은 메시지를 알림으로 만든다', () => {
    const items = buildNotificationItems([
      connection({
        unreadCount: 2,
        lastMessage: { content: '안녕하세요', created_at: '2026-08-24T01:00:00Z', sender_id: 'p1' },
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('message:match-1');
  });

  it('아직 대화가 없는 새 매치도 알림으로 만든다', () => {
    const items = buildNotificationItems([connection({})]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('match:match-1');
  });

  it('이미 대화가 오간 매치는 알림이 아니다', () => {
    const items = buildNotificationItems([
      connection({
        lastMessage: { content: '반가워요', created_at: '2026-08-24T01:00:00Z', sender_id: 'me' },
      }),
    ]);
    expect(items).toHaveLength(0);
  });

  it('입력이 없으면 빈 목록', () => {
    expect(buildNotificationItems(undefined)).toEqual([]);
  });

  // 헤더 배지는 이 목록의 길이로 켜진다. 새 매치만 있어도 배지가 켜져야 한다.
  it('새 매치만 있어도 배지가 켜질 조건을 만족한다', () => {
    expect(buildNotificationItems([connection({})]).length > 0).toBe(true);
  });
});
