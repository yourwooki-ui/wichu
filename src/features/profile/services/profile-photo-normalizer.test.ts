import { describe, expect, it } from 'vitest';

import { getProfilePhotoResize } from './profile-photo-policy';

describe('getProfilePhotoResize', () => {
  it('keeps photos already within the upload boundary', () => {
    expect(getProfilePhotoResize(1600, 2000)).toBeNull();
  });

  it('preserves portrait and landscape aspect ratios through one constrained edge', () => {
    expect(getProfilePhotoResize(4000, 3000)).toEqual({ width: 2048, height: null });
    expect(getProfilePhotoResize(2000, 4000)).toEqual({ width: null, height: 2048 });
  });
});
