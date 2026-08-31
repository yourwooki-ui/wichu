import { describe, expect, it } from 'vitest';

import { toMyPreviewProfile } from './my-profile-preview';

describe('toMyPreviewProfile', () => {
  it('reuses the operational profile and exposes approved photos', () => {
    const operational = {
      details: null,
      interests: [{ label: 'Music' }],
      languages: [{ language_code: 'en', proficiency: 'advanced' }],
      profile: {
        id: 'user-1',
        display_name: 'Mina',
        birth_date: '2000-01-01',
        gender: 'woman',
        country_code: 'KR',
        native_language: 'ko',
        languages: ['ko', 'en'],
        bio: 'Hello',
        last_active_at: null,
        created_at: new Date().toISOString(),
        profile_photos: [
          { review_status: 'pending', signed_url: 'pending.jpg' },
          { review_status: 'approved', signed_url: 'approved.jpg' },
        ],
      },
      settings: null,
      tags: [{ category: 'connection_goal', value: 'friends' }],
    } as unknown as Parameters<typeof toMyPreviewProfile>[0];

    const preview = toMyPreviewProfile(operational, 'ko');

    expect(preview.photos).toEqual(['approved.jpg']);
    expect(preview.isPhotoReviewed).toBe(true);
    expect(preview.languageDetails).toEqual([
      { code: 'ko', isNative: true, level: 'native' },
      { code: 'en', isNative: false, level: 'advanced' },
    ]);
    expect(preview.connectionGoals).toEqual(['friends']);
  });
});
