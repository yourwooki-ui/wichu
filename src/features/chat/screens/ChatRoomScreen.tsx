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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Keyboard,
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
import Animated, {
  FadeInDown,
  FadeOutDown,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { CountryFlag } from '@/components/CountryFlag';
import {
  BottomSheetCloseButton,
  InteractiveBottomSheet,
} from '@/components/InteractiveBottomSheet';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { Screen } from '@/components/Screen';
import { ChatRoomSkeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { MONETIZATION_ENABLED } from '@/constants/features';
import { reviewSamplesEnabled } from '@/constants/feature-flags';
import { listLayout, messageEntering, stateEntering, stateExiting } from '@/constants/motion';
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
import { getTranslationLanguage } from '@/features/translation/translation-language';
import { getMockConversation, mockConversations } from '@/features/matches/data/mock-connections';
import {
  matchesService,
  type MatchConnection,
  type MatchRoomConnection,
} from '@/features/matches/services/matches-service';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { safetyService } from '@/features/settings/services/safety-service';
import {
  ReportReasonSheet,
  type ReportSubmission,
} from '@/features/settings/components/ReportReasonSheet';
import { useAuthSession } from '@/hooks/use-auth-session';
import { hapticsService } from '@/services/haptics-service';
import { reportOperationalError } from '@/services/operational-error-service';
import { productAnalyticsService } from '@/services/product-analytics-service';

type ChatRoomScreenProps = { matchId: string };

type LocalMessage = {
  id: string;
  messageId?: string;
  content: string;
  mine: boolean;
  originalLanguage?: string;
  translated?: string;
  translatedLanguage?: string;
  translationVisible?: boolean;
  translationStatus?: 'translating' | 'failed';
  translationStatusLanguage?: string;
  status?: 'sending' | 'failed';
  attachments?: ChatImageAttachment[];
  imageDrafts?: ChatImageDraft[];
  uploadProgress?: { completed: number; total: number };
  animateOnMount?: boolean;
};

export function ChatRoomScreen({ matchId }: ChatRoomScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { i18n, t } = useTranslation();
  const activeAppLanguage = i18n.resolvedLanguage ?? i18n.language;
  const translationTargetLanguage = getTranslationLanguage(activeAppLanguage);
  const { session } = useAuthSession();
  const entitlement = usePassEntitlement();
  const reduceMotion = useReducedMotion();
  const userId = session?.user.id;
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const isNearBottomRef = useRef(true);
  const previousMessageCount = useRef(0);
  const isMock = reviewSamplesEnabled && matchId.startsWith('mock-');
  const mockConversation = getMockConversation(matchId) ?? mockConversations[0];
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
      const connection = await matchesService.getConnection(matchId);
      if (!connection) throw new Error('Match not found');
      return connection;
    },
    queryKey: ['match', matchId, userId],
    placeholderData: () => {
      const cached = queryClient
        .getQueryData<MatchConnection[]>(['matches', 'connections', userId])
        ?.find((item) => item.matchId === matchId);
      return cached ? toMatchRoomConnection(cached) : undefined;
    },
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

  useEffect(() => {
    const error = connectionQuery.error ?? messagesQuery.error;
    if (error) reportOperationalError('chat_room_query', error, `/chat/${matchId}`);
  }, [connectionQuery.error, matchId, messagesQuery.error]);

  const displayedMessages = useMemo(() => {
    if (isMock || !userId) return messages;
    const remoteMessages = [...(messagesQuery.data?.pages ?? [])]
      .reverse()
      .flatMap((page: ChatMessagePage) => page.messages)
      .map((message) => toLocalMessage(message, userId, activeAppLanguage));
    return messages.reduce(mergeMessage, remoteMessages);
  }, [activeAppLanguage, isMock, messages, messagesQuery.data, userId]);

  useEffect(() => {
    if (isMock || !userId) return;
    const channel = chatService.subscribe(matchId, (message) => {
      setMessages((current) =>
        mergeMessage(current, {
          ...toLocalMessage(message, userId, activeAppLanguage),
          animateOnMount: message.sender_id !== userId,
        }),
      );
      if (message.sender_id !== userId) {
        void chatService
          .markRead(matchId)
          .then(() => queryClient.invalidateQueries({ queryKey: ['matches'] }))
          .catch(() => undefined);
      }
    });
    return () => {
      void chatService.unsubscribe(channel).catch(() => undefined);
    };
  }, [activeAppLanguage, isMock, matchId, queryClient, userId]);

  useEffect(() => {
    if (isMock || !userId || !messagesQuery.data?.pages.length) return;
    void chatService
      .markRead(matchId)
      .then(() => queryClient.invalidateQueries({ queryKey: ['matches'] }))
      .catch(() => undefined);
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

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const subscription = Keyboard.addListener(showEvent, () => {
      if (!isNearBottomRef.current) return;
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return () => subscription.remove();
  }, []);

  const profile = useMemo(() => {
    if (isMock) return mockConversation.profile;
    const real = connectionQuery.data?.profile;
    if (!real) return null;
    return {
      ...mockConversation.profile,
      id: real.id,
      name: real.display_name,
      countryCode: real.country_code,
      photo: real.photo ?? '',
      isOnline:
        Boolean(real.last_active_at) && now - new Date(real.last_active_at!).getTime() < 5 * 60_000,
    };
  }, [connectionQuery.data?.profile, isMock, mockConversation.profile, now]);

  if (!isMock && connectionQuery.isLoading) {
    return (
      <Screen edges={['top', 'left', 'right']} style={styles.connectionStateScreen}>
        <ChatRoomSkeleton />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen edges={['top', 'left', 'right']} style={styles.connectionStateScreen}>
        <StateView
          actionLabel={t('reliability.retry')}
          body={t('reliability.messagesBody')}
          container="plain"
          illustration={illustratedIcons.connectionError}
          onAction={() => void connectionQuery.refetch()}
          title={t('reliability.messagesTitle')}
          tone="error"
        />
      </Screen>
    );
  }

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
      setMessages((current) =>
        mergeMessage(current, toLocalMessage(saved, userId, activeAppLanguage)),
      );
      productAnalyticsService.track(
        'message_sent',
        {
          has_image: attachments.length > 0,
          has_text: Boolean(message.content),
        },
        `/chat/${matchId}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['matches'] }).catch(() => undefined);
    } catch {
      setMessages((current) =>
        current.map((item) => (item.id === message.id ? { ...item, status: 'failed' } : item)),
      );
      hapticsService.error();
      try {
        AccessibilityInfo.announceForAccessibility(t('experience.chat.sendFailed'));
      } catch {
        // 접근성 모듈 실패가 메시지 재시도 UI까지 막지 않게 한다.
      }
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
      Alert.alert(t('chatRoom.passCheckFailed'), t('chatRoom.reconnect'));
      return;
    }
    if (!hasGoldPass) {
      const actions = MONETIZATION_ENABLED
        ? [
            { text: t('chatRoom.later'), style: 'cancel' as const },
            { text: t('chatRoom.viewGold'), onPress: () => router.push('/(tabs)/shop') },
          ]
        : [{ text: t('chatRoom.confirm') }];
      Alert.alert(t('chatRoom.goldTitle'), t('chatRoom.goldPhotoBody'), actions);
      return;
    }

    const remaining = CHAT_IMAGE_LIMIT - selectedImages.length;
    if (remaining <= 0) {
      Alert.alert(t('chatRoom.maxPhotosTitle'), t('chatRoom.maxPhotosBody'));
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
      Alert.alert(t('chatRoom.photoAddFailed'), t('reliability.messagesBody'));
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
      originalLanguage: normalizeLanguage(activeAppLanguage),
      status: isMock ? undefined : 'sending',
      animateOnMount: true,
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

  const updateMessage = (message: LocalMessage, patch: Partial<LocalMessage>) => {
    setMessages((current) => {
      const index = current.findIndex((item) => item.id === message.id);
      if (index < 0) return [...current, { ...message, ...patch }];
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const translate = async (message: LocalMessage) => {
    const targetLanguage = translationTargetLanguage;
    if (!targetLanguage) return;
    if (hasTranslationFor(message, targetLanguage)) {
      updateMessage(message, {
        translated: message.translated,
        translatedLanguage: targetLanguage,
        translationVisible: !message.translationVisible,
      });
      return;
    }
    if (isMock) {
      updateMessage(message, {
        translated: t('experience.chat.sampleTranslation'),
        translatedLanguage: targetLanguage,
        translationVisible: true,
      });
      return;
    }
    if (!message.messageId || isTranslationPending(message, targetLanguage)) return;

    updateMessage(message, {
      translationStatus: 'translating',
      translationStatusLanguage: targetLanguage,
    });
    try {
      const result = await translationService.translateMessage(
        message.messageId,
        activeAppLanguage,
      );
      updateMessage(message, {
        translated: result.translatedText,
        translatedLanguage: targetLanguage,
        translationStatus: undefined,
        translationStatusLanguage: undefined,
        translationVisible: true,
      });
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
    } catch (error) {
      reportOperationalError('chat_translation', error, `/chat/${matchId}`);
      updateMessage(message, {
        translationStatus: 'failed',
        translationStatusLanguage: targetLanguage,
      });
    }
  };

  const submitReport = async (submission: ReportSubmission) => {
    if (isMock) {
      setReportOpen(false);
      Alert.alert(t('chatRoom.sampleProfileTitle'), t('chatRoom.sampleProfileBody'));
      return;
    }
    setSafetyBusy(true);
    const { error } = await safetyService.report(profile.id, {
      context: 'chat',
      sourceMatchId: matchId,
      ...submission,
    });
    setSafetyBusy(false);
    setReportOpen(false);
    Alert.alert(
      error ? t('chatRoom.reportFailedTitle') : t('chatRoom.reportSuccessTitle'),
      error ? t('chatRoom.reportFailedBody') : t('chatRoom.reportSuccessBody'),
    );
    if (!error) productAnalyticsService.track('profile_reported', undefined, `/chat/${matchId}`);
  };

  const confirmBlock = () => {
    if (isMock) {
      setSafetyOpen(false);
      Alert.alert(t('chatRoom.sampleProfileTitle'), t('chatRoom.sampleBlockBody'));
      return;
    }
    Alert.alert(t('chatRoom.blockTitle', { name: profile.name }), t('chatRoom.blockBody'), [
      { text: t('chatRoom.cancel'), style: 'cancel' },
      {
        text: t('chatRoom.block'),
        style: 'destructive',
        onPress: async () => {
          setSafetyBusy(true);
          const { error } = await safetyService.block(profile.id);
          setSafetyBusy(false);
          if (error) {
            Alert.alert(t('chatRoom.blockFailed'), t('chatRoom.reportFailedBody'));
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
      Alert.alert(t('chatRoom.sampleMatchTitle'), t('chatRoom.sampleMatchBody'));
      return;
    }
    Alert.alert(t('chatRoom.leaveTitle'), t('chatRoom.leaveBody', { name: profile.name }), [
      { text: t('chatRoom.cancel'), style: 'cancel' },
      {
        text: t('chatRoom.leave'),
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
            Alert.alert(t('chatRoom.leaveFailed'), t('chatRoom.leaveFailedBody'));
          } finally {
            setSafetyBusy(false);
          }
        },
      },
    ]);
  };

  const loading = !isMock && (connectionQuery.isLoading || messagesQuery.isLoading);
  const failed = !isMock && (connectionQuery.isError || messagesQuery.isError);

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={t('chatRoom.back')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Ionicons color={palette.ink} name="chevron-back" size={25} />
          </Pressable>
          <Pressable
            accessibilityLabel={t('chatRoom.openProfile', { name: profile.name })}
            accessibilityRole="button"
            onPress={() =>
              router.push(
                `/profile/${profile.id}?context=chat&matchId=${encodeURIComponent(matchId)}`,
              )
            }
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
                {profile.isOnline ? t('chatRoom.online') : t('chatRoom.recent')}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel={t('chatRoom.safetyMenu')}
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
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          onScroll={handleMessageScroll}
          ref={scrollRef}
          scrollEventThrottle={80}
          showsVerticalScrollIndicator={false}
          style={styles.messageScroll}
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
            <Text style={styles.matchTitle}>{t('chatRoom.matchTitle')}</Text>
            <Text style={styles.matchSubtitle}>{t('chatRoom.matchSubtitle')}</Text>
          </View>

          <View style={styles.safetyNotice}>
            <IllustratedIcon size={22} source={illustratedIcons.safety} />
            <Text style={styles.safetyNoticeText}>{t('chatRoom.safetyTip')}</Text>
          </View>

          {!isMock && messagesQuery.hasNextPage ? (
            <Pressable
              accessibilityLabel={t('chatRoom.olderA11y')}
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
                {messagesQuery.isFetchingNextPage
                  ? t('chatRoom.olderLoading')
                  : t('chatRoom.older')}
              </Text>
            </Pressable>
          ) : null}

          {loading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={palette.pink} />
              <Text style={styles.stateText}>{t('chatRoom.loading')}</Text>
            </View>
          ) : null}
          {failed ? (
            <View style={styles.stateBlock}>
              <IllustratedIcon size={56} source={illustratedIcons.connectionError} />
              <Text style={styles.stateTitle}>{t('chatRoom.loadFailed')}</Text>
              <Pressable
                accessibilityLabel={t('reliability.retry')}
                accessibilityRole="button"
                onPress={() => {
                  void connectionQuery.refetch();
                  void messagesQuery.refetch();
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>{t('chatRoom.retry')}</Text>
              </Pressable>
            </View>
          ) : null}
          {!loading && !failed ? (
            <>
              {!displayedMessages.length ? (
                <View style={styles.starterBlock}>
                  <Text style={styles.starterEyebrow}>FIRST MESSAGE</Text>
                  <Text style={styles.starterTitle}>{t('chatRoom.starterTitle')}</Text>
                  <Text style={styles.starterBody}>{t('chatRoom.starterBody')}</Text>
                  <View style={styles.starterList}>
                    {[
                      t('chatRoom.starters.profile'),
                      t('chatRoom.starters.hobby'),
                      t('chatRoom.starters.music'),
                    ].map((starter) => (
                      <Pressable
                        accessibilityLabel={t('chatRoom.starterA11y', { starter })}
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
                  <Text style={styles.dayText}>{t('chatRoom.today')}</Text>
                </View>
              ) : null}
              {displayedMessages.map((message) => (
                <Animated.View
                  entering={message.animateOnMount ? messageEntering() : undefined}
                  key={message.id}
                  layout={listLayout()}
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
                  {isTranslationShown(message, activeAppLanguage) ? (
                    <Animated.View entering={stateEntering()} style={styles.translation}>
                      <IllustratedIcon size={18} source={illustratedIcons.translation} />
                      <Text style={styles.translationText}>{message.translated}</Text>
                    </Animated.View>
                  ) : null}
                  {!message.mine &&
                  Boolean(message.content) &&
                  Boolean(translationTargetLanguage) &&
                  (isMock || message.messageId) &&
                  normalizeLanguage(message.originalLanguage ?? '') !==
                    normalizeLanguage(activeAppLanguage) ? (
                    <Pressable
                      accessibilityLabel={
                        isTranslationShown(message, activeAppLanguage)
                          ? t('experience.chat.showOriginal')
                          : t('experience.chat.translate')
                      }
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: isTranslationPending(message, activeAppLanguage),
                        disabled: isTranslationPending(message, activeAppLanguage),
                      }}
                      disabled={isTranslationPending(message, activeAppLanguage)}
                      onPress={() => void translate(message)}
                      style={styles.translationAction}
                    >
                      {isTranslationPending(message, activeAppLanguage) ? (
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
                        {isTranslationPending(message, activeAppLanguage)
                          ? t('experience.chat.translating')
                          : isTranslationFailed(message, activeAppLanguage)
                            ? t('experience.chat.translationRetry')
                            : isTranslationShown(message, activeAppLanguage)
                              ? t('experience.chat.showOriginal')
                              : t('experience.chat.translate')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {message.status ? (
                    <Animated.View entering={stateEntering()} exiting={stateExiting()}>
                      <Pressable
                        accessibilityLabel={
                          message.status === 'failed' ? t('chatRoom.retryMessage') : undefined
                        }
                        accessibilityRole="button"
                        disabled={message.status !== 'failed'}
                        onPress={() => void deliver(message)}
                        style={[
                          styles.deliveryAction,
                          message.mine ? styles.deliveryMine : styles.deliveryTheirs,
                        ]}
                      >
                        <View style={styles.deliveryCopy}>
                          <Text
                            style={[
                              styles.deliveryText,
                              message.status === 'failed' && styles.deliveryFailed,
                            ]}
                          >
                            {message.status === 'sending'
                              ? message.uploadProgress
                                ? t('chatRoom.uploading', message.uploadProgress)
                                : t('chatRoom.sending')
                              : t('chatRoom.sendFailed')}
                          </Text>
                          {message.uploadProgress ? (
                            <UploadProgress
                              completed={message.uploadProgress.completed}
                              total={message.uploadProgress.total}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </Animated.View>
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
            <Animated.View
              entering={stateEntering()}
              exiting={stateExiting()}
              style={styles.attachmentTray}
            >
              <View style={styles.attachmentTrayHeading}>
                <Text style={styles.attachmentTrayTitle}>{t('chatRoom.trayTitle')}</Text>
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
                  <Animated.View
                    entering={messageEntering()}
                    exiting={stateExiting()}
                    key={image.draftId}
                    layout={listLayout()}
                    style={styles.attachmentPreviewWrap}
                  >
                    <Image
                      cachePolicy="memory"
                      contentFit="cover"
                      recyclingKey={image.uri}
                      source={{ uri: image.uri }}
                      style={styles.attachmentPreview}
                    />
                    <Pressable
                      accessibilityLabel={t('chatRoom.removePhoto', { index: index + 1 })}
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
                  </Animated.View>
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}
          <View style={styles.composerArea}>
            <Pressable
              accessibilityLabel={
                hasGoldPass ? t('chatRoom.addPhoto') : t('chatRoom.goldPhotoA11y')
              }
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
              <View style={styles.goldPassMark}>
                <IllustratedIcon size={16} source={illustratedIcons.goldPremium} />
              </View>
            </Pressable>
            <View style={styles.composer}>
              <TextInput
                editable={!failed}
                maxLength={4000}
                multiline
                onChangeText={setDraft}
                onFocus={() => {
                  if (!isNearBottomRef.current) return;
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
                }}
                placeholder={t('chatRoom.placeholder', { name: profile.name })}
                placeholderTextColor="#93939B"
                ref={inputRef}
                style={styles.input}
                value={draft}
              />
            </View>
            <Pressable
              accessibilityLabel={t('chatRoom.send')}
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

      <InteractiveBottomSheet
        accessibilityLabel={t('chatRoom.safetyMenu')}
        contentStyle={styles.safetySheetContent}
        dismissEnabled={!safetyBusy}
        onClose={() => setSafetyOpen(false)}
        sheetStyle={styles.safetySheet}
        visible={safetyOpen}
      >
        <Text style={styles.sheetTitle}>{t('chatRoom.sheetTitle', { name: profile.name })}</Text>
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
          label={t('chatRoom.viewProfile')}
          onPress={() => {
            setSafetyOpen(false);
            router.push(
              `/profile/${profile.id}?context=chat&matchId=${encodeURIComponent(matchId)}`,
            );
          }}
        />
        <SafetyAction
          disabled={safetyBusy}
          icon="flag-outline"
          label={t('chatRoom.report')}
          onPress={() => {
            setSafetyOpen(false);
            setReportOpen(true);
          }}
        />
        <SafetyAction
          danger
          disabled={safetyBusy}
          icon="exit-outline"
          label={t('chatRoom.leave')}
          onPress={confirmEndMatch}
        />
        <SafetyAction
          danger
          disabled={safetyBusy}
          icon="ban-outline"
          label={t('chatRoom.block')}
          onPress={confirmBlock}
        />
        <BottomSheetCloseButton
          accessibilityLabel={t('chatRoom.close')}
          accessibilityRole="button"
          accessibilityState={{ disabled: safetyBusy }}
          disabled={safetyBusy}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>
            {safetyBusy ? t('chatRoom.processing') : t('chatRoom.close')}
          </Text>
        </BottomSheetCloseButton>
      </InteractiveBottomSheet>

      <ReportReasonSheet
        busy={safetyBusy}
        onClose={() => setReportOpen(false)}
        onSubmit={(submission) => void submitReport(submission)}
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

function toMatchRoomConnection(connection: MatchConnection): MatchRoomConnection {
  return {
    matchId: connection.matchId,
    matchedAt: connection.matchedAt,
    profile: {
      id: connection.profile.id,
      display_name: connection.profile.display_name,
      country_code: connection.profile.country_code,
      last_active_at: connection.profile.last_active_at,
      photo: connection.profile.photo,
    },
  };
}

function createMockMessages(conversation: (typeof mockConversations)[number]): LocalMessage[] {
  return [
    {
      id: '1',
      content: 'Hey! Your profile made me want to travel again.',
      mine: false,
      originalLanguage: 'en',
    },
    { id: '2', content: 'Then I owe you a proper recommendation list 🙂', mine: true },
    {
      id: '3',
      content: conversation.message.replace(/^You: /, ''),
      mine: false,
      originalLanguage: 'en',
    },
    {
      id: '4',
      content: 'I loved this place. Let’s go together next time!',
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
  const normalizedLocale = normalizeLanguage(locale);
  const translated = translations[normalizedLocale] ?? translations[locale];
  return {
    id: message.client_id ?? message.id,
    messageId: message.id,
    content: message.content,
    mine: message.sender_id === userId,
    originalLanguage: message.original_language ?? undefined,
    attachments: message.attachments,
    translated: typeof translated === 'string' ? translated : undefined,
    translatedLanguage: typeof translated === 'string' ? normalizedLocale : undefined,
    // 서버에 캐시된 번역이 있어도 사용자가 버튼을 누르기 전에는 원문만 보여준다.
    translationVisible: false,
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

function hasTranslationFor(message: LocalMessage, targetLanguage: string) {
  return Boolean(
    message.translated &&
    normalizeLanguage(message.translatedLanguage ?? '') === normalizeLanguage(targetLanguage),
  );
}

function isTranslationShown(message: LocalMessage, targetLanguage: string) {
  return Boolean(message.translationVisible && hasTranslationFor(message, targetLanguage));
}

function isTranslationPending(message: LocalMessage, targetLanguage: string) {
  return (
    message.translationStatus === 'translating' &&
    normalizeLanguage(message.translationStatusLanguage ?? '') === normalizeLanguage(targetLanguage)
  );
}

function isTranslationFailed(message: LocalMessage, targetLanguage: string) {
  return (
    message.translationStatus === 'failed' &&
    normalizeLanguage(message.translationStatusLanguage ?? '') === normalizeLanguage(targetLanguage)
  );
}

function mergeMessage(current: LocalMessage[], incoming: LocalMessage) {
  const index = current.findIndex((message) => message.id === incoming.id);
  if (index < 0) return [...current, incoming];
  const next = [...current];
  next[index] = incoming;
  return next;
}

function UploadProgress({ completed, total }: { completed: number; total: number }) {
  const progress = useSharedValue(total > 0 ? completed / total : 0);

  useEffect(() => {
    progress.set(withTiming(total > 0 ? completed / total : 0, { duration: 180 }));
  }, [completed, progress, total]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.get())) * 100}%`,
  }));

  return (
    <View accessibilityRole="progressbar" style={styles.uploadTrack}>
      <Animated.View style={[styles.uploadFill, fillStyle]} />
    </View>
  );
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
          accessibilityLabel={t('chatRoom.imageA11y', {
            count: images.length,
            index: index + 1,
          })}
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
              <Text style={styles.messageImageFallbackText}>{t('chatRoom.imageFailed')}</Text>
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
  const { t } = useTranslation();
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
            accessibilityLabel={t('chatRoom.closeImage')}
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
            <ZoomableViewerImage
              height={height}
              key={uri}
              onClose={onClose}
              uri={uri}
              width={width}
            />
          ))}
        </ScrollView>
        {images.length > 1 ? (
          <View
            accessibilityLabel={t('chatRoom.imageA11y', {
              count: images.length,
              index: activeIndex + 1,
            })}
            style={[styles.viewerDots, { bottom: Math.max(viewerInsets.bottom + 18, 24) }]}
          >
            {images.map((uri, index) => (
              <View
                key={`dot-${uri}`}
                style={[styles.viewerDot, index === activeIndex && styles.viewerDotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </AppModal>
  );
}

function ZoomableViewerImage({
  height,
  onClose,
  uri,
  width,
}: {
  height: number;
  onClose: () => void;
  uri: string;
  width: number;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onUpdate((event) => {
        scale.set(Math.max(1, Math.min(4, savedScale.get() * event.scale)));
      })
      .onEnd(() => {
        savedScale.set(scale.get());
      });

    const pan = Gesture.Pan()
      .activeOffsetY([-12, 12])
      .failOffsetX([-22, 22])
      .onBegin(() => {
        dragStartX.set(translateX.get());
        dragStartY.set(translateY.get());
      })
      .onUpdate((event) => {
        if (scale.get() > 1.02) {
          translateX.set(dragStartX.get() + event.translationX);
          translateY.set(dragStartY.get() + event.translationY);
          return;
        }
        if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
          translateY.set(event.translationY);
        }
      })
      .onEnd((event) => {
        if (scale.get() > 1.02) return;
        if (Math.abs(translateY.get()) > 120 || Math.abs(event.velocityY) > 950) {
          runOnJS(onClose)();
          return;
        }
        translateY.set(withSpring(0, { damping: 20, stiffness: 220 }));
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((_event, success) => {
        if (!success) return;
        if (scale.get() > 1.02) {
          scale.set(withSpring(1, { damping: 20, stiffness: 220 }));
          savedScale.set(1);
          translateX.set(withSpring(0, { damping: 20, stiffness: 220 }));
          translateY.set(withSpring(0, { damping: 20, stiffness: 220 }));
          return;
        }
        scale.set(withSpring(2.2, { damping: 20, stiffness: 220 }));
        savedScale.set(2.2);
      });

    return Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [dragStartX, dragStartY, onClose, savedScale, scale, translateX, translateY]);

  const imageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translateY.get()), [0, 240], [1, 0.42], Extrapolation.CLAMP),
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.viewerPage, { height, width }, imageStyle]}>
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          source={{ uri }}
          style={styles.viewerImage}
        />
      </Animated.View>
    </GestureDetector>
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
  connectionStateScreen: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F5F5F6',
    gap: 14,
    justifyContent: 'center',
    maxWidth: 620,
    paddingHorizontal: 24,
    width: '100%',
  },
  keyboard: { flex: 1 },
  messageScroll: { flex: 1, minHeight: 0 },
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
  deliveryCopy: { minWidth: 92 },
  deliveryMine: { alignSelf: 'flex-end' },
  deliveryTheirs: { alignSelf: 'flex-start' },
  deliveryText: { color: palette.inkMuted, fontSize: 10, marginRight: 3 },
  deliveryFailed: { color: '#D52C47', fontWeight: '800' },
  uploadTrack: {
    backgroundColor: '#D7D7DC',
    borderRadius: 2,
    height: 3,
    marginTop: 4,
    overflow: 'hidden',
    width: '100%',
  },
  uploadFill: { backgroundColor: palette.pink, borderRadius: 2, height: '100%' },
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
  goldPassMark: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    top: -2,
    width: 18,
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
  viewerPage: { justifyContent: 'center' },
  viewerImage: { height: '100%', width: '100%' },
  viewerDots: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    position: 'absolute',
  },
  viewerDot: { backgroundColor: '#68686F', borderRadius: 3, height: 5, width: 5 },
  viewerDotActive: { backgroundColor: palette.white, width: 16 },
  safetySheet: {
    backgroundColor: palette.white,
  },
  safetySheetContent: {
    paddingBottom: 24,
    paddingHorizontal: 20,
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
