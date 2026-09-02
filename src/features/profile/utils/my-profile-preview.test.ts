import { describe, expect, it } from 'vitest';

import { supportedLanguages } from '../../../i18n/languages';

import { toMyPreviewProfile } from './my-profile-preview';

function createOperationalProfile() {
  return {
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
}

describe('toMyPreviewProfile', () => {
  it('keeps approved and pending photos in order for the private preview', () => {
    const operational = createOperationalProfile();

    const preview = toMyPreviewProfile(operational, 'ko');

    expect(preview.photos).toEqual(['pending.jpg', 'approved.jpg']);
    expect(preview.photoReviewStatuses).toEqual(['pending', 'approved']);
    expect(preview.isPhotoReviewed).toBe(false);
    expect(preview.languageDetails).toEqual([
      { code: 'ko', isNative: true, level: 'native' },
      { code: 'en', isNative: false, level: 'advanced' },
    ]);
    expect(preview.connectionGoals).toEqual(['friends']);
  });

  it.each(supportedLanguages)('converts the private preview safely in $code', ({ code }) => {
    const preview = toMyPreviewProfile(createOperationalProfile(), code);

    expect(preview.countryLabel).toBeTruthy();
    expect(preview.photos).toHaveLength(2);
  });

  it('tolerates incomplete persisted locale and collection values', () => {
    const operational = createOperationalProfile() as unknown as {
      interests: null;
      languages: null;
      profile: {
        country_code: null;
        languages: null;
        native_language: null;
        profile_photos: null;
      };
      tags: null;
    };
    operational.interests = null;
    operational.languages = null;
    operational.tags = null;
    operational.profile.country_code = null;
    operational.profile.languages = null;
    operational.profile.native_language = null;
    operational.profile.profile_photos = null;

    const preview = toMyPreviewProfile(
      operational as unknown as Parameters<typeof toMyPreviewProfile>[0],
      '',
    );

    expect(preview.countryCode).toBe('');
    expect(preview.countryLabel).toBe('');
    expect(preview.languages).toEqual([]);
    expect(preview.languageDetails).toEqual([]);
    expect(preview.photos).toEqual([]);
  });
});
