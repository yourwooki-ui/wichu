import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandWordmark } from '@/components/BrandWordmark';
import { CountryFlag } from '@/components/CountryFlag';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';
import { getRepresentativeCountryCode } from '@/constants/languages';
import { palette, radius } from '@/constants/theme';
import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { profileService } from '@/features/profile/services/profile-service';
import { getProfileAge } from '@/features/profile/utils/profile-display';
import { useAuthSession } from '@/hooks/use-auth-session';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';

const REVIEW_LABELS = {
  draft: '작성 중',
  pending: '사진 심사 중',
  approved: '프로필 승인 완료',
  rejected: '프로필 수정 필요',
} as const;

const TAG_LABELS: Record<string, string> = {
  dating: '데이트',
  friends: '새로운 친구',
  language_exchange: '언어 교환',
  travel_buddy: '여행 친구',
  calm: '차분한',
  playful: '유쾌한',
  curious: '호기심 많은',
  active: '활동적인',
  creative: '창의적인',
  spontaneous: '즉흥적인',
  warm: '다정한',
  independent: '독립적인',
  early_bird: '아침형',
  night_owl: '저녁형',
  flexible: '유연한',
  talkative: '대화를 이끄는',
  listener: '잘 들어주는',
  balanced: '균형 잡힌',
};

const LANGUAGE_LEVELS: Record<string, string> = {
  beginner: '기초',
  intermediate: '일상 회화',
  advanced: '고급',
  fluent: '능숙',
};

const INTEREST_LABELS: Record<string, string> = {
  Music: '음악',
  Travel: '여행',
  Photography: '사진',
  Cafe: '카페',
  Movies: '영화',
  Fitness: '운동',
  Gaming: '게임',
  Fashion: '패션',
  'Language Exchange': '언어 교환',
  Food: '음식',
};

export function MeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { i18n } = useTranslation();
  const { profileReviewStatus, refreshProfile, session } = useAuthSession();
  const entitlement = usePassEntitlement();
  const userId = session?.user.id;
  const [photoRepairing, setPhotoRepairing] = useState(false);
  const [photoRepairError, setPhotoRepairError] = useState<string | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['me', 'operational-profile', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const operational = await profileService.getMyOperationalProfile(userId!);
      const data = operational.profile;
      const databasePaths = [...data.profile_photos]
        .sort((a, b) => a.position - b.position)
        .map((photo) => photo.storage_path);
      const storagePaths = databasePaths.length
        ? databasePaths
        : await profilePhotoService.listMyStoredPhotos(userId!);

      const photos = await Promise.all(
        storagePaths.map(async (storagePath) => {
          const { data: signed } = await profilePhotoService.createSignedPhotoUrl(storagePath);
          return signed?.signedUrl ?? null;
        }),
      );

      return {
        ...operational,
        photos: photos.filter((photo): photo is string => Boolean(photo)),
      };
    },
  });

  const languageNames = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: 'language' }),
    [i18n.language],
  );

  if (profileQuery.isLoading) return <MeSkeleton />;

  if (profileQuery.isError) {
    return (
      <Screen edges={['top', 'left', 'right']} style={styles.centered}>
        <View style={styles.emptyIcon}>
          <Ionicons color={palette.pink} name="cloud-offline-outline" size={28} />
        </View>
        <Text style={styles.emptyTitle}>프로필을 불러오지 못했어요.</Text>
        <Text style={styles.emptyText}>저장된 프로필은 그대로예요. 연결 상태를 확인해 주세요.</Text>
        <Pressable onPress={() => profileQuery.refetch()} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>다시 시도</Text>
        </Pressable>
      </Screen>
    );
  }

  if (!profileQuery.data) {
    return (
      <Screen edges={['top', 'left', 'right']} style={styles.centered}>
        <View style={styles.emptyIcon}>
          <Ionicons color={palette.pink} name="person-add-outline" size={28} />
        </View>
        <Text style={styles.emptyTitle}>프로필이 아직 준비되지 않았어요.</Text>
        <Text style={styles.emptyText}>WICHU를 이용하려면 프로필 설정을 완료해주세요.</Text>
        <Pressable onPress={() => router.push('/profile-setup')} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>프로필 완성하기</Text>
        </Pressable>
      </Screen>
    );
  }

  const {
    interests,
    languages: spokenLanguages,
    photos,
    profile,
    settings,
    tags: profileTags,
  } = profileQuery.data;
  const reviewStatus = profileReviewStatus ?? profile.review_status;
  const photosUnderReview = reviewStatus === 'pending';
  const interestLabels = interests.map(
    (interest) => INTEREST_LABELS[interest.label] ?? interest.label,
  );
  const languages = [
    profile.native_language
      ? { code: profile.native_language, level: '모국어', native: true }
      : null,
    ...spokenLanguages.map((language) => ({
      code: language.language_code,
      level: LANGUAGE_LEVELS[language.proficiency] ?? language.proficiency,
      native: false,
    })),
  ].filter((language): language is NonNullable<typeof language> => Boolean(language));
  const tags = profileTags.map((tag) => TAG_LABELS[tag.value] ?? tag.value);
  const interestedIn = profile.interested_in.map((gender) => formatGender(gender)).join(', ');
  const tier = entitlement.data?.tier ?? 'free';
  const tierLabel = tier === 'gold' ? 'Gold Pass' : tier === 'ad_free' ? 'Ad-Free' : 'Free';
  const isDiscoverable = settings?.discovery_enabled ?? true;
  const previewTags = [...tags, ...interestLabels.map((item) => `# ${item}`)].slice(0, 3);

  const repairMissingPhotos = async () => {
    if (!userId || photoRepairing) return;
    setPhotoRepairError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: 6,
      quality: 0.85,
    });
    if (result.canceled) return;

    const validPhotos = result.assets.filter(
      (asset) =>
        (!asset.mimeType || ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) &&
        (asset.fileSize ?? 0) <= 6 * 1024 * 1024 &&
        asset.width >= 600 &&
        asset.height >= 600,
    );
    if (!validPhotos.length) {
      setPhotoRepairError('600 × 600픽셀 이상의 JPG, PNG 또는 WebP 사진을 선택해주세요.');
      return;
    }

    setPhotoRepairing(true);
    try {
      await profilePhotoService.uploadPhotos(
        userId,
        validPhotos.map((asset, index) => ({
          ...asset,
          draftId: `${asset.assetId ?? asset.uri}-${Date.now()}-${index}`,
        })),
      );
      const { error } = await profileService.submitForReview();
      if (error) throw error;
      await Promise.all([profileQuery.refetch(), refreshProfile()]);
    } catch (error) {
      setPhotoRepairError(
        error instanceof Error ? error.message : '프로필 사진을 저장하지 못했어요.',
      );
    } finally {
      setPhotoRepairing(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <BrandWordmark color={theme.colors.text} size={23} />
          <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>내 프로필</Text>
        </View>
        <Pressable
          accessibilityLabel="설정 열기"
          onPress={() => router.push('/settings')}
          style={styles.headerButton}
        >
          <Ionicons color={palette.ink} name="settings-outline" size={23} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHub}>
          <View
            style={[styles.avatarRing, entitlement.data?.tier === 'gold' && styles.avatarRingGold]}
          >
            {photos[0] ? (
              <View style={styles.avatarMedia}>
                <Image
                  blurRadius={photosUnderReview ? 18 : 0}
                  cachePolicy="memory-disk"
                  source={{ uri: photos[0] }}
                  style={styles.avatar}
                />
                {photosUnderReview ? (
                  <View style={styles.avatarReviewOverlay}>
                    <Ionicons color={palette.white} name="time" size={17} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.avatarEmpty}>
                <Ionicons color={palette.inkMuted} name="person" size={40} />
              </View>
            )}
          </View>
          <View style={styles.identityCopy}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>
                {profile.display_name}, {getProfileAge(profile.birth_date)}
              </Text>
              <CountryFlag compact countryCode={profile.country_code} style={styles.flag} />
            </View>
            <Text numberOfLines={1} style={styles.accountEmail}>
              {session?.user.email}
            </Text>
            <View style={styles.identityBadges}>
              <View style={styles.reviewPill}>
                <View
                  style={[
                    styles.reviewDot,
                    {
                      backgroundColor:
                        reviewStatus === 'approved'
                          ? '#20B775'
                          : reviewStatus === 'rejected'
                            ? palette.danger
                            : '#E6A800',
                    },
                  ]}
                />
                <Text style={styles.reviewText}>{REVIEW_LABELS[reviewStatus]}</Text>
              </View>
              {tier === 'gold' ? (
                <View style={styles.goldProfileBadge}>
                  <Text style={styles.goldProfileDiamond}>◆</Text>
                  <Text style={styles.goldProfileText}>GOLD</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Pressable
            accessibilityLabel="프로필 수정"
            onPress={() => router.push('/profile-setup')}
            style={({ pressed }) => [styles.hubEditButton, pressed && styles.pressed]}
          >
            <Ionicons color={palette.ink} name="pencil" size={17} />
          </Pressable>
        </View>

        {reviewStatus === 'rejected' && profile.review_note ? (
          <View style={styles.reviewNotice}>
            <Ionicons color={palette.danger} name="alert-circle" size={20} />
            <View style={styles.reviewNoticeCopy}>
              <Text style={styles.reviewNoticeTitle}>프로필 수정이 필요해요</Text>
              <Text style={styles.reviewNoticeText}>{profile.review_note}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.statusStrip}>
          <StatusCell
            icon="eye-outline"
            label="발견 노출"
            tone={isDiscoverable ? 'green' : 'neutral'}
            value={isDiscoverable ? '켜짐' : '꺼짐'}
          />
          <View style={styles.statusDivider} />
          <StatusCell
            icon="shield-checkmark-outline"
            label="심사 상태"
            value={shortReviewLabel(reviewStatus)}
          />
          <View style={styles.statusDivider} />
          <StatusCell
            icon="ticket-outline"
            label="이용권"
            tone={tier === 'gold' ? 'gold' : 'neutral'}
            value={tierLabel}
          />
        </View>

        {profile.profile_completeness < 100 || !photos.length ? (
          <View style={styles.attentionCard}>
            <View style={styles.attentionTop}>
              <View style={styles.attentionCopy}>
                <Text style={styles.attentionEyebrow}>프로필 완성도</Text>
                <Text style={styles.attentionTitle}>
                  {!photos.length
                    ? '대표 사진을 다시 등록해주세요'
                    : '조금만 더 채우면 준비 완료예요'}
                </Text>
              </View>
              <Text style={styles.attentionValue}>{profile.profile_completeness}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${profile.profile_completeness}%` }]} />
            </View>
            {!photos.length ? (
              <Pressable
                disabled={photoRepairing}
                onPress={repairMissingPhotos}
                style={({ pressed }) => [styles.attentionAction, pressed && styles.pressed]}
              >
                <Text style={styles.attentionActionText}>
                  {photoRepairing ? '사진 저장 중…' : '사진 추가하기'}
                </Text>
                <Ionicons color={palette.white} name="arrow-forward" size={16} />
              </Pressable>
            ) : null}
            {photoRepairError ? (
              <Text style={styles.photoRepairError}>{photoRepairError}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.groupTitle}>빠른 메뉴</Text>
        <View style={styles.quickGrid}>
          <QuickAction
            color="#FFE5EE"
            detail="사진 · 소개 · 관심사"
            icon="person-outline"
            label="프로필 수정"
            onPress={() => router.push('/profile-setup')}
          />
          <QuickAction
            color="#E9F8C8"
            detail="연령 · 국가 · 공개"
            icon="options-outline"
            label="탐색 설정"
            onPress={() => router.push('/settings')}
          />
          <QuickAction
            color="#E8E5FF"
            detail="픽 · 매치 · 방문자"
            icon="people-outline"
            label="연결 관리"
            onPress={() => router.push('/(tabs)/matches')}
          />
          <QuickAction
            color="#FFF0BE"
            detail={tierLabel}
            icon="diamond-outline"
            label="이용권"
            onPress={() => router.push('/(tabs)/shop')}
          />
        </View>

        <View style={styles.previewHeader}>
          <View>
            <Text style={styles.groupTitle}>내 프로필 미리보기</Text>
            <Text style={styles.groupHint}>다른 사용자에게 보이는 첫인상이에요</Text>
          </View>
          <Pressable onPress={() => router.push('/profile-setup')}>
            <Text style={styles.previewEditText}>수정</Text>
          </Pressable>
        </View>
        <View style={[styles.profilePreview, tier === 'gold' && styles.profilePreviewGold]}>
          {photos[0] ? (
            <Image
              blurRadius={photosUnderReview ? 20 : 0}
              cachePolicy="memory-disk"
              contentPosition="center"
              source={{ uri: photos[0] }}
              style={styles.previewImage}
            />
          ) : (
            <LinearGradient colors={['#DDDDE3', '#BDBEC7']} style={styles.previewPlaceholder}>
              <Ionicons color="rgba(255,255,255,0.72)" name="person" size={72} />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(15,15,18,0.84)']}
            locations={[0.34, 1]}
            style={styles.previewGradient}
          />
          {photosUnderReview ? (
            <View style={styles.previewReviewBadge}>
              <Ionicons color={palette.white} name="time-outline" size={13} />
              <Text style={styles.previewReviewText}>사진 심사 중</Text>
            </View>
          ) : null}
          <View style={styles.previewCopy}>
            <View style={styles.previewNameRow}>
              <Text style={styles.previewName}>
                {profile.display_name}, {getProfileAge(profile.birth_date)}
              </Text>
              <CountryFlag compact countryCode={profile.country_code} style={styles.previewFlag} />
              {tier === 'gold' ? <Text style={styles.previewDiamond}>◆</Text> : null}
            </View>
            {profile.bio ? (
              <Text numberOfLines={2} style={styles.previewBio}>
                {profile.bio}
              </Text>
            ) : null}
            {previewTags.length ? (
              <View style={styles.previewTags}>
                {previewTags.map((tag) => (
                  <Text key={tag} style={styles.previewTag}>
                    {tag}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setDetailsExpanded((current) => !current)}
          style={({ pressed }) => [styles.detailsToggle, pressed && styles.pressed]}
        >
          <View>
            <Text style={styles.detailsTitle}>프로필 상세 정보</Text>
            <Text style={styles.detailsHint}>사진, 언어, 관심사와 탐색 조건</Text>
          </View>
          <Ionicons
            color={palette.ink}
            name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
            size={19}
          />
        </Pressable>

        {detailsExpanded ? (
          <View style={styles.detailsBody}>
            <Section title="프로필 사진" meta={`${photos.length} / 6`}>
              {photos.length ? (
                <ScrollView
                  contentContainerStyle={styles.photoRail}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {photos.map((photo, index) => (
                    <View key={photo} style={styles.photoWrap}>
                      <Image
                        blurRadius={photosUnderReview ? 22 : 0}
                        source={{ uri: photo }}
                        style={styles.photo}
                      />
                      {index === 0 ? (
                        <View style={styles.mainBadge}>
                          <Text style={styles.mainBadgeText}>대표</Text>
                        </View>
                      ) : null}
                      {photosUnderReview ? (
                        <View style={styles.photoReviewOverlay}>
                          <Ionicons color={palette.white} name="time-outline" size={18} />
                          <Text style={styles.photoReviewText}>심사 중</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.photoMissingBlock}>
                  <MissingValue label="제출한 사진이 저장되지 않았어요. 심사를 계속하려면 사진을 다시 추가해주세요." />
                  <Pressable
                    accessibilityRole="button"
                    disabled={photoRepairing}
                    onPress={repairMissingPhotos}
                    style={({ pressed }) => [
                      styles.photoRepairAction,
                      (pressed || photoRepairing) && styles.pressed,
                    ]}
                  >
                    <Ionicons color={palette.white} name="images-outline" size={16} />
                    <Text style={styles.photoRepairText}>
                      {photoRepairing ? '사진 저장 중…' : '프로필 사진 추가'}
                    </Text>
                  </Pressable>
                  {photoRepairError ? (
                    <Text style={styles.photoRepairError}>{photoRepairError}</Text>
                  ) : null}
                </View>
              )}
            </Section>

            <Section title="자기소개">
              {profile.bio ? (
                <Text style={styles.bio}>{profile.bio}</Text>
              ) : (
                <MissingValue label="작성한 자기소개가 없어요" />
              )}
            </Section>

            <Section title="프로필 정보">
              <InfoRow icon="person-outline" label="성별" value={formatGender(profile.gender)} />
              <InfoRow icon="heart-outline" label="관심 성별" value={interestedIn || '미설정'} />
              <InfoRow
                icon="calendar-outline"
                label="선호 연령"
                value={settings ? `${settings.min_age}세 – ${settings.max_age}세` : '미설정'}
              />
              <InfoRow
                icon="navigate-outline"
                label="최대 탐색 거리"
                value={
                  settings
                    ? settings.max_distance_km === 0
                      ? '무제한'
                      : `${new Intl.NumberFormat('ko-KR').format(settings.max_distance_km)}km 이하`
                    : '미설정'
                }
              />
              <InfoRow
                icon="globe-outline"
                label="탐색 국가"
                value={
                  settings?.country_codes.length ? settings.country_codes.join(', ') : '모든 국가'
                }
              />
            </Section>

            <Section title="언어">
              {languages.length ? (
                <View style={styles.chips}>
                  {languages.map((language) => (
                    <View key={`${language.code}-${language.level}`} style={styles.languageChip}>
                      <CountryFlag
                        compact
                        countryCode={getRepresentativeCountryCode(language.code)}
                        style={styles.languageFlag}
                      />
                      <View>
                        <Text style={styles.languageName}>
                          {languageNames.of(language.code) ?? language.code.toUpperCase()}
                        </Text>
                        <Text style={styles.languageLevel}>{language.level}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <MissingValue label="등록한 언어가 없어요" />
              )}
            </Section>

            <Section title="프로필 키워드">
              <ChipList items={tags} empty="선택한 프로필 키워드가 없어요" />
            </Section>

            <Section title="관심사">
              <ChipList items={interestLabels} empty="선택한 관심사가 없어요" pink />
            </Section>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.settingsAction, pressed && styles.pressed]}
        >
          <View style={styles.settingsIcon}>
            <Ionicons color={palette.ink} name="settings-outline" size={21} />
          </View>
          <View style={styles.settingsCopy}>
            <Text style={styles.settingsTitle}>계정 및 개인정보 설정</Text>
            <Text style={styles.settingsText}>알림, 안전 및 계정 관리</Text>
          </View>
          <Ionicons color={palette.inkMuted} name="chevron-forward" size={19} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Section({
  children,
  meta,
  title,
}: {
  children: React.ReactNode;
  meta?: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function StatusCell({
  icon,
  label,
  tone = 'neutral',
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: 'gold' | 'green' | 'neutral';
  value: string;
}) {
  const color = tone === 'gold' ? '#9A7000' : tone === 'green' ? '#16895A' : palette.ink;
  return (
    <View style={styles.statusCell}>
      <Ionicons color={color} name={icon} size={17} />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.statusValue, { color }]}>
        {value}
      </Text>
    </View>
  );
}

function QuickAction({
  color,
  detail,
  icon,
  label,
  onPress,
}: {
  color: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, { backgroundColor: color }]}>
        <Ionicons color={palette.ink} name={icon} size={20} />
      </View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.quickDetail}>
          {detail}
        </Text>
      </View>
      <Ionicons color="#B2B2BA" name="chevron-forward" size={16} />
    </Pressable>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons color={palette.ink} name={icon} size={18} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ChipList({
  empty,
  items,
  pink = false,
}: {
  empty: string;
  items: string[];
  pink?: boolean;
}) {
  if (!items.length) return <MissingValue label={empty} />;
  return (
    <View style={styles.chips}>
      {items.map((item) => (
        <View key={item} style={[styles.chip, pink && styles.chipPink]}>
          <Text style={[styles.chipText, pink && styles.chipTextPink]}>
            {pink ? '# ' : ''}
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MissingValue({ label }: { label: string }) {
  return <Text style={styles.missing}>{label}</Text>;
}

function MeSkeleton() {
  return (
    <Screen edges={['top', 'left', 'right']} style={styles.centered}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonLine} />
      <Text style={styles.loadingText}>프로필을 불러오는 중…</Text>
    </Screen>
  );
}

function formatGender(value: string) {
  if (value === 'woman') return '여성';
  if (value === 'man') return '남성';
  if (value === 'nonbinary') return '논바이너리';
  if (value === 'other') return '기타';
  return value || '미설정';
}

function shortReviewLabel(status: keyof typeof REVIEW_LABELS) {
  if (status === 'approved') return '승인';
  if (status === 'rejected') return '수정 필요';
  if (status === 'pending') return '심사 중';
  return '작성 중';
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 80,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 2.1, lineHeight: 12, marginTop: 2 },
  headerButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DFDFE4',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  content: { paddingBottom: 34, paddingHorizontal: 20 },
  profileHub: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 24,
    flexDirection: 'row',
    padding: 14,
  },
  identityCopy: { flex: 1, marginLeft: 13, minWidth: 0 },
  avatarRing: {
    alignItems: 'center',
    borderColor: palette.pink,
    borderRadius: 43,
    borderWidth: 2,
    height: 86,
    justifyContent: 'center',
    width: 86,
  },
  avatarRingGold: { borderColor: '#DCAF2D', borderWidth: 3 },
  goldProfileBadge: {
    alignItems: 'center',
    backgroundColor: '#211B0D',
    borderColor: '#DCAF2D',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goldProfileDiamond: { color: '#FFD35A', fontSize: 9 },
  goldProfileText: { color: '#FFE59A', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  avatarMedia: {
    borderRadius: 39,
    height: 78,
    overflow: 'hidden',
    position: 'relative',
    width: 78,
  },
  avatar: { borderRadius: 39, height: 78, width: 78 },
  avatarReviewOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.34)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  avatarEmpty: {
    alignItems: 'center',
    backgroundColor: '#DCDCE1',
    borderRadius: 39,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  hubEditButton: {
    alignItems: 'center',
    backgroundColor: '#F1F1F4',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: 8,
    width: 36,
  },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  name: { color: palette.ink, flexShrink: 1, fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  flag: { borderRadius: 4, height: 14, width: 21 },
  accountEmail: { color: palette.inkMuted, fontSize: 9, marginTop: 3 },
  identityBadges: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 8 },
  reviewPill: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  reviewDot: { borderRadius: 4, height: 8, width: 8 },
  reviewText: { color: palette.ink, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  reviewNotice: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF0F1',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    padding: 14,
  },
  reviewNoticeCopy: { flex: 1 },
  reviewNoticeTitle: { color: palette.danger, fontSize: 12, fontWeight: '900' },
  reviewNoticeText: { color: palette.ink, fontSize: 11, lineHeight: 16, marginTop: 3 },
  statusStrip: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 20,
    flexDirection: 'row',
    marginTop: 10,
    minHeight: 74,
    paddingHorizontal: 7,
  },
  statusCell: { alignItems: 'center', flex: 1, minWidth: 0 },
  statusDivider: { backgroundColor: '#E5E5E9', height: 31, width: StyleSheet.hairlineWidth },
  statusLabel: { color: palette.inkMuted, fontSize: 8, fontWeight: '700', marginTop: 4 },
  statusValue: { fontSize: 10, fontWeight: '900', marginTop: 1, maxWidth: '92%' },
  attentionCard: { backgroundColor: palette.ink, borderRadius: 22, marginTop: 10, padding: 16 },
  attentionTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  attentionCopy: { flex: 1, paddingRight: 10 },
  attentionEyebrow: { color: palette.pink, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  attentionTitle: { color: palette.white, fontSize: 13, fontWeight: '900', marginTop: 5 },
  attentionValue: { color: palette.lime, fontSize: 23, fontWeight: '900' },
  attentionAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 7,
    marginTop: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  attentionActionText: { color: palette.white, fontSize: 10, fontWeight: '900' },
  completionTop: { flexDirection: 'row', justifyContent: 'space-between' },
  completionEyebrow: { color: palette.pink, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  completionTitle: { color: palette.white, fontSize: 14, fontWeight: '900', marginTop: 5 },
  completionValue: { color: palette.lime, fontSize: 25, fontWeight: '900' },
  progressTrack: {
    backgroundColor: '#36363C',
    borderRadius: 3,
    height: 5,
    marginTop: 15,
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: palette.lime, borderRadius: 3, height: '100%' },
  groupTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginTop: 22,
  },
  groupHint: { color: palette.inkMuted, fontSize: 9, marginTop: 3 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  quickAction: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 11,
    width: '48.8%',
  },
  quickIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  quickCopy: { flex: 1, marginLeft: 9, minWidth: 0 },
  quickLabel: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  quickDetail: { color: palette.inkMuted, fontSize: 8, marginTop: 3 },
  previewHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  previewEditText: {
    color: palette.pinkPressed,
    fontSize: 10,
    fontWeight: '900',
    paddingVertical: 4,
  },
  profilePreview: {
    backgroundColor: '#D8D8DE',
    borderRadius: 24,
    height: 300,
    marginTop: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  profilePreviewGold: { borderColor: '#DCAF2D', borderWidth: 2 },
  previewImage: { height: '100%', width: '100%' },
  previewPlaceholder: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  previewGradient: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  previewReviewBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,19,0.68)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    left: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    top: 13,
  },
  previewReviewText: { color: palette.white, fontSize: 8, fontWeight: '900' },
  previewCopy: { bottom: 17, left: 17, position: 'absolute', right: 17 },
  previewNameRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  previewName: { color: palette.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.7 },
  previewFlag: { borderRadius: 4, height: 15, width: 22 },
  previewDiamond: { color: '#FFD35A', fontSize: 12 },
  previewBio: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
    maxWidth: '90%',
  },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  previewTag: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    color: palette.white,
    fontSize: 8,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  detailsToggle: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    minHeight: 67,
    paddingHorizontal: 16,
  },
  detailsTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  detailsHint: { color: palette.inkMuted, fontSize: 9, marginTop: 3 },
  detailsBody: { marginTop: 4 },
  editAction: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 11,
    minHeight: 48,
  },
  editActionText: { color: palette.white, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.68 },
  section: {
    borderBottomColor: '#D8D8DD',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 21,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  sectionMeta: { color: palette.inkMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  photoRail: { gap: 9 },
  photoWrap: {
    borderRadius: 18,
    height: 150,
    overflow: 'hidden',
    position: 'relative',
    width: 112,
  },
  photo: { height: '100%', width: '100%' },
  photoReviewOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(14,14,18,0.38)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  photoReviewText: {
    color: palette.white,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 5,
  },
  photoMissingBlock: { alignItems: 'flex-start', gap: 10 },
  photoRepairAction: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  photoRepairText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  photoRepairError: { color: palette.danger, fontSize: 10, lineHeight: 15 },
  mainBadge: {
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: 'absolute',
    top: 8,
  },
  mainBadgeText: { color: palette.white, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  bio: { color: palette.ink, fontSize: 14, lineHeight: 22 },
  infoRow: { alignItems: 'center', flexDirection: 'row', minHeight: 48 },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 14,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  infoLabel: { color: palette.inkMuted, fontSize: 11, fontWeight: '700', marginLeft: 10 },
  infoValue: {
    color: palette.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 10,
    textAlign: 'right',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipPink: { backgroundColor: '#FFE7EF' },
  chipText: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  chipTextPink: { color: palette.pinkPressed },
  languageChip: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  languageFlag: { borderRadius: 5, height: 20, width: 28 },
  languageName: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  languageLevel: { color: palette.inkMuted, fontSize: 8, fontWeight: '700', marginTop: 1 },
  missing: { color: palette.inkMuted, fontSize: 12, fontStyle: 'italic' },
  settingsAction: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 11,
    marginTop: 20,
    padding: 14,
  },
  settingsIcon: {
    alignItems: 'center',
    backgroundColor: palette.lime,
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  settingsCopy: { flex: 1 },
  settingsTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  settingsText: { color: palette.inkMuted, fontSize: 9, marginTop: 3 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE5EE',
    borderRadius: 28,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyTitle: { color: palette.ink, fontSize: 19, fontWeight: '900', marginTop: 15 },
  emptyText: {
    color: palette.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    maxWidth: 280,
    textAlign: 'center',
  },
  emptyAction: {
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  emptyActionText: { color: palette.white, fontSize: 12, fontWeight: '900' },
  skeletonAvatar: { backgroundColor: '#D8D8DD', borderRadius: 50, height: 100, width: 100 },
  skeletonLine: {
    backgroundColor: '#D8D8DD',
    borderRadius: 5,
    height: 10,
    marginTop: 16,
    width: 140,
  },
  loadingText: { color: palette.inkMuted, fontSize: 11, marginTop: 12 },
});
