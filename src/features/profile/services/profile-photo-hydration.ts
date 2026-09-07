import type { ProfilePhotoDraft } from '@/features/profile/types/profile-photo';
import type { Database, Tables } from '@/types/database';

type StoredProfilePhoto = Tables<'profile_photos'> & { signed_url: string };

function getMimeType(storagePath: string): ProfilePhotoDraft['mimeType'] {
  const extension = storagePath.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Restores every persisted profile photo into the editor in database order.
 *
 * Keep this conversion independent from the picker so a cached or partially
 * signed response can never silently collapse a multi-photo profile to one tile.
 */
export function hydrateStoredProfilePhotos(
  photos: StoredProfilePhoto[],
  fallbackReviewStatus: Database['public']['Enums']['profile_review_status'],
): ProfilePhotoDraft[] {
  return [...photos]
    .sort((left, right) => left.position - right.position)
    .map((photo) => ({
      assetId: photo.id,
      draftId: `stored:${photo.id}`,
      fileName: photo.storage_path.split('/').pop() ?? photo.id,
      fileSize: 0,
      height: 1200,
      mimeType: getMimeType(photo.storage_path),
      storagePath: photo.storage_path,
      reviewStatus: photo.review_status ?? fallbackReviewStatus,
      type: 'image',
      uri: photo.signed_url,
      width: 960,
    }));
}
