import { randomUUID } from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import {
  CHAT_IMAGE_LIMIT,
  type ChatImageAttachment,
  type ChatImageMimeType,
} from '@/features/chat/types/chat-attachment';
import { getSupabaseClient } from '@/lib/supabase';

export const CHAT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const CHAT_MEDIA_BUCKET = 'chat-media';
const UPLOAD_CONCURRENCY = 2;

const MIME_EXTENSIONS: Record<ChatImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type ChatImageDraft = Pick<
  ImagePickerAsset,
  'uri' | 'file' | 'fileName' | 'fileSize' | 'mimeType' | 'width' | 'height'
> & {
  draftId: string;
};

function resolveMimeType(image: ChatImageDraft): ChatImageMimeType {
  if (image.mimeType && image.mimeType in MIME_EXTENSIONS) {
    return image.mimeType as ChatImageMimeType;
  }
  if (image.mimeType === 'image/jpg') return 'image/jpeg';

  const extension = image.fileName?.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  throw new Error('JPG, PNG, WebP 이미지만 보낼 수 있어요.');
}

async function getFileSize(image: ChatImageDraft) {
  if (typeof image.fileSize === 'number') return image.fileSize;
  if (Platform.OS === 'web' && image.file) return image.file.size;
  return new ExpoFile(image.uri).size ?? 0;
}

async function readImage(image: ChatImageDraft) {
  if (Platform.OS === 'web' && image.file) return image.file.arrayBuffer();
  return new ExpoFile(image.uri).arrayBuffer();
}

function createStoragePath(
  userId: string,
  matchId: string,
  clientId: string,
  position: number,
  mimeType: ChatImageMimeType,
) {
  return `${userId}/${matchId}/${clientId}/${position}-${randomUUID()}.${MIME_EXTENSIONS[mimeType]}`;
}

export const chatMediaService = {
  async validateDrafts(images: ChatImageDraft[]) {
    for (const image of images) {
      resolveMimeType(image);
      const size = await getFileSize(image);
      if (size <= 0) throw new Error('사진 파일을 읽지 못했어요.');
      if (size > CHAT_IMAGE_MAX_BYTES) {
        throw new Error('사진 한 장은 8MB 이하로 선택해주세요.');
      }
      if (image.width < 1 || image.height < 1) throw new Error('사진 크기를 확인하지 못했어요.');
    }
  },

  async uploadImages(
    userId: string,
    matchId: string,
    clientId: string,
    images: ChatImageDraft[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<ChatImageAttachment[]> {
    if (images.length < 1 || images.length > CHAT_IMAGE_LIMIT) {
      throw new Error(`사진은 한 번에 최대 ${CHAT_IMAGE_LIMIT}장까지 보낼 수 있어요.`);
    }
    await this.validateDrafts(images);

    const supabase = getSupabaseClient();
    const uploadedPaths: string[] = [];
    const prepared = images.map((image, index) => {
      const mimeType = resolveMimeType(image);
      return {
        image,
        mimeType,
        path: createStoragePath(userId, matchId, clientId, index + 1, mimeType),
      };
    });
    const attachments: ChatImageAttachment[] = [];
    const errors: unknown[] = [];
    let nextIndex = 0;
    let completed = 0;
    onProgress?.(0, prepared.length);

    async function uploadWorker() {
      while (nextIndex < prepared.length) {
        const index = nextIndex++;
        const item = prepared[index];
        if (!item) return;
        try {
          const bytes = await readImage(item.image);
          const { error } = await supabase.storage
            .from(CHAT_MEDIA_BUCKET)
            .upload(item.path, bytes, {
              cacheControl: '3600',
              contentType: item.mimeType,
              upsert: false,
            });
          if (error) throw error;
          uploadedPaths.push(item.path);
          attachments[index] = {
            path: item.path,
            mimeType: item.mimeType,
            width: item.image.width,
            height: item.image.height,
            localUri: item.image.uri,
          };
          completed += 1;
          onProgress?.(completed, prepared.length);
        } catch (error) {
          errors.push(error);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, prepared.length) }, uploadWorker),
    );
    if (errors.length > 0) {
      if (uploadedPaths.length)
        await supabase.storage.from(CHAT_MEDIA_BUCKET).remove(uploadedPaths);
      throw errors[0];
    }
    return attachments;
  },

  async hydrateAttachments(attachments: ChatImageAttachment[]) {
    if (!attachments.length) return attachments;
    const { data, error } = await getSupabaseClient()
      .storage.from(CHAT_MEDIA_BUCKET)
      .createSignedUrls(
        attachments.map((attachment) => attachment.path),
        3600,
      );
    if (error) throw error;

    const urls = new Map(
      data.flatMap((item) =>
        item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
      ),
    );
    return attachments.map((attachment) => ({
      ...attachment,
      url: urls.get(attachment.path),
    }));
  },

  async removeImages(paths: string[]) {
    if (!paths.length) return;
    const { error } = await getSupabaseClient().storage.from(CHAT_MEDIA_BUCKET).remove(paths);
    if (error) throw error;
  },
};
