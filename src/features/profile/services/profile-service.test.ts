import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SignedStoredProfilePhoto } from './profile-photo-reconciliation';
import { profileService } from './profile-service';

const { createSignedPhotoUrls, listMyStoredPhotos } = vi.hoisted(() => ({
  createSignedPhotoUrls: vi.fn(),
  listMyStoredPhotos: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock('@/features/profile/utils/my-profile-preview', () => ({
  toMyPreviewProfile: vi.fn(),
}));

vi.mock('./profile-photo-service', () => ({
  profilePhotoService: {
    createSignedPhotoUrls,
    listMyStoredPhotos,
  },
}));

function createPhoto(id: string): SignedStoredProfilePhoto {
  return {
    created_at: '2026-09-08T00:00:00.000Z',
    id,
    position: 1,
    profile_id: 'profile-id',
    review_note: null,
    review_status: 'approved',
    reviewed_at: null,
    reviewed_by: null,
    signed_url: `https://photos.test/${id}.jpg?fresh=1`,
    storage_path: `profile-id/${id}.jpg`,
    submitted_at: null,
  };
}

function createOperationalProfile() {
  return {
    details: null,
    interests: [],
    languages: [],
    profile: {
      profile_photos: [createPhoto('primary')],
      review_status: 'approved',
    },
    prompts: [],
    settings: null,
    tags: [],
  } as unknown as Awaited<ReturnType<typeof profileService.getMyOperationalProfile>>;
}

describe('profileService.getMyEditableProfile', () => {
  beforeEach(() => {
    createSignedPhotoUrls.mockReset();
    listMyStoredPhotos.mockReset();
    vi.restoreAllMocks();
  });

  it('keeps database photos visible when the optional Storage listing fails', async () => {
    const operational = createOperationalProfile();
    vi.spyOn(profileService, 'getMyOperationalProfile').mockResolvedValue(operational);
    listMyStoredPhotos.mockRejectedValue(new Error('Storage temporarily unavailable'));

    await expect(profileService.getMyEditableProfile('profile-id')).resolves.toBe(operational);
    expect(createSignedPhotoUrls).not.toHaveBeenCalled();
  });

  it('recovers every signable orphan without blanking photos for one broken file', async () => {
    const operational = createOperationalProfile();
    vi.spyOn(profileService, 'getMyOperationalProfile').mockResolvedValue(operational);
    listMyStoredPhotos.mockResolvedValue([
      'profile-id/primary.jpg',
      'profile-id/recovered.jpg',
      'profile-id/broken.jpg',
    ]);
    createSignedPhotoUrls.mockResolvedValue({
      data: [
        {
          path: 'profile-id/recovered.jpg',
          signedUrl: 'https://photos.test/recovered.jpg?fresh=1',
        },
        { error: 'Object not found', path: 'profile-id/broken.jpg', signedUrl: null },
      ],
      error: null,
    });

    const result = await profileService.getMyEditableProfile('profile-id');

    expect(result.profile.profile_photos.map((photo) => photo.storage_path)).toEqual([
      'profile-id/primary.jpg',
      'profile-id/recovered.jpg',
    ]);
  });
});
