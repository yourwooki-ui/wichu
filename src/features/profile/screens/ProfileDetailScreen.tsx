import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryFlag } from '@/components/CountryFlag';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';
import { getRepresentativeCountryCode } from '@/constants/languages';
import { palette, radius } from '@/constants/theme';
import { mockProfiles } from '@/features/discover/data/mock-profiles';
import { discoveryService } from '@/features/discover/services/discovery-service';
import { useDiscoverStore } from '@/features/discover/stores/discover-store';
import { safetyService } from '@/features/settings/services/safety-service';
import { getProfileAge, getProfilePresence } from '@/features/profile/utils/profile-display';
import { profileVisitService } from '@/features/profile/services/profile-visit-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import type { SwipeAction } from '@/types/profile';

const HERO_HEIGHT_RATIO = 1.28;
const HERO_MAX_HEIGHT = 560;

export function ProfileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { session } = useAuthSession();
  const insets = useSafeAreaInsets();
  const { i18n, t } = useTranslation();
  const deckProfile = useDiscoverStore((state) =>
    state.profiles.find((profile) => profile.id === id),
  );
  const removeProfile = useDiscoverStore((state) => state.removeProfile);
  const recordSwipe = useDiscoverStore((state) => state.recordSwipe);
  const restoreSwipe = useDiscoverStore((state) => state.restoreSwipe);
  const recycleProfiles = useDiscoverStore((state) => state.recycleProfiles);
  const profile = deckProfile ?? mockProfiles.find((item) => item.id === id);
  const [photoWidth, setPhotoWidth] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!id || !session?.user.id) return;
    void profileVisitService.recordVisit(id, session.user.id).catch(() => undefined);
  }, [id, session?.user.id]);

  const presence = useMemo(
    () => getProfilePresence(profile?.lastActiveAt ?? null, now),
    [now, profile?.lastActiveAt],
  );
  const presenceLabel = presence
    ? t(`discover.presence.${presence.kind}`, { count: presence.count })
    : null;
  const languageDisplayNames = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: 'language' }),
    [i18n.language],
  );

  if (!profile) {
    return (
      <Screen style={styles.unavailableScreen}>
        <View style={[styles.unavailableIcon, { backgroundColor: theme.colors.surface }]}>
          <Ionicons color={theme.colors.textMuted} name="person-outline" size={30} />
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

  const age = getProfileAge(profile.birthDate, now);
  const heroHeight = Math.min((photoWidth || 430) * HERO_HEIGHT_RATIO, HERO_MAX_HEIGHT);
  const distanceLabel = profile.distanceKm
    ? t('profileDetail.distanceAway', {
        distance: new Intl.NumberFormat(i18n.language).format(profile.distanceKm),
      })
    : null;
  const languages =
    profile.languageDetails ??
    profile.languages.map((code, index) => ({
      code: getLanguageCode(code) ?? code,
      level: index === 0 ? ('native' as const) : ('intermediate' as const),
      isNative: index === 0,
    }));

  const handleHeroLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== photoWidth) setPhotoWidth(nextWidth);
  };

  const handlePhotoScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!photoWidth) return;
    setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / photoWidth));
  };

  const handleReport = () => {
    if (profile.id.startsWith('mock-')) {
      setSafetyOpen(false);
      Alert.alert(t('profileDetail.testProfileTitle'), t('profileDetail.testProfileBody'));
      return;
    }

    Alert.alert(t('profileDetail.reportTitle'), t('profileDetail.reportBody'), [
      { text: t('profileDetail.cancel'), style: 'cancel' },
      {
        text: t('profileDetail.report'),
        onPress: async () => {
          setSafetyBusy(true);
          const { error } = await safetyService.report(profile.id, 'other');
          setSafetyBusy(false);
          setSafetyOpen(false);
          Alert.alert(
            error ? t('profileDetail.actionFailed') : t('profileDetail.reportedTitle'),
            error ? t('profileDetail.tryAgain') : t('profileDetail.reportedBody'),
          );
        },
      },
    ]);
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
    if (decisionBusy || !session?.user.id) return;
    setDecisionBusy(true);
    recordSwipe(profile.id, action);

    try {
      const result = profile.id.startsWith('mock-')
        ? { matchId: null }
        : await discoveryService.swipe(session.user.id, profile.id, action);
      if (__DEV__) recycleProfiles([profile]);
      if (result.matchId) {
        Alert.alert('매치됐어요!', `${profile.name}님과 서로 Pick했어요.`, [
          { text: '계속 탐색', onPress: () => router.replace('/(tabs)/discover') },
          { text: '인사하기', onPress: () => router.replace(`/chat/${result.matchId}`) },
        ]);
        return;
      }
      router.replace('/(tabs)/discover');
    } catch {
      restoreSwipe(profile);
      setDecisionBusy(false);
      Alert.alert('선택을 저장하지 못했어요', '연결을 확인하고 다시 시도해주세요.');
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']} padded={false}>
      <ScrollView
        bounces={false}
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.surface }]}
        showsVerticalScrollIndicator={false}
      >
        <View onLayout={handleHeroLayout} style={[styles.hero, { height: heroHeight }]}>
          {photoWidth > 0 ? (
            <ScrollView
              decelerationRate="fast"
              horizontal
              onMomentumScrollEnd={handlePhotoScroll}
              pagingEnabled
              scrollEnabled={profile.photos.length > 1}
              showsHorizontalScrollIndicator={false}
            >
              {profile.photos.map((photo, index) => (
                <Image
                  accessibilityLabel={`${profile.name} ${t('profileDetail.photo', { index: index + 1 })}`}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  key={photo}
                  priority={index === 0 ? 'high' : 'normal'}
                  source={{ uri: photo }}
                  style={{ height: heroHeight, width: photoWidth }}
                  transition={160}
                />
              ))}
            </ScrollView>
          ) : null}
          <LinearGradient
            colors={['rgba(8,8,12,0.38)', 'rgba(8,8,12,0)', 'rgba(8,8,12,0.76)']}
            locations={[0, 0.45, 1]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <HeaderButton
              accessibilityLabel={t('profileDetail.back')}
              icon="chevron-back"
              onPress={() => router.back()}
            />
            <HeaderButton
              accessibilityLabel={t('profileDetail.safetyOptions')}
              icon="ellipsis-horizontal"
              onPress={() => setSafetyOpen(true)}
            />
          </View>
          {profile.photos.length > 1 ? (
            <View pointerEvents="none" style={styles.photoProgress}>
              {profile.photos.map((photo, index) => (
                <View
                  key={photo}
                  style={[
                    styles.photoProgressItem,
                    index === photoIndex && styles.photoProgressActive,
                  ]}
                />
              ))}
            </View>
          ) : null}
          <View pointerEvents="none" style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {profile.name}, {age}
              </Text>
              {profile.isVerified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons color={palette.white} name="checkmark" size={13} />
                </View>
              ) : null}
            </View>
            {profile.isGoldPass ? (
              <View style={styles.goldIdentity}>
                <Text style={styles.goldIdentityDiamond}>◆</Text>
                <Text style={styles.goldIdentityText}>GOLD PASS</Text>
              </View>
            ) : null}
            <View style={styles.heroMetaRow}>
              {distanceLabel ? (
                <View style={styles.heroMetaItem}>
                  <Ionicons color={palette.lime} name="navigate" size={13} />
                  <Text style={styles.heroMetaText}>{distanceLabel}</Text>
                </View>
              ) : null}
              {distanceLabel && presenceLabel ? <View style={styles.metaDivider} /> : null}
              {presenceLabel ? (
                <View style={styles.presence}>
                  <View
                    style={[
                      styles.presenceDot,
                      presence?.kind === 'online' && styles.presenceDotOnline,
                    ]}
                  />
                  <Text style={styles.heroMetaText}>{presenceLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.locationCard}>
            <CountryFlag compact countryCode={profile.countryCode} label={profile.countryLabel} />
            <View style={styles.locationCopy}>
              <Text style={[styles.locationLabel, { color: theme.colors.textMuted }]}>
                {t('profileDetail.basedIn')}
              </Text>
              <Text style={[styles.locationValue, { color: theme.colors.text }]}>
                {profile.countryLabel}
              </Text>
            </View>
            {profile.isNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            ) : null}
          </View>

          <DetailSection title={t('profileDetail.about')}>
            <Text style={[styles.bio, { color: theme.colors.text }]}>{profile.bio}</Text>
          </DetailSection>

          <DetailSection title={t('profileDetail.languages')}>
            <View style={styles.chips}>
              {languages.map((language) => (
                <View
                  key={language.code}
                  style={[styles.languageChip, { borderColor: theme.colors.border }]}
                >
                  {getLanguageCode(language.code) ? (
                    <CountryFlag
                      compact
                      countryCode={getRepresentativeCountryCode(getLanguageCode(language.code)!)}
                      label={getLanguageLabel(language.code, languageDisplayNames)}
                      style={styles.languageFlag}
                    />
                  ) : (
                    <Ionicons color={theme.colors.primary} name="chatbubble-outline" size={14} />
                  )}
                  <View style={styles.languageCopy}>
                    <Text style={[styles.languageText, { color: theme.colors.text }]}>
                      {getLanguageLabel(language.code, languageDisplayNames)}
                    </Text>
                    <Text style={[styles.languageLevelText, { color: theme.colors.textMuted }]}>
                      {t(`profileDetail.languageLevels.${language.level}`)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </DetailSection>

          <DetailSection title={t('profileDetail.interests')}>
            <View style={styles.chips}>
              {profile.interests.map((interest) => (
                <View key={interest} style={styles.interestChip}>
                  <Text style={styles.interestText}># {interest}</Text>
                </View>
              ))}
            </View>
          </DetailSection>

          <Pressable
            accessibilityRole="button"
            onPress={() => setSafetyOpen(true)}
            style={({ pressed }) => [styles.safetyLink, pressed && styles.pressed]}
          >
            <Ionicons color={theme.colors.textMuted} name="shield-checkmark-outline" size={18} />
            <Text style={[styles.safetyLinkText, { color: theme.colors.textMuted }]}>
              {t('profileDetail.reportOrBlock')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

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

      <Modal
        animationType="fade"
        onRequestClose={() => setSafetyOpen(false)}
        transparent
        visible={safetyOpen}
      >
        <Pressable onPress={() => setSafetyOpen(false)} style={styles.modalBackdrop}>
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
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
              onPress={handleReport}
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
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function HeaderButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: 'chevron-back' | 'ellipsis-horizontal';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <Ionicons color={palette.white} name={icon} size={22} />
    </Pressable>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.section, { borderTopColor: theme.colors.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {children}
    </View>
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

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  Deutsch: 'de',
  English: 'en',
  Español: 'es',
  Français: 'fr',
  한국어: 'ko',
  日本語: 'ja',
};

function getLanguageCode(language: string) {
  if (/^[a-z]{2,3}$/i.test(language)) return language.toLowerCase();
  return LANGUAGE_NAME_TO_CODE[language];
}

function getLanguageLabel(language: string, displayNames: Intl.DisplayNames) {
  const code = getLanguageCode(language);
  return code ? (displayNames.of(code) ?? language) : language;
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 112 },
  hero: { backgroundColor: '#D8D8DE', overflow: 'hidden', width: '100%' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 16,
    position: 'absolute',
    right: 16,
    top: 0,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,16,20,0.36)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  photoProgress: {
    flexDirection: 'row',
    gap: 5,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 10,
  },
  photoProgressItem: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 2,
    flex: 1,
    height: 3,
  },
  photoProgressActive: { backgroundColor: palette.white },
  heroInfo: { bottom: 24, left: 22, position: 'absolute', right: 22 },
  goldIdentity: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,16,18,0.64)',
    borderColor: 'rgba(255,211,90,0.7)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginTop: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  goldIdentityDiamond: { color: '#FFD35A', fontSize: 10 },
  goldIdentityText: { color: '#FFE9A9', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  name: { color: palette.white, fontSize: 33, fontWeight: '900', letterSpacing: -0.9 },
  verifiedBadge: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 9,
    height: 19,
    justifyContent: 'center',
    width: 19,
  },
  heroMetaRow: { alignItems: 'center', flexDirection: 'row', marginTop: 7 },
  heroMetaItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  presence: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  presenceDot: { backgroundColor: 'rgba(255,255,255,0.68)', borderRadius: 4, height: 7, width: 7 },
  presenceDotOnline: { backgroundColor: palette.lime },
  heroMetaText: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '700' },
  metaDivider: {
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: 2,
    height: 3,
    marginHorizontal: 9,
    width: 3,
  },
  details: { paddingHorizontal: 20 },
  locationCard: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: 22,
    paddingTop: 22,
  },
  locationCopy: { flex: 1, marginLeft: 12 },
  locationLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  locationValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  newBadge: {
    backgroundColor: palette.lime,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  newBadgeText: { color: palette.ink, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.25, marginBottom: 12 },
  bio: { fontSize: 15, lineHeight: 23 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  languageChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  languageText: { fontSize: 12, fontWeight: '800' },
  languageCopy: { paddingRight: 2 },
  languageLevelText: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  languageFlag: { borderRadius: 5, height: 18, width: 26 },
  interestChip: {
    backgroundColor: '#FFF0F5',
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  interestText: { color: palette.pinkPressed, fontSize: 12, fontWeight: '800' },
  safetyLink: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  safetyLinkText: { fontSize: 12, fontWeight: '700', marginLeft: 7 },
  pressed: { opacity: 0.66 },
  modalBackdrop: { backgroundColor: 'rgba(12,12,16,0.46)', flex: 1, justifyContent: 'flex-end' },
  safetySheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: { alignSelf: 'center', borderRadius: 2, height: 4, marginBottom: 20, width: 42 },
  sheetTitle: { fontSize: 19, fontWeight: '900', marginBottom: 12 },
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
  unavailableIcon: {
    alignItems: 'center',
    borderRadius: 26,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  unavailableTitle: { fontSize: 20, fontWeight: '900', marginTop: 16 },
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
});
