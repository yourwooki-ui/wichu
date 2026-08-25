export const CHAT_IMAGE_LIMIT = 5;

export type ChatImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type ChatImageAttachment = {
  path: string;
  mimeType: ChatImageMimeType;
  width: number;
  height: number;
  url?: string;
  localUri?: string;
};

const SUPPORTED_MIME_TYPES = new Set<ChatImageMimeType>(['image/jpeg', 'image/png', 'image/webp']);

export function parseChatAttachments(value: unknown): ChatImageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, CHAT_IMAGE_LIMIT).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.path !== 'string' ||
      !isChatImageMimeType(candidate.mimeType) ||
      typeof candidate.width !== 'number' ||
      typeof candidate.height !== 'number' ||
      candidate.width < 1 ||
      candidate.height < 1
    ) {
      return [];
    }
    return [
      {
        path: candidate.path,
        mimeType: candidate.mimeType,
        width: candidate.width,
        height: candidate.height,
      },
    ];
  });
}

function isChatImageMimeType(value: unknown): value is ChatImageMimeType {
  return typeof value === 'string' && SUPPORTED_MIME_TYPES.has(value as ChatImageMimeType);
}
