import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { ChatRowsSkeleton } from '@/components/Skeleton';
import { StateView } from '@/components/StateView';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette } from '@/constants/theme';
import { matchesService } from '@/features/matches/services/matches-service';
import { useAuthSession } from '@/hooks/use-auth-session';

export function NotificationsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { session } = useAuthSession();
  const connectionsQuery = useQuery({
    enabled: visible && Boolean(session?.user.id),
    queryFn: () => matchesService.listConnections(session!.user.id),
    queryKey: ['matches', 'connections', session?.user.id],
    staleTime: 20_000,
  });
  const items = (connectionsQuery.data ?? []).flatMap((connection) => {
    if (connection.unreadCount > 0) {
      return [
        {
          id: `message:${connection.matchId}`,
          matchId: connection.matchId,
          photo: connection.profile.photo,
          title: `${connection.profile.display_name}님의 새 메시지`,
          body: connection.lastMessage?.content ?? '새 메시지가 도착했어요.',
          time: connection.lastMessage?.created_at ?? connection.matchedAt,
        },
      ];
    }
    if (!connection.lastMessage) {
      return [
        {
          id: `match:${connection.matchId}`,
          matchId: connection.matchId,
          photo: connection.profile.photo,
          title: `${connection.profile.display_name}님과 매치됐어요`,
          body: '지금 첫 인사를 보내보세요.',
          time: connection.matchedAt,
        },
      ];
    }
    return [];
  });

  return (
    <AppModal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>알림</Text>
            <Pressable
              accessibilityLabel="알림 닫기"
              hitSlop={8}
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons color={palette.ink} name="close" size={21} />
            </Pressable>
          </View>
          {connectionsQuery.isLoading ? (
            <View style={styles.list}>
              <ChatRowsSkeleton count={4} />
            </View>
          ) : connectionsQuery.isError ? (
            <StateView
              actionLabel="다시 시도"
              body="연결 상태를 확인하고 다시 불러와 주세요."
              container="plain"
              illustration={illustratedIcons.connectionError}
              onAction={() => void connectionsQuery.refetch()}
              title="알림을 불러오지 못했어요"
              tone="error"
            />
          ) : items.length ? (
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    onClose();
                    router.push(`/chat/${item.matchId}`);
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <IllustratedIcon size={30} source={illustratedIcons.connections} />
                    </View>
                  )}
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text numberOfLines={1} style={styles.rowBody}>
                      {item.body}
                    </Text>
                  </View>
                  <Text style={styles.rowTime}>{formatActivityTime(item.time)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.empty}>
              <View style={styles.icon}>
                <IllustratedIcon size={56} source={illustratedIcons.notification} />
              </View>
              <Text style={styles.emptyTitle}>새로운 알림이 없어요</Text>
              <Text style={styles.emptyText}>
                새로운 Pick, Match와 메시지가 생기면 여기에 알려드릴게요.
              </Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    </AppModal>
  );
}

function formatActivityTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}시간`;
  return `${Math.floor(minutes / 1_440)}일`;
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(17,17,17,0.38)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: '#F8F8FA',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxWidth: 460,
    minHeight: 330,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: palette.line,
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    marginTop: 10,
    width: 38,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  close: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  empty: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  list: { paddingBottom: 18, paddingHorizontal: 12, paddingTop: 12 },
  row: {
    alignItems: 'center',
    borderBottomColor: '#E1E1E5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 76,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: palette.white, borderRadius: 17 },
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#FFE8EF',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  rowBody: { color: palette.inkMuted, fontSize: 10, marginTop: 3 },
  rowTime: { color: palette.inkMuted, fontSize: 10, fontWeight: '700' },
  icon: {
    alignItems: 'center',
    backgroundColor: '#FFF4CF',
    borderRadius: 29,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '900', marginTop: 15 },
  emptyText: {
    color: palette.inkMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
    maxWidth: 250,
    textAlign: 'center',
  },
});
