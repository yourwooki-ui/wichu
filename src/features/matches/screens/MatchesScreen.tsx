import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTabHeader } from '@/components/AppTabHeader';
import { CountryFlag } from '@/components/CountryFlag';
import { GoldBadge } from '@/components/GoldBadge';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { Screen } from '@/components/Screen';
import { ConnectionGridSkeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { MONETIZATION_ENABLED } from '@/constants/features';
import { reviewSamplesEnabled } from '@/constants/feature-flags';
import { elevation, palette, pressFeedback, radius, typography } from '@/constants/theme';
import { type ConnectionProfile, mockConnections } from '@/features/matches/data/mock-connections';
import { matchesService } from '@/features/matches/services/matches-service';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { profileVisitService } from '@/features/profile/services/profile-visit-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { hapticsService } from '@/services/haptics-service';

type MatchCategory = 'picked-me' | 'matched' | 'visitors';

const categories: {
  key: MatchCategory;
  label: string;
}[] = [
  { key: 'picked-me', label: '나를 픽함' },
  { key: 'matched', label: '매칭됨' },
  { key: 'visitors', label: '방문자' },
];

const categoryCopy: Record<MatchCategory, { description: string }> = {
  'picked-me': {
    description: '나를 Pick한 사람들이에요.',
  },
  matched: {
    description: '서로 Pick해 연결된 사람들이에요.',
  },
  visitors: {
    description: '최근 내 프로필을 본 사람들이에요.',
  },
};

const emptyCategoryCopy: Record<
  MatchCategory,
  { title: string; body: string; actionLabel: string }
> = {
  'picked-me': {
    title: '아직 나를 Pick한 사람이 없어요',
    body: '새로운 Pick을 받으면 여기에 표시됩니다.',
    actionLabel: '발견하러 가기',
  },
  matched: {
    title: '아직 매치가 없어요',
    body: '서로 Pick하면 매치 목록에 표시됩니다.',
    actionLabel: '발견하러 가기',
  },
  visitors: {
    title: '아직 프로필 방문자가 없어요',
    body: '누군가 내 프로필을 확인하면 여기에 표시됩니다.',
    actionLabel: '내 프로필 보기',
  },
};

const profilesByCategory: Record<MatchCategory, ConnectionProfile[]> = {
  'picked-me': [mockConnections[0], mockConnections[1], mockConnections[3], mockConnections[4]],
  matched: mockConnections,
  visitors: [mockConnections[2], mockConnections[0], mockConnections[4], mockConnections[3]],
};

const visitorTimes: Record<string, string> = {
  'mock-sofia': '2분 전',
  'mock-lina': '18분 전',
  'mock-clara': '어제',
  'mock-yuna': '3일 전',
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
  const router = useRouter();
  const entitlement = usePassEntitlement();
  const { session } = useAuthSession();
  const [category, setCategory] = useState<MatchCategory>('picked-me');
  const [now] = useState(() => Date.now());
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

  const openProfile = (profileId: string) => router.push(`/profile/${profileId}`);

  const openChat = (profile: ConnectionProfile) => {
    const realMatch = matchesQuery.data?.find((match) => match.profile.id === profile.id);
    router.push(`/chat/${realMatch?.matchId ?? `mock-match-${profile.name.toLowerCase()}`}`);
  };

  const selectCategory = (nextCategory: MatchCategory) => {
    if (nextCategory === category) return;
    hapticsService.selection();
    setCategory(nextCategory);
  };

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <AppTabHeader actionIcon={illustratedIcons.matches} eyebrow="연결" />

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
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => selectCategory(item.key)}
              style={({ pressed }) => [
                styles.category,
                selected && styles.categorySelected,
                pressed && styles.categoryPressed,
              ]}
            >
              <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                {item.label}
              </Text>
              <View style={[styles.categoryCount, selected && styles.categoryCountSelected]}>
                <Text
                  style={[styles.categoryCountText, selected && styles.categoryCountTextSelected]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>{copy.description}</Text>

        {visitorsLocked ? (
          <View style={styles.visitorLock}>
            <View style={styles.visitorLockCopy}>
              <View style={styles.visitorLockIcon}>
                <IllustratedIcon size={40} source={illustratedIcons.goldPass} />
              </View>
              <View style={styles.visitorLockTextBlock}>
                <Text style={styles.visitorLockTitle}>프로필 방문자 확인</Text>
                <Text style={styles.visitorLockText}>
                  방문자 프로필은 Gold Pass에서 확인할 수 있습니다.
                </Text>
              </View>
            </View>
            {MONETIZATION_ENABLED ? (
              <Pressable
                onPress={() => router.push('/(tabs)/shop')}
                style={styles.visitorLockAction}
              >
                <Text style={styles.visitorLockActionText}>Gold Pass 보기</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {categoryLoading ? (
          <ConnectionGridSkeleton />
        ) : categoryError ? (
          <StateView
            actionLabel="다시 시도"
            body="저장된 연결은 그대로예요. 잠시 후 다시 확인해주세요."
            illustration={illustratedIcons.connectionError}
            onAction={() => {
              if (category === 'picked-me') void incomingLikesQuery.refetch();
              if (category === 'matched') void matchesQuery.refetch();
              if (category === 'visitors') void visitorsQuery.refetch();
            }}
            title="연결을 불러오지 못했어요"
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
            {profiles.map((profile) => (
              <ProfileTile
                activityTime={
                  category === 'visitors'
                    ? formatVisitTime(
                        visitorsQuery.data?.find((visitor) => visitor.visitor_id === profile.id)
                          ?.last_visited_at,
                        now,
                      )
                    : category === 'picked-me'
                      ? formatRemainingPickTime(
                          incomingLikesQuery.data?.find((like) => like.profileId === profile.id)
                            ?.expiresAt,
                          now,
                        )
                      : visitorTimes[profile.id]
                }
                category={category}
                key={profile.id}
                locked={visitorsLocked}
                onChat={() => openChat(profile)}
                onPress={() =>
                  visitorsLocked
                    ? MONETIZATION_ENABLED
                      ? router.push('/(tabs)/shop')
                      : undefined
                    : openProfile(profile.id)
                }
                profile={profile}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

type ProfileTileProps = {
  activityTime?: string;
  category: MatchCategory;
  locked?: boolean;
  onChat: () => void;
  onPress: () => void;
  profile: ConnectionProfile;
};

function ProfileTile({
  activityTime,
  category,
  locked = false,
  onChat,
  onPress,
  profile,
}: ProfileTileProps) {
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
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={locked ? 'Gold Pass로 방문자 확인' : `${profile.name} 프로필 열기`}
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
                  <Text style={styles.onlineText}>온라인</Text>
                </View>
              ) : profile.isNew ? (
                <View style={styles.newPill}>
                  <Text style={styles.newPillText}>NEW</Text>
                </View>
              ) : null}
            </View>
            {profile.isGoldPass ? <GoldBadge /> : null}
          </View>
        ) : null}

        {locked ? (
          <View style={styles.lockedContent}>
            <View style={styles.lockedIcon}>
              <Ionicons color={palette.white} name="lock-closed" size={17} />
            </View>
            <Text style={styles.lockedLabel}>방문자 확인</Text>
            <Text style={styles.lockedHint}>Gold Pass 전용</Text>
          </View>
        ) : (
          <View style={[styles.cardContent, isMatched && styles.cardContentWithAction]}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {profile.name}, {profile.age}
              </Text>
              <CountryFlag compact countryCode={profile.countryCode} style={styles.flag} />
            </View>
            <View style={styles.metaRow}>
              <Ionicons color="rgba(255,255,255,0.78)" name="navigate" size={11} />
              <Text style={styles.meta}>
                {profile.distanceKm}km 거리
                {category === 'visitors' ? ` · ${activityTime} 방문` : ''}
                {category === 'picked-me' ? ` · Pick ${activityTime ?? '24시간 남음'}` : ''}
              </Text>
            </View>
          </View>
        )}
      </Pressable>

      {isMatched && !locked ? (
        <Pressable
          accessibilityLabel={`${profile.name}님에게 메시지 보내기`}
          accessibilityRole="button"
          onPress={handleChatPress}
          style={({ pressed }) => [styles.cardAction, pressed && pressFeedback.control]}
        >
          <Ionicons color={palette.ink} name="chatbubble" size={14} />
          <Text style={styles.cardActionText}>메시지</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatVisitTime(value: string | undefined, now: number) {
  if (!value) return '최근';
  const minutes = Math.max(1, Math.floor((now - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function formatRemainingPickTime(value: string | undefined, now: number) {
  if (!value) return '24시간 남음';
  const remainingMs = new Date(value).getTime() - now;
  if (remainingMs <= 0) return '만료';
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (remainingMinutes < 60) return `${remainingMinutes}분 남음`;
  return `${Math.ceil(remainingMinutes / 60)}시간 남음`;
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
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 3,
  },
  categorySelected: {
    backgroundColor: palette.white,
    ...elevation.sm,
  },
  categoryPressed: pressFeedback.control,
  categoryLabel: { ...typography.label, color: palette.inkMuted },
  categoryLabelSelected: { color: palette.ink, fontWeight: '900' },
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
    aspectRatio: 0.76,
    backgroundColor: '#D8D8DE',
    borderRadius: 20,
    overflow: 'hidden',
    width: '48.5%',
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
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 11,
    position: 'absolute',
    right: 11,
    top: 11,
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
  cardContent: { bottom: 14, left: 14, position: 'absolute', right: 14 },
  cardContentWithAction: { bottom: 58 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  name: { ...typography.subheading, color: palette.white, fontWeight: '900' },
  flag: { borderColor: 'rgba(255,255,255,0.48)', borderRadius: 3, height: 13, width: 19 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  meta: { color: 'rgba(255,255,255,0.84)', fontSize: 11, fontWeight: '700' },
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
