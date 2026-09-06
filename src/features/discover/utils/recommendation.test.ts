import { describe, expect, it } from 'vitest';

import { rankDiscoveryProfiles } from './recommendation';
import type { Profile } from '@/types/profile';

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: 'profile',
    name: 'Profile',
    age: 27,
    gender: 'woman',
    countryCode: 'KR',
    countryLabel: 'Korea',
    languages: ['ko'],
    bio: 'Hello',
    interests: [],
    photos: ['photo'],
    lastActiveAt: null,
    ...overrides,
  };
}

describe('discovery recommendations', () => {
  const now = new Date('2026-09-06T12:00:00.000Z').getTime();

  it('always exposes an online profile before an offline profile with a stronger fit', () => {
    const ranked = rankDiscoveryProfiles(
      [
        profile({
          id: 'recent-goal',
          connectionGoals: ['long_term'],
          lastActiveAt: '2026-09-06T11:00:00.000Z',
        }),
        profile({ id: 'online', lastActiveAt: '2026-09-06T11:56:00.000Z' }),
      ],
      { connectionGoals: ['long_term'], interestLabels: [], languageCodes: [] },
      now,
    );

    expect(ranked.map((item) => item.id)).toEqual(['online', 'recent-goal']);
  });

  it('uses exact recency before profile fit within the recent tier', () => {
    const ranked = rankDiscoveryProfiles(
      [
        profile({
          id: 'older-goal',
          connectionGoals: ['long_term'],
          lastActiveAt: '2026-09-06T11:40:00.000Z',
        }),
        profile({ id: 'newer', lastActiveAt: '2026-09-06T11:50:00.000Z' }),
      ],
      { connectionGoals: ['long_term'], interestLabels: [], languageCodes: [] },
      now,
    );

    expect(ranked.map((item) => item.id)).toEqual(['newer', 'older-goal']);
  });

  it('uses profile fit only after activity is tied', () => {
    const ranked = rankDiscoveryProfiles(
      [
        profile({ id: 'plain', lastActiveAt: '2026-09-06T10:00:00.000Z' }),
        profile({
          id: 'goal',
          connectionGoals: ['long_term'],
          lastActiveAt: '2026-09-06T10:00:00.000Z',
        }),
      ],
      { connectionGoals: ['long_term'], interestLabels: [], languageCodes: [] },
      now,
    );

    expect(ranked.map((item) => item.id)).toEqual(['goal', 'plain']);
  });

  it('adds explainable reasons for shared interests and languages', () => {
    const [ranked] = rankDiscoveryProfiles(
      [profile({ interests: ['Photography'], languages: ['en'] })],
      { connectionGoals: [], interestLabels: ['photography'], languageCodes: ['EN'] },
      now,
    );

    expect(ranked?.recommendationReasons).toEqual(['shared_interests', 'language_match']);
  });
});
