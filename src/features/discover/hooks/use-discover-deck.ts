import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { reviewSamplesEnabled } from '@/constants/feature-flags';
import { INTERSTITIAL_ADS_ENABLED } from '@/constants/features';
import { DISCOVER_PREPARE_COUNT } from '@/features/discover/constants';
import { discoveryService } from '@/features/discover/services/discovery-service';
import { useDiscoverStore } from '@/features/discover/stores/discover-store';
import { adsService } from '@/features/monetization/services/ads-service';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { useAuthSession } from '@/hooks/use-auth-session';
import { hapticsService } from '@/services/haptics-service';
import { productAnalyticsService } from '@/services/product-analytics-service';
import type { Profile, SwipeAction } from '@/types/profile';

type UndoableSwipe = { profile: Profile; action: SwipeAction; userId: string };
type MatchedProfile = { matchId: string; profile: Profile };

export function useDiscoverDeck() {
  const { session } = useAuthSession();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [swipeError, setSwipeError] = useState<string | null>(null);
  const [lastMatch, setLastMatch] = useState<MatchedProfile | null>(null);
  const [undoStack, setUndoStack] = useState<UndoableSwipe[]>([]);
  const trackedEmpty = useRef(false);
  const userId = session?.user.id;
  const passEntitlement = usePassEntitlement();
  const undoEntitlementQuery = useQuery({
    enabled: Boolean(userId) && !reviewSamplesEnabled,
    queryFn: discoveryService.getUndoEntitlement,
    queryKey: ['discover', 'undo-entitlement', userId],
    staleTime: 10_000,
  });
  const undoUnlimited =
    (passEntitlement.data?.unlimitedUndo ?? false) ||
    (undoEntitlementQuery.data?.unlimited ?? false);
  const undoCredits = reviewSamplesEnabled ? 0 : (undoEntitlementQuery.data?.credits ?? 0);
  const undoEntitlementReady =
    reviewSamplesEnabled || (!passEntitlement.isPending && !undoEntitlementQuery.isPending);
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
      reviewSamplesEnabled
        ? discoveryService.getDevelopmentSampleCandidates(preferencesQuery.data!, locale)
        : discoveryService.getCandidates(preferencesQuery.data!, locale),
  });

  useEffect(() => {
    clearDeck();
    trackedEmpty.current = false;
  }, [clearDeck, userId]);

  useEffect(() => {
    if (!userId) return;
    productAnalyticsService.track('discover_viewed', undefined, '/discover');
  }, [userId]);

  useEffect(() => {
    if (!candidatesQuery.data) return;
    if (reviewSamplesEnabled) recycleProfiles(candidatesQuery.data);
    else mergeProfiles(candidatesQuery.data);
  }, [candidatesQuery.data, mergeProfiles, recycleProfiles]);

  useEffect(() => {
    if (!candidatesQuery.isSuccess || profiles.length > 0 || trackedEmpty.current) return;
    trackedEmpty.current = true;
    productAnalyticsService.track(
      'discover_empty',
      {
        country_filter_count: preferencesQuery.data?.countryCodes?.length ?? 0,
        goal_filter_count: preferencesQuery.data?.connectionGoals.length ?? 0,
        unlimited_distance: preferencesQuery.data?.maxDistanceKm === 0,
      },
      '/discover',
    );
  }, [candidatesQuery.isSuccess, preferencesQuery.data, profiles.length]);

  const swipeMutation = useMutation({
    mutationFn: ({ profile, action }: { profile: Profile; action: SwipeAction }) =>
      discoveryService.swipe(userId!, profile.id, action),
    onMutate: ({ profile, action }) => {
      setSwipeError(null);
      setUndoStack((current) => [...current, { profile, action, userId: userId! }]);
      recordSwipe(profile.id, action);
    },
    onError: (_error, { profile }) => {
      restoreSwipe(profile);
      setUndoStack((current) => current.filter((item) => item.profile.id !== profile.id));
      setSwipeError('선택을 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    },
    onSuccess: ({ matchId }, { profile, action }) => {
      productAnalyticsService.track(
        'swipe_recorded',
        {
          action,
          has_intro: false,
        },
        '/discover',
      );
      if (matchId) {
        productAnalyticsService.track('match_created', undefined, '/discover');
        setLastMatch({ matchId, profile });
        // A completed match is a hard boundary: older swipes cannot skip past it.
        setUndoStack([]);
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
        void queryClient.invalidateQueries({ queryKey: ['chat-list'] });
      } else if (INTERSTITIAL_ADS_ENABLED && passEntitlement.isSuccess) {
        void adsService.showInterstitial(
          'discover_swipe',
          passEntitlement.data?.adsRemoved ?? false,
        );
      }
    },
    onSettled: () => {
      const remainingProfiles = useDiscoverStore.getState().profiles.length;
      if (reviewSamplesEnabled && candidatesQuery.data) {
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
      hapticsService.selection();
      setSwipeError(null);
      restoreSwipe(profile);
      setUndoStack((current) => current.slice(0, -1));
    },
    onError: (_error, { profile, action, userId: swipeUserId }) => {
      recordSwipe(profile.id, action);
      setUndoStack((current) => [...current, { profile, action, userId: swipeUserId }]);
      setSwipeError('선택을 되돌리지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['discover', 'undo-entitlement', userId], {
        credits: result.creditsRemaining,
        unlimited: result.unlimited,
      });
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: (filters: Parameters<typeof discoveryService.updatePreferences>[1]) =>
      discoveryService.updatePreferences(userId!, filters),
    onSuccess: (filters) => {
      productAnalyticsService.track(
        'discovery_filters_saved',
        {
          country_count: filters.countryCodes?.length ?? 0,
          goal_count: filters.connectionGoals.length,
          unlimited_distance: filters.maxDistanceKm === 0,
        },
        '/discover',
      );
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
    const lastSwipe = undoStack.at(-1);
    if (
      !userId ||
      !lastSwipe ||
      lastSwipe.userId !== userId ||
      swipeMutation.isPending ||
      undoMutation.isPending ||
      (!undoUnlimited && undoCredits < 1 && !reviewSamplesEnabled)
    )
      return;
    undoMutation.mutate(lastSwipe);
  }, [undoCredits, undoStack, undoUnlimited, swipeMutation.isPending, undoMutation, userId]);

  const watchRewardedAdAndUndo = useCallback(async () => {
    const lastSwipe = undoStack.at(-1);
    if (!lastSwipe || !userId || lastSwipe.userId !== userId) return 'unavailable' as const;
    const result = await adsService.showRewardedUndo('discover_undo', userId);
    if (result !== 'rewarded') return result;

    if (reviewSamplesEnabled) {
      undoMutation.mutate(lastSwipe);
      return 'undone' as const;
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const refreshed = await undoEntitlementQuery.refetch();
      if ((refreshed.data?.credits ?? 0) >= 1) {
        undoMutation.mutate(lastSwipe);
        return 'undone' as const;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    return 'pending-credit' as const;
  }, [undoEntitlementQuery, undoMutation, undoStack, userId]);

  const clearLastMatch = useCallback(() => setLastMatch(null), []);

  const queryError = preferencesQuery.error ?? candidatesQuery.error;

  return {
    profiles,
    swipe,
    undo,
    canUndo:
      undoEntitlementReady &&
      undoStack.at(-1)?.userId === userId &&
      !swipeMutation.isPending &&
      !undoMutation.isPending,
    canUndoWithoutAd: undoUnlimited || undoCredits > 0,
    undoCredits,
    undoUnlimited,
    watchRewardedAdAndUndo,
    retry,
    isLoading: profiles.length === 0 && (preferencesQuery.isLoading || candidatesQuery.isLoading),
    isRefilling: candidatesQuery.isFetching && profiles.length > 0,
    error: swipeError ?? (queryError instanceof Error ? queryError.message : null),
    lastMatch,
    clearLastMatch,
    preferences: preferencesQuery.data,
    savePreferences: preferencesMutation.mutateAsync,
    isSavingPreferences: preferencesMutation.isPending,
  };
}
