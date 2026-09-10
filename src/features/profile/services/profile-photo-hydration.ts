import type { ProfilePhotoDraft } from '@/features/profile/types/profile-photo';
import type { Database, Tables } from '@/types/database';

type StoredProfilePhoto = Tables<'profile_photos'> & { signed_url: string };

type SignedPhotoUrlResult = {
  path: string | null;
  signedUrl: string | null;
};

function getMimeType(storagePath: string): ProfilePhotoDraft['mimeType'] {
  const extension = storagePath.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Adds any available signed URLs without discarding authoritative database rows.
 * Missing URLs are refreshed by the individual editor tile after hydration.
 */
export function attachSignedUrlsToProfilePhotos(
  photos: Tables<'profile_photos'>[],
  signedResults: SignedPhotoUrlResult[],
): StoredProfilePhoto[] {
  const signedUrlsByPath = new Map(
    signedResults.flatMap((result) =>
      result.path && result.signedUrl ? [[result.path, result.signedUrl] as const] : [],
    ),
  );

  return [...photos]
    .sort((left, right) => left.position - right.position)
    .map((photo) => ({
      ...photo,
      signed_url: signedUrlsByPath.get(photo.storage_path) ?? '',
    }));
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
