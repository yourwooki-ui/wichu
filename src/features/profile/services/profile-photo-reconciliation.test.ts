import { describe, expect, it } from 'vitest';

import type { Tables } from '@/types/database';

import {
  reconcileEditableProfilePhotos,
  type SignedStoredProfilePhoto,
} from './profile-photo-reconciliation';

function createDatabasePhoto(id: string, position: number): SignedStoredProfilePhoto {
  return {
    created_at: '2026-09-07T00:00:00.000Z',
    id,
    position,
    profile_id: 'profile-id',
    review_note: null,
    review_status: 'approved',
    reviewed_at: null,
    reviewed_by: null,
    signed_url: `https://photos.test/${id}.jpg`,
    storage_path: `profile-id/${id}.jpg`,
    submitted_at: null,
  } satisfies Tables<'profile_photos'> & { signed_url: string };
}

describe('editable profile photo reconciliation', () => {
  it('keeps every database photo in its saved order', () => {
    const photos = reconcileEditableProfilePhotos(
      [createDatabasePhoto('third', 3), createDatabasePhoto('first', 1)],
      [],
      'profile-id',
      'approved',
    );

    expect(photos.map((photo) => photo.storage_path)).toEqual([
      'profile-id/first.jpg',
      'profile-id/third.jpg',
    ]);
    expect(photos.map((photo) => photo.position)).toEqual([1, 2]);
  });

  it('restores every owner upload missing from a one-row database snapshot', () => {
    const photos = reconcileEditableProfilePhotos(
      [createDatabasePhoto('primary', 1)],
      ['second', 'third', 'fourth'].map((id) => ({
        signedUrl: `https://photos.test/${id}.jpg`,
        storagePath: `profile-id/${id}.jpg`,
      })),
      'profile-id',
      'approved',
    );

    expect(photos).toHaveLength(4);
    expect(photos.map((photo) => photo.storage_path)).toEqual([
      'profile-id/primary.jpg',
      'profile-id/second.jpg',
      'profile-id/third.jpg',
      'profile-id/fourth.jpg',
    ]);
    expect(photos.slice(1).every((photo) => photo.review_status === 'pending')).toBe(true);
  });

  it('deduplicates paths, rejects foreign folders, and caps the editor at six photos', () => {
    const photos = reconcileEditableProfilePhotos(
      [createDatabasePhoto('primary', 1)],
      [
        { signedUrl: 'duplicate', storagePath: 'profile-id/primary.jpg' },
        { signedUrl: 'foreign', storagePath: 'other-profile/private.jpg' },
        ...Array.from({ length: 8 }, (_, index) => ({
          signedUrl: `https://photos.test/recovered-${index}.jpg`,
          storagePath: `profile-id/recovered-${index}.jpg`,
        })),
      ],
      'profile-id',
      'approved',
    );

    expect(photos).toHaveLength(6);
    expect(new Set(photos.map((photo) => photo.storage_path)).size).toBe(6);
    expect(photos.every((photo) => photo.profile_id === 'profile-id')).toBe(true);
  });
});
