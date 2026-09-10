import { describe, expect, it } from 'vitest';

import type { ConnectionProfile, ConversationPreview } from '@/features/matches/types/connection';
import { rankConnectionProfiles, rankConversations } from './connection-ranking';

function profile(overrides: Partial<ConnectionProfile>): ConnectionProfile {
  return {
    age: 24,
    countryCode: 'KR',
    distanceKm: 1,
    id: 'profile',
    isNew: false,
    isOnline: false,
    matchedAt: '',
    name: 'Profile',
    photo: 'photo',
    ...overrides,
  };
}

function conversation(
  candidate: ConnectionProfile,
  overrides: Partial<ConversationPreview> = {},
): ConversationPreview {
  return {
    matchId: candidate.id,
    message: '',
    profile: candidate,
    time: '',
    unreadCount: 0,
    ...overrides,
  };
}

describe('connection activity ranking', () => {
  it('keeps an online profile ahead of Gold and new profile signals', () => {
    const ranked = rankConnectionProfiles([
      profile({ id: 'gold-new', isGoldPass: true, isNew: true }),
      profile({ id: 'online', isOnline: true }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(['online', 'gold-new']);
  });

  it('uses exact recent activity before secondary signals', () => {
    const ranked = rankConnectionProfiles([
      profile({ id: 'older-gold', isGoldPass: true, lastActiveAt: '2026-09-06T08:00:00Z' }),
      profile({ id: 'newer', lastActiveAt: '2026-09-06T09:00:00Z' }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(['newer', 'older-gold']);
  });

  it('keeps online chat ahead of an offline unread chat', () => {
    const ranked = rankConversations([
      conversation(profile({ id: 'offline' }), { unreadCount: 4 }),
      conversation(profile({ id: 'online', isOnline: true })),
    ]);

    expect(ranked.map((item) => item.matchId)).toEqual(['online', 'offline']);
  });
});
