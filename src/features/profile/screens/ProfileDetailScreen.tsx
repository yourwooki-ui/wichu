import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppViewport } from '@/components/NativePreviewFrame';
import { Screen } from '@/components/Screen';
import { Skeleton, SkeletonLine } from '@/components/Skeleton';
import { useAppTheme } from '@/components/ThemeProvider';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { elevation, layout, palette, radius, typography } from '@/constants/theme';
import { MatchCelebration } from '@/features/discover/components/MatchCelebration';
import { mockProfiles } from '@/features/discover/data/mock-profiles';
import { discoveryService } from '@/features/discover/services/discovery-service';
import { useDiscoverStore } from '@/features/discover/stores/discover-store';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { StandardProfileDetail } from '@/features/profile/components/StandardProfileDetail';
import { profileVisitService } from '@/features/profile/services/profile-visit-service';
import {
  ReportReasonSheet,
  type ReportReason,
} from '@/features/settings/components/ReportReasonSheet';
import { safetyService } from '@/features/settings/services/safety-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import { hapticsService } from '@/services/haptics-service';
import type { SwipeAction } from '@/types/profile';

type ProfileDetailScreenProps = {
  mode?: 'preview' | 'public';
  profileId?: string;
};

export function ProfileDetailScreen({ mode = 'public', profileId }: ProfileDetailScreenProps = {}) {
  const { id: routeProfileId } = useLocalSearchParams<{ id?: string }>();
  const id = profileId ?? routeProfileId;
  const isPreview = mode === 'preview';
  const router = useRouter();
  const theme = useAppTheme();
  const { session } = useAuthSession();
  const insets = useSafeAreaInsets();
  const viewport = useAppViewport();
  const { i18n, t } = useTranslation();
  const entitlement = usePassEntitlement();
  const deckProfile = useDiscoverStore((state) =>
    isPreview ? undefined : state.profiles.find((profile) => profile.id === id),
  );
  const removeProfile = useDiscoverStore((state) => state.removeProfile);
  const recordSwipe = useDiscoverStore((state) => state.recordSwipe);
  const restoreSwipe = useDiscoverStore((state) => state.restoreSwipe);
  const recycleProfiles = useDiscoverStore((state) => state.recycleProfiles);
  const cachedProfile = isPreview
    ? undefined
    : (deckProfile ?? mockProfiles.find((item) => item.id === id));
  const remoteProfileQuery = useQuery({
    queryKey: [isPreview ? 'my-profile-preview' : 'profile-detail', id, i18n.language],
    enabled: Boolean(id && session?.user.id && !id.startsWith('mock-')),
    staleTime: 60_000,
    queryFn: () => discoveryService.getProfileById(id!, i18n.language),
  });
  const loadedProfile = remoteProfileQuery.data ?? cachedProfile ?? undefined;
  const profile = useMemo(
    () =>
      loadedProfile && isPreview
        ? { ...loadedProfile, isGoldPass: entitlement.data?.tier === 'gold' }
        : loadedProfile,
    [entitlement.data?.tier, isPreview, loadedProfile],
  );
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionAction, setDecisionAction] = useState<SwipeAction | null>(null);
  const [matchedMatchId, setMatchedMatchId] = useState<string | null>(null);
  const decisionX = useSharedValue(0);
  const decisionOpacity = useSharedValue(1);
  const decisionFeedback = useSharedValue(0);

  const decisionSurfaceStyle = useAnimatedStyle(() => ({
    opacity: decisionOpacity.get(),
    transform: [
      { translateX: decisionX.get() },
      {
        scale: interpolate(
          Math.abs(decisionX.get()),
          [0, viewport.width],
          [1, 0.985],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const decisionFeedbackStyle = useAnimatedStyle(() => ({
    opacity: decisionFeedback.get(),
    transform: [{ scale: interpolate(decisionFeedback.get(), [0, 1], [0.76, 1]) }],
  }));

  useEffect(() => {
    if (isPreview || !id || !session?.user.id) return;
    void profileVisitService.recordVisit(id, session.user.id).catch(() => undefined);
  }, [id, isPreview, session?.user.id]);

  if (!profile && remoteProfileQuery.isLoading) {
    // 사진이 먼저 오는 화면이라 스피너 대신 실제 배치(대표 사진 → 이름 → 태그)를 미리 그린다.
    return (
      <Screen style={[styles.screen, styles.loadingScreen]}>
        <View accessibilityLabel="프로필을 불러오는 중" accessibilityRole="progressbar">
          <Skeleton style={styles.loadingPhoto} />
          <SkeletonLine height={24} style={{ marginTop: 20 }} width="52%" />
          <SkeletonLine height={13} style={{ marginTop: 10 }} width="34%" />
          <View style={styles.loadingChips}>
            <SkeletonLine height={30} width={84} />
            <SkeletonLine height={30} width={68} />
            <SkeletonLine height={30} width={92} />
          </View>
          <SkeletonLine height={13} style={{ marginTop: 22 }} width="88%" />
          <SkeletonLine height={13} style={{ marginTop: 9 }} width="74%" />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen style={[styles.screen, styles.unavailableScreen]}>
        <View style={[styles.unavailableIcon, { backgroundColor: theme.colors.surface }]}>
          <IllustratedIcon size={60} source={illustratedIcons.searchEmpty} />
        </View>
        <Text style={[styles.unavailableTitle, { color: theme.colors.text }]}>
          {t('profileDetail.unavailable')}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.unavailableButton}>
          <Text style={styles.unavailableButtonText}>{t('profileDetail.back')}</Text>
        </Pressable>
      </Screen>
    );
  }

  const handleReport = async (reason: ReportReason) => {
    if (profile.id.startsWith('mock-')) {
      setReportOpen(false);
      Alert.alert(t('profileDetail.testProfileTitle'), t('profileDetail.testProfileBody'));
      return;
    }

    setSafetyBusy(true);
    const { error } = await safetyService.report(profile.id, reason);
    setSafetyBusy(false);
    setReportOpen(false);
    Alert.alert(
      error ? t('profileDetail.actionFailed') : t('profileDetail.reportedTitle'),
      error ? t('profileDetail.tryAgain') : t('profileDetail.reportedBody'),
    );
  };

  const handleBlock = () => {
    if (profile.id.startsWith('mock-')) {
      setSafetyOpen(false);
      Alert.alert(t('profileDetail.testProfileTitle'), t('profileDetail.testProfileBody'));
      return;
    }

    Alert.alert(t('profileDetail.blockTitle'), t('profileDetail.blockBody'), [
      { text: t('profileDetail.cancel'), style: 'cancel' },
      {
        text: t('profileDetail.block'),
        style: 'destructive',
        onPress: async () => {
          setSafetyBusy(true);
          const { error } = await safetyService.block(profile.id);
          setSafetyBusy(false);
          if (error) {
            Alert.alert(t('profileDetail.actionFailed'), t('profileDetail.tryAgain'));
            return;
          }
          setSafetyOpen(false);
          removeProfile(profile.id);
          router.back();
        },
      },
    ]);
  };

  const handleDecision = async (action: SwipeAction) => {
    if (decisionBusy || !session?.user.id || isPreview) return;
    setDecisionBusy(true);
    setDecisionAction(action);
    hapticsService.swipe(action);
    decisionFeedback.set(withSpring(1, { damping: 16, stiffness: 230 }));
    recordSwipe(profile.id, action);

    try {
      const result = profile.id.startsWith('mock-')
        ? { matchId: null }
        : await discoveryService.swipe(session.user.id, profile.id, action);
      if (__DEV__) recycleProfiles([profile]);
      if (result.matchId) {
        decisionFeedback.set(withTiming(0, { duration: 120 }));
        setDecisionAction(null);
        setDecisionBusy(false);
        setMatchedMatchId(result.matchId);
        return;
      }

      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (reduceMotion) {
        router.replace('/(tabs)/discover');
        return;
      }

      decisionOpacity.set(withTiming(0.88, { duration: 230 }));
      decisionX.set(
        withTiming(action === 'like' ? viewport.width * 1.12 : -viewport.width * 1.12, {
          duration: 230,
          easing: Easing.out(Easing.cubic),
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 230));
      router.replace('/(tabs)/discover');
    } catch {
      restoreSwipe(profile);
      hapticsService.error();
      setDecisionBusy(false);
      setDecisionAction(null);
      decisionFeedback.set(withTiming(0, { duration: 120 }));
      decisionOpacity.set(withTiming(1, { duration: 160 }));
      decisionX.set(withSpring(0, { damping: 18, stiffness: 210 }));
      Alert.alert('선택을 저장하지 못했어요', '연결을 확인하고 다시 시도해주세요.');
    }
  };

  const footer = isPreview ? (
    <View
      style={[
        styles.decisionBar,
        { backgroundColor: theme.colors.surface, paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/profile-edit')}
        style={({ pressed }) => [styles.previewEditButton, pressed && styles.pressed]}
      >
        <Ionicons color={palette.white} name="pencil" size={17} />
        <Text style={styles.previewEditText}>프로필 수정</Text>
      </Pressable>
    </View>
  ) : (
    <View
      style={[
        styles.decisionBar,
        { backgroundColor: theme.colors.surface, paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <Pressable
        accessibilityLabel="이 프로필 패스"
        accessibilityRole="button"
        disabled={decisionBusy}
        hitSlop={6}
        onPress={() => handleDecision('pass')}
        style={({ pressed }) => [
          styles.passButton,
          { borderColor: theme.colors.border },
          (pressed || decisionBusy) && styles.pressed,
        ]}
      >
        <Ionicons color={theme.colors.text} name="close" size={25} />
      </Pressable>
      <Pressable
        accessibilityLabel="이 프로필 픽"
        accessibilityRole="button"
        disabled={decisionBusy}
        onPress={() => handleDecision('like')}
        style={({ pressed }) => [styles.pickButton, (pressed || decisionBusy) && styles.pressed]}
      >
        <Ionicons color={palette.white} name="heart" size={19} />
        <Text style={styles.pickButtonText}>{decisionBusy ? '처리 중…' : 'PICK'}</Text>
      </Pressable>
    </View>
  );

  return (
    <Screen edges={['left', 'right', 'bottom']} padded={false} style={styles.screen}>
      <Animated.View
        pointerEvents={decisionBusy ? 'none' : 'auto'}
        style={[styles.detailSurface, decisionSurfaceStyle]}
      >
        <StandardProfileDetail
          footer={footer}
          headerLeft={{
            accessibilityLabel: t('profileDetail.back'),
            icon: 'chevron-back',
            onPress: () => router.back(),
          }}
          headerRight={{
            accessibilityLabel: isPreview ? '프로필 수정' : t('profileDetail.safetyOptions'),
            icon: isPreview ? 'pencil' : 'ellipsis-horizontal',
            onPress: isPreview ? () => router.push('/profile-edit') : () => setSafetyOpen(true),
          }}
          onSafety={isPreview ? undefined : () => setSafetyOpen(true)}
          photoBlurRadius={isPreview && !profile.isPhotoReviewed ? 18 : 0}
          photoStatusLabel={isPreview && !profile.isPhotoReviewed ? '공개 사진 심사 중' : undefined}
          profile={profile}
        />
        {decisionAction ? (
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[styles.decisionFeedback, decisionFeedbackStyle]}
          >
            <View
              style={[
                styles.decisionFeedbackMark,
                decisionAction === 'like'
                  ? styles.decisionFeedbackPick
                  : styles.decisionFeedbackPass,
              ]}
            >
              <Ionicons
                color={decisionAction === 'like' ? palette.white : palette.ink}
                name={decisionAction === 'like' ? 'heart' : 'close'}
                size={32}
              />
            </View>
            <Text style={styles.decisionFeedbackText}>
              {decisionAction === 'like' ? 'PICK' : 'PASS'}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>

      {!isPreview ? (
        <>
          <AppModal
            animationType="fade"
            onRequestClose={() => setSafetyOpen(false)}
            transparent
            visible={safetyOpen}
          >
            <View style={styles.modalBackdrop}>
              <Pressable
                accessibilityLabel="안전 메뉴 닫기"
                onPress={() => setSafetyOpen(false)}
                style={StyleSheet.absoluteFill}
              />
              <View
                accessibilityViewIsModal
                style={[styles.safetySheet, { backgroundColor: theme.colors.surface }]}
              >
                <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                  {t('profileDetail.safetyTitle', { name: profile.name })}
                </Text>
                <SafetyAction
                  disabled={safetyBusy}
                  icon="flag-outline"
                  label={t('profileDetail.report')}
                  onPress={() => {
                    setSafetyOpen(false);
                    setReportOpen(true);
                  }}
                />
                <SafetyAction
                  danger
                  disabled={safetyBusy}
                  icon="ban-outline"
                  label={t('profileDetail.block')}
                  onPress={handleBlock}
                />
                <Pressable
                  disabled={safetyBusy}
                  onPress={() => setSafetyOpen(false)}
                  style={[styles.cancelButton, { backgroundColor: theme.colors.background }]}
                >
                  <Text style={[styles.cancelText, { color: theme.colors.text }]}>
                    {t('profileDetail.cancel')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </AppModal>

          <ReportReasonSheet
            busy={safetyBusy}
            onClose={() => setReportOpen(false)}
            onSelect={(reason) => void handleReport(reason)}
            visible={reportOpen}
          />
          <MatchCelebration
            onChat={() => {
              const matchId = matchedMatchId;
              setMatchedMatchId(null);
              if (matchId) router.replace(`/chat/${matchId}`);
            }}
            onContinue={() => {
              setMatchedMatchId(null);
              router.replace('/(tabs)/discover');
            }}
            profile={matchedMatchId ? profile : null}
          />
        </>
      ) : null}
    </Screen>
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
  icon: 'flag-outline' | 'ban-outline';
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const color = danger ? theme.colors.danger : theme.colors.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.safetyAction, pressed && styles.pressed]}
    >
      <Ionicons color={color} name={icon} size={20} />
      <Text style={[styles.safetyActionText, { color }]}>{label}</Text>
      <Ionicons color={theme.colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: layout.maxContentWidth, width: '100%' },
  detailSurface: { flex: 1 },
  decisionFeedback: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: '38%',
  },
  decisionFeedbackMark: {
    alignItems: 'center',
    borderRadius: 38,
    height: 76,
    justifyContent: 'center',
    width: 76,
    ...elevation.md,
  },
  decisionFeedbackPass: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(17,17,17,0.12)',
    borderWidth: 1,
  },
  decisionFeedbackPick: { backgroundColor: palette.pink },
  decisionFeedbackText: {
    backgroundColor: 'rgba(17,17,17,0.72)',
    borderRadius: radius.pill,
    color: palette.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginTop: 9,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalBackdrop: { backgroundColor: 'rgba(12,12,16,0.46)', flex: 1, justifyContent: 'flex-end' },
  safetySheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: { alignSelf: 'center', borderRadius: 2, height: 4, marginBottom: 20, width: 42 },
  sheetTitle: { ...typography.heading, marginBottom: 12 },
  safetyAction: { alignItems: 'center', flexDirection: 'row', minHeight: 56 },
  safetyActionText: { flex: 1, fontSize: 15, fontWeight: '800', marginLeft: 12 },
  cancelButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    marginTop: 8,
    paddingVertical: 15,
  },
  cancelText: { fontSize: 14, fontWeight: '800' },
  unavailableScreen: { alignItems: 'center', justifyContent: 'center' },
  loadingScreen: { paddingTop: 12 },
  loadingPhoto: { borderRadius: 26, height: 340 },
  loadingChips: { flexDirection: 'row', gap: 8, marginTop: 18 },
  unavailableIcon: {
    alignItems: 'center',
    borderRadius: 26,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  unavailableTitle: { ...typography.heading, marginTop: 16 },
  unavailableButton: {
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  unavailableButtonText: { color: palette.white, fontWeight: '800' },
  decisionBar: {
    alignItems: 'center',
    borderTopColor: 'rgba(17,17,17,0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 11,
    position: 'absolute',
    right: 0,
  },
  passButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pickButton: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  pickButtonText: { color: palette.white, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  previewEditButton: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  previewEditText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.66 },
});
