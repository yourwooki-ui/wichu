import { beforeEach, describe, expect, it, vi } from 'vitest';

import { profilePhotoService } from './profile-photo-service';

const { createSignedPhotoUrl, createSignedPhotoUrls, fromBucket } = vi.hoisted(() => ({
  createSignedPhotoUrl: vi.fn(),
  createSignedPhotoUrls: vi.fn(),
  fromBucket: vi.fn(),
}));

vi.mock('expo-file-system', () => ({
  File: class MockFile {},
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    storage: { from: fromBucket },
  }),
}));

describe('profilePhotoService.createSignedPhotoUrls', () => {
  beforeEach(() => {
    createSignedPhotoUrl.mockReset();
    createSignedPhotoUrls.mockReset();
    fromBucket.mockReset();
    fromBucket.mockReturnValue({
      createSignedUrl: createSignedPhotoUrl,
      createSignedUrls: createSignedPhotoUrls,
    });
  });

  it('retries only the failed paths and keeps every recoverable photo', async () => {
    createSignedPhotoUrls.mockResolvedValue({
      data: [
        {
          error: null,
          path: 'profile-id/primary.jpg',
          signedURL: '/primary',
          signedUrl: 'https://photos.test/primary.jpg?token=batch',
        },
        {
          error: 'temporary failure',
          path: 'profile-id/detail.jpg',
          signedURL: null,
          signedUrl: null,
        },
      ],
      error: null,
    });
    createSignedPhotoUrl.mockResolvedValue({
      data: { signedUrl: 'https://photos.test/detail.jpg?token=retry' },
      error: null,
    });

    const result = await profilePhotoService.createSignedPhotoUrls([
      'profile-id/primary.jpg',
      'profile-id/detail.jpg',
    ]);

    expect(result.error).toBeNull();
    expect(result.data?.map((photo) => photo.signedUrl)).toEqual([
      'https://photos.test/primary.jpg?token=batch',
      'https://photos.test/detail.jpg?token=retry',
    ]);
    expect(createSignedPhotoUrl).toHaveBeenCalledTimes(1);
    expect(createSignedPhotoUrl).toHaveBeenCalledWith(
      'profile-id/detail.jpg',
      3600,
      expect.objectContaining({ cacheNonce: expect.any(String) }),
    );
  });

  it('falls back to individual signing when the batch request fails', async () => {
    createSignedPhotoUrls.mockResolvedValue({
      data: null,
      error: new Error('batch unavailable'),
    });
    createSignedPhotoUrl.mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://photos.test/${path}?token=retry` },
      error: null,
    }));

    const result = await profilePhotoService.createSignedPhotoUrls([
      'profile-id/primary.jpg',
      'profile-id/detail.jpg',
    ]);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(createSignedPhotoUrl).toHaveBeenCalledTimes(2);
  });
});
