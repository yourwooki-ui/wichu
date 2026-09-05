import { describe, expect, it } from 'vitest';

import { getProfilePhotoResize } from './profile-photo-policy';
import {
  getProfilePhotoIdentity,
  normalizeProfilePhotoSelections,
} from './profile-photo-selection';

describe('getProfilePhotoResize', () => {
  it('keeps photos already within the upload boundary', () => {
    expect(getProfilePhotoResize(1600, 2000)).toBeNull();
  });

  it('preserves portrait and landscape aspect ratios through one constrained edge', () => {
    expect(getProfilePhotoResize(4000, 3000)).toEqual({ width: 2048, height: null });
    expect(getProfilePhotoResize(2000, 4000)).toEqual({ width: null, height: 2048 });
  });
});

describe('profile photo selection normalization', () => {
  const createAsset = (uri: string) => ({
    assetId: null,
    fileName: null,
    fileSize: undefined,
    height: 1200,
    mimeType: 'image/jpeg' as const,
    type: 'image' as const,
    uri,
    width: 960,
  });

  it('keeps metadata-less Android selections distinct after normalization', async () => {
    const result = await normalizeProfilePhotoSelections(
      [createAsset('content://photo/one'), createAsset('content://photo/two')],
      async (asset) => ({
        ...asset,
        assetId: null,
        fileName: 'wichu-profile.jpg',
        fileSize: undefined,
        uri: 'file://normalized/profile.jpg',
      }),
    );

    expect(result.failed).toBe(0);
    expect(result.assets).toHaveLength(2);
    expect(result.assets.map(getProfilePhotoIdentity)).toEqual([
      'uri:content://photo/one',
      'uri:content://photo/two',
    ]);
  });

  it('keeps successful photos when one native conversion fails', async () => {
    const result = await normalizeProfilePhotoSelections(
      [createAsset('content://photo/ok'), createAsset('content://photo/broken')],
      async (asset) => {
        if (asset.uri.endsWith('/broken')) throw new Error('conversion failed');
        return asset;
      },
    );

    expect(result.failed).toBe(1);
    expect(result.assets.map(getProfilePhotoIdentity)).toEqual(['uri:content://photo/ok']);
  });
});
