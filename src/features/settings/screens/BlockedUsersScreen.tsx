import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CountryFlag } from '@/components/CountryFlag';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ListRowsSkeleton } from '@/components/Skeleton';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius, typography } from '@/constants/theme';
import { safetyService } from '@/features/settings/services/safety-service';

const queryKey = ['safety', 'blocked-users'] as const;
const blockedDateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' });

export function BlockedUsersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const blockedQuery = useQuery({ queryKey, queryFn: safetyService.listBlockedUsers });
  const unblockMutation = useMutation({
    mutationFn: safetyService.unblock,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () =>
      Alert.alert('차단을 해제하지 못했어요', '연결 상태를 확인하고 다시 시도해 주세요.'),
  });

  const confirmUnblock = (blockId: string, name: string) => {
    Alert.alert(`${name}님의 차단을 해제할까요?`, '해제 후 탐색에서 다시 만날 수 있어요.', [
      { text: '취소', style: 'cancel' },
      { text: '차단 해제', onPress: () => unblockMutation.mutate(blockId) },
    ]);
  };

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons color={palette.ink} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>차단한 사용자</Text>
        <View style={styles.headerButton} />
      </View>

      {blockedQuery.isLoading ? (
        <View style={styles.content}>
          <ListRowsSkeleton count={4} height={76} />
        </View>
      ) : blockedQuery.isError ? (
        <EmptyState
          actionLabel="다시 시도"
          description="연결 상태를 확인하고 다시 불러와 주세요."
          illustration={illustratedIcons.connectionError}
          onAction={() => void blockedQuery.refetch()}
          title="차단 목록을 불러오지 못했어요"
          tone="error"
        />
      ) : blockedQuery.data?.length === 0 ? (
        <EmptyState
          description="차단한 사용자가 없어요."
          illustration={illustratedIcons.safety}
          title="차단 목록이 비어 있어요"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.helper}>차단한 사용자는 서로의 프로필과 메시지를 볼 수 없어요.</Text>
          <View style={styles.list}>
            {(blockedQuery.data ?? []).map((item) => (
              <View key={item.block_id} style={styles.row}>
                {item.photoUrl ? (
                  <Image contentFit="cover" source={{ uri: item.photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons color={palette.inkMuted} name="person" size={22} />
                  </View>
                )}
                <View style={styles.copy}>
                  <View style={styles.nameRow}>
                    <Text numberOfLines={1} style={styles.name}>
                      {item.display_name}
                    </Text>
                    {item.country_code ? (
                      <CountryFlag
                        compact
                        countryCode={item.country_code}
                        label={item.country_code}
                      />
                    ) : null}
                  </View>
                  <Text style={styles.date}>
                    {blockedDateFormatter.format(new Date(item.blocked_at))}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={unblockMutation.isPending}
                  onPress={() => confirmUnblock(item.block_id, item.display_name)}
                  style={({ pressed }) => [styles.unblock, pressed && styles.pressed]}
                >
                  <Text style={styles.unblockText}>해제</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 68,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerTitle: { ...typography.subheading, color: palette.ink, fontWeight: '900' },
  content: { paddingBottom: 32, paddingHorizontal: 18 },
  helper: { ...typography.caption, color: palette.inkMuted, marginBottom: 12 },
  list: { backgroundColor: palette.white, borderRadius: 22, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    borderBottomColor: '#ECECEF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 14,
  },
  avatar: { borderRadius: 22, height: 44, width: 44 },
  avatarFallback: { alignItems: 'center', backgroundColor: '#EFEFF2', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: 11 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  name: { ...typography.bodyStrong, color: palette.ink, flexShrink: 1, fontWeight: '900' },
  date: { color: palette.inkMuted, fontSize: 10, marginTop: 3 },
  unblock: {
    borderColor: '#D8D8DD',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  unblockText: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.58 },
});
