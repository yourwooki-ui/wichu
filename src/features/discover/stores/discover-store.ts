import { create } from 'zustand';

import { mockProfiles } from '@/features/discover/data/mock-profiles';
import { Profile, SwipeAction } from '@/types/profile';

type SwipeRecord = { profileId: string; action: SwipeAction; swipedAt: number };

type DiscoverState = {
  profiles: Profile[];
  swipeHistory: SwipeRecord[];
  recordSwipe: (profileId: string, action: SwipeAction) => void;
  resetMockDeck: () => void;
};

export const useDiscoverStore = create<DiscoverState>((set) => ({
  profiles: mockProfiles,
  swipeHistory: [],
  recordSwipe: (profileId, action) =>
    set((state) => ({
      profiles: state.profiles.filter((profile) => profile.id !== profileId),
      swipeHistory: [...state.swipeHistory, { profileId, action, swipedAt: Date.now() }],
    })),
  resetMockDeck: () => set({ profiles: mockProfiles, swipeHistory: [] }),
}));
