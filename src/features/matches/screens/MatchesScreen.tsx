import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandWordmark } from '@/components/BrandWordmark';
import { CountryFlag } from '@/components/CountryFlag';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';
import { palette, radius } from '@/constants/theme';
import { type ConnectionProfile, mockConnections } from '@/features/matches/data/mock-connections';
import { matchesService } from '@/features/matches/services/matches-service';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { profileVisitService } from '@/features/profile/services/profile-visit-service';
import { getProfileAge } from '@/features/profile/utils/profile-display';
import { useAuthSession } from '@/hooks/use-auth-session';

type MatchCategory = 'picked-me' | 'matched' | 'visitors';

const categories: {
  key: MatchCategory;
  label: string;
}[] = [
  { key: 'picked-me', label: '나를 픽함' },
  { key: 'matched', label: '매칭됨' },
  { key: 'visitors', label: '방문자' },
];

const categoryCopy: Record<MatchCategory, { title: string; description: string }> = {
  'picked-me': {
    title: '나를 픽한 사람',
    description: '프로필을 확인하고 서로의 픽을 완성해보세요.',
  },
  matched: {
    title: '매칭된 사람',
    description: '서로를 픽해 연결된 사람들이에요.',
  },
  visitors: {
    title: '프로필 방문자',
    description: '최근 내 프로필을 확인한 사람들이에요.',
  },
};

const profilesByCategory: Record<MatchCategory, ConnectionProfile[]> = {
  'picked-me': [mockConnections[1], mockConnections[3], mockConnections[4]],
  matched: mockConnections,
  visitors: [mockConnections[2], mockConnections[0], mockConnections[4], mockConnections[3]],
};

const visitorTimes: Record<string, string> = {
  'mock-sofia': '2분 전',
  'mock-lina': '18분 전',
  'mock-clara': '어제',
  'mock-yuna': '3일 전',
};

export function MatchesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const entitlement = usePassEntitlement();
  const { session } = useAuthSession();
  const [category, setCategory] = useState<MatchCategory>('picked-me');
  const [now] = useState(() => Date.now());
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
    age: getProfileAge(visitor.birth_date),
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
    age: getProfileAge(connection.profile.birth_date),
    countryCode: connection.profile.country_code,
    distanceKm: 0,
    photo: connection.profile.photo ?? '',
    matchedAt: connection.matchedAt,
    isOnline:
      Boolean(connection.profile.last_active_at) &&
      now - new Date(connection.profile.last_active_at!).getTime() <= 5 * 60 * 1000,
    isNew: now - new Date(connection.matchedAt).getTime() <= 24 * 60 * 60 * 1000,
  }));
  const matchedProfiles = realMatches.length || !__DEV__ ? realMatches : profilesByCategory.matched;
  const profiles =
    category === 'visitors'
      ? visitors
      : category === 'matched'
        ? matchedProfiles
        : __DEV__
          ? profilesByCategory[category]
          : [];
  const copy = categoryCopy[category];
  const visitorsLocked = category === 'visitors' && entitlement.data?.tier !== 'gold';

  const openProfile = (profileId: string) => router.push(`/profile/${profileId}`);

  const openChat = (profile: ConnectionProfile) => {
    const realMatch = matchesQuery.data?.find((match) => match.profile.id === profile.id);
    router.push(`/chat/${realMatch?.matchId ?? `mock-match-${profile.name.toLowerCase()}`}`);
  };

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <BrandWordmark color={theme.colors.text} size={23} />
          <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>연결</Text>
        </View>
        <View style={styles.headerMark}>
          <Ionicons color={palette.pink} name="people" size={23} />
        </View>
      </View>

      <View accessibilityRole="tablist" style={styles.categories}>
        {categories.map((item) => {
          const selected = item.key === category;
          const count =
            item.key === 'visitors'
              ? visitors.length
              : item.key === 'matched'
                ? matchedProfiles.length
                : __DEV__
                  ? profilesByCategory['picked-me'].length
                  : 0;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => setCategory(item.key)}
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.description}</Text>
        </View>

        {visitorsLocked ? (
          <View style={styles.visitorLock}>
            <View style={styles.visitorLockIcon}>
              <Ionicons color="#493400" name="diamond" size={22} />
            </View>
            <Text style={styles.visitorLockTitle}>방문자 확인은 Gold Pass 혜택이에요</Text>
            <Text style={styles.visitorLockText}>
              내 프로필을 확인한 사용자를 보고 새로운 연결을 시작해보세요.
            </Text>
            <Pressable onPress={() => router.push('/ad-free')} style={styles.visitorLockAction}>
              <Text style={styles.visitorLockActionText}>Gold Pass 보기</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {profiles.map((profile) => (
              <ProfileTile
                category={category}
                key={profile.id}
                onChat={() => openChat(profile)}
                onPress={() => openProfile(profile.id)}
                profile={profile}
                visitorTime={
                  category === 'visitors'
                    ? formatVisitTime(
                        visitorsQuery.data?.find((visitor) => visitor.visitor_id === profile.id)
                          ?.last_visited_at,
                        now,
                      )
                    : visitorTimes[profile.id]
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

type ProfileTileProps = {
  category: MatchCategory;
  onChat: () => void;
  onPress: () => void;
  profile: ConnectionProfile;
  visitorTime?: string;
};

function ProfileTile({ category, onChat, onPress, profile, visitorTime }: ProfileTileProps) {
  const isMatched = category === 'matched';
  const isPickedMe = category === 'picked-me';

  return (
    <Pressable
      accessibilityLabel={`Open ${profile.name}'s profile`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={{ uri: profile.photo }}
        style={StyleSheet.absoluteFill}
        transition={160}
      />
      {profile.isGoldPass ? <View pointerEvents="none" style={styles.goldCardBorder} /> : null}
      <LinearGradient
        colors={['transparent', 'rgba(5,5,8,0.86)']}
        locations={[0.42, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.cardTop}>
        {profile.isOnline ? (
          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>온라인</Text>
          </View>
        ) : null}
        {isPickedMe ? (
          <View style={styles.pickedBadge}>
            <Ionicons color={palette.white} name="sparkles" size={12} />
          </View>
        ) : null}
        {profile.isGoldPass ? (
          <View style={styles.goldBadge}>
            <Text style={styles.goldDiamond}>◆</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {profile.name}, {profile.age}
          </Text>
          <CountryFlag compact countryCode={profile.countryCode} style={styles.flag} />
        </View>
        <Text style={styles.meta}>
          {profile.distanceKm}km 거리
          {category === 'visitors' ? ` · ${visitorTime} 방문` : ''}
        </Text>

        {isMatched ? (
          <Pressable
            accessibilityLabel={`Message ${profile.name}`}
            onPress={(event) => {
              event.stopPropagation();
              onChat();
            }}
            style={styles.cardAction}
          >
            <Ionicons color={palette.ink} name="chatbubble" size={14} />
            <Text style={styles.cardActionText}>메시지</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
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

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 76,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 2.1, lineHeight: 12, marginTop: 2 },
  headerMark: {
    alignItems: 'center',
    backgroundColor: '#FFE5EE',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  categories: {
    borderBottomColor: '#D9D9DE',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  category: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 3,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 3,
  },
  categorySelected: { borderBottomColor: palette.pink },
  categoryPressed: { opacity: 0.64 },
  categoryLabel: { color: palette.inkMuted, fontSize: 12, fontWeight: '800' },
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
  categoryCountText: { color: palette.inkMuted, fontSize: 8, fontWeight: '900' },
  categoryCountTextSelected: { color: palette.pink },
  content: { paddingBottom: 26, paddingHorizontal: 20 },
  titleBlock: { paddingBottom: 17, paddingTop: 20 },
  title: { color: palette.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: palette.inkMuted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    aspectRatio: 0.76,
    backgroundColor: '#D8D8DE',
    borderRadius: 23,
    overflow: 'hidden',
    width: '48.6%',
    ...Platform.select({ web: { boxShadow: '0 7px 18px rgba(17,17,17,0.10)' } }),
  },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  goldCardBorder: {
    borderColor: '#DCAF2D',
    borderRadius: 23,
    borderWidth: 3,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 11,
    position: 'absolute',
    right: 11,
    top: 11,
  },
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
  onlineText: { color: palette.white, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  pickedBadge: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    marginLeft: 'auto',
    width: 30,
  },
  goldBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.72)',
    borderColor: '#FFD35A',
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    marginLeft: 5,
    width: 30,
  },
  goldDiamond: { color: '#FFD35A', fontSize: 12 },
  cardContent: { bottom: 14, left: 14, position: 'absolute', right: 14 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  name: { color: palette.white, fontSize: 17, fontWeight: '900' },
  flag: { borderColor: 'rgba(255,255,255,0.48)', borderRadius: 3, height: 13, width: 19 },
  meta: { color: 'rgba(255,255,255,0.76)', fontSize: 10, fontWeight: '700', marginTop: 3 },
  cardAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.lime,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  cardActionText: {
    color: palette.ink,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  visitorLock: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#E4CD85',
    borderRadius: 25,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 31,
  },
  visitorLockIcon: {
    alignItems: 'center',
    backgroundColor: '#FFD35A',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  visitorLockTitle: { color: palette.ink, fontSize: 16, fontWeight: '900', marginTop: 15 },
  visitorLockText: {
    color: palette.inkMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
    maxWidth: 260,
    textAlign: 'center',
  },
  visitorLockAction: {
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    marginTop: 17,
    paddingHorizontal: 19,
    paddingVertical: 12,
  },
  visitorLockActionText: { color: palette.white, fontSize: 11, fontWeight: '900' },
});
