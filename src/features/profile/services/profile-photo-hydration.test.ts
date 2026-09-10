import { describe, expect, it } from 'vitest';

import type { Tables } from '@/types/database';

import {
  attachSignedUrlsToProfilePhotos,
  hydrateStoredProfilePhotos,
} from './profile-photo-hydration';

function createStoredPhoto(
  id: string,
  position: number,
  reviewStatus: Tables<'profile_photos'>['review_status'] = 'approved',
) {
  return {
    created_at: '2026-09-06T00:00:00.000Z',
    id,
    position,
    profile_id: 'profile-id',
    review_note: null,
    review_status: reviewStatus,
    reviewed_at: null,
    reviewed_by: null,
    signed_url: `https://photos.test/${id}.jpg`,
    storage_path: `profile-id/${id}.jpg`,
    submitted_at: null,
  };
}

describe('profile photo editor hydration', () => {
  it('preserves every database photo when one signed URL is missing', () => {
    const first = createStoredPhoto('first', 1);
    const second = createStoredPhoto('second', 2);
    const rows = attachSignedUrlsToProfilePhotos(
      [first, second].map(({ signed_url: _signedUrl, ...photo }) => photo),
      [{ path: first.storage_path, signedUrl: first.signed_url }],
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((photo) => photo.storage_path)).toEqual([
      'profile-id/first.jpg',
      'profile-id/second.jpg',
    ]);
    expect(rows.map((photo) => photo.signed_url)).toEqual(['https://photos.test/first.jpg', '']);
  });

  it('restores all persisted photos in their saved order', () => {
    const drafts = hydrateStoredProfilePhotos(
      [
        createStoredPhoto('third', 3),
        createStoredPhoto('first', 1),
        createStoredPhoto('second', 2),
      ],
      'approved',
    );

    expect(drafts).toHaveLength(3);
    expect(drafts.map((photo) => photo.draftId)).toEqual([
      'stored:first',
      'stored:second',
      'stored:third',
    ]);
    expect(drafts.map((photo) => photo.uri)).toEqual([
      'https://photos.test/first.jpg',
      'https://photos.test/second.jpg',
      'https://photos.test/third.jpg',
    ]);
  });

  it('does not drop any of six photos with mixed review states', () => {
    const statuses = [
      'approved',
      'pending',
      'rejected',
      'approved',
      'pending',
      'approved',
    ] as const;
    const drafts = hydrateStoredProfilePhotos(
      statuses.map((status, index) => createStoredPhoto(`photo-${index + 1}`, index + 1, status)),
      'pending',
    );

    expect(drafts).toHaveLength(6);
    expect(drafts.map((photo) => photo.reviewStatus)).toEqual(statuses);
    expect(new Set(drafts.map((photo) => photo.draftId)).size).toBe(6);
  });
});
