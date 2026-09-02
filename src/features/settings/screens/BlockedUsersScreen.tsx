import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CountryFlag } from '@/components/CountryFlag';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ListRowsSkeleton } from '@/components/Skeleton';
import { listEntering, listExiting, listLayout } from '@/constants/motion';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius, typography } from '@/constants/theme';
import { safetyService } from '@/features/settings/services/safety-service';
import { formatDate } from '@/lib/intl-format';

const queryKey = ['safety', 'blocked-users'] as const;

export function BlockedUsersScreen() {
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const blockedQuery = useQuery({ queryKey, queryFn: safetyService.listBlockedUsers });
  const unblockMutation = useMutation({
    mutationFn: safetyService.unblock,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () =>
      Alert.alert(
        t('safetySurfaces.blocked.unblockFailed'),
        t('safetySurfaces.blocked.unblockFailedBody'),
      ),
  });

  const confirmUnblock = (blockId: string, name: string) => {
    Alert.alert(
      t('safetySurfaces.blocked.confirmTitle', { name }),
      t('safetySurfaces.blocked.confirmBody'),
      [
        { text: t('safetySurfaces.blocked.cancel'), style: 'cancel' },
        {
          text: t('safetySurfaces.blocked.confirm'),
          onPress: () => unblockMutation.mutate(blockId),
        },
      ],
    );
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('safetySurfaces.blocked.back')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons color={palette.ink} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('safetySurfaces.blocked.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      {blockedQuery.isLoading ? (
        <View style={styles.content}>
          <ListRowsSkeleton count={4} height={76} />
        </View>
      ) : blockedQuery.isError ? (
        <EmptyState
          actionLabel={t('reliability.retry')}
          description={t('safetySurfaces.blocked.unblockFailedBody')}
          illustration={illustratedIcons.connectionError}
          onAction={() => void blockedQuery.refetch()}
          title={t('safetySurfaces.blocked.loadFailed')}
          tone="error"
        />
      ) : blockedQuery.data?.length === 0 ? (
        <EmptyState
          description={t('safetySurfaces.blocked.emptyBody')}
          illustration={illustratedIcons.safety}
          title={t('safetySurfaces.blocked.emptyTitle')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <Text style={styles.helper}>{t('safetySurfaces.blocked.helper')}</Text>
          <View style={styles.list}>
            {(blockedQuery.data ?? []).map((item, index) => (
              <Animated.View
                entering={listEntering(index)}
                exiting={listExiting()}
                key={item.block_id}
                layout={listLayout()}
                style={styles.row}
              >
                {item.photoUrl ? (
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    recyclingKey={item.profile_id}
                    source={{ uri: item.photoUrl }}
                    style={styles.avatar}
                    transition={140}
                  />
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
                    {formatDate(i18n.resolvedLanguage ?? 'ko-KR', new Date(item.blocked_at))}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={unblockMutation.isPending}
                  onPress={() => confirmUnblock(item.block_id, item.display_name)}
                  style={({ pressed }) => [styles.unblock, pressed && styles.pressed]}
                >
                  <Text style={styles.unblockText}>{t('safetySurfaces.blocked.action')}</Text>
                </Pressable>
              </Animated.View>
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
  scroll: { flex: 1, minHeight: 0 },
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
