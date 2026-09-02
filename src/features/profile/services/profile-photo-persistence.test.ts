import { describe, expect, it, vi } from 'vitest';

import { persistProfilePhotoChanges } from './profile-photo-persistence';

const stagedPhotos = {
  orderedPaths: ['profile/old.jpg', 'profile/new.jpg'],
  uploadedPaths: ['profile/new.jpg'],
};

describe('profile photo persistence', () => {
  it('rolls back only newly uploaded files when the database commit fails', async () => {
    const commitError = new Error('database commit failed');
    const removeStorageFiles = vi.fn().mockResolvedValue(undefined);

    await expect(
      persistProfilePhotoChanges({
        stage: vi.fn().mockResolvedValue(stagedPhotos),
        commit: vi.fn().mockRejectedValue(commitError),
        removeStorageFiles,
      }),
    ).rejects.toBe(commitError);

    expect(removeStorageFiles).toHaveBeenCalledOnce();
    expect(removeStorageFiles).toHaveBeenCalledWith(['profile/new.jpg']);
  });

  it('does not fail or delete committed new photos when obsolete cleanup fails', async () => {
    const cleanupError = new Error('storage cleanup failed');
    const removeStorageFiles = vi.fn().mockRejectedValue(cleanupError);
    const onCleanupError = vi.fn();

    await expect(
      persistProfilePhotoChanges({
        stage: vi.fn().mockResolvedValue(stagedPhotos),
        commit: vi.fn().mockResolvedValue(['profile/obsolete.jpg']),
        removeStorageFiles,
        onCleanupError,
      }),
    ).resolves.toEqual(stagedPhotos);

    expect(removeStorageFiles).toHaveBeenCalledOnce();
    expect(removeStorageFiles).toHaveBeenCalledWith(['profile/obsolete.jpg']);
    expect(onCleanupError).toHaveBeenCalledWith(cleanupError, 'obsolete');
  });

  it('preserves the original commit error even when rollback cleanup also fails', async () => {
    const commitError = new Error('database commit failed');
    const cleanupError = new Error('rollback cleanup failed');
    const onCleanupError = vi.fn();

    await expect(
      persistProfilePhotoChanges({
        stage: vi.fn().mockResolvedValue(stagedPhotos),
        commit: vi.fn().mockRejectedValue(commitError),
        removeStorageFiles: vi.fn().mockRejectedValue(cleanupError),
        onCleanupError,
      }),
    ).rejects.toBe(commitError);

    expect(onCleanupError).toHaveBeenCalledWith(cleanupError, 'rollback');
  });
});
