import { describe, expect, it } from 'vitest';

import { CHAT_IMAGE_LIMIT, parseChatAttachments } from '../types/chat-attachment';

describe('parseChatAttachments', () => {
  it('keeps valid immutable image metadata', () => {
    expect(
      parseChatAttachments([
        {
          path: 'sender/match/client/1-photo.jpg',
          mimeType: 'image/jpeg',
          width: 1200,
          height: 1600,
        },
      ]),
    ).toEqual([
      {
        path: 'sender/match/client/1-photo.jpg',
        mimeType: 'image/jpeg',
        width: 1200,
        height: 1600,
      },
    ]);
  });

  it('drops malformed and unsupported metadata', () => {
    expect(
      parseChatAttachments([
        null,
        { path: 'x', mimeType: 'image/gif', width: 10, height: 10 },
        { path: 'x', mimeType: 'image/png', width: 0, height: 10 },
      ]),
    ).toEqual([]);
  });

  it('never accepts more than the message limit', () => {
    const attachments = Array.from({ length: CHAT_IMAGE_LIMIT + 2 }, (_, index) => ({
      path: `sender/match/client/${index + 1}-photo.webp`,
      mimeType: 'image/webp',
      width: 800,
      height: 800,
    }));
    expect(parseChatAttachments(attachments)).toHaveLength(CHAT_IMAGE_LIMIT);
  });
});
