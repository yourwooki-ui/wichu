import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppTabHeader } from '@/components/AppTabHeader';
import { CountryFlag } from '@/components/CountryFlag';
import { GoldBadge } from '@/components/GoldBadge';
import { MotionIllustratedIcon } from '@/components/MotionIllustratedIcon';
import { Screen } from '@/components/Screen';
import { ConnectionGridSkeleton } from '@/components/Skeleton';
import {
  categoryEntering,
  categoryExiting,
  listEntering,
  listExiting,
  listLayout,
} from '@/constants/motion';
import { StateView } from '@/components/StateView';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { MONETIZATION_ENABLED } from '@/constants/features';
import { reviewSamplesEnabled } from '@/constants/feature-flags';
import { elevation, palette, pressFeedback, radius, typography } from '@/constants/theme';
import { type ConnectionProfile, mockConnections } from '@/features/matches/data/mock-connections';
import { matchesService } from '@/features/matches/services/matches-service';
import { useAdGatedNavigation } from '@/features/monetization/hooks/use-ad-gated-navigation';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { profileVisitService } from '@/features/profile/services/profile-visit-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { hapticsService } from '@/services/haptics-service';
import { reportOperationalError } from '@/services/operational-error-service';

type MatchCategory = 'picked-me' | 'matched' | 'visitors';

const profilesByCategory: Record<MatchCategory, ConnectionProfile[]> = {
  'picked-me': [mockConnections[0], mockConnections[1], mockConnections[3], mockConnections[4]],
  matched: mockConnections,
  visitors: [mockConnections[2], mockConnections[0], mockConnections[4], mockConnections[3]],
};

const visitorTimes: Record<string, { count: number; unit: 'minutes' | 'days' }> = {
  'mock-sofia': { count: 2, unit: 'minutes' },
  'mock-lina': { count: 18, unit: 'minutes' },
  'mock-clara': { count: 1, unit: 'days' },
  'mock-yuna': { count: 3, unit: 'days' },
};

function includeReviewSamples(
  liveProfiles: ConnectionProfile[],
  sampleProfiles: ConnectionProfile[],
) {
  if (!reviewSamplesEnabled) return liveProfiles;
  const sampleIds = new Set(sampleProfiles.map((profile) => profile.id));
  return [...sampleProfiles, ...liveProfiles.filter((profile) => !sampleIds.has(profile.id))];
}

export function MatchesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigateWithAdGate = useAdGatedNavigation();
  const entitlement = usePassEntitlement();
  const { session } = useAuthSession();
  const [category, setCategory] = useState<MatchCategory>('picked-me');
  const [categoryDirection, setCategoryDirection] = useState<-1 | 1>(1);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const categories: { key: MatchCategory; label: string }[] = [
    { key: 'picked-me', label: t('matches.categories.picked') },
    { key: 'matched', label: t('matches.categories.matched') },
    { key: 'visitors', label: t('matches.categories.visitors') },
  ];
  const categoryCopy: Record<MatchCategory, { description: string }> = {
    'picked-me': { description: t('matches.descriptions.picked') },
    matched: { description: t('matches.descriptions.matched') },
    visitors: { description: t('matches.descriptions.visitors') },
  };
  const emptyCategoryCopy: Record<
    MatchCategory,
    { title: string; body: string; actionLabel: string }
  > = {
    'picked-me': {
      title: t('matches.empty.pickedTitle'),
      body: t('matches.empty.pickedBody'),
      actionLabel: t('matches.empty.discover'),
    },
    matched: {
      title: t('matches.empty.matchedTitle'),
      body: t('matches.empty.matchedBody'),
      actionLabel: t('matches.empty.discover'),
    },
    visitors: {
      title: t('matches.empty.visitorsTitle'),
      body: t('matches.empty.visitorsBody'),
      actionLabel: t('matches.empty.profile'),
    },
  };
  const incomingLikesQuery = useQuery({
    enabled: Boolean(session?.user.id),
    queryFn: matchesService.listIncomingLikes,
    queryKey: ['matches', 'incoming-likes', session?.user.id],
    staleTime: 20_000,
  });
  const visitorsQuery = useQuery({
    enabled: entitlement.data?.tier === 'gold',
    queryFn: profileVisitService.getMyVisitors,
    queryKey: ['profile-visitors'],
    staleTime: 30_000,
  });
  const matchesQuery = useQuery({
    enabled: Boolean(session?.user.id),
    queryFn: () => matchesService.listConnections(session!.user.id),
    queryKey: ['matches', 'connections', session?.user.id],
    staleTime: 20_000,
  });
  const connectionQueryError =
    incomingLikesQuery.error ?? matchesQuery.error ?? visitorsQuery.error;
  useEffect(() => {
    if (connectionQueryError) {
      reportOperationalError('matches_query', connectionQueryError, '/matches');
    }
  }, [connectionQueryError]);
  const visitors = (visitorsQuery.data ?? []).map((visitor): ConnectionProfile => ({
    id: visitor.visitor_id,
    name: visitor.display_name,
    age: visitor.age,
    countryCode: visitor.country_code,
    distanceKm: visitor.distance_km ?? 0,
    photo: visitor.photo,
    matchedAt: '',
    isOnline:
      Boolean(visitor.last_active_at) &&
      now - new Date(visitor.last_active_at!).getTime() <= 5 * 60 * 1000,
    isNew: false,
    isGoldPass: visitor.is_gold_pass,
  }));
  const realMatches = (matchesQuery.data ?? []).map((connection): ConnectionProfile => ({
    id: connection.profile.id,
    name: connection.profile.display_name,
    age: connection.profile.age,
    countryCode: connection.profile.country_code,
    distanceKm: 0,
    photo: connection.profile.photo ?? '',
    matchedAt: connection.matchedAt,
    isOnline:
      Boolean(connection.profile.last_active_at) &&
      now - new Date(connection.profile.last_active_at!).getTime() <= 5 * 60 * 1000,
    isNew: now - new Date(connection.matchedAt).getTime() <= 24 * 60 * 60 * 1000,
  }));
  const incomingLikes = (incomingLikesQuery.data ?? []).map((like): ConnectionProfile => ({
    id: like.profileId,
    name: like.displayName,
    age: like.age,
    countryCode: like.countryCode,
    distanceKm: like.distanceKm ?? 0,
    photo: like.photo,
    matchedAt: like.likedAt,
    isOnline:
      Boolean(like.lastActiveAt) && now - new Date(like.lastActiveAt!).getTime() <= 5 * 60 * 1000,
    isNew: now - new Date(like.likedAt).getTime() <= 24 * 60 * 60 * 1000,
    isGoldPass: like.isGoldPass,
    introMessage: like.introMessage,
  }));
  const matchedProfiles = includeReviewSamples(realMatches, profilesByCategory.matched);
  const pickedProfiles = prioritizeGoldProfiles(
    includeReviewSamples(incomingLikes, profilesByCategory['picked-me']),
  );
  const visitorProfiles = includeReviewSamples(visitors, profilesByCategory.visitors);
  const profiles =
    category === 'visitors'
      ? visitorProfiles
      : category === 'matched'
        ? matchedProfiles
        : pickedProfiles;
  const copy = categoryCopy[category];
  const emptyCopy = emptyCategoryCopy[category];
  const visitorsLocked =
    category === 'visitors' && entitlement.data?.tier !== 'gold' && !reviewSamplesEnabled;
  const categoryLoading =
    !reviewSamplesEnabled &&
    (category === 'picked-me'
      ? incomingLikesQuery.isLoading
      : category === 'matched'
        ? matchesQuery.isLoading
        : !visitorsLocked && visitorsQuery.isLoading);
  const categoryError =
    !reviewSamplesEnabled &&
    (category === 'picked-me'
      ? incomingLikesQuery.isError
      : category === 'matched'
        ? matchesQuery.isError
        : !visitorsLocked && visitorsQuery.isError);

  const refreshControl = useRefreshControl(
    useCallback(
      () =>
        Promise.all([
          incomingLikesQuery.refetch(),
          matchesQuery.refetch(),
          visitorsLocked ? Promise.resolve(null) : visitorsQuery.refetch(),
        ]),
      [incomingLikesQuery, matchesQuery, visitorsLocked, visitorsQuery],
    ),
  );

  const openProfile = (profile: ConnectionProfile) => {
    const realMatch = matchesQuery.data?.find((match) => match.profile.id === profile.id);
    const context =
      category === 'matched' ? 'matched' : category === 'visitors' ? 'visitor' : 'incoming-like';
    const matchId =
      category === 'matched'
        ? (realMatch?.matchId ?? `mock-match-${profile.name.toLowerCase()}`)
        : undefined;
    const matchQuery = matchId ? `&matchId=${encodeURIComponent(matchId)}` : '';
    void navigateWithAdGate(`/profile/${profile.id}?context=${context}${matchQuery}`);
  };

  const openChat = (profile: ConnectionProfile) => {
    const realMatch = matchesQuery.data?.find((match) => match.profile.id === profile.id);
    void navigateWithAdGate(
      `/chat/${realMatch?.matchId ?? `mock-match-${profile.name.toLowerCase()}`}`,
    );
  };

  const selectCategory = (nextCategory: MatchCategory) => {
    if (nextCategory === category) return;
    hapticsService.selection();
    setCategoryDirection(
      categories.findIndex((item) => item.key === nextCategory) >
        categories.findIndex((item) => item.key === category)
        ? 1
        : -1,
    );
    setCategory(nextCategory);
  };

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <AppTabHeader
        actionIcon={illustratedIcons.matches}
        actionMotion={pickedProfiles.length ? 'pulse' : undefined}
        eyebrow={t('matches.eyebrow')}
      />

      <View accessibilityRole="tablist" style={styles.categories}>
        {categories.map((item) => {
          const selected = item.key === category;
          const count =
            item.key === 'visitors'
              ? visitorProfiles.length
              : item.key === 'matched'
                ? matchedProfiles.length
                : pickedProfiles.length;
          return (
            <MatchCategoryTab
              count={count}
              key={item.key}
              label={item.label}
              onPress={() => selectCategory(item.key)}
              selected={selected}
            />
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Animated.View
          entering={categoryEntering(categoryDirection)}
          exiting={categoryExiting(categoryDirection)}
          key={category}
        >
          <Text style={styles.subtitle}>{copy.description}</Text>

          {visitorsLocked ? (
            <View style={styles.visitorLock}>
              <View style={styles.visitorLockCopy}>
                <View style={styles.visitorLockIcon}>
                  <MotionIllustratedIcon
                    motion="shine"
                    size={40}
                    source={illustratedIcons.goldPass}
                  />
                </View>
                <View style={styles.visitorLockTextBlock}>
                  <Text style={styles.visitorLockTitle}>{t('matches.visitorLockTitle')}</Text>
                  <Text style={styles.visitorLockText}>{t('matches.visitorLockBody')}</Text>
                </View>
              </View>
              {MONETIZATION_ENABLED ? (
                <Pressable
                  accessibilityLabel={t('matches.goldAction')}
                  accessibilityRole="button"
                  onPress={() => router.push('/(tabs)/shop')}
                  style={styles.visitorLockAction}
                >
                  <Text style={styles.visitorLockActionText}>{t('matches.goldAction')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {categoryLoading ? (
            <ConnectionGridSkeleton />
          ) : categoryError ? (
            <StateView
              actionLabel={t('reliability.retry')}
              body={t('reliability.connectionsBody')}
              illustration={illustratedIcons.connectionError}
              onAction={() => {
                if (category === 'picked-me') void incomingLikesQuery.refetch();
                if (category === 'matched') void matchesQuery.refetch();
                if (category === 'visitors') void visitorsQuery.refetch();
              }}
              title={t('reliability.connectionsTitle')}
              tone="error"
            />
          ) : !profiles.length ? (
            <StateView
              actionLabel={emptyCopy.actionLabel}
              body={emptyCopy.body}
              icon={category === 'matched' ? 'chatbubbles-outline' : 'heart-outline'}
              illustration={illustratedIcons.connections}
              onAction={() =>
                router.push(category === 'visitors' ? '/(tabs)/me' : '/(tabs)/discover')
              }
              title={emptyCopy.title}
            />
          ) : (
            <View style={styles.grid}>
              {profiles.map((profile, index) => (
                <ProfileTile
                  activityTime={
                    category === 'visitors'
                      ? formatVisitTime(
                          visitorsQuery.data?.find((visitor) => visitor.visitor_id === profile.id)
                            ?.last_visited_at,
                          now,
                          t,
                        )
                      : category === 'picked-me'
                        ? formatRemainingPickTime(
                            incomingLikesQuery.data?.find((like) => like.profileId === profile.id)
                              ?.expiresAt,
                            now,
                            t,
                          )
                        : formatSampleVisitTime(profile.id, t)
                  }
                  category={category}
                  introMessage={profile.introMessage}
                  index={index}
                  key={`${category}-${profile.id}`}
                  locked={visitorsLocked}
                  onChat={() => openChat(profile)}
                  onPress={() =>
                    visitorsLocked
                      ? MONETIZATION_ENABLED
                        ? router.push('/(tabs)/shop')
                        : undefined
                      : openProfile(profile)
                  }
                  profile={profile}
                />
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function MatchCategoryTab({
  count,
  label,
  onPress,
  selected,
}: {
  count: number;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const active = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    active.set(reduceMotion ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: 180 }));
  }, [active, reduceMotion, selected]);

  const selectionStyle = useAnimatedStyle(() => ({
    opacity: active.get(),
    transform: [{ scale: 0.94 + active.get() * 0.06 }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(active.get(), [0, 1], [palette.inkMuted, palette.ink]),
  }));
  const countStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(active.get(), [0, 1], ['#DEDEE2', '#FFE1EB']),
  }));
  const countTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(active.get(), [0, 1], [palette.inkMuted, palette.pink]),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.category, pressed && styles.categoryPressed]}
    >
      <Animated.View pointerEvents="none" style={[styles.categorySelection, selectionStyle]} />
      <View style={styles.categoryContent}>
        <Animated.Text
          maxFontSizeMultiplier={1.15}
          numberOfLines={1}
          style={[styles.categoryLabel, labelStyle]}
        >
          {label}
        </Animated.Text>
        <Animated.View style={[styles.categoryCount, countStyle]}>
          <Animated.Text style={[styles.categoryCountText, countTextStyle]}>{count}</Animated.Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

type ProfileTileProps = {
  activityTime?: string;
  category: MatchCategory;
  index: number;
  introMessage?: string | null;
  locked?: boolean;
  onChat: () => void;
  onPress: () => void;
  profile: ConnectionProfile;
};

function ProfileTile({
  activityTime,
  category,
  index,
  introMessage,
  locked = false,
  onChat,
  onPress,
  profile,
}: ProfileTileProps) {
  const { t } = useTranslation();
  const isMatched = category === 'matched';

  const handleProfilePress = () => {
    hapticsService.selection();
    onPress();
  };

  const handleChatPress = () => {
    hapticsService.selection();
    onChat();
  };

  return (
    <Animated.View
      entering={listEntering(index)}
      exiting={listExiting()}
      layout={listLayout()}
      style={styles.card}
    >
      <Pressable
        accessibilityLabel={
          locked ? t('matches.goldVisitorA11y') : t('matches.openProfile', { name: profile.name })
        }
        accessibilityRole="button"
        onPress={handleProfilePress}
        style={({ pressed }) => [styles.cardSurface, pressed && styles.cardPressed]}
      >
        <Image
          blurRadius={locked ? 28 : 0}
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: profile.photo }}
          style={StyleSheet.absoluteFill}
          transition={160}
        />
        {locked ? <View style={[styles.lockedVeil, styles.nonInteractive]} /> : null}
        {!locked && profile.isGoldPass ? (
          <View style={[styles.goldCardBorder, styles.nonInteractive]} />
        ) : null}
        <LinearGradient
          colors={['transparent', 'rgba(5,5,8,0.86)']}
          locations={[0.42, 1]}
          style={StyleSheet.absoluteFill}
        />

        {!locked ? (
          <View style={styles.cardTop}>
            <View style={styles.statusSlot}>
              {profile.isOnline ? (
                <View style={styles.onlinePill}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>{t('matches.online')}</Text>
                </View>
              ) : profile.isNew ? (
                <View style={styles.newPill}>
                  <Text style={styles.newPillText}>{t('matches.new')}</Text>
                </View>
              ) : null}
            </View>
            {profile.isGoldPass ? <GoldBadge iconOnly /> : null}
          </View>
        ) : null}

        {locked ? (
          <View style={styles.lockedContent}>
            <View style={styles.lockedIcon}>
              <Ionicons color={palette.white} name="lock-closed" size={17} />
            </View>
            <Text style={styles.lockedLabel}>{t('matches.visitorLocked')}</Text>
            <Text style={styles.lockedHint}>{t('matches.goldOnly')}</Text>
          </View>
        ) : (
          <View style={[styles.cardContent, isMatched && styles.cardContentWithAction]}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>
                {profile.name}, {profile.age}
              </Text>
              <CountryFlag compact countryCode={profile.countryCode} style={styles.flag} />
            </View>
            <View style={styles.metaRow}>
              <Ionicons color="rgba(255,255,255,0.78)" name="navigate" size={11} />
              <Text numberOfLines={2} style={styles.meta}>
                {t('matches.distance', { distance: profile.distanceKm })}
                {category === 'visitors'
                  ? t('matches.visited', { time: activityTime ?? t('matches.time.recent') })
                  : ''}
                {category === 'picked-me'
                  ? t('matches.pickExpires', {
                      time: activityTime ?? t('matches.time.dayLeft'),
                    })
                  : ''}
              </Text>
            </View>
            {category === 'picked-me' && introMessage ? (
              <View style={styles.pickMessagePreview}>
                <Ionicons color={palette.pink} name="chatbubble-ellipses" size={12} />
                <Text numberOfLines={1} style={styles.pickMessagePreviewText}>
                  {introMessage}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>

      {isMatched && !locked ? (
        <Pressable
          accessibilityLabel={t('matches.messageA11y', { name: profile.name })}
          accessibilityRole="button"
          onPress={handleChatPress}
          style={({ pressed }) => [styles.cardAction, pressed && pressFeedback.control]}
        >
          <Ionicons color={palette.ink} name="chatbubble" size={14} />
          <Text style={styles.cardActionText}>{t('matches.message')}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function formatVisitTime(value: string | undefined, now: number, t: TFunction) {
  if (!value) return t('matches.time.recent');
  const minutes = Math.max(1, Math.floor((now - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return t('matches.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('matches.time.hoursAgo', { count: hours });
  return t('matches.time.daysAgo', { count: Math.floor(hours / 24) });
}

function formatRemainingPickTime(value: string | undefined, now: number, t: TFunction) {
  if (!value) return t('matches.time.dayLeft');
  const remainingMs = new Date(value).getTime() - now;
  if (remainingMs <= 0) return t('matches.time.expired');
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (remainingMinutes < 60) return t('matches.time.minutesLeft', { count: remainingMinutes });
  return t('matches.time.hoursLeft', { count: Math.ceil(remainingMinutes / 60) });
}

function formatSampleVisitTime(profileId: string, t: TFunction) {
  const sampleTime = visitorTimes[profileId];
  if (!sampleTime) return undefined;
  return t(sampleTime.unit === 'minutes' ? 'matches.time.minutesAgo' : 'matches.time.daysAgo', {
    count: sampleTime.count,
  });
}

function prioritizeGoldProfiles(profiles: ConnectionProfile[]) {
  return [...profiles].sort(
    (left, right) => Number(Boolean(right.isGoldPass)) - Number(Boolean(left.isGoldPass)),
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  categories: {
    backgroundColor: '#E8E8EC',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 3,
    marginHorizontal: 20,
    padding: 4,
  },
  category: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    overflow: 'hidden',
    paddingHorizontal: 3,
  },
  categorySelection: {
    backgroundColor: palette.white,
    borderRadius: 14,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    ...elevation.sm,
  },
  categoryContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  categoryPressed: pressFeedback.control,
  categoryLabel: { ...typography.label, color: palette.inkMuted, flexShrink: 1 },
  categoryLabelSelected: { color: palette.ink },
  categoryCount: {
    alignItems: 'center',
    backgroundColor: '#DEDEE2',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minWidth: 19,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  categoryCountSelected: { backgroundColor: '#FFE1EB' },
  categoryCountText: { color: palette.inkMuted, fontSize: 11, fontWeight: '900' },
  categoryCountTextSelected: { color: palette.pink },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingBottom: 26, paddingHorizontal: 20 },
  subtitle: {
    ...typography.bodySm,
    color: palette.inkMuted,
    paddingBottom: 16,
    paddingTop: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  card: {
    aspectRatio: 0.71,
    backgroundColor: '#D8D8DE',
    borderRadius: 20,
    overflow: 'hidden',
    width: '48.25%',
    ...elevation.md,
  },
  cardSurface: { flex: 1 },
  cardPressed: pressFeedback.surface,
  nonInteractive: { pointerEvents: 'none' },
  lockedVeil: {
    backgroundColor: 'rgba(17,17,17,0.22)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  lockedContent: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  lockedIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.62)',
    borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  lockedLabel: { ...typography.bodySm, color: palette.white, fontWeight: '900', marginTop: 10 },
  lockedHint: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.4,
    marginTop: 3,
  },
  goldCardBorder: {
    borderColor: '#D7AC43',
    borderRadius: 20,
    borderWidth: 2,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pickMessagePreview: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 5,
    marginTop: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pickMessagePreviewText: {
    color: palette.ink,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 10,
    position: 'absolute',
    right: 10,
    top: 10,
  },
  statusSlot: { alignItems: 'flex-start', flex: 1 },
  onlinePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.66)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  onlineDot: { backgroundColor: palette.lime, borderRadius: 3, height: 6, width: 6 },
  onlineText: { color: palette.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  newPill: {
    backgroundColor: palette.lime,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  newPillText: { color: palette.ink, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  cardContent: { bottom: 13, left: 12, position: 'absolute', right: 12 },
  cardContentWithAction: { bottom: 58 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  name: { ...typography.subheading, color: palette.white, flexShrink: 1, fontWeight: '900' },
  flag: { borderColor: 'rgba(255,255,255,0.48)', borderRadius: 3, height: 13, width: 19 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  meta: {
    color: 'rgba(255,255,255,0.84)',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  cardAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.lime,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    bottom: 14,
    left: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
    zIndex: 4,
  },
  cardActionText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  visitorLock: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#E4CD85',
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    padding: 12,
  },
  visitorLockCopy: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  visitorLockIcon: {
    alignItems: 'center',
    backgroundColor: '#FFD35A',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  visitorLockTextBlock: { flex: 1, marginLeft: 10 },
  visitorLockTitle: { ...typography.label, color: palette.ink, fontWeight: '900' },
  visitorLockText: { ...typography.caption, color: palette.inkMuted, marginTop: 2 },
  visitorLockAction: {
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    marginLeft: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  visitorLockActionText: { color: palette.white, fontSize: 11, fontWeight: '900' },
});
