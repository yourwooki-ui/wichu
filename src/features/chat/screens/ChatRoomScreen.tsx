import { Ionicons } from '@expo/vector-icons';
import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { CountryFlag } from '@/components/CountryFlag';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { Screen } from '@/components/Screen';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { MONETIZATION_ENABLED } from '@/constants/features';
import { DatePlanShareSheet } from '@/features/chat/components/DatePlanShareSheet';
import { palette, pressFeedback, radius } from '@/constants/theme';
import { chatMediaService, type ChatImageDraft } from '@/features/chat/services/chat-media-service';
import { CHAT_IMAGE_LIMIT, type ChatImageAttachment } from '@/features/chat/types/chat-attachment';
import { isNearChatBottom, shouldAutoScrollChat } from '@/features/chat/utils/chat-scroll';
import { assessMessageSafety } from '@/features/chat/utils/message-safety';
import {
  chatService,
  type ChatMessage,
  type ChatMessagePage,
} from '@/features/chat/services/chat-service';
import {
  normalizeLanguage,
  translationService,
} from '@/features/chat/services/translation-service';
import { getMockConversation, mockConversations } from '@/features/matches/data/mock-connections';
import { matchesService } from '@/features/matches/services/matches-service';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { safetyService } from '@/features/settings/services/safety-service';
import {
  ReportReasonSheet,
  type ReportReason,
} from '@/features/settings/components/ReportReasonSheet';
import { useAuthSession } from '@/hooks/use-auth-session';
import { hapticsService } from '@/services/haptics-service';
import { productAnalyticsService } from '@/services/product-analytics-service';

type ChatRoomScreenProps = { matchId: string };

const CONVERSATION_STARTERS = [
  '안녕하세요! 프로필이 인상적이었어요 🙂',
  '요즘 가장 즐겨 하는 건 뭐예요?',
  '서로 좋아하는 음악부터 이야기해볼까요?',
] as const;

type LocalMessage = {
  id: string;
  messageId?: string;
  content: string;
  mine: boolean;
  originalLanguage?: string;
  translated?: string;
  translationStatus?: 'translating' | 'failed';
  status?: 'sending' | 'failed';
  attachments?: ChatImageAttachment[];
  imageDrafts?: ChatImageDraft[];
  uploadProgress?: { completed: number; total: number };
};

export function ChatRoomScreen({ matchId }: ChatRoomScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { i18n, t } = useTranslation();
  const { session } = useAuthSession();
  const entitlement = usePassEntitlement();
  const reduceMotion = useReducedMotion();
  const userId = session?.user.id;
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const isNearBottomRef = useRef(true);
  const previousMessageCount = useRef(0);
  const mockConversation = getMockConversation(matchId) ?? mockConversations[0];
  const isMock = matchId.startsWith('mock-');
  const [draft, setDraft] = useState('');
  const [selectedImages, setSelectedImages] = useState<ChatImageDraft[]>([]);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [now] = useState(() => Date.now());
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [dateShareOpen, setDateShareOpen] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [revealedImageMessages, setRevealedImageMessages] = useState<Set<string>>(() => new Set());
  const [messages, setMessages] = useState<LocalMessage[]>(() =>
    isMock ? createMockMessages(mockConversation) : [],
  );
  const hasGoldPass = entitlement.data?.tier === 'gold';

  useEffect(() => {
    productAnalyticsService.track('chat_opened', { is_mock: isMock }, `/chat/${matchId}`);
  }, [isMock, matchId]);

  const connectionQuery = useQuery({
    enabled: !isMock && Boolean(userId),
    queryFn: async () => {
      const connections = await matchesService.listConnections(userId!);
      const connection = connections.find((item) => item.matchId === matchId);
      if (!connection) throw new Error('Match not found');
      return connection;
    },
    queryKey: ['match', matchId, userId],
    staleTime: 30_000,
  });

  const messagesQuery = useInfiniteQuery({
    enabled: !isMock && Boolean(userId),
    getNextPageParam: (lastPage: ChatMessagePage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => chatService.listMessages(matchId, { before: pageParam }),
    queryKey: ['chat', matchId],
    staleTime: 10_000,
  });

  const displayedMessages = useMemo(() => {
    if (isMock || !userId) return messages;
    const remoteMessages = [...(messagesQuery.data?.pages ?? [])]
      .reverse()
      .flatMap((page: ChatMessagePage) => page.messages)
      .map((message) => toLocalMessage(message, userId, i18n.language));
    return messages.reduce(mergeMessage, remoteMessages);
  }, [i18n.language, isMock, messages, messagesQuery.data, userId]);

  useEffect(() => {
    if (isMock || !userId) return;
    const channel = chatService.subscribe(matchId, (message) => {
      setMessages((current) =>
        mergeMessage(current, toLocalMessage(message, userId, i18n.language)),
      );
      if (message.sender_id !== userId) {
        void chatService.markRead(matchId).then(() => {
          void queryClient.invalidateQueries({ queryKey: ['matches'] });
        });
      }
    });
    return () => {
      void chatService.unsubscribe(channel);
    };
  }, [i18n.language, isMock, matchId, queryClient, userId]);

  useEffect(() => {
    if (isMock || !userId || !messagesQuery.data?.pages.length) return;
    void chatService.markRead(matchId).then(() => {
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    });
  }, [isMock, matchId, messagesQuery.data, queryClient, userId]);

  useEffect(() => {
    const previous = previousMessageCount.current;
    const next = displayedMessages.length;
    const latestMessage = displayedMessages[next - 1];
    previousMessageCount.current = displayedMessages.length;
    if (!next) return;

    const shouldScroll = shouldAutoScrollChat({
      isNearBottom: isNearBottomRef.current,
      latestMessageIsMine: Boolean(latestMessage?.mine),
      nextCount: next,
      previousCount: previous,
    });
    if (!shouldScroll) {
      if (next !== previous + 1 || latestMessage?.mine) return;
      const notificationTimer = setTimeout(() => setShowJumpToLatest(true), 0);
      return () => clearTimeout(notificationTimer);
    }

    const timer = setTimeout(() => {
      setShowJumpToLatest(false);
      isNearBottomRef.current = true;
      scrollRef.current?.scrollToEnd({ animated: previous > 0 });
    }, 60);
    return () => clearTimeout(timer);
  }, [displayedMessages]);

  const profile = useMemo(() => {
    const real = connectionQuery.data?.profile;
    if (!real) return mockConversation.profile;
    return {
      ...mockConversation.profile,
      id: real.id,
      name: real.display_name,
      countryCode: real.country_code,
      photo: real.photo ?? mockConversation.profile.photo,
      isOnline:
        Boolean(real.last_active_at) && now - new Date(real.last_active_at!).getTime() < 5 * 60_000,
    };
  }, [connectionQuery.data?.profile, mockConversation.profile, now]);

  const deliver = async (message: LocalMessage) => {
    if (isMock || !userId) return;
    setMessages((current) =>
      current.map((item) => (item.id === message.id ? { ...item, status: 'sending' } : item)),
    );
    try {
      let attachments = message.attachments ?? [];
      if (!attachments.length && message.imageDrafts?.length) {
        attachments = await chatMediaService.uploadImages(
          userId,
          matchId,
          message.id,
          message.imageDrafts,
          (completed, total) => {
            setMessages((current) =>
              current.map((item) =>
                item.id === message.id ? { ...item, uploadProgress: { completed, total } } : item,
              ),
            );
          },
        );
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id
              ? { ...item, attachments, imageDrafts: undefined, uploadProgress: undefined }
              : item,
          ),
        );
      }

      const saved = attachments.length
        ? await chatService.sendImageMessage(
            matchId,
            message.id,
            message.content,
            attachments,
            message.originalLanguage ?? '',
          )
        : await chatService.sendMessage(
            matchId,
            message.id,
            message.content,
            message.originalLanguage ?? '',
          );
      setMessages((current) => mergeMessage(current, toLocalMessage(saved, userId, i18n.language)));
      productAnalyticsService.track(
        'message_sent',
        {
          has_image: attachments.length > 0,
          has_text: Boolean(message.content),
        },
        `/chat/${matchId}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    } catch {
      setMessages((current) =>
        current.map((item) => (item.id === message.id ? { ...item, status: 'failed' } : item)),
      );
      hapticsService.error();
      AccessibilityInfo.announceForAccessibility(t('experience.chat.sendFailed'));
    }
  };

  const handleMessageScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const nearBottom = isNearChatBottom({
      contentHeight: contentSize.height,
      offsetY: contentOffset.y,
      viewportHeight: layoutMeasurement.height,
    });
    isNearBottomRef.current = nearBottom;
    if (nearBottom && showJumpToLatest) setShowJumpToLatest(false);
  };

  const jumpToLatest = () => {
    isNearBottomRef.current = true;
    setShowJumpToLatest(false);
    hapticsService.selection();
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const selectStarter = (starter: string) => {
    hapticsService.selection();
    setDraft(starter);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const pickImages = async () => {
    if (entitlement.isLoading) return;
    if (entitlement.isError) {
      Alert.alert('이용권을 확인하지 못했어요', '연결 상태를 확인한 뒤 다시 시도해주세요.');
      return;
    }
    if (!hasGoldPass) {
      const actions = MONETIZATION_ENABLED
        ? [
            { text: '나중에', style: 'cancel' as const },
            { text: 'Gold Pass 보기', onPress: () => router.push('/(tabs)/shop') },
          ]
        : [{ text: '확인' }];
      Alert.alert(
        'Gold Pass 전용 기능이에요',
        'Gold 회원은 사진을 한 번에 최대 5장까지 안전하게 보낼 수 있어요.',
        actions,
      );
      return;
    }

    const remaining = CHAT_IMAGE_LIMIT - selectedImages.length;
    if (remaining <= 0) {
      Alert.alert('사진은 5장까지', '선택한 사진을 지운 뒤 다른 사진을 추가해주세요.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        exif: false,
        mediaTypes: ['images'],
        orderedSelection: true,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        quality: 0.82,
        selectionLimit: remaining,
      });
      if (result.canceled) return;
      const additions = result.assets.slice(0, remaining).map((asset) => ({
        ...asset,
        draftId: randomUUID(),
      }));
      await chatMediaService.validateDrafts(additions);
      setSelectedImages((current) => [...current, ...additions].slice(0, CHAT_IMAGE_LIMIT));
    } catch {
      Alert.alert('사진을 추가하지 못했어요', t('reliability.messagesBody'));
    }
  };

  const commitSend = () => {
    const content = draft.trim();
    if ((!content && !selectedImages.length) || !userId) return;
    const optimisticId = randomUUID();
    const optimisticMessage: LocalMessage = {
      id: optimisticId,
      content,
      imageDrafts: selectedImages.length ? selectedImages : undefined,
      mine: true,
      originalLanguage: normalizeLanguage(i18n.language),
      status: isMock ? undefined : 'sending',
    };
    setDraft('');
    setSelectedImages([]);
    setMessages((current) => [...current, optimisticMessage]);
    hapticsService.selection();
    if (isMock) return;
    void deliver(optimisticMessage);
  };

  const send = () => {
    const warning = assessMessageSafety(draft);
    if (!warning) {
      commitSend();
      return;
    }

    productAnalyticsService.track('message_safety_warning', { warning }, `/chat/${matchId}`);
    Alert.alert(
      t(`experience.chatSafety.${warning}Title`),
      t(`experience.chatSafety.${warning}Body`),
      [
        { text: t('experience.chatSafety.edit'), style: 'cancel' },
        { text: t('experience.chatSafety.sendAnyway'), onPress: commitSend },
      ],
    );
  };

  const openImageViewer = (message: LocalMessage, index: number) => {
    const images = getMessageImageSources(message);
    if (!images.length) return;
    setViewerImages(images);
    setViewerIndex(Math.min(index, images.length - 1));
  };

  const translate = async (message: LocalMessage) => {
    const targetLanguage = normalizeLanguage(i18n.language);
    if (isMock) {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, translated: '내 언어로 번역된 샘플 메시지예요.' }
            : item,
        ),
      );
      return;
    }
    if (!message.messageId || message.translationStatus === 'translating') return;

    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, translationStatus: 'translating' } : item,
      ),
    );
    try {
      const result = await translationService.translateMessage(message.messageId, targetLanguage);
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, translated: result.translatedText, translationStatus: undefined }
            : item,
        ),
      );
      queryClient.setQueryData<InfiniteData<ChatMessagePage, string | null>>(
        ['chat', matchId],
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  messages: page.messages.map((item) =>
                    item.id === message.messageId
                      ? {
                          ...item,
                          translated_content: {
                            ...(isTranslationMap(item.translated_content)
                              ? item.translated_content
                              : {}),
                            [targetLanguage]: result.translatedText,
                          },
                        }
                      : item,
                  ),
                })),
              }
            : current,
      );
    } catch {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, translationStatus: 'failed' } : item,
        ),
      );
    }
  };

  const submitReport = async (reason: ReportReason) => {
    if (isMock) {
      setReportOpen(false);
      Alert.alert('테스트 프로필', '샘플 프로필에는 실제 신고가 접수되지 않아요.');
      return;
    }
    setSafetyBusy(true);
    const { error } = await safetyService.report(profile.id, reason);
    setSafetyBusy(false);
    setReportOpen(false);
    Alert.alert(
      error ? '신고하지 못했어요' : '신고가 접수됐어요',
      error ? '잠시 후 다시 시도해주세요.' : '운영진이 내용을 확인할게요.',
    );
    if (!error) productAnalyticsService.track('profile_reported', undefined, `/chat/${matchId}`);
  };

  const confirmBlock = () => {
    if (isMock) {
      setSafetyOpen(false);
      Alert.alert('테스트 프로필', '샘플 프로필에는 실제 차단이 적용되지 않아요.');
      return;
    }
    Alert.alert(`${profile.name}님을 차단할까요?`, '서로의 프로필과 메시지를 볼 수 없게 됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '차단',
        style: 'destructive',
        onPress: async () => {
          setSafetyBusy(true);
          const { error } = await safetyService.block(profile.id);
          setSafetyBusy(false);
          if (error) {
            Alert.alert('차단하지 못했어요', '잠시 후 다시 시도해주세요.');
            return;
          }
          setSafetyOpen(false);
          productAnalyticsService.track('profile_blocked', undefined, `/chat/${matchId}`);
          router.replace('/(tabs)/chat');
        },
      },
    ]);
  };

  const confirmEndMatch = () => {
    if (isMock) {
      setSafetyOpen(false);
      Alert.alert('테스트 매치', '샘플 대화는 개발 중 반복해서 확인할 수 있도록 유지돼요.');
      return;
    }
    Alert.alert(
      '대화방에서 나갈까요?',
      `나가면 ${profile.name}님과의 매치가 종료되고, 대화 내용은 양쪽에서 더 이상 볼 수 없습니다. 차단과 신고는 별도로 할 수 있어요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '대화방 나가기',
          style: 'destructive',
          onPress: async () => {
            setSafetyBusy(true);
            try {
              await matchesService.endMatch(matchId);
              queryClient.removeQueries({ queryKey: ['chat', matchId] });
              queryClient.removeQueries({ queryKey: ['match', matchId] });
              await queryClient.invalidateQueries({ queryKey: ['matches'] });
              await queryClient.invalidateQueries({ queryKey: ['chat-list'] });
              setSafetyOpen(false);
              router.replace('/(tabs)/chat');
            } catch {
              Alert.alert('대화방에서 나가지 못했어요', '이미 종료됐거나 연결이 불안정해요.');
            } finally {
              setSafetyBusy(false);
            }
          },
        },
      ],
    );
  };

  const loading = !isMock && (connectionQuery.isLoading || messagesQuery.isLoading);
  const failed = !isMock && (connectionQuery.isError || messagesQuery.isError);

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="뒤로"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Ionicons color={palette.ink} name="chevron-back" size={25} />
          </Pressable>
          <Pressable
            accessibilityLabel={`${profile.name} 프로필 열기`}
            accessibilityRole="button"
            onPress={() => router.push(`/profile/${profile.id}`)}
            style={styles.person}
          >
            <View>
              <Image
                cachePolicy="memory-disk"
                source={{ uri: profile.photo }}
                style={styles.headerAvatar}
              />
              {profile.isOnline ? <View style={styles.headerOnlineDot} /> : null}
            </View>
            <View>
              <View style={styles.personNameRow}>
                <Text style={styles.personName}>{profile.name}</Text>
                <CountryFlag compact countryCode={profile.countryCode} style={styles.flag} />
              </View>
              <Text style={styles.personMeta}>
                {profile.isOnline ? '현재 온라인' : '최근 활동'}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel="대화 안전 메뉴"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setSafetyOpen(true)}
            style={styles.headerButton}
          >
            <Ionicons color={palette.ink} name="ellipsis-horizontal" size={23} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.messages}
          onScroll={handleMessageScroll}
          ref={scrollRef}
          scrollEventThrottle={80}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.matchMoment}>
            <View style={styles.matchPhotos}>
              <Image
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: profile.photo }}
                style={styles.matchPhotoLeft}
                transition={140}
              />
              <View style={styles.matchMark}>
                <Ionicons color={palette.white} name="checkmark" size={14} />
              </View>
            </View>
            <Text style={styles.matchTitle}>서로를 픽했어요.</Text>
            <Text style={styles.matchSubtitle}>이제 서로 메시지를 보낼 수 있어요.</Text>
          </View>

          <View style={styles.safetyNotice}>
            <IllustratedIcon size={22} source={illustratedIcons.safety} />
            <Text style={styles.safetyNoticeText}>
              연락처와 개인정보는 충분히 알아간 뒤 천천히 공유하세요.
            </Text>
          </View>

          {!isMock && messagesQuery.hasNextPage ? (
            <Pressable
              accessibilityLabel="이전 메시지 불러오기"
              accessibilityRole="button"
              accessibilityState={{
                busy: messagesQuery.isFetchingNextPage,
                disabled: messagesQuery.isFetchingNextPage,
              }}
              disabled={messagesQuery.isFetchingNextPage}
              onPress={() => void messagesQuery.fetchNextPage()}
              style={styles.loadOlderButton}
            >
              {messagesQuery.isFetchingNextPage ? (
                <ActivityIndicator color={palette.inkMuted} size="small" />
              ) : (
                <Ionicons color={palette.inkMuted} name="chevron-up" size={15} />
              )}
              <Text style={styles.loadOlderText}>
                {messagesQuery.isFetchingNextPage ? '불러오는 중' : '이전 메시지'}
              </Text>
            </Pressable>
          ) : null}

          {loading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={palette.pink} />
              <Text style={styles.stateText}>대화를 불러오는 중이에요</Text>
            </View>
          ) : null}
          {failed ? (
            <View style={styles.stateBlock}>
              <IllustratedIcon size={56} source={illustratedIcons.connectionError} />
              <Text style={styles.stateTitle}>대화를 불러오지 못했어요</Text>
              <Pressable
                accessibilityLabel={t('reliability.retry')}
                accessibilityRole="button"
                onPress={() => {
                  void connectionQuery.refetch();
                  void messagesQuery.refetch();
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : null}
          {!loading && !failed ? (
            <>
              {!displayedMessages.length ? (
                <View style={styles.starterBlock}>
                  <Text style={styles.starterEyebrow}>FIRST MESSAGE</Text>
                  <Text style={styles.starterTitle}>첫 문장이 고민되나요?</Text>
                  <Text style={styles.starterBody}>문장을 골라 내 말투로 다듬어 보내보세요.</Text>
                  <View style={styles.starterList}>
                    {CONVERSATION_STARTERS.map((starter) => (
                      <Pressable
                        accessibilityLabel={`${starter} 입력`}
                        accessibilityRole="button"
                        key={starter}
                        onPress={() => selectStarter(starter)}
                        style={({ pressed }) => [
                          styles.starterAction,
                          pressed && styles.starterActionPressed,
                        ]}
                      >
                        <Text style={styles.starterActionText}>{starter}</Text>
                        <Ionicons color={palette.pink} name="arrow-forward" size={15} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {displayedMessages.length ? (
                <View style={styles.dayPill}>
                  <Text style={styles.dayText}>오늘</Text>
                </View>
              ) : null}
              {displayedMessages.map((message) => (
                <View
                  key={message.id}
                  style={[styles.messageBlock, message.mine ? styles.mineBlock : styles.theirBlock]}
                >
                  {getMessageImageItems(message).length ? (
                    <MessageImageGrid
                      hidden={!message.mine && !revealedImageMessages.has(message.id)}
                      images={getMessageImageItems(message)}
                      mine={message.mine}
                      onPress={(index) => {
                        if (!message.mine && !revealedImageMessages.has(message.id)) {
                          setRevealedImageMessages((current) => new Set(current).add(message.id));
                          return;
                        }
                        openImageViewer(message, index);
                      }}
                    />
                  ) : null}
                  {message.content ? (
                    <View
                      style={[
                        styles.bubble,
                        message.mine ? styles.mineBubble : styles.theirBubble,
                        getMessageImageItems(message).length ? styles.bubbleAfterMedia : null,
                      ]}
                    >
                      <Text style={[styles.bubbleText, message.mine && styles.mineText]}>
                        {message.content}
                      </Text>
                    </View>
                  ) : null}
                  {message.translated ? (
                    <View style={styles.translation}>
                      <IllustratedIcon size={18} source={illustratedIcons.translation} />
                      <Text style={styles.translationText}>{message.translated}</Text>
                    </View>
                  ) : !message.mine &&
                    message.messageId &&
                    normalizeLanguage(message.originalLanguage ?? '') !==
                      normalizeLanguage(i18n.language) ? (
                    <Pressable
                      accessibilityLabel="메시지 번역 보기"
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: message.translationStatus === 'translating',
                        disabled: message.translationStatus === 'translating',
                      }}
                      disabled={message.translationStatus === 'translating'}
                      onPress={() => void translate(message)}
                      style={styles.translationAction}
                    >
                      {message.translationStatus === 'translating' ? (
                        <ActivityIndicator color={palette.pink} size="small" />
                      ) : (
                        <IllustratedIcon size={18} source={illustratedIcons.translation} />
                      )}
                      <Text
                        style={[
                          styles.translationActionText,
                          message.translationStatus === 'failed' && styles.translationFailed,
                        ]}
                      >
                        {message.translationStatus === 'translating'
                          ? '번역 중…'
                          : message.translationStatus === 'failed'
                            ? '번역 실패 · 다시 시도'
                            : '번역 보기'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {message.status ? (
                    <Pressable
                      accessibilityLabel={
                        message.status === 'failed' ? '메시지 다시 보내기' : undefined
                      }
                      accessibilityRole="button"
                      disabled={message.status !== 'failed'}
                      onPress={() => void deliver(message)}
                      style={[
                        styles.deliveryAction,
                        message.mine ? styles.deliveryMine : styles.deliveryTheirs,
                      ]}
                    >
                      <Text
                        style={[
                          styles.deliveryText,
                          message.status === 'failed' && styles.deliveryFailed,
                        ]}
                      >
                        {message.status === 'sending'
                          ? message.uploadProgress
                            ? `사진 올리는 중 ${message.uploadProgress.completed}/${message.uploadProgress.total}`
                            : '전송 중…'
                          : '전송 실패 · 다시 보내기'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>

        {showJumpToLatest ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(180)}
            exiting={reduceMotion ? undefined : FadeOutDown.duration(140)}
            style={[styles.jumpToLatestAnchor, { bottom: selectedImages.length ? 154 : 72 }]}
          >
            <Pressable
              accessibilityLabel={t('experience.chat.newMessage')}
              accessibilityLiveRegion="polite"
              accessibilityRole="button"
              onPress={jumpToLatest}
              style={({ pressed }) => [styles.jumpToLatest, pressed && pressFeedback.control]}
            >
              <Ionicons color={palette.white} name="arrow-down" size={16} />
              <Text style={styles.jumpToLatestText}>{t('experience.chat.newMessage')}</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <View style={[styles.composerShell, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {selectedImages.length ? (
            <View style={styles.attachmentTray}>
              <View style={styles.attachmentTrayHeading}>
                <Text style={styles.attachmentTrayTitle}>보낼 사진</Text>
                <Text style={styles.attachmentCount}>
                  {selectedImages.length}/{CHAT_IMAGE_LIMIT}
                </Text>
              </View>
              <ScrollView
                contentContainerStyle={styles.attachmentPreviewContent}
                horizontal
                keyboardShouldPersistTaps="always"
                showsHorizontalScrollIndicator={false}
              >
                {selectedImages.map((image, index) => (
                  <View key={image.draftId} style={styles.attachmentPreviewWrap}>
                    <Image
                      cachePolicy="memory"
                      contentFit="cover"
                      recyclingKey={image.uri}
                      source={{ uri: image.uri }}
                      style={styles.attachmentPreview}
                    />
                    <Pressable
                      accessibilityLabel={`${index + 1}번째 사진 제거`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() =>
                        setSelectedImages((current) =>
                          current.filter((item) => item.draftId !== image.draftId),
                        )
                      }
                      style={styles.attachmentRemove}
                    >
                      <Ionicons color={palette.white} name="close" size={14} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.composerArea}>
            <Pressable
              accessibilityLabel={hasGoldPass ? '사진 추가' : 'Gold Pass 사진 전송 기능 알아보기'}
              accessibilityRole="button"
              accessibilityState={{
                busy: entitlement.isLoading,
                disabled: failed || entitlement.isLoading,
              }}
              disabled={failed || entitlement.isLoading}
              hitSlop={4}
              onPress={() => void pickImages()}
              style={({ pressed }) => [styles.mediaButton, pressed && styles.pressed]}
            >
              <IllustratedIcon size={30} source={illustratedIcons.profilePhotos} />
              <Text style={styles.goldDiamond}>◆</Text>
            </Pressable>
            <View style={styles.composer}>
              <TextInput
                editable={!failed}
                maxLength={4000}
                multiline
                onChangeText={setDraft}
                placeholder={`${profile.name}님에게 메시지 보내기`}
                placeholderTextColor="#93939B"
                ref={inputRef}
                style={styles.input}
                value={draft}
              />
            </View>
            <Pressable
              accessibilityLabel="메시지 보내기"
              accessibilityRole="button"
              accessibilityState={{
                disabled: (!draft.trim() && !selectedImages.length) || failed,
              }}
              disabled={(!draft.trim() && !selectedImages.length) || failed}
              onPress={send}
              hitSlop={6}
              style={({ pressed }) => [
                styles.sendButton,
                (!draft.trim() && !selectedImages.length) || failed ? styles.sendDisabled : null,
                pressed && pressFeedback.control,
              ]}
            >
              <Ionicons color={palette.white} name="arrow-up" size={20} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <AppModal
        animationType="fade"
        onRequestClose={() => setSafetyOpen(false)}
        transparent
        visible={safetyOpen}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="대화 안전 메뉴 닫기"
            accessibilityRole="button"
            onPress={() => setSafetyOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.safetySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{profile.name}님과의 대화</Text>
            <SafetyAction
              disabled={safetyBusy}
              icon="share-social-outline"
              label={t('experience.dateShare.action')}
              onPress={() => {
                setSafetyOpen(false);
                setDateShareOpen(true);
              }}
            />
            <SafetyAction
              disabled={safetyBusy}
              icon="person-outline"
              label="프로필 보기"
              onPress={() => {
                setSafetyOpen(false);
                router.push(`/profile/${profile.id}`);
              }}
            />
            <SafetyAction
              disabled={safetyBusy}
              icon="flag-outline"
              label="신고하기"
              onPress={() => {
                setSafetyOpen(false);
                setReportOpen(true);
              }}
            />
            <SafetyAction
              danger
              disabled={safetyBusy}
              icon="exit-outline"
              label="대화방 나가기"
              onPress={confirmEndMatch}
            />
            <SafetyAction
              danger
              disabled={safetyBusy}
              icon="ban-outline"
              label="차단하기"
              onPress={confirmBlock}
            />
            <Pressable
              accessibilityLabel="대화 안전 메뉴 닫기"
              accessibilityRole="button"
              accessibilityState={{ disabled: safetyBusy }}
              disabled={safetyBusy}
              onPress={() => setSafetyOpen(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>{safetyBusy ? '처리 중…' : '닫기'}</Text>
            </Pressable>
          </View>
        </View>
      </AppModal>

      <ReportReasonSheet
        busy={safetyBusy}
        onClose={() => setReportOpen(false)}
        onSelect={(reason) => void submitReport(reason)}
        visible={reportOpen}
      />

      <DatePlanShareSheet
        matchName={profile.name}
        onClose={() => setDateShareOpen(false)}
        visible={dateShareOpen}
      />

      <ImageViewer
        images={viewerImages}
        initialIndex={viewerIndex}
        key={`${viewerIndex}-${viewerImages.join('|')}`}
        onClose={() => setViewerImages([])}
        visible={viewerImages.length > 0}
      />
    </Screen>
  );
}

function createMockMessages(conversation: (typeof mockConversations)[number]): LocalMessage[] {
  return [
    { id: '1', content: 'Hey! Your profile made me want to travel again.', mine: false },
    { id: '2', content: 'Then I owe you a proper recommendation list 🙂', mine: true },
    {
      id: '3',
      content: conversation.message.replace(/^You: /, ''),
      mine: false,
      translated: '내 언어로 번역됨',
    },
    {
      id: '4',
      content: '여기 정말 좋았어요. 다음에는 같이 가요!',
      mine: false,
      attachments: [
        {
          path: 'mock/chat-photo.jpg',
          mimeType: 'image/jpeg',
          width: 900,
          height: 1200,
          url: conversation.profile.photo,
        },
      ],
    },
  ];
}

function toLocalMessage(message: ChatMessage, userId: string, locale: string): LocalMessage {
  const translations =
    message.translated_content &&
    typeof message.translated_content === 'object' &&
    !Array.isArray(message.translated_content)
      ? message.translated_content
      : {};
  const translated = translations[locale];
  return {
    id: message.client_id ?? message.id,
    messageId: message.id,
    content: message.content,
    mine: message.sender_id === userId,
    originalLanguage: message.original_language ?? undefined,
    attachments: message.attachments,
    translated: typeof translated === 'string' ? translated : undefined,
  };
}

type MessageImageItem = { key: string; uri?: string };

function getMessageImageItems(message: LocalMessage): MessageImageItem[] {
  if (message.attachments?.length) {
    return message.attachments.map((attachment) => ({
      key: attachment.path,
      uri: attachment.url ?? attachment.localUri,
    }));
  }
  return (message.imageDrafts ?? []).map((image) => ({ key: image.draftId, uri: image.uri }));
}

function getMessageImageSources(message: LocalMessage) {
  return getMessageImageItems(message).flatMap((image) => (image.uri ? [image.uri] : []));
}

function isTranslationMap(
  value: ChatMessage['translated_content'],
): value is Record<string, string> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function mergeMessage(current: LocalMessage[], incoming: LocalMessage) {
  const index = current.findIndex((message) => message.id === incoming.id);
  if (index < 0) return [...current, incoming];
  const next = [...current];
  next[index] = incoming;
  return next;
}

function MessageImageGrid({
  hidden,
  images,
  mine,
  onPress,
}: {
  hidden: boolean;
  images: MessageImageItem[];
  mine: boolean;
  onPress: (index: number) => void;
}) {
  const { t } = useTranslation();
  const single = images.length === 1;
  return (
    <View style={[styles.imageGrid, mine ? styles.imageGridMine : styles.imageGridTheirs]}>
      {images.map((image, index) => (
        <Pressable
          accessibilityLabel={`${index + 1}번째 사진 크게 보기`}
          accessibilityRole="button"
          disabled={!image.uri}
          key={image.key}
          onPress={() => onPress(index)}
          style={[styles.messageImageWrap, single && styles.messageImageWrapSingle]}
        >
          {image.uri ? (
            <Image
              blurRadius={hidden ? 26 : 0}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: image.uri }}
              style={styles.messageImage}
              transition={140}
            />
          ) : (
            <View style={styles.messageImageFallback}>
              <Ionicons color={palette.inkMuted} name="image-outline" size={25} />
              <Text style={styles.messageImageFallbackText}>사진을 불러오지 못했어요</Text>
            </View>
          )}
          {hidden && image.uri ? (
            <View pointerEvents="none" style={styles.hiddenImageOverlay}>
              <IllustratedIcon size={30} source={illustratedIcons.safety} />
              <Text style={styles.hiddenImageTitle}>{t('experience.chatSafety.imageHidden')}</Text>
              <Text style={styles.hiddenImageBody}>{t('experience.chatSafety.revealImage')}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function ImageViewer({
  images,
  initialIndex,
  onClose,
  visible,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
  visible: boolean;
}) {
  const { height, width } = useWindowDimensions();
  const viewerInsets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  return (
    <AppModal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View accessibilityViewIsModal style={styles.viewerBackdrop}>
        <View style={[styles.viewerHeader, { paddingTop: Math.max(viewerInsets.top + 6, 18) }]}>
          <Text style={styles.viewerCount}>
            {activeIndex + 1} / {images.length}
          </Text>
          <Pressable
            accessibilityLabel="사진 닫기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
          >
            <Ionicons color={palette.white} name="close" size={30} />
          </Pressable>
        </View>
        <ScrollView
          contentOffset={{ x: width * initialIndex, y: 0 }}
          horizontal
          onMomentumScrollEnd={(event) =>
            setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          pagingEnabled
          showsHorizontalScrollIndicator={false}
        >
          {images.map((uri) => (
            <View key={uri} style={{ height, justifyContent: 'center', width }}>
              <Image contentFit="contain" source={{ uri }} style={styles.viewerImage} />
            </View>
          ))}
        </ScrollView>
      </View>
    </AppModal>
  );
}

function SafetyAction({
  danger = false,
  disabled,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  disabled: boolean;
  icon: 'person-outline' | 'flag-outline' | 'exit-outline' | 'ban-outline' | 'share-social-outline';
  label: string;
  onPress: () => void;
}) {
  const color = danger ? '#D52C47' : palette.ink;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.safetyAction, pressed && styles.pressed]}
    >
      <Ionicons color={color} name={icon} size={20} />
      <Text style={[styles.safetyActionText, { color }]}>{label}</Text>
      <Ionicons color={palette.inkMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', backgroundColor: '#F5F5F6', maxWidth: 620, width: '100%' },
  keyboard: { flex: 1 },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomColor: '#E4E4E7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 70,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  person: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  headerAvatar: { backgroundColor: '#E1E1E5', borderRadius: 20, height: 40, width: 40 },
  headerOnlineDot: {
    backgroundColor: palette.lime,
    borderColor: palette.white,
    borderRadius: 6,
    borderWidth: 2,
    bottom: 0,
    height: 12,
    position: 'absolute',
    right: 0,
    width: 12,
  },
  personNameRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  personName: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  personMeta: { color: palette.inkMuted, fontSize: 10, fontWeight: '700', marginTop: 1 },
  flag: { borderRadius: 3, height: 11, width: 16 },
  messages: { flexGrow: 1, paddingBottom: 18, paddingHorizontal: 16 },
  matchMoment: { alignItems: 'center', paddingBottom: 25, paddingTop: 24 },
  matchPhotos: { height: 58, position: 'relative', width: 64 },
  matchPhotoLeft: {
    backgroundColor: '#E1E1E5',
    borderColor: '#F5F5F6',
    borderRadius: 29,
    borderWidth: 3,
    height: 58,
    width: 58,
  },
  matchMark: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderColor: '#F5F5F6',
    borderRadius: 12,
    borderWidth: 2,
    bottom: -2,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 24,
  },
  matchTitle: { color: palette.ink, fontSize: 16, fontWeight: '900', marginTop: 11 },
  matchSubtitle: { color: palette.inkMuted, fontSize: 11, marginTop: 3 },
  safetyNotice: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFF7D9',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 22,
    maxWidth: 360,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  safetyNoticeText: { color: '#6F5700', flexShrink: 1, fontSize: 10, fontWeight: '700' },
  loadOlderButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  loadOlderText: { color: palette.inkMuted, fontSize: 11, fontWeight: '800' },
  starterBlock: {
    backgroundColor: palette.white,
    borderColor: '#E2E2E7',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    padding: 16,
  },
  starterEyebrow: { color: palette.pink, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  starterTitle: { color: palette.ink, fontSize: 16, fontWeight: '900', marginTop: 4 },
  starterBody: { color: palette.inkMuted, fontSize: 10, marginTop: 3 },
  starterList: { gap: 7, marginTop: 13 },
  starterAction: {
    alignItems: 'center',
    backgroundColor: '#F4F4F6',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 13,
  },
  starterActionPressed: { backgroundColor: '#FFE8EF' },
  starterActionText: { color: palette.ink, flex: 1, fontSize: 11, fontWeight: '800' },
  stateBlock: { alignItems: 'center', gap: 9, paddingVertical: 35 },
  stateTitle: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  stateText: { color: palette.inkMuted, fontSize: 12, fontWeight: '700' },
  retryButton: {
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  retryText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  dayPill: {
    alignSelf: 'center',
    backgroundColor: '#E8E8EB',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  dayText: { color: palette.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  messageBlock: { marginTop: 12, maxWidth: '82%' },
  mineBlock: { alignItems: 'flex-end', alignSelf: 'flex-end' },
  theirBlock: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 20, paddingHorizontal: 15, paddingVertical: 11 },
  bubbleAfterMedia: { marginTop: 4 },
  mineBubble: { backgroundColor: palette.ink, borderBottomRightRadius: 6 },
  theirBubble: { backgroundColor: palette.white, borderBottomLeftRadius: 6 },
  bubbleText: { color: palette.ink, fontSize: 14, lineHeight: 20 },
  mineText: { color: palette.white },
  translation: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 3,
  },
  translationText: { color: palette.inkMuted, fontSize: 10, fontWeight: '700' },
  translationAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 3,
  },
  translationActionText: { color: palette.pink, fontSize: 10, fontWeight: '800' },
  translationFailed: { color: '#D52C47' },
  deliveryAction: { marginTop: 5 },
  deliveryMine: { alignSelf: 'flex-end' },
  deliveryTheirs: { alignSelf: 'flex-start' },
  deliveryText: { color: palette.inkMuted, fontSize: 10, marginRight: 3 },
  deliveryFailed: { color: '#D52C47', fontWeight: '800' },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    overflow: 'hidden',
    width: 242,
  },
  imageGridMine: { borderBottomRightRadius: 8, borderTopLeftRadius: 19, borderTopRightRadius: 19 },
  imageGridTheirs: {
    borderBottomLeftRadius: 8,
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
  },
  messageImageWrap: {
    backgroundColor: '#E1E1E5',
    height: 145,
    overflow: 'hidden',
    width: 119.5,
  },
  messageImageWrapSingle: { height: 292, width: 242 },
  messageImage: { height: '100%', width: '100%' },
  messageImageFallback: {
    alignItems: 'center',
    flex: 1,
    gap: 7,
    justifyContent: 'center',
    padding: 10,
  },
  messageImageFallbackText: {
    color: palette.inkMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  hiddenImageOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,20,0.34)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  hiddenImageTitle: { color: palette.white, fontSize: 13, fontWeight: '900', marginTop: 5 },
  hiddenImageBody: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  jumpToLatest: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: palette.ink,
    borderColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 9,
  },
  jumpToLatestAnchor: { alignSelf: 'center', position: 'absolute', zIndex: 4 },
  jumpToLatestText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  composerShell: {
    backgroundColor: palette.white,
    borderTopColor: '#E4E4E7',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  composerArea: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
  },
  mediaButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    position: 'relative',
    width: 42,
  },
  goldDiamond: {
    color: '#C99500',
    fontSize: 10,
    position: 'absolute',
    right: 1,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 2,
    top: 0,
  },
  attachmentTray: { paddingBottom: 9 },
  attachmentTrayHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 7,
    paddingHorizontal: 14,
  },
  attachmentTrayTitle: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  attachmentCount: { color: '#A17500', fontSize: 10, fontWeight: '900' },
  attachmentPreviewContent: { gap: 8, paddingHorizontal: 12 },
  attachmentPreviewWrap: { height: 62, position: 'relative', width: 62 },
  attachmentPreview: { backgroundColor: '#E1E1E5', borderRadius: 13, height: 62, width: 62 },
  attachmentRemove: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.82)',
    borderColor: palette.white,
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    width: 20,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: '#F0F0F2',
    borderRadius: 22,
    flex: 1,
    flexDirection: 'row',
    minHeight: 42,
    paddingLeft: 14,
    paddingRight: 5,
  },
  input: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 42,
    outlineWidth: 0,
    paddingVertical: 11,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sendDisabled: { backgroundColor: '#C8C8CE' },
  viewerBackdrop: { backgroundColor: '#08080A', flex: 1 },
  viewerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 18,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  viewerCount: { color: palette.white, fontSize: 13, fontWeight: '800' },
  viewerImage: { height: '100%', width: '100%' },
  modalBackdrop: { backgroundColor: 'rgba(12,12,16,0.46)', flex: 1, justifyContent: 'flex-end' },
  safetySheet: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#D8D8DE',
    borderRadius: 2,
    height: 4,
    marginBottom: 20,
    width: 42,
  },
  sheetTitle: { color: palette.ink, fontSize: 19, fontWeight: '900', marginBottom: 12 },
  safetyAction: { alignItems: 'center', flexDirection: 'row', minHeight: 56 },
  safetyActionText: { flex: 1, fontSize: 15, fontWeight: '800', marginLeft: 12 },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#F1F1F3',
    borderRadius: radius.md,
    marginTop: 8,
    paddingVertical: 15,
  },
  cancelText: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.66 },
});
