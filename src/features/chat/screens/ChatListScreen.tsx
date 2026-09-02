import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppTabHeader } from '@/components/AppTabHeader';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { Screen } from '@/components/Screen';
import { ChatRowsSkeleton } from '@/components/Skeleton';
import { listEntering, listExiting, listLayout } from '@/constants/motion';
import { StateView } from '@/components/StateView';
import { reviewSamplesEnabled } from '@/constants/feature-flags';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, pressFeedback, radius, typography } from '@/constants/theme';
import { ConnectionAvatar } from '@/features/matches/components/ConnectionAvatar';
import {
  type ConnectionProfile,
  type ConversationPreview,
  mockConversations,
} from '@/features/matches/data/mock-connections';
import { matchesService } from '@/features/matches/services/matches-service';
import { useAdGatedNavigation } from '@/features/monetization/hooks/use-ad-gated-navigation';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { reportOperationalError } from '@/services/operational-error-service';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ChatListScreen() {
  const router = useRouter();
  const navigateWithAdGate = useAdGatedNavigation();
  const { t } = useTranslation();
  const { session } = useAuthSession();
  const currentUserId = session?.user.id;
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const matchesQuery = useQuery({
    enabled: Boolean(session?.user.id),
    queryFn: () => matchesService.listConnections(session!.user.id),
    queryKey: ['matches', 'connections', session?.user.id],
    staleTime: 20_000,
  });
  useEffect(() => {
    if (matchesQuery.error) reportOperationalError('chat_list_query', matchesQuery.error, '/chat');
  }, [matchesQuery.error]);
  const realConversations = useMemo<ConversationPreview[]>(
    () =>
      (matchesQuery.data ?? []).map((connection) => ({
        matchId: connection.matchId,
        profile: {
          id: connection.profile.id,
          name: connection.profile.display_name,
          age: connection.profile.age,
          countryCode: connection.profile.country_code,
          distanceKm: 0,
          photo: connection.profile.photo ?? '',
          matchedAt: formatRelativeTime(connection.matchedAt, now, t),
          isOnline:
            Boolean(connection.profile.last_active_at) &&
            now - new Date(connection.profile.last_active_at!).getTime() < 5 * 60_000,
          isNew: now - new Date(connection.matchedAt).getTime() < 24 * 60 * 60_000,
        } satisfies ConnectionProfile,
        message: connection.lastMessage?.content ?? t('chatList.newMatch'),
        time: formatRelativeTime(
          connection.lastMessage?.created_at ?? connection.matchedAt,
          now,
          t,
        ),
        unreadCount: connection.unreadCount,
        isYourTurn:
          Boolean(connection.lastMessage) && connection.lastMessage?.sender_id !== currentUserId,
      })),
    [currentUserId, matchesQuery.data, now, t],
  );
  const sourceConversations =
    realConversations.length || !reviewSamplesEnabled ? realConversations : mockConversations;
  const normalizedQuery = query.trim().toLowerCase();
  const conversations = useMemo(
    () =>
      sourceConversations.filter(
        ({ profile }) => !normalizedQuery || profile.name.toLowerCase().includes(normalizedQuery),
      ),
    [normalizedQuery, sourceConversations],
  );
  const activeProfiles = sourceConversations
    .map((conversation) => conversation.profile)
    .filter((profile) => profile.isOnline);
  const unreadCount = conversations.reduce((total, item) => total + item.unreadCount, 0);
  const listError = matchesQuery.isError && !reviewSamplesEnabled;
  // 대화가 하나도 없으면 검색·온라인 레일·목록 제목은 의미가 없다.
  const hasConversations = sourceConversations.length > 0;
  const refreshControl = useRefreshControl(
    useCallback(() => matchesQuery.refetch(), [matchesQuery]),
  );

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <AppTabHeader
        actionAccessibilityLabel={t('chatList.headerAction')}
        actionIcon={illustratedIcons.notification}
        actionMotion={unreadCount > 0 ? 'bell' : undefined}
        eyebrow={t('chatList.eyebrow')}
        onAction={() => router.push('/settings')}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.heading}>
          <Text style={styles.title}>{t('chatList.title')}</Text>
          <Text style={styles.subtitle}>{t('chatList.subtitle')}</Text>
        </View>

        {activeProfiles.length ? (
          <FlashList
            contentContainerStyle={styles.activeContent}
            data={activeProfiles}
            horizontal
            keyExtractor={(profile) => profile.id}
            renderItem={({ item: profile }) => (
              <ConnectionAvatar
                onPress={() => {
                  const conversation = sourceConversations.find(
                    (item) => item.profile.id === profile.id,
                  );
                  void navigateWithAdGate(
                    `/chat/${conversation?.matchId ?? `mock-match-${profile.name.toLowerCase()}`}`,
                  );
                }}
                profile={profile}
              />
            )}
            showsHorizontalScrollIndicator={false}
            style={styles.activeRail}
          />
        ) : null}

        {hasConversations ? (
          <View style={styles.searchWrap}>
            <Ionicons color={palette.inkMuted} name="search" size={19} />
            <TextInput
              autoCapitalize="none"
              onChangeText={setQuery}
              placeholder={t('chatList.searchPlaceholder')}
              placeholderTextColor="#9999A1"
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable
                accessibilityLabel={t('chatList.clearSearch')}
                accessibilityRole="button"
                onPress={() => setQuery('')}
              >
                <Ionicons color={palette.inkMuted} name="close-circle" size={20} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {hasConversations ? (
          <View style={styles.listHeading}>
            <Text style={styles.listTitle}>{t('chatList.sectionTitle')}</Text>
            {unreadCount ? (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>
                  {t('chatList.unread', { count: unreadCount })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.list}>
          {matchesQuery.isLoading ? <ChatRowsSkeleton /> : null}
          {listError ? (
            <StateView
              actionLabel={t('reliability.retry')}
              body={t('reliability.messagesBody')}
              container="plain"
              illustration={illustratedIcons.connectionError}
              onAction={() => matchesQuery.refetch()}
              title={t('reliability.messagesTitle')}
              tone="error"
            />
          ) : null}
          {!matchesQuery.isLoading && !listError
            ? conversations.map((conversation, index) => (
                <AnimatedPressable
                  entering={listEntering(index)}
                  exiting={listExiting()}
                  layout={listLayout()}
                  accessibilityLabel={t('chatList.openChat', {
                    name: conversation.profile.name,
                  })}
                  key={conversation.matchId}
                  onPress={() => void navigateWithAdGate(`/chat/${conversation.matchId}`)}
                  style={({ pressed }: { pressed: boolean }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
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
                      <Text
                        style={[styles.name, conversation.unreadCount > 0 && styles.nameUnread]}
                      >
                        {conversation.profile.name}
                      </Text>
                      <Text
                        style={[styles.time, conversation.unreadCount > 0 && styles.timeUnread]}
                      >
                        {conversation.time}
                      </Text>
                    </View>
                    <View style={styles.messageRow}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.message,
                          conversation.unreadCount > 0 && styles.messageUnread,
                        ]}
                      >
                        {conversation.isTyping ? t('chatList.typing') : conversation.message}
                      </Text>
                      {conversation.unreadCount > 0 ? (
                        <View style={styles.unreadCount}>
                          <Text style={styles.unreadCountText}>{conversation.unreadCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    {conversation.isTranslated ? (
                      <View style={styles.translatedRow}>
                        <IllustratedIcon size={17} source={illustratedIcons.translation} />
                        <Text style={styles.translatedText}>
                          {t('chatList.translationAvailable')}
                        </Text>
                      </View>
                    ) : null}
                    {conversation.isYourTurn && conversation.unreadCount === 0 ? (
                      <View style={styles.yourTurnRow}>
                        <Ionicons color="#986A00" name="sparkles" size={13} />
                        <Text style={styles.yourTurnText}>
                          {t('experience.chatSafety.yourTurn')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </AnimatedPressable>
              ))
            : null}
          {!matchesQuery.isLoading && !listError && !conversations.length ? (
            query ? (
              <StateView
                body={t('chatList.searchEmptyBody')}
                container="plain"
                illustration={illustratedIcons.searchEmpty}
                title={t('chatList.searchEmptyTitle')}
              />
            ) : (
              <StateView
                actionLabel={t('chatList.discoverAction')}
                body={t('chatList.emptyBody')}
                container="plain"
                illustration={illustratedIcons.chatEmpty}
                onAction={() => router.push('/(tabs)/discover')}
                title={t('chatList.emptyTitle')}
              />
            )
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatRelativeTime(value: string, now: number, t: TFunction) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return t('chatList.time.now');
  if (minutes < 60) return t('chatList.time.minutes', { count: minutes });
  if (minutes < 1_440) return t('chatList.time.hours', { count: Math.floor(minutes / 60) });
  return t('chatList.time.days', { count: Math.floor(minutes / 1_440) });
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  heading: { paddingHorizontal: 20, paddingTop: 7 },
  title: { ...typography.display, color: palette.ink },
  subtitle: { ...typography.bodySm, color: palette.inkMuted, marginTop: 3 },
  activeRail: { height: 118, marginTop: 18 },
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
  searchInput: { ...typography.body, color: palette.ink, flex: 1, height: 48, outlineWidth: 0 },
  listHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 23,
    paddingHorizontal: 20,
  },
  listTitle: { ...typography.heading, color: palette.ink },
  unreadPill: {
    backgroundColor: '#FFE2EC',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unreadPillText: { color: palette.pink, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  scroll: { flex: 1, minHeight: 0 },
  list: { marginTop: 7, paddingBottom: 25, paddingHorizontal: 12 },
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
  rowPressed: {
    ...pressFeedback.surface,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 18,
  },
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
  name: { ...typography.bodyStrong, color: palette.ink },
  nameUnread: { fontWeight: '900' },
  time: { ...typography.caption, color: palette.inkMuted, fontWeight: '700' },
  timeUnread: { color: palette.pink },
  messageRow: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: 5 },
  message: { ...typography.bodySm, color: palette.inkMuted, flex: 1 },
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
  unreadCountText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  translatedRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  translatedText: { color: palette.inkMuted, fontSize: 11, fontWeight: '700' },
  yourTurnRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  yourTurnText: { color: '#7B5909', fontSize: 11, fontWeight: '800' },
});
