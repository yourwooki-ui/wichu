import { Image, type ImageSource } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { BrandWordmark } from '@/components/BrandWordmark';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';
import { layout, palette } from '@/constants/theme';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { SwipeDeck } from '@/features/discover/components/SwipeDeck';
import { DiscoverGestureCoach } from '@/features/discover/components/DiscoverGestureCoach';
import { DiscoverUndoCoach } from '@/features/discover/components/DiscoverUndoCoach';
import { DiscoveryFilterSheet } from '@/features/discover/components/DiscoveryFilterSheet';
import { MatchCelebration } from '@/features/discover/components/MatchCelebration';
import { NotificationsSheet } from '@/features/discover/components/NotificationsSheet';
import { useDiscoverDeck } from '@/features/discover/hooks/use-discover-deck';
import { buildNotificationItems } from '@/features/discover/utils/notification-feed';
import { REWARDED_ADS_ENABLED } from '@/constants/features';
import { matchesService } from '@/features/matches/services/matches-service';
import { tutorialState } from '@/features/onboarding/services/tutorial-state';
import { useAuthSession } from '@/hooks/use-auth-session';
import type { Profile, SwipeAction } from '@/types/profile';

const headerIcons = {
  undo: illustratedIcons.rewind,
  filter: illustratedIcons.discoverySettings,
  notification: illustratedIcons.notification,
} satisfies Record<string, ImageSource>;

export function DiscoverScreen() {
  const router = useRouter();
  const { coach } = useLocalSearchParams<{ coach?: string }>();
  const theme = useAppTheme();
  const { session } = useAuthSession();
  const deck = useDiscoverDeck();
  const { clearLastMatch, lastMatch, swipe: swipeDeck } = deck;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [undoCoachAvailable, setUndoCoachAvailable] = useState(false);
  const [undoCoachVisible, setUndoCoachVisible] = useState(false);
  const notificationsQuery = useQuery({
    enabled: Boolean(session?.user.id),
    queryFn: () => matchesService.listConnections(session!.user.id),
    queryKey: ['matches', 'connections', session?.user.id],
    staleTime: 20_000,
  });
  // 시트와 같은 판정을 써야 배지와 내용이 어긋나지 않는다.
  const hasUnreadNotifications = buildNotificationItems(notificationsQuery.data).length > 0;

  useEffect(() => {
    let active = true;
    const userId = session?.user.id;
    if (!userId) return () => undefined;

    void tutorialState.hasCompletedUndoCoach(userId).then((completed) => {
      if (active) {
        setUndoCoachAvailable(!completed);
        setUndoCoachVisible(false);
      }
    });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const handleSwipe = useCallback(
    (profile: Profile, action: SwipeAction) => {
      swipeDeck(profile, action);
      const userId = session?.user.id;
      if (action !== 'pass' || !undoCoachAvailable || !userId || coach === '1') return;

      // SwipeDeck이 퇴장 애니메이션을 마친 뒤 호출하므로 다음 카드와 되돌리기 버튼이
      // 준비된 정확한 순간에 한 번만 안내한다.
      setUndoCoachAvailable(false);
      setUndoCoachVisible(true);
      void tutorialState.completeUndoCoach(userId).catch(() => undefined);
    },
    [coach, session?.user.id, swipeDeck, undoCoachAvailable],
  );

  const handleUndo = () => {
    if (deck.canUndoWithoutAd) {
      deck.undo();
      return;
    }
    if (!REWARDED_ADS_ENABLED) {
      // 광고 연동 전에 "광고 보기"를 제안하면 100% 실패한다. 제안 자체를 하지 않는다.
      Alert.alert('되돌리기를 모두 사용했어요', '다음 프로필에서 신중하게 선택해보세요.');
      return;
    }

    Alert.alert(
      '되돌리기 1회 받기',
      '광고를 끝까지 시청하면 마지막 선택을 한 번 되돌릴 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '광고 보기',
          onPress: async () => {
            const result = await deck.watchRewardedAdAndUndo();
            if (result === 'dismissed') Alert.alert('광고 시청이 완료되지 않았어요.');
            if (result === 'unavailable') Alert.alert('지금은 광고를 불러올 수 없어요.');
            if (result === 'pending-credit') {
              Alert.alert('보상 확인 중', '광고 보상이 확인되면 되돌리기 1회가 지급돼요.');
            }
          },
        },
      ],
    );
  };

  const openMatchedChat = () => {
    if (!lastMatch) return;
    const matchId = lastMatch.matchId;
    clearLastMatch();
    router.push(`/chat/${matchId}`);
  };

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <HeaderAction
            disabled={!deck.canUndo}
            icon={headerIcons.undo}
            label="마지막 선택 되돌리기"
            onPress={handleUndo}
          />
        </View>
        <View style={styles.brandBlock}>
          <BrandWordmark color={theme.colors.text} size={24} />
        </View>
        <View style={[styles.headerSide, styles.headerActions]}>
          <HeaderAction
            icon={headerIcons.filter}
            label="탐색 조건 설정"
            onPress={() => setFiltersOpen(true)}
          />
          <HeaderAction
            badge={hasUnreadNotifications}
            icon={headerIcons.notification}
            label="알림 열기"
            onPress={() => setNotificationsOpen(true)}
          />
        </View>
      </View>
      <SwipeDeck
        error={deck.error}
        isLoading={deck.isLoading}
        onAdjustFilters={() => setFiltersOpen(true)}
        onRetry={deck.retry}
        onSwipe={handleSwipe}
        profiles={deck.profiles}
      />
      {filtersOpen ? (
        <DiscoveryFilterSheet
          onClose={() => setFiltersOpen(false)}
          onSave={deck.savePreferences}
          saving={deck.isSavingPreferences}
          value={deck.preferences}
          visible
        />
      ) : null}
      <NotificationsSheet onClose={() => setNotificationsOpen(false)} visible={notificationsOpen} />
      <MatchCelebration
        onChat={openMatchedChat}
        onContinue={clearLastMatch}
        profile={lastMatch?.profile ?? null}
      />
      <DiscoverGestureCoach
        active={coach === '1'}
        onComplete={() => router.replace('/(tabs)/discover')}
        userId={session?.user.id}
      />
      <DiscoverUndoCoach onClose={() => setUndoCoachVisible(false)} visible={undoCoachVisible} />
    </Screen>
  );
}

type HeaderActionProps = {
  badge?: boolean;
  disabled?: boolean;
  icon: ImageSource;
  label: string;
  onPress: () => void;
};

function HeaderAction({
  badge = false,
  disabled = false,
  icon,
  label,
  onPress,
}: HeaderActionProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerAction,
        { opacity: disabled ? 0.55 : pressed ? 0.62 : 1 },
      ]}
    >
      <Image contentFit="contain" source={icon} style={styles.headerActionIcon} />
      {badge ? (
        <View style={[styles.headerActionBadge, { borderColor: theme.colors.background }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: layout.maxContentWidth, width: '100%' },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  brandBlock: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: '50%',
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    transform: [{ translateX: -48 }],
    width: 96,
  },
  headerSide: { alignItems: 'center', flexDirection: 'row', minWidth: 96 },
  headerActions: {
    gap: 2,
    justifyContent: 'flex-end',
  },
  headerAction: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
  headerActionIcon: {
    height: 47,
    width: 47,
  },
  headerActionBadge: {
    // 테두리는 화면 배경과 같은 색이어야 '파낸' 것처럼 보인다. 색은 호출부에서 넣는다.
    backgroundColor: palette.pink,
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: 'absolute',
    right: 1,
    top: 1,
    width: 10,
  },
});
