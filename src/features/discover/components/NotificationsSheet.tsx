import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  BottomSheetCloseButton,
  InteractiveBottomSheet,
} from '@/components/InteractiveBottomSheet';
import { buildNotificationItems } from '@/features/discover/utils/notification-feed';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { ChatRowsSkeleton } from '@/components/Skeleton';
import { listEntering, listExiting, listLayout } from '@/constants/motion';
import { StateView } from '@/components/StateView';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, pressFeedback } from '@/constants/theme';
import { matchesService } from '@/features/matches/services/matches-service';
import { useAuthSession } from '@/hooks/use-auth-session';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NotificationsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const { session } = useAuthSession();
  const sheetHeight = Math.min(Math.max(height * 0.62, 360), 620);
  const connectionsQuery = useQuery({
    enabled: visible && Boolean(session?.user.id),
    queryFn: () => matchesService.listConnections(session!.user.id),
    queryKey: ['matches', 'connections', session?.user.id],
    staleTime: 20_000,
  });
  const items = buildNotificationItems(connectionsQuery.data, {
    matchBody: t('discoveryControls.notifications.matchBody'),
    matchTitle: (name) => t('discoveryControls.notifications.matchTitle', { name }),
    messageFallback: t('discoveryControls.notifications.messageFallback'),
    messageTitle: (name) => t('discoveryControls.notifications.messageTitle', { name }),
  });

  return (
    <InteractiveBottomSheet
      accessibilityLabel={t('discoveryControls.notifications.panel')}
      collapsedOffset={Math.min(height * 0.26, 220)}
      onClose={onClose}
      sheetStyle={[styles.sheet, { height: sheetHeight }]}
      visible={visible}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('discoveryControls.notifications.title')}</Text>
        <BottomSheetCloseButton
          accessibilityLabel={t('discoveryControls.notifications.close')}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && pressFeedback.icon]}
        >
          <Ionicons color={palette.ink} name="close" size={21} />
        </BottomSheetCloseButton>
      </View>
      {connectionsQuery.isLoading ? (
        <View style={styles.list}>
          <ChatRowsSkeleton count={4} />
        </View>
      ) : connectionsQuery.isError ? (
        <StateView
          actionLabel={t('reliability.retry')}
          body={t('reliability.connectionsBody')}
          container="plain"
          illustration={illustratedIcons.connectionError}
          onAction={() => void connectionsQuery.refetch()}
          title={t('discoveryControls.notifications.failed')}
          tone="error"
        />
      ) : items.length ? (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {items.map((item, index) => (
            <AnimatedPressable
              accessibilityLabel={`${item.title}. ${item.body}`}
              accessibilityRole="button"
              entering={listEntering(index)}
              exiting={listExiting()}
              key={item.id}
              layout={listLayout()}
              onPress={() => {
                onClose();
                router.push(`/chat/${item.matchId}`);
              }}
              style={({ pressed }: { pressed: boolean }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
            >
              {item.photo ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  recyclingKey={item.id}
                  source={{ uri: item.photo }}
                  style={styles.avatar}
                  transition={140}
                />
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
              <Text style={styles.rowTime}>{formatActivityTime(item.time, t)}</Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <StateView
            body={t('discoveryControls.notifications.emptyBody')}
            container="plain"
            illustration={illustratedIcons.notification}
            title={t('discoveryControls.notifications.emptyTitle')}
          />
        </View>
      )}
    </InteractiveBottomSheet>
  );
}

function formatActivityTime(value: string, t: ReturnType<typeof useTranslation>['t']) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return t('discoveryControls.notifications.now');
  if (minutes < 60) return t('discoveryControls.notifications.minutes', { count: minutes });
  if (minutes < 1_440) {
    return t('discoveryControls.notifications.hours', { count: Math.floor(minutes / 60) });
  }
  return t('discoveryControls.notifications.days', { count: Math.floor(minutes / 1_440) });
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#F8F8FA',
    maxWidth: 460,
  },
  scroll: { flex: 1, minHeight: 0 },
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
});
