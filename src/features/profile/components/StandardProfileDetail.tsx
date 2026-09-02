import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CountryFlag } from '@/components/CountryFlag';
import { GoldBadge } from '@/components/GoldBadge';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppTheme } from '@/components/ThemeProvider';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { getRepresentativeCountryCode } from '@/constants/languages';
import { palette, radius } from '@/constants/theme';
import { getProfilePresence } from '@/features/profile/utils/profile-display';
import { getLanguageDisplayName } from '@/lib/display-names';
import { formatNumber } from '@/lib/intl-format';
import type { Profile } from '@/types/profile';

const HERO_HEIGHT_RATIO = 1.18;
const HERO_MAX_HEIGHT = 520;

type ProfileDetailItem = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconBackground: string;
  iconColor: string;
  label: string;
};

const DETAIL_ICON_TONES = {
  work: { background: '#EAF0FF', foreground: '#2F6BFF' },
  education: { background: '#F0EAFF', foreground: '#7452D6' },
  height: { background: '#E7F8F0', foreground: '#168A5C' },
  personality: { background: '#FDEAF2', foreground: '#D93D79' },
  drinking: { background: '#F4EAF9', foreground: '#8B4AB8' },
  smoking: { background: '#FCEDEA', foreground: '#C95849' },
  exercise: { background: '#FFF0E1', foreground: '#D97524' },
  pets: { background: '#F6EEE7', foreground: '#87603E' },
} as const;

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  Deutsch: 'de',
  English: 'en',
  Español: 'es',
  Français: 'fr',
  한국어: 'ko',
  日本語: 'ja',
};

const INTEREST_KEYS: Record<string, string> = {
  Music: 'music',
  Travel: 'travel',
  Photography: 'photography',
  Cafe: 'cafe',
  Movies: 'movies',
  Fitness: 'fitness',
  Gaming: 'gaming',
  Fashion: 'fashion',
  'Language Exchange': 'language-exchange',
  Food: 'food',
};

export type ProfileDetailHeaderAction = {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

type StandardProfileDetailProps = {
  footer?: ReactNode;
  headerLeft: ProfileDetailHeaderAction;
  headerRight?: ProfileDetailHeaderAction;
  onSafety?: () => void;
  photoBlurRadius?: number;
  photoStatusLabel?: string;
  profile: Profile;
};

export function StandardProfileDetail({
  footer,
  headerLeft,
  headerRight,
  onSafety,
  photoBlurRadius = 0,
  photoStatusLabel,
  profile,
}: StandardProfileDetailProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { i18n, t } = useTranslation();
  const [photoWidth, setPhotoWidth] = useState(0);
  const [now] = useState(() => Date.now());
  const age = profile.age;
  const heroHeight = Math.min((photoWidth || 430) * HERO_HEIGHT_RATIO, HERO_MAX_HEIGHT);
  const primaryPhoto = profile.photos[0];
  const additionalPhotos = profile.photos.slice(1);
  const photoReviewStatuses = profile.photoReviewStatuses;
  const getPhotoStatus = (index: number) => photoReviewStatuses?.[index];
  const getPhotoBlurRadius = (index: number) => {
    const status = getPhotoStatus(index);
    return status && status !== 'approved' ? Math.max(photoBlurRadius, 18) : photoBlurRadius;
  };
  const getPhotoStatusLabel = (index: number) => {
    const status = getPhotoStatus(index);
    if (status === 'pending' || status === 'draft') return t('profileReview.steps.reviewing');
    if (status === 'rejected') return t('profileReview.rejected.title');
    return status ? undefined : photoStatusLabel;
  };
  const primaryPhotoStatusLabel = getPhotoStatusLabel(0);
  const presence = useMemo(
    () => getProfilePresence(profile.lastActiveAt, now),
    [now, profile.lastActiveAt],
  );
  const presenceLabel = presence
    ? t(`discover.presence.${presence.kind}`, { count: presence.count })
    : null;
  const distanceLabel = profile.distanceKm
    ? t('profileDetail.distanceAway', {
        distance: formatNumber(i18n.language, profile.distanceKm),
      })
    : null;
  const languages =
    profile.languageDetails ??
    profile.languages.map((code, index) => ({
      code: getLanguageCode(code) ?? code,
      level: index === 0 ? ('native' as const) : ('intermediate' as const),
      isNative: index === 0,
    }));
  const interests = profile.interests.map((interest) => {
    const key = INTEREST_KEYS[interest];
    return key ? t(`profileSetup.interests.${key}`) : interest;
  });
  const basicDetails = compactProfileDetails([
    profile.details?.occupation
      ? {
          icon: 'briefcase' as const,
          iconBackground: DETAIL_ICON_TONES.work.background,
          iconColor: DETAIL_ICON_TONES.work.foreground,
          label: profile.details.occupation,
        }
      : null,
    profile.details?.educationLevel
      ? {
          icon: 'school' as const,
          iconBackground: DETAIL_ICON_TONES.education.background,
          iconColor: DETAIL_ICON_TONES.education.foreground,
          label: t(`me.detail.values.${profile.details.educationLevel}`, {
            defaultValue: profile.details.educationLevel,
          }),
        }
      : null,
    profile.details?.heightCm
      ? {
          icon: 'human-male-height' as const,
          iconBackground: DETAIL_ICON_TONES.height.background,
          iconColor: DETAIL_ICON_TONES.height.foreground,
          label: `${profile.details.heightCm}cm`,
        }
      : null,
  ]);
  const lifestyleDetails = compactProfileDetails([
    profile.details?.personalityType
      ? {
          icon: 'brain' as const,
          iconBackground: DETAIL_ICON_TONES.personality.background,
          iconColor: DETAIL_ICON_TONES.personality.foreground,
          label: profile.details.personalityType,
        }
      : null,
    profile.details?.drinking
      ? {
          icon: 'glass-wine' as const,
          iconBackground: DETAIL_ICON_TONES.drinking.background,
          iconColor: DETAIL_ICON_TONES.drinking.foreground,
          label: t(`me.detail.values.${profile.details.drinking}`, {
            defaultValue: profile.details.drinking,
          }),
        }
      : null,
    profile.details?.smoking
      ? {
          icon:
            profile.details.smoking === 'never' || profile.details.smoking === 'quitting'
              ? ('smoking-off' as const)
              : ('smoking' as const),
          iconBackground: DETAIL_ICON_TONES.smoking.background,
          iconColor: DETAIL_ICON_TONES.smoking.foreground,
          label: t(`me.detail.values.${profile.details.smoking}`, {
            defaultValue: profile.details.smoking,
          }),
        }
      : null,
    profile.details?.exercise
      ? {
          icon: 'dumbbell' as const,
          iconBackground: DETAIL_ICON_TONES.exercise.background,
          iconColor: DETAIL_ICON_TONES.exercise.foreground,
          label: t(`me.detail.values.${profile.details.exercise}`, {
            defaultValue: profile.details.exercise,
          }),
        }
      : null,
    profile.details?.pets
      ? {
          icon: 'paw' as const,
          iconBackground: DETAIL_ICON_TONES.pets.background,
          iconColor: DETAIL_ICON_TONES.pets.foreground,
          label: t(`me.detail.values.${profile.details.pets}`, {
            defaultValue: profile.details.pets,
          }),
        }
      : null,
  ]);

  const handleHeroLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== photoWidth) setPhotoWidth(nextWidth);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          { backgroundColor: theme.colors.background, paddingBottom: footer ? 112 : 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View onLayout={handleHeroLayout} style={[styles.hero, { height: heroHeight }]}>
          {primaryPhoto ? (
            <Image
              accessibilityLabel={`${profile.name} ${t('profileDetail.photo', { index: 1 })}`}
              blurRadius={getPhotoBlurRadius(0)}
              cachePolicy="memory-disk"
              contentFit="cover"
              priority="high"
              source={{ uri: primaryPhoto }}
              style={StyleSheet.absoluteFill}
              transition={160}
            />
          ) : (
            <LinearGradient colors={['#D9DAE1', '#B7B9C4']} style={StyleSheet.absoluteFill}>
              <View style={styles.photoPlaceholder}>
                <IllustratedIcon size={54} source={illustratedIcons.profilePhotos} />
                <Text style={styles.photoPlaceholderText}>{t('me.detail.photoPreparing')}</Text>
              </View>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['rgba(8,8,12,0.38)', 'rgba(8,8,12,0)', 'rgba(8,8,12,0.76)']}
            locations={[0, 0.45, 1]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <HeaderButton action={headerLeft} />
            {headerRight ? (
              <HeaderButton action={headerRight} />
            ) : (
              <View style={styles.headerGap} />
            )}
          </View>
          {additionalPhotos.length ? (
            <View pointerEvents="none" style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>1 / {profile.photos.length}</Text>
            </View>
          ) : null}
          {primaryPhotoStatusLabel ? (
            <View style={styles.photoStatus}>
              <IllustratedIcon size={18} source={illustratedIcons.photoReview} />
              <Text style={styles.photoStatusText}>{primaryPhotoStatusLabel}</Text>
            </View>
          ) : null}
          <View pointerEvents="none" style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>
                {profile.name}, {age}
              </Text>
              {profile.isPhotoReviewed ? (
                <View
                  accessibilityLabel={t('experience.trust.photoReviewedA11y')}
                  style={styles.reviewedBadge}
                >
                  <IllustratedIcon size={17} source={illustratedIcons.safety} />
                  <Text style={styles.reviewedBadgeText}>
                    {t('experience.trust.photoReviewed')}
                  </Text>
                </View>
              ) : null}
            </View>
            {profile.isGoldPass ? (
              <View style={styles.goldIdentitySlot}>
                <GoldBadge label="GOLD PASS" size="md" />
              </View>
            ) : null}
            <View style={styles.heroMetaRow}>
              {distanceLabel ? (
                <View style={styles.heroMetaItem}>
                  <IllustratedIcon size={18} source={illustratedIcons.location} />
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

        <View style={[styles.details, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.profileContext}>
            <CountryFlag
              compact
              countryCode={profile.countryCode}
              label={profile.countryLabel}
              style={styles.contextFlag}
            />
            <View style={styles.contextCopy}>
              <Text style={[styles.contextLabel, { color: theme.colors.textMuted }]}>
                {t('profileDetail.basedIn')}
              </Text>
              <Text style={[styles.contextValue, { color: theme.colors.text }]}>
                {profile.countryLabel}
              </Text>
            </View>
            {profile.isNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{t('experience.discover.newProfile')}</Text>
              </View>
            ) : null}
          </View>

          {profile.connectionGoals?.length ? (
            <DetailSection title={t('profileSetup.profileTags.categories.connection_goal.label')}>
              <View style={styles.chips}>
                {profile.connectionGoals.map((goal) => (
                  <View key={goal} style={styles.connectionGoalChip}>
                    <Text style={styles.connectionGoalText}>
                      {t(`profileSetup.profileTags.values.${goal}`)}
                    </Text>
                  </View>
                ))}
              </View>
            </DetailSection>
          ) : null}

          {profile.bio ? (
            <DetailSection title={t('profileDetail.about')}>
              <Text style={[styles.bio, { color: theme.colors.text }]}>{profile.bio}</Text>
            </DetailSection>
          ) : null}

          {basicDetails.length ? (
            <DetailSection title={t('me.detail.basic')}>
              <DetailPills items={basicDetails} />
            </DetailSection>
          ) : null}

          {lifestyleDetails.length ? (
            <DetailSection title={t('me.detail.lifestyle')}>
              <DetailPills items={lifestyleDetails} />
            </DetailSection>
          ) : null}

          {languages.length ? (
            <DetailSection title={t('profileDetail.languages')}>
              <View style={styles.chips}>
                {languages.map((language) => (
                  <View
                    key={`${language.code}-${language.level}`}
                    style={[styles.languageChip, { borderColor: theme.colors.border }]}
                  >
                    {getLanguageCode(language.code) ? (
                      <CountryFlag
                        compact
                        countryCode={getRepresentativeCountryCode(getLanguageCode(language.code)!)}
                        label={getLanguageLabel(language.code, i18n.language)}
                        style={styles.languageFlag}
                      />
                    ) : (
                      <Ionicons color={theme.colors.primary} name="chatbubble-outline" size={14} />
                    )}
                    <View style={styles.languageCopy}>
                      <Text style={[styles.languageText, { color: theme.colors.text }]}>
                        {getLanguageLabel(language.code, i18n.language)}
                      </Text>
                      <Text style={[styles.languageLevelText, { color: theme.colors.textMuted }]}>
                        {t(`profileDetail.languageLevels.${language.level}`)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </DetailSection>
          ) : null}

          {interests.length ? (
            <DetailSection title={t('profileDetail.interests')}>
              <View style={styles.chips}>
                {interests.map((interest) => (
                  <View key={interest} style={styles.interestChip}>
                    <Text style={styles.interestText}># {interest}</Text>
                  </View>
                ))}
              </View>
            </DetailSection>
          ) : null}

          {additionalPhotos.length ? (
            <DetailSection title={t('profileDetail.photos', { count: profile.photos.length })}>
              <View style={styles.photoGallery}>
                {additionalPhotos.map((photo, index) => (
                  <View key={`${photo}-${index}`} style={styles.galleryPhotoFrame}>
                    <Image
                      accessibilityLabel={`${profile.name} ${t('profileDetail.photo', { index: index + 2 })}`}
                      blurRadius={getPhotoBlurRadius(index + 1)}
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      priority="normal"
                      source={{ uri: photo }}
                      style={StyleSheet.absoluteFill}
                      transition={160}
                    />
                    {getPhotoStatusLabel(index + 1) ? (
                      <View style={styles.galleryPhotoStatus}>
                        <IllustratedIcon size={17} source={illustratedIcons.photoReview} />
                        <Text style={styles.galleryPhotoStatusText}>
                          {getPhotoStatusLabel(index + 1)}
                        </Text>
                      </View>
                    ) : null}
                    <View pointerEvents="none" style={styles.galleryPhotoCount}>
                      <Text style={styles.galleryPhotoCountText}>
                        {index + 2} / {profile.photos.length}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </DetailSection>
          ) : null}

          {onSafety ? (
            <Pressable
              accessibilityRole="button"
              onPress={onSafety}
              style={({ pressed }) => [styles.safetyLink, pressed && styles.pressed]}
            >
              <IllustratedIcon size={24} source={illustratedIcons.safety} />
              <Text style={[styles.safetyLinkText, { color: theme.colors.textMuted }]}>
                {t('profileDetail.reportOrBlock')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      {footer}
    </View>
  );
}

function HeaderButton({ action }: { action: ProfileDetailHeaderAction }) {
  return (
    <Pressable
      accessibilityLabel={action.accessibilityLabel}
      accessibilityRole="button"
      onPress={action.onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <Ionicons color={palette.white} name={action.icon} size={22} />
    </Pressable>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.section, { borderTopColor: theme.colors.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function DetailPills({ items }: { items: ProfileDetailItem[] }) {
  const theme = useAppTheme();
  return (
    <View style={styles.detailGrid}>
      {items.map((item) => (
        <View
          key={`${item.icon}-${item.label}`}
          style={[styles.detailPill, { borderColor: theme.colors.border }]}
        >
          <View style={[styles.detailIcon, { backgroundColor: item.iconBackground }]}>
            <MaterialCommunityIcons color={item.iconColor} name={item.icon} size={17} />
          </View>
          <Text style={[styles.detailPillText, { color: theme.colors.text }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function compactProfileDetails(items: (ProfileDetailItem | null)[]) {
  return items.filter((item): item is ProfileDetailItem => item !== null);
}

function getLanguageCode(language: string) {
  if (/^[a-z]{2,3}$/i.test(language)) return language.toLowerCase();
  return LANGUAGE_NAME_TO_CODE[language];
}

function getLanguageLabel(language: string, locale: string) {
  const code = getLanguageCode(language);
  return code ? getLanguageDisplayName(locale, code) : language;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: { backgroundColor: '#D8D8DE', overflow: 'hidden', width: '100%' },
  photoPlaceholder: { alignItems: 'center', flex: 1, justifyContent: 'center', gap: 10 },
  photoPlaceholderText: { color: palette.white, fontSize: 13, fontWeight: '800' },
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
  headerGap: { height: 44, width: 44 },
  photoCountBadge: {
    backgroundColor: 'rgba(17,17,20,0.56)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    right: 18,
    top: 76,
  },
  photoCountText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  photoStatus: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,20,0.58)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    left: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    top: 76,
  },
  photoStatusText: { color: palette.white, fontSize: 10, fontWeight: '900' },
  heroInfo: { bottom: 24, left: 22, position: 'absolute', right: 22 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  name: {
    color: palette.white,
    flexShrink: 1,
    fontSize: 33,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  reviewedBadge: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 3,
    height: 22,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  reviewedBadgeText: { color: palette.white, fontSize: 10, fontWeight: '900' },
  goldIdentitySlot: { alignSelf: 'flex-start', marginTop: 7 },
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
  profileContext: { alignItems: 'center', flexDirection: 'row', minHeight: 78 },
  contextFlag: { borderRadius: 7, height: 25, width: 36 },
  contextCopy: { flex: 1, marginLeft: 11 },
  contextLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  contextValue: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  newBadge: {
    backgroundColor: palette.lime,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  newBadgeText: { color: palette.ink, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.25, marginBottom: 12 },
  bio: { fontSize: 15, lineHeight: 23 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailPill: {
    alignItems: 'center',
    backgroundColor: '#FAFAFB',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 40,
    paddingLeft: 7,
    paddingRight: 13,
    paddingVertical: 6,
  },
  detailIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  detailPillText: { fontSize: 12, fontWeight: '800' },
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
  languageLevelText: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  languageFlag: { borderRadius: 5, height: 18, width: 26 },
  interestChip: {
    backgroundColor: '#FFF0F5',
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  interestText: { color: palette.pinkPressed, fontSize: 12, fontWeight: '800' },
  connectionGoalChip: {
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  connectionGoalText: { color: palette.white, fontSize: 12, fontWeight: '900' },
  photoGallery: { gap: 14 },
  galleryPhotoFrame: {
    aspectRatio: 0.8,
    backgroundColor: '#D8D8DE',
    borderRadius: 22,
    overflow: 'hidden',
    width: '100%',
  },
  galleryPhotoStatus: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,20,0.62)',
    borderRadius: radius.pill,
    bottom: 14,
    flexDirection: 'row',
    gap: 5,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    zIndex: 2,
  },
  galleryPhotoStatusText: { color: palette.white, fontSize: 10, fontWeight: '900' },
  galleryPhotoCount: {
    backgroundColor: 'rgba(17,17,20,0.56)',
    borderRadius: radius.pill,
    bottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    right: 14,
    zIndex: 2,
  },
  galleryPhotoCountText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  safetyLink: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 24,
    paddingTop: 22,
  },
  safetyLinkText: { fontSize: 12, fontWeight: '700', marginLeft: 7 },
  pressed: { opacity: 0.66 },
});
