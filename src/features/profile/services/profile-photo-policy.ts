export const PROFILE_PHOTO_MAX_LONG_EDGE = 2048;

export function getProfilePhotoResize(width: number, height: number) {
  if (width <= 0 || height <= 0 || Math.max(width, height) <= PROFILE_PHOTO_MAX_LONG_EDGE) {
    return null;
  }
  return width >= height
    ? { width: PROFILE_PHOTO_MAX_LONG_EDGE, height: null }
    : { width: null, height: PROFILE_PHOTO_MAX_LONG_EDGE };
}
