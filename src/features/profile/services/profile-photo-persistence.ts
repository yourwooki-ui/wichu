type StagedProfilePhotos = {
  orderedPaths: string[];
  uploadedPaths: string[];
};

type PhotoCleanupPhase = 'rollback' | 'obsolete';

type PersistProfilePhotoChangesOptions = {
  stage: () => Promise<StagedProfilePhotos>;
  commit: (orderedPaths: string[]) => Promise<string[]>;
  removeStorageFiles: (storagePaths: string[]) => Promise<void>;
  onCleanupError?: (error: unknown, phase: PhotoCleanupPhase) => void;
};

async function removeStorageFilesSafely(
  storagePaths: string[],
  phase: PhotoCleanupPhase,
  removeStorageFiles: PersistProfilePhotoChangesOptions['removeStorageFiles'],
  onCleanupError?: PersistProfilePhotoChangesOptions['onCleanupError'],
) {
  if (storagePaths.length === 0) return;

  try {
    await removeStorageFiles(storagePaths);
  } catch (error) {
    onCleanupError?.(error, phase);
  }
}

/**
 * Keeps the database commit as the source of truth.
 *
 * New uploads are rolled back only when the database commit fails. Once the
 * commit succeeds, deleting obsolete objects is best-effort and must never
 * delete the newly committed photos or turn a successful save into an error.
 */
export async function persistProfilePhotoChanges({
  stage,
  commit,
  removeStorageFiles,
  onCleanupError,
}: PersistProfilePhotoChangesOptions) {
  const stagedPhotos = await stage();
  let obsoletePaths: string[];

  try {
    obsoletePaths = await commit(stagedPhotos.orderedPaths);
  } catch (error) {
    await removeStorageFilesSafely(
      stagedPhotos.uploadedPaths,
      'rollback',
      removeStorageFiles,
      onCleanupError,
    );
    throw error;
  }

  await removeStorageFilesSafely(obsoletePaths, 'obsolete', removeStorageFiles, onCleanupError);

  return stagedPhotos;
}
