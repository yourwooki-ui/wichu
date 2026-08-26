import { describe, expect, it } from 'vitest';

import { isNearChatBottom, shouldAutoScrollChat } from './chat-scroll';

describe('chat scroll behavior', () => {
  it('treats the final 96 pixels as the bottom zone', () => {
    expect(isNearChatBottom({ contentHeight: 1000, offsetY: 304, viewportHeight: 600 })).toBe(true);
    expect(isNearChatBottom({ contentHeight: 1000, offsetY: 250, viewportHeight: 600 })).toBe(
      false,
    );
  });

  it('scrolls to the initial conversation and messages sent by me', () => {
    expect(
      shouldAutoScrollChat({
        isNearBottom: false,
        latestMessageIsMine: false,
        nextCount: 12,
        previousCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldAutoScrollChat({
        isNearBottom: false,
        latestMessageIsMine: true,
        nextCount: 13,
        previousCount: 12,
      }),
    ).toBe(true);
  });

  it('preserves the reading position for older pages and incoming messages', () => {
    expect(
      shouldAutoScrollChat({
        isNearBottom: true,
        latestMessageIsMine: false,
        nextCount: 32,
        previousCount: 12,
      }),
    ).toBe(false);
    expect(
      shouldAutoScrollChat({
        isNearBottom: false,
        latestMessageIsMine: false,
        nextCount: 13,
        previousCount: 12,
      }),
    ).toBe(false);
  });
});
