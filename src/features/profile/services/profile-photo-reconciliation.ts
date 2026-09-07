import type { Database, Tables } from '@/types/database';

const MAX_PROFILE_PHOTOS = 6;

export type SignedStoredProfilePhoto = Tables<'profile_photos'> & { signed_url: string };

type RecoveredStoragePhoto = {
  signedUrl: string;
  storagePath: string;
};

/**
 * Builds the private editor's complete photo list.
 *
 * The database rows remain authoritative and keep their moderation state. Files
 * that exist only in the owner's Storage folder are recovered as pending photos
 * so an older partial save cannot collapse the editor to a single image.
 */
export function reconcileEditableProfilePhotos(
  databasePhotos: SignedStoredProfilePhoto[],
  recoveredStoragePhotos: RecoveredStoragePhoto[],
  profileId: string,
  fallbackReviewStatus: Database['public']['Enums']['profile_review_status'],
): SignedStoredProfilePhoto[] {
  const orderedDatabasePhotos = [...databasePhotos].sort(
    (left, right) => left.position - right.position,
  );
  const knownPaths = new Set(orderedDatabasePhotos.map((photo) => photo.storage_path));
  const ownerPrefix = `${profileId}/`;

  const recoveredPhotos = recoveredStoragePhotos.flatMap((photo) => {
    if (
      !photo.storagePath.startsWith(ownerPrefix) ||
      !photo.signedUrl ||
      knownPaths.has(photo.storagePath)
    ) {
      return [];
    }

    knownPaths.add(photo.storagePath);
    return [
      {
        created_at: '1970-01-01T00:00:00.000Z',
        id: `storage:${photo.storagePath}`,
        position: 0,
        profile_id: profileId,
        review_note: null,
        review_status:
          fallbackReviewStatus === 'draft' ? fallbackReviewStatus : ('pending' as const),
        reviewed_at: null,
        reviewed_by: null,
        signed_url: photo.signedUrl,
        storage_path: photo.storagePath,
        submitted_at: null,
      },
    ];
  });

  return [...orderedDatabasePhotos, ...recoveredPhotos]
    .slice(0, MAX_PROFILE_PHOTOS)
    .map((photo, index) => ({ ...photo, position: index + 1 }));
}
