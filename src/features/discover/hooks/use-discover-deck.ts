import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DISCOVER_PREPARE_COUNT } from '@/features/discover/constants';
import { discoveryService } from '@/features/discover/services/discovery-service';
import { useDiscoverStore } from '@/features/discover/stores/discover-store';
import { useAuthSession } from '@/hooks/use-auth-session';
import type { Profile, SwipeAction } from '@/types/profile';

type UndoableSwipe = { profile: Profile; action: SwipeAction; userId: string };

export function useDiscoverDeck() {
  const { session } = useAuthSession();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [swipeError, setSwipeError] = useState<string | null>(null);
  const [lastMatchId, setLastMatchId] = useState<string | null>(null);
  const [lastSwipe, setLastSwipe] = useState<UndoableSwipe | null>(null);
  const userId = session?.user.id;
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const profiles = useDiscoverStore((state) => state.profiles);
  const mergeProfiles = useDiscoverStore((state) => state.mergeProfiles);
  const recycleProfiles = useDiscoverStore((state) => state.recycleProfiles);
  const recordSwipe = useDiscoverStore((state) => state.recordSwipe);
  const restoreSwipe = useDiscoverStore((state) => state.restoreSwipe);
  const clearDeck = useDiscoverStore((state) => state.clearDeck);

  const preferencesQuery = useQuery({
    queryKey: ['discover', 'preferences', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: () => discoveryService.getPreferences(userId!),
  });

  const candidatesQuery = useQuery({
    queryKey: ['discover', 'candidates', userId, preferencesQuery.data, locale],
    enabled: Boolean(userId && preferencesQuery.data),
    staleTime: 15_000,
    queryFn: () =>
      __DEV__
        ? discoveryService.getDevelopmentSampleCandidates(preferencesQuery.data!, locale)
        : discoveryService.getCandidates(preferencesQuery.data!, locale),
  });

  useEffect(() => {
    clearDeck();
  }, [clearDeck, userId]);

  useEffect(() => {
    if (!candidatesQuery.data) return;
    if (__DEV__) recycleProfiles(candidatesQuery.data);
    else mergeProfiles(candidatesQuery.data);
  }, [candidatesQuery.data, mergeProfiles, recycleProfiles]);

  const swipeMutation = useMutation({
    mutationFn: ({ profile, action }: { profile: Profile; action: SwipeAction }) =>
      discoveryService.swipe(userId!, profile.id, action),
    onMutate: ({ profile, action }) => {
      setSwipeError(null);
      setLastSwipe({ profile, action, userId: userId! });
      recordSwipe(profile.id, action);
    },
    onError: (_error, { profile }) => {
      restoreSwipe(profile);
      setLastSwipe((current) => (current?.profile.id === profile.id ? null : current));
      setSwipeError('선택을 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    },
    onSuccess: ({ matchId }, { profile }) => {
      if (matchId) {
        setLastMatchId(matchId);
        setLastSwipe((current) => (current?.profile.id === profile.id ? null : current));
      }
    },
    onSettled: () => {
      const remainingProfiles = useDiscoverStore.getState().profiles.length;
      if (__DEV__ && candidatesQuery.data) {
        recycleProfiles(candidatesQuery.data);
        return;
      }
      if (remainingProfiles < DISCOVER_PREPARE_COUNT) {
        void candidatesQuery.refetch();
      }
    },
  });

  const undoMutation = useMutation({
    mutationFn: ({ profile, userId: swipeUserId }: UndoableSwipe) =>
      discoveryService.undoSwipe(swipeUserId, profile.id),
    onMutate: ({ profile }) => {
      setSwipeError(null);
      restoreSwipe(profile);
      setLastSwipe(null);
    },
    onError: (_error, { profile, action, userId: swipeUserId }) => {
      recordSwipe(profile.id, action);
      setLastSwipe({ profile, action, userId: swipeUserId });
      setSwipeError('선택을 되돌리지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: (filters: Parameters<typeof discoveryService.updatePreferences>[1]) =>
      discoveryService.updatePreferences(userId!, filters),
    onSuccess: (filters) => {
      queryClient.setQueryData(['discover', 'preferences', userId], filters);
      clearDeck();
      void queryClient.invalidateQueries({ queryKey: ['discover', 'candidates', userId] });
    },
  });

  const swipe = useCallback(
    (profile: Profile, action: SwipeAction) => {
      if (!userId) return;
      swipeMutation.mutate({ profile, action });
    },
    [swipeMutation, userId],
  );

  const retry = useCallback(() => {
    setSwipeError(null);
    void Promise.all([preferencesQuery.refetch(), candidatesQuery.refetch()]);
  }, [candidatesQuery, preferencesQuery]);

  const undo = useCallback(() => {
    if (
      !userId ||
      !lastSwipe ||
      lastSwipe.userId !== userId ||
      swipeMutation.isPending ||
      undoMutation.isPending
    )
      return;
    undoMutation.mutate(lastSwipe);
  }, [lastSwipe, swipeMutation.isPending, undoMutation, userId]);

  const queryError = preferencesQuery.error ?? candidatesQuery.error;

  return {
    profiles,
    swipe,
    undo,
    canUndo: lastSwipe?.userId === userId && !swipeMutation.isPending && !undoMutation.isPending,
    retry,
    isLoading: profiles.length === 0 && (preferencesQuery.isLoading || candidatesQuery.isLoading),
    isRefilling: candidatesQuery.isFetching && profiles.length > 0,
    error: swipeError ?? (queryError instanceof Error ? queryError.message : null),
    lastMatchId,
    clearLastMatch: () => setLastMatchId(null),
    preferences: preferencesQuery.data,
    savePreferences: preferencesMutation.mutateAsync,
    isSavingPreferences: preferencesMutation.isPending,
  };
}
