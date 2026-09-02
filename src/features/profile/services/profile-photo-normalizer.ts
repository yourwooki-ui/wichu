import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import { getProfilePhotoResize } from './profile-photo-policy';

const JPEG_QUALITY = 0.86;

/**
 * Converts device-specific assets (including HEIC) to a predictable upload.
 * The native module is loaded only after the user has picked a photo so it can
 * never participate in the app-start import graph.
 */
export async function normalizeProfilePhotoAsset(
  asset: ImagePickerAsset,
): Promise<ImagePickerAsset> {
  if (Platform.OS === 'web') return asset;

  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const context = ImageManipulator.manipulate(asset.uri);
  const resize = getProfilePhotoResize(asset.width, asset.height);
  if (resize) context.resize(resize);

  const rendered = await context.renderAsync();
  const normalized = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  return {
    ...asset,
    assetId: null,
    fileName: `${asset.fileName?.replace(/\.[^.]+$/, '') || 'wichu-profile'}.jpg`,
    fileSize: undefined,
    height: normalized.height,
    mimeType: 'image/jpeg',
    uri: normalized.uri,
    width: normalized.width,
  };
}
