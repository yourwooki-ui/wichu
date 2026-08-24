import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';

import type { ProfilePhotoDraft } from '@/features/profile/types/profile-photo';
import { getSupabaseClient } from '@/lib/supabase';

const PHOTO_BUCKET = 'profile-photos';
const UPLOAD_CONCURRENCY = 2;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function resolveMimeType(photo: ProfilePhotoDraft) {
  if (photo.mimeType && MIME_EXTENSIONS[photo.mimeType]) return photo.mimeType;

  const extension = photo.fileName?.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';

  throw new Error('Choose a JPG, PNG, or WebP image.');
}

async function readPhoto(photo: ProfilePhotoDraft) {
  if (Platform.OS === 'web' && photo.file) return photo.file.arrayBuffer();
  return new ExpoFile(photo.uri).arrayBuffer();
}

function createStoragePath(profileId: string, position: number, extension: string) {
  const uniquePart = `${Date.now()}-${position}-${Math.random().toString(36).slice(2, 10)}`;
  return `${profileId}/${uniquePart}.${extension}`;
}

export const profilePhotoService = {
  async createSignedPhotoUrl(storagePath: string, expiresIn = 3600) {
    return getSupabaseClient().storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, expiresIn);
  },
  async createSignedPhotoUrls(storagePaths: string[], expiresIn = 3600) {
    if (storagePaths.length === 0) return { data: [], error: null };
    return getSupabaseClient().storage.from(PHOTO_BUCKET).createSignedUrls(storagePaths, expiresIn);
  },
  async listMyStoredPhotos(profileId: string) {
    const { data, error } = await getSupabaseClient()
      .storage.from(PHOTO_BUCKET)
      .list(profileId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'asc' },
      });
    if (error) throw error;

    return data
      .filter((file) => file.id && !file.name.startsWith('.'))
      .map((file) => `${profileId}/${file.name}`);
  },
  async uploadPhotos(
    profileId: string,
    photos: ProfilePhotoDraft[],
    onProgress?: (completed: number, total: number) => void,
  ) {
    const supabase = getSupabaseClient();
    const uploadedPaths: string[] = [];

    try {
      const preparedPhotos = photos.map((photo, index) => {
        const mimeType = resolveMimeType(photo);
        const position = index + 1;
        return {
          photo,
          mimeType,
          position,
          storagePath: createStoragePath(profileId, position, MIME_EXTENSIONS[mimeType]),
        };
      });
      const uploadErrors: unknown[] = [];
      let nextIndex = 0;
      let completed = 0;
      onProgress?.(0, photos.length);

      async function uploadWorker() {
        while (nextIndex < preparedPhotos.length) {
          const preparedPhoto = preparedPhotos[nextIndex];
          nextIndex += 1;
          if (!preparedPhoto) return;

          const { photo, mimeType, storagePath } = preparedPhoto;
          try {
            const fileData = await readPhoto(photo);
            const { error } = await supabase.storage
              .from(PHOTO_BUCKET)
              .upload(storagePath, fileData, {
                cacheControl: '31536000',
                contentType: mimeType,
                upsert: false,
              });
            if (error) throw error;
            uploadedPaths.push(storagePath);
            completed += 1;
            onProgress?.(completed, photos.length);
          } catch (error) {
            uploadErrors.push(error);
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, preparedPhotos.length) }, uploadWorker),
      );
      if (uploadErrors.length > 0) throw uploadErrors[0];

      const { error: rowError } = await supabase.from('profile_photos').insert(
        preparedPhotos.map(({ position, storagePath }) => ({
          profile_id: profileId,
          storage_path: storagePath,
          position,
        })),
      );
      if (rowError) throw rowError;
      return uploadedPaths;
    } catch (error) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
      }
      throw error;
    }
  },
  async stageNewPhotos(
    profileId: string,
    photos: ProfilePhotoDraft[],
    onProgress?: (completed: number, total: number) => void,
  ) {
    const newPhotos = photos.filter((photo) => !photo.storagePath);
    const uploadedPaths = await this.uploadPhotoFiles(profileId, newPhotos, onProgress);
    let uploadedIndex = 0;
    return {
      orderedPaths: photos.map((photo) => photo.storagePath ?? uploadedPaths[uploadedIndex++]!),
      uploadedPaths,
    };
  },
  async uploadPhotoFiles(
    profileId: string,
    photos: ProfilePhotoDraft[],
    onProgress?: (completed: number, total: number) => void,
  ) {
    const supabase = getSupabaseClient();
    const uploadedPaths: string[] = [];
    const preparedPhotos = photos.map((photo, index) => {
      const mimeType = resolveMimeType(photo);
      return {
        index,
        photo,
        mimeType,
        storagePath: createStoragePath(profileId, index + 1, MIME_EXTENSIONS[mimeType]),
      };
    });
    const uploadErrors: unknown[] = [];
    let nextIndex = 0;
    let completed = 0;
    onProgress?.(0, photos.length);

    async function uploadWorker() {
      while (nextIndex < preparedPhotos.length) {
        const preparedPhoto = preparedPhotos[nextIndex++];
        if (!preparedPhoto) return;
        try {
          const fileData = await readPhoto(preparedPhoto.photo);
          const { error } = await supabase.storage
            .from(PHOTO_BUCKET)
            .upload(preparedPhoto.storagePath, fileData, {
              cacheControl: '31536000',
              contentType: preparedPhoto.mimeType,
              upsert: false,
            });
          if (error) throw error;
          uploadedPaths[preparedPhoto.index] = preparedPhoto.storagePath;
          completed += 1;
          onProgress?.(completed, photos.length);
        } catch (error) {
          uploadErrors.push(error);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, preparedPhotos.length) }, uploadWorker),
    );
    if (uploadErrors.length > 0) {
      const uploadedStoragePaths = uploadedPaths.filter(Boolean);
      if (uploadedStoragePaths.length) {
        await supabase.storage.from(PHOTO_BUCKET).remove(uploadedStoragePaths);
      }
      throw uploadErrors[0];
    }
    return uploadedPaths;
  },
  async removeUploadedPhotos(profileId: string, storagePaths: string[]) {
    if (storagePaths.length === 0) return;
    const supabase = getSupabaseClient();
    await supabase
      .from('profile_photos')
      .delete()
      .eq('profile_id', profileId)
      .in('storage_path', storagePaths);
    await supabase.storage.from(PHOTO_BUCKET).remove(storagePaths);
  },
  async removeStorageFiles(storagePaths: string[]) {
    if (storagePaths.length === 0) return;
    const { error } = await getSupabaseClient().storage.from(PHOTO_BUCKET).remove(storagePaths);
    if (error) throw error;
  },
};
