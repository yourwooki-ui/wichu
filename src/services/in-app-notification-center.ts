import { create } from 'zustand';

export type InAppNotification = {
  body: string;
  id: string;
  photo: string | null;
  route: '/chat' | '/matches' | `/chat/${string}`;
  title: string;
  type: 'match' | 'message';
};

type NotificationCenterState = {
  clear: () => void;
  dismiss: (id: string) => void;
  enqueue: (notice: InAppNotification) => void;
  queue: InAppNotification[];
};

const MAX_QUEUED_NOTICES = 4;
const DUPLICATE_WINDOW_MS = 1200;
const recentlyQueued = new Map<string, number>();

export const useInAppNotificationCenter = create<NotificationCenterState>((set) => ({
  queue: [],
  enqueue: (notice) =>
    set((state) => {
      // Match 푸시는 /matches, Realtime은 정확한 /chat/:id를 사용한다.
      // 같은 사건의 두 전달 경로가 겹치지 않도록 Match는 종류 단위로 합친다.
      const group = notice.type === 'match' ? 'match' : `${notice.type}:${notice.route}`;
      const queuedAt = Date.now();
      const previousQueuedAt = recentlyQueued.get(group);
      const existingIndex = state.queue.findIndex(
        (item) => (item.type === 'match' ? 'match' : `${item.type}:${item.route}`) === group,
      );
      if (previousQueuedAt !== undefined && queuedAt - previousQueuedAt < DUPLICATE_WINDOW_MS) {
        return state;
      }
      recentlyQueued.set(group, queuedAt);
      if (existingIndex >= 0) {
        const queue = [...state.queue];
        queue[existingIndex] = notice;
        return { queue };
      }
      return { queue: [...state.queue, notice].slice(-MAX_QUEUED_NOTICES) };
    }),
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),
  clear: () => {
    recentlyQueued.clear();
    set({ queue: [] });
  },
}));
