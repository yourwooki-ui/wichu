import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryFlag } from '@/components/CountryFlag';
import { Screen } from '@/components/Screen';
import { palette, radius } from '@/constants/theme';
import { chatService, type ChatMessage } from '@/features/chat/services/chat-service';
import { getMockConversation, mockConversations } from '@/features/matches/data/mock-connections';
import { matchesService } from '@/features/matches/services/matches-service';
import { safetyService } from '@/features/settings/services/safety-service';
import { useAuthSession } from '@/hooks/use-auth-session';

type ChatRoomScreenProps = { matchId: string };

type LocalMessage = {
  id: string;
  content: string;
  mine: boolean;
  translated?: string;
  status?: 'sending' | 'failed';
};

export function ChatRoomScreen({ matchId }: ChatRoomScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const scrollRef = useRef<ScrollView>(null);
  const mockConversation = getMockConversation(matchId) ?? mockConversations[0];
  const isMock = matchId.startsWith('mock-');
  const [draft, setDraft] = useState('');
  const [now] = useState(() => Date.now());
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>(() =>
    createMockMessages(mockConversation),
  );

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

  const messagesQuery = useQuery({
    enabled: !isMock && Boolean(userId),
    queryFn: () => chatService.listMessages(matchId),
    queryKey: ['chat', matchId],
    staleTime: 10_000,
  });

  const displayedMessages = useMemo(() => {
    if (isMock || !userId) return messages;
    const remoteMessages = (messagesQuery.data ?? []).map((message) =>
      toLocalMessage(message, userId, i18n.language),
    );
    return messages.reduce(mergeMessage, remoteMessages);
  }, [i18n.language, isMock, messages, messagesQuery.data, userId]);

  useEffect(() => {
    if (isMock || !userId) return;
    const channel = chatService.subscribe(matchId, (message) => {
      setMessages((current) =>
        mergeMessage(current, toLocalMessage(message, userId, i18n.language)),
      );
    });
    return () => {
      void chatService.unsubscribe(channel);
    };
  }, [i18n.language, isMock, matchId, userId]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [displayedMessages.length]);

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

  const send = async () => {
    const content = draft.trim();
    if (!content || !userId) return;
    const optimisticId = `local-${Date.now()}`;
    setDraft('');
    setMessages((current) => [
      ...current,
      { id: optimisticId, content, mine: true, status: isMock ? undefined : 'sending' },
    ]);
    if (isMock) return;

    try {
      const saved = await chatService.sendMessage(matchId, userId, content, i18n.language);
      setMessages((current) =>
        mergeMessage(
          current.filter((message) => message.id !== optimisticId),
          toLocalMessage(saved, userId, i18n.language),
        ),
      );
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === optimisticId ? { ...message, status: 'failed' } : message,
        ),
      );
    }
  };

  const submitReport = async (reason: string) => {
    if (isMock) {
      setSafetyOpen(false);
      Alert.alert('테스트 프로필', '샘플 프로필에는 실제 신고가 접수되지 않아요.');
      return;
    }
    setSafetyBusy(true);
    const { error } = await safetyService.report(profile.id, reason);
    setSafetyBusy(false);
    setSafetyOpen(false);
    Alert.alert(
      error ? '신고하지 못했어요' : '신고가 접수됐어요',
      error ? '잠시 후 다시 시도해주세요.' : '운영진이 내용을 확인할게요.',
    );
  };

  const chooseReportReason = () => {
    Alert.alert('신고 이유를 선택해주세요', undefined, [
      { text: '부적절한 콘텐츠', onPress: () => void submitReport('inappropriate_content') },
      { text: '스팸 또는 홍보', onPress: () => void submitReport('spam') },
      { text: '허위 프로필', onPress: () => void submitReport('fake_profile') },
      { text: '취소', style: 'cancel' },
    ]);
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
      `${profile.name}님과의 매치를 종료할까요?`,
      '대화가 즉시 종료되고 서로 메시지를 주고받을 수 없게 됩니다. 차단과 신고는 별도로 할 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '매치 종료',
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
              Alert.alert('매치를 종료하지 못했어요', '이미 종료됐거나 연결이 불안정해요.');
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
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Ionicons color={palette.ink} name="chevron-back" size={25} />
          </Pressable>
          <Pressable
            accessibilityLabel={`${profile.name} 프로필 열기`}
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
            hitSlop={8}
            onPress={() => setSafetyOpen(true)}
            style={styles.headerButton}
          >
            <Ionicons color={palette.ink} name="ellipsis-horizontal" size={23} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.messages}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.matchMoment}>
            <View style={styles.matchPhotos}>
              <Image source={{ uri: profile.photo }} style={styles.matchPhotoLeft} />
              <View style={styles.matchMark}>
                <Ionicons color={palette.white} name="checkmark" size={14} />
              </View>
            </View>
            <Text style={styles.matchTitle}>서로를 픽했어요.</Text>
            <Text style={styles.matchSubtitle}>가볍게 첫인사를 건네보세요.</Text>
          </View>

          {loading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={palette.pink} />
              <Text style={styles.stateText}>대화를 불러오는 중이에요</Text>
            </View>
          ) : null}
          {failed ? (
            <View style={styles.stateBlock}>
              <Ionicons color={palette.inkMuted} name="cloud-offline-outline" size={26} />
              <Text style={styles.stateTitle}>대화를 불러오지 못했어요</Text>
              <Pressable
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
              <View style={styles.dayPill}>
                <Text style={styles.dayText}>오늘</Text>
              </View>
              {displayedMessages.map((message) => (
                <View
                  key={message.id}
                  style={[styles.messageBlock, message.mine ? styles.mineBlock : styles.theirBlock]}
                >
                  <View
                    style={[styles.bubble, message.mine ? styles.mineBubble : styles.theirBubble]}
                  >
                    <Text style={[styles.bubbleText, message.mine && styles.mineText]}>
                      {message.content}
                    </Text>
                  </View>
                  {message.translated ? (
                    <View style={styles.translation}>
                      <Ionicons color={palette.inkMuted} name="language" size={12} />
                      <Text style={styles.translationText}>{message.translated}</Text>
                    </View>
                  ) : null}
                  {message.status ? (
                    <Text
                      style={[
                        styles.deliveryText,
                        message.status === 'failed' && styles.deliveryFailed,
                      ]}
                    >
                      {message.status === 'sending' ? '전송 중…' : '전송 실패'}
                    </Text>
                  ) : null}
                </View>
              ))}
              {displayedMessages.length ? <Text style={styles.seen}>방금 읽음</Text> : null}
            </>
          ) : null}
        </ScrollView>

        <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            accessibilityLabel="사진 첨부"
            onPress={() =>
              Alert.alert('사진 메시지', '이미지 전송은 다음 개발 단계에서 연결할게요.')
            }
            style={styles.addButton}
          >
            <Ionicons color={palette.ink} name="add" size={25} />
          </Pressable>
          <View style={styles.composer}>
            <TextInput
              editable={!failed}
              maxLength={4000}
              multiline
              onChangeText={setDraft}
              placeholder="메시지 입력..."
              placeholderTextColor="#93939B"
              style={styles.input}
              value={draft}
            />
            <View style={styles.translateButton}>
              <Ionicons color={palette.inkMuted} name="language" size={19} />
            </View>
          </View>
          <Pressable
            accessibilityLabel="메시지 보내기"
            disabled={!draft.trim() || failed}
            onPress={() => void send()}
            style={[styles.sendButton, (!draft.trim() || failed) && styles.sendDisabled]}
          >
            <Ionicons color={palette.white} name="arrow-up" size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        onRequestClose={() => setSafetyOpen(false)}
        transparent
        visible={safetyOpen}
      >
        <Pressable onPress={() => setSafetyOpen(false)} style={styles.modalBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.safetySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{profile.name}님과의 대화</Text>
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
              onPress={chooseReportReason}
            />
            <SafetyAction
              danger
              disabled={safetyBusy}
              icon="heart-dislike-outline"
              label="매치 종료"
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
              disabled={safetyBusy}
              onPress={() => setSafetyOpen(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>{safetyBusy ? '처리 중…' : '닫기'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    id: message.id,
    content: message.content,
    mine: message.sender_id === userId,
    translated: typeof translated === 'string' ? translated : undefined,
  };
}

function mergeMessage(current: LocalMessage[], incoming: LocalMessage) {
  return current.some((message) => message.id === incoming.id) ? current : [...current, incoming];
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
  icon: 'person-outline' | 'flag-outline' | 'heart-dislike-outline' | 'ban-outline';
  label: string;
  onPress: () => void;
}) {
  const color = danger ? '#D52C47' : palette.ink;
  return (
    <Pressable
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
  dayText: { color: palette.inkMuted, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  messageBlock: { marginTop: 12, maxWidth: '82%' },
  mineBlock: { alignItems: 'flex-end', alignSelf: 'flex-end' },
  theirBlock: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 20, paddingHorizontal: 15, paddingVertical: 11 },
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
  translationText: { color: palette.inkMuted, fontSize: 9, fontWeight: '700' },
  deliveryText: { color: palette.inkMuted, fontSize: 9, marginRight: 3, marginTop: 5 },
  deliveryFailed: { color: '#D52C47', fontWeight: '800' },
  seen: {
    alignSelf: 'flex-end',
    color: palette.inkMuted,
    fontSize: 9,
    marginRight: 3,
    marginTop: 6,
  },
  composerArea: {
    alignItems: 'flex-end',
    backgroundColor: palette.white,
    borderTopColor: '#E4E4E7',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  addButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 34 },
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
  translateButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 38 },
  sendButton: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sendDisabled: { backgroundColor: '#C8C8CE' },
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
