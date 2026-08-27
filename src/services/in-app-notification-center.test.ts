import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type InAppNotification, useInAppNotificationCenter } from './in-app-notification-center';

function messageNotice(id: string): InAppNotification {
  return {
    body: `body-${id}`,
    id,
    photo: null,
    route: `/chat/${id}`,
    title: `title-${id}`,
    type: 'message',
  };
}

describe('in-app notification center', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useInAppNotificationCenter.getState().clear();
  });

  it('keeps only the four most recent notices', () => {
    for (let index = 1; index <= 5; index += 1) {
      useInAppNotificationCenter.getState().enqueue(messageNotice(String(index)));
    }

    expect(useInAppNotificationCenter.getState().queue.map((notice) => notice.id)).toEqual([
      '2',
      '3',
      '4',
      '5',
    ]);
  });

  it('drops a duplicate delivery inside the dedupe window', () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(1_000).mockReturnValueOnce(1_500);

    useInAppNotificationCenter.getState().enqueue(messageNotice('same'));
    useInAppNotificationCenter.getState().enqueue({
      ...messageNotice('same'),
      body: 'duplicate',
    });

    expect(useInAppNotificationCenter.getState().queue).toHaveLength(1);
    expect(useInAppNotificationCenter.getState().queue[0]?.body).toBe('body-same');
  });

  it('replaces an existing route after the dedupe window', () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(1_000).mockReturnValueOnce(2_300);

    useInAppNotificationCenter.getState().enqueue(messageNotice('same'));
    useInAppNotificationCenter.getState().enqueue({
      ...messageNotice('same'),
      body: 'new message',
    });

    expect(useInAppNotificationCenter.getState().queue).toHaveLength(1);
    expect(useInAppNotificationCenter.getState().queue[0]?.body).toBe('new message');
  });

  it('clears queue and dedupe memory together', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    useInAppNotificationCenter.getState().enqueue(messageNotice('same'));
    useInAppNotificationCenter.getState().clear();
    useInAppNotificationCenter.getState().enqueue(messageNotice('same'));

    expect(useInAppNotificationCenter.getState().queue).toHaveLength(1);
  });
});
