import type { ImagePickerAsset } from 'expo-image-picker';

export type NormalizedProfilePhotoSelection = ImagePickerAsset & {
  sourceIdentity: string;
};

type PhotoIdentityCarrier = ImagePickerAsset & {
  sourceIdentity?: string;
};

export function getProfilePhotoIdentity(photo: PhotoIdentityCarrier) {
  if (photo.sourceIdentity) return photo.sourceIdentity;
  if (photo.assetId) return `asset:${photo.assetId}`;
  return `uri:${photo.uri}`;
}

/**
 * Keeps every selected asset distinguishable even after Android normalization
 * turns metadata-less images into the same generic JPEG filename and size.
 * A failed conversion only skips that asset instead of discarding the batch.
 */
export async function normalizeProfilePhotoSelections(
  assets: ImagePickerAsset[],
  normalize: (asset: ImagePickerAsset) => Promise<ImagePickerAsset>,
) {
  const settled = await Promise.allSettled(
    assets.map(async (asset) => ({
      ...(await normalize(asset)),
      sourceIdentity: getProfilePhotoIdentity(asset),
    })),
  );

  return {
    assets: settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    failed: settled.filter((result) => result.status === 'rejected').length,
  };
}
