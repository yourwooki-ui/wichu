import { create } from 'zustand';

import { Profile, SwipeAction } from '@/types/profile';

type SwipeRecord = { profileId: string; action: SwipeAction; swipedAt: number };

type DiscoverState = {
  profiles: Profile[];
  swipeHistory: SwipeRecord[];
  mergeProfiles: (profiles: Profile[]) => void;
  recycleProfiles: (profiles: Profile[]) => void;
  recordSwipe: (profileId: string, action: SwipeAction) => void;
  restoreSwipe: (profile: Profile) => void;
  removeProfile: (profileId: string) => void;
  clearDeck: () => void;
};

export const useDiscoverStore = create<DiscoverState>((set) => ({
  profiles: [],
  swipeHistory: [],
  mergeProfiles: (profiles) =>
    set((state) => {
      const dismissedIds = new Set(state.swipeHistory.map((record) => record.profileId));
      const existingIds = new Set(state.profiles.map((profile) => profile.id));
      const nextProfiles = profiles.filter(
        (profile) => !dismissedIds.has(profile.id) && !existingIds.has(profile.id),
      );
      return nextProfiles.length > 0 ? { profiles: [...state.profiles, ...nextProfiles] } : state;
    }),
  recycleProfiles: (profiles) =>
    set((state) => {
      const existingIds = new Set(state.profiles.map((profile) => profile.id));
      const recycledProfiles = profiles.filter((profile) => !existingIds.has(profile.id));
      if (recycledProfiles.length === 0) return state;

      const recycledIds = new Set(recycledProfiles.map((profile) => profile.id));
      return {
        profiles: [...state.profiles, ...recycledProfiles],
        swipeHistory: state.swipeHistory.filter((record) => !recycledIds.has(record.profileId)),
      };
    }),
  recordSwipe: (profileId, action) =>
    set((state) => ({
      profiles: state.profiles.filter((profile) => profile.id !== profileId),
      swipeHistory: [...state.swipeHistory, { profileId, action, swipedAt: Date.now() }],
    })),
  restoreSwipe: (profile) =>
    set((state) => ({
      profiles: [profile, ...state.profiles.filter((item) => item.id !== profile.id)],
      swipeHistory: state.swipeHistory.filter((record) => record.profileId !== profile.id),
    })),
  removeProfile: (profileId) =>
    set((state) => ({ profiles: state.profiles.filter((profile) => profile.id !== profileId) })),
  clearDeck: () => set({ profiles: [], swipeHistory: [] }),
}));
