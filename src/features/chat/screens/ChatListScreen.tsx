import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandWordmark } from '@/components/BrandWordmark';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';
import { palette, radius } from '@/constants/theme';
import { ConnectionAvatar } from '@/features/matches/components/ConnectionAvatar';
import {
  type ConnectionProfile,
  type ConversationPreview,
  mockConnections,
  mockConversations,
} from '@/features/matches/data/mock-connections';
import { matchesService } from '@/features/matches/services/matches-service';
import { getProfileAge } from '@/features/profile/utils/profile-display';
import { useAuthSession } from '@/hooks/use-auth-session';

export function ChatListScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { session } = useAuthSession();
  const [query, setQuery] = useState('');
  const [now] = useState(() => Date.now());
  const matchesQuery = useQuery({
    enabled: Boolean(session?.user.id),
    queryFn: () => matchesService.listConnections(session!.user.id),
    queryKey: ['matches', 'connections', session?.user.id],
    staleTime: 20_000,
  });
  const realConversations = useMemo<ConversationPreview[]>(
    () =>
      (matchesQuery.data ?? []).map((connection) => ({
        matchId: connection.matchId,
        profile: {
          id: connection.profile.id,
          name: connection.profile.display_name,
          age: getProfileAge(connection.profile.birth_date),
          countryCode: connection.profile.country_code,
          distanceKm: 0,
          photo: connection.profile.photo ?? '',
          matchedAt: formatRelativeTime(connection.matchedAt, now),
          isOnline:
            Boolean(connection.profile.last_active_at) &&
            now - new Date(connection.profile.last_active_at!).getTime() < 5 * 60_000,
          isNew: now - new Date(connection.matchedAt).getTime() < 24 * 60 * 60_000,
        } satisfies ConnectionProfile,
        message: connection.lastMessage?.content ?? '새로운 매치예요. 먼저 인사해보세요.',
        time: formatRelativeTime(connection.lastMessage?.created_at ?? connection.matchedAt, now),
        unreadCount: 0,
      })),
    [matchesQuery.data, now],
  );
  const sourceConversations =
    realConversations.length || !__DEV__ ? realConversations : mockConversations;
  const normalizedQuery = query.trim().toLowerCase();
  const conversations = useMemo(
    () =>
      sourceConversations.filter(
        ({ profile }) => !normalizedQuery || profile.name.toLowerCase().includes(normalizedQuery),
      ),
    [normalizedQuery, sourceConversations],
  );
  const activeProfiles = conversations
    .map((conversation) => conversation.profile)
    .filter((profile) => profile.isOnline);
  const unreadCount = conversations.reduce((total, item) => total + item.unreadCount, 0);

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <BrandWordmark color={theme.colors.text} size={23} />
          <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>메시지</Text>
        </View>
        <Pressable accessibilityLabel="Chat settings" style={styles.headerAction}>
          <Ionicons color={palette.ink} name="options-outline" size={23} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <Text style={styles.title}>대화를 이어가요</Text>
          <Text style={styles.subtitle}>가볍게 인사하고 새로운 이야기를 시작해보세요.</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.activeContent}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.activeRail}
        >
          {(activeProfiles.length
            ? activeProfiles
            : mockConnections.filter((profile) => profile.isOnline)
          ).map((profile) => (
            <ConnectionAvatar
              key={profile.id}
              onPress={() => {
                const conversation = conversations.find((item) => item.profile.id === profile.id);
                router.push(
                  `/chat/${conversation?.matchId ?? `mock-match-${profile.name.toLowerCase()}`}`,
                );
              }}
              profile={profile}
            />
          ))}
        </ScrollView>

        <View style={styles.searchWrap}>
          <Ionicons color={palette.inkMuted} name="search" size={19} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="이름 검색"
            placeholderTextColor="#9999A1"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}>
              <Ionicons color={palette.inkMuted} name="close-circle" size={20} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>메시지</Text>
          {unreadCount ? (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>새 메시지 {unreadCount}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.list}>
          {matchesQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={palette.pink} />
              <Text style={styles.loadingText}>대화를 불러오는 중이에요</Text>
            </View>
          ) : null}
          {conversations.map((conversation) => (
            <Pressable
              accessibilityLabel={`Open chat with ${conversation.profile.name}`}
              key={conversation.matchId}
              onPress={() => router.push(`/chat/${conversation.matchId}`)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.avatarWrap}>
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: conversation.profile.photo }}
                  style={{ borderRadius: 29, height: 58, width: 58 }}
                />
                {conversation.profile.isOnline ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.rowCopy}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, conversation.unreadCount > 0 && styles.nameUnread]}>
                    {conversation.profile.name}
                  </Text>
                  <Text style={[styles.time, conversation.unreadCount > 0 && styles.timeUnread]}>
                    {conversation.time}
                  </Text>
                </View>
                <View style={styles.messageRow}>
                  <Text
                    numberOfLines={1}
                    style={[styles.message, conversation.unreadCount > 0 && styles.messageUnread]}
                  >
                    {conversation.isTyping ? '입력 중…' : conversation.message}
                  </Text>
                  {conversation.unreadCount > 0 ? (
                    <View style={styles.unreadCount}>
                      <Text style={styles.unreadCountText}>{conversation.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
                {conversation.isTranslated ? (
                  <View style={styles.translatedRow}>
                    <Ionicons color={palette.inkMuted} name="language" size={11} />
                    <Text style={styles.translatedText}>번역 가능</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}
          {!matchesQuery.isLoading && !conversations.length ? (
            <View style={styles.noResult}>
              <Ionicons color={palette.inkMuted} name="search-outline" size={25} />
              <Text style={styles.noResultTitle}>검색 결과가 없어요</Text>
              <Text style={styles.noResultText}>다른 이름을 검색해보세요.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatRelativeTime(value: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}시간`;
  return `${Math.floor(minutes / 1_440)}일`;
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 80,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 2.1, lineHeight: 12, marginTop: 2 },
  headerAction: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DFDFE4',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heading: { paddingHorizontal: 20, paddingTop: 7 },
  title: { color: palette.ink, fontSize: 27, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { color: palette.inkMuted, fontSize: 13, fontWeight: '600', marginTop: 3 },
  activeRail: { marginTop: 18 },
  activeContent: { gap: 5, paddingHorizontal: 20 },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DEDEE3',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 9,
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 15,
  },
  searchInput: { color: palette.ink, flex: 1, fontSize: 14, height: 48, outlineWidth: 0 },
  listHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 23,
    paddingHorizontal: 20,
  },
  listTitle: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  unreadPill: {
    backgroundColor: '#FFE2EC',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unreadPillText: { color: palette.pink, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  list: { marginTop: 7, paddingBottom: 25, paddingHorizontal: 12 },
  loadingRow: { alignItems: 'center', gap: 9, paddingVertical: 28 },
  loadingText: { color: palette.inkMuted, fontSize: 12, fontWeight: '700' },
  row: {
    alignItems: 'center',
    borderBottomColor: '#DCDCE1',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 13,
    minHeight: 84,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 18 },
  avatarWrap: { height: 58, position: 'relative', width: 58 },
  onlineDot: {
    backgroundColor: palette.lime,
    borderColor: palette.paper,
    borderRadius: 7,
    borderWidth: 2.5,
    bottom: 0,
    height: 14,
    position: 'absolute',
    right: 0,
    width: 14,
  },
  rowCopy: { flex: 1 },
  rowTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  nameUnread: { fontWeight: '900' },
  time: { color: palette.inkMuted, fontSize: 10, fontWeight: '700' },
  timeUnread: { color: palette.pink },
  messageRow: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: 5 },
  message: { color: palette.inkMuted, flex: 1, fontSize: 13, lineHeight: 17 },
  messageUnread: { color: palette.ink, fontWeight: '700' },
  unreadCount: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
  },
  unreadCountText: { color: palette.white, fontSize: 10, fontWeight: '900' },
  translatedRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  translatedText: { color: palette.inkMuted, fontSize: 9, fontWeight: '700' },
  noResult: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 45 },
  noResultTitle: { color: palette.ink, fontSize: 15, fontWeight: '900', marginTop: 10 },
  noResultText: { color: palette.inkMuted, fontSize: 12, marginTop: 4 },
});
