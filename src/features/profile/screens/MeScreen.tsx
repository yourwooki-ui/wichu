import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image, type ImageSource } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTabHeader } from '@/components/AppTabHeader';
import { CountryFlag } from '@/components/CountryFlag';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { ListRowsSkeleton, Skeleton, SkeletonLine } from '@/components/Skeleton';
import { getPassIllustration, illustratedIcons } from '@/constants/illustrated-icons';
import { MONETIZATION_ENABLED } from '@/constants/features';
import { palette, pressFeedback, radius, typography } from '@/constants/theme';
import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { profileService } from '@/features/profile/services/profile-service';
import { getProfileCompletion } from '@/features/profile/utils/profile-completion';
import { getProfileAge } from '@/features/profile/utils/profile-display';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { reportOperationalError } from '@/services/operational-error-service';

type ReviewStatus = 'approved' | 'draft' | 'pending' | 'rejected';

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
  const { t } = useTranslation();
  const router = useRouter();
  const { profileReviewStatus, refreshProfile, session } = useAuthSession();
  const entitlement = usePassEntitlement();
  const userId = session?.user.id;
  const [photoRepairing, setPhotoRepairing] = useState(false);
  const [photoRepairError, setPhotoRepairError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['me', 'operational-profile', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const operational = await profileService.getMyOperationalProfile(userId!);
      const data = operational.profile;
      const databasePhotos = [...data.profile_photos].sort((a, b) => a.position - b.position);
      const photos = databasePhotos.length
        ? databasePhotos
            .map((photo) => ({
              storagePath: photo.storage_path,
              uri: photo.signed_url,
              reviewStatus: photo.review_status ?? data.review_status,
              reviewNote: photo.review_note,
            }))
            .filter((photo) => Boolean(photo.uri))
        : await Promise.all(
            (await profilePhotoService.listMyStoredPhotos(userId!)).map(async (storagePath) => {
              const { data: signed } = await profilePhotoService.createSignedPhotoUrl(storagePath);
              return {
                storagePath,
                uri: signed?.signedUrl ?? '',
                reviewStatus: 'pending' as const,
                reviewNote: null,
              };
            }),
          );

      return {
        ...operational,
        photos: photos.filter((photo) => Boolean(photo.uri)),
      };
    },
  });

  const refreshControl = useRefreshControl(
    useCallback(
      () => Promise.all([profileQuery.refetch(), refreshProfile()]),
      [profileQuery, refreshProfile],
    ),
  );

  useEffect(() => {
    if (profileQuery.error) reportOperationalError('me_query', profileQuery.error, '/me');
  }, [profileQuery.error]);

  if (profileQuery.isLoading) return <MeSkeleton />;

  if (profileQuery.isError) {
    return (
      <Screen edges={['top', 'left', 'right']} style={styles.centered}>
        <StateView
          actionLabel={t('reliability.retry')}
          body={t('reliability.profileBody')}
          container="plain"
          illustration={illustratedIcons.connectionError}
          onAction={() => void profileQuery.refetch()}
          title={t('reliability.profileTitle')}
          tone="error"
        />
      </Screen>
    );
  }

  if (!profileQuery.data) {
    return (
      <Screen edges={['top', 'left', 'right']} style={styles.centered}>
        <View style={styles.emptyIcon}>
          <IllustratedIcon size={58} source={illustratedIcons.profileEdit} />
        </View>
        <Text style={styles.emptyTitle}>프로필이 아직 준비되지 않았어요.</Text>
        <Text style={styles.emptyText}>WICHU를 이용하려면 프로필 설정을 완료해주세요.</Text>
        <Pressable
          accessibilityLabel="프로필 완성하기"
          accessibilityRole="button"
          onPress={() => router.push('/profile-setup')}
          style={styles.emptyAction}
        >
          <Text style={styles.emptyActionText}>프로필 완성하기</Text>
        </Pressable>
      </Screen>
    );
  }

  const { details, interests, photos, profile, settings, tags: profileTags } = profileQuery.data;
  // 서버는 점수만 주고 무엇이 비었는지는 알려주지 않는다. 같은 규칙으로 다시 판정한다.
  const completion = getProfileCompletion(profile);
  const reviewStatus = profileReviewStatus ?? profile.review_status;
  const primaryPhoto = photos[0];
  const photosUnderReview = photos.filter((photo) => photo.reviewStatus === 'pending').length;
  const rejectedPhotos = photos.filter((photo) => photo.reviewStatus === 'rejected');
  const primaryPhotoUnderReview = primaryPhoto?.reviewStatus === 'pending';
  const interestLabels = interests.map(
    (interest) => INTEREST_LABELS[interest.label] ?? interest.label,
  );
  const tags = profileTags.map((tag) => TAG_LABELS[tag.value] ?? tag.value);
  const tier = entitlement.data?.tier ?? 'free';
  const tierLabel = tier === 'gold' ? 'Gold Pass' : tier === 'ad_free' ? 'Ad-Free' : 'Free';
  const isDiscoverable = settings?.discovery_enabled ?? true;
  const previewTags = [
    details?.personality_type,
    details?.occupation,
    ...tags,
    ...interestLabels.map((item) => `# ${item}`),
  ]
    .filter((item): item is string => Boolean(item))
    .slice(0, 3);
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
    } catch {
      setPhotoRepairError(t('reliability.profileBody'));
    } finally {
      setPhotoRepairing(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <AppTabHeader
        actionAccessibilityLabel="설정 열기"
        actionIcon={illustratedIcons.settings}
        eyebrow="내 프로필"
        onAction={() => router.push('/settings')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeroHeader}>
          <View style={styles.profileHeroHeading}>
            <Text style={styles.profileHeroEyebrow}>WICHU PROFILE</Text>
            <Text style={styles.profileHeroTitle}>{t('experience.profile.publicProfile')}</Text>
            <Text style={styles.profileHeroAccount}>공개 사진과 프로필 정보를 관리합니다</Text>
          </View>
          <Pressable
            accessibilityLabel="프로필 수정"
            accessibilityRole="button"
            onPress={() => router.push('/profile-edit')}
            style={({ pressed }) => [styles.profileEditAction, pressed && styles.pressed]}
          >
            <Ionicons color={palette.white} name="pencil" size={14} />
            <Text style={styles.profileEditActionText}>수정</Text>
          </Pressable>
        </View>

        <View>
          <Pressable
            accessibilityHint="상대방에게 보이는 전체 프로필을 확인합니다"
            accessibilityLabel="내 공개 프로필 전체 미리보기"
            accessibilityRole="button"
            onPress={() => router.push('/profile-preview')}
            style={({ pressed }) => [
              styles.profilePreview,
              tier === 'gold' && styles.profilePreviewGold,
              pressed && styles.previewPressed,
            ]}
          >
            {primaryPhoto ? (
              <Image
                blurRadius={primaryPhotoUnderReview ? 16 : 0}
                cachePolicy="memory-disk"
                contentPosition="center"
                source={{ uri: primaryPhoto.uri }}
                style={styles.previewImage}
              />
            ) : (
              <LinearGradient colors={['#DDDDE3', '#BDBEC7']} style={styles.previewPlaceholder}>
                <View style={styles.previewPlaceholderIcon}>
                  <IllustratedIcon size={48} source={illustratedIcons.profilePhotos} />
                </View>
                <Text style={styles.previewPlaceholderTitle}>
                  {photosUnderReview ? '사진 확인 중' : '대표 사진이 필요해요'}
                </Text>
                <Text style={styles.previewPlaceholderText}>
                  {photosUnderReview > 0
                    ? '승인 전에는 공개 사진이 제한돼요'
                    : '사진을 1장 이상 추가해주세요'}
                </Text>
              </LinearGradient>
            )}
            <LinearGradient
              colors={['rgba(10,10,14,0.04)', 'rgba(10,10,14,0.1)', 'rgba(10,10,14,0.9)']}
              locations={[0, 0.48, 1]}
              style={styles.previewGradient}
            />
            {photosUnderReview > 0 ? (
              <View style={styles.previewReviewBadge}>
                <IllustratedIcon size={18} source={illustratedIcons.photoReview} />
                <Text style={styles.previewReviewText}>{photosUnderReview}장 심사 중</Text>
              </View>
            ) : null}
            <View style={styles.previewModeBadge}>
              <IllustratedIcon size={18} source={illustratedIcons.discoveryVisible} />
              <Text style={styles.previewModeText}>전체 미리보기</Text>
            </View>
            <View style={styles.previewCopy}>
              <View style={styles.previewNameRow}>
                <Text style={styles.previewName}>
                  {profile.display_name}, {getProfileAge(profile.birth_date)}
                </Text>
                <CountryFlag
                  compact
                  countryCode={profile.country_code}
                  style={styles.previewFlag}
                />
                {tier === 'gold' ? (
                  <IllustratedIcon
                    size={27}
                    source={illustratedIcons.goldPremium}
                    style={styles.previewDiamond}
                  />
                ) : null}
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
          </Pressable>
        </View>

        {photosUnderReview > 0 ? (
          <View style={styles.pendingNotice}>
            <View style={styles.pendingNoticeIcon}>
              <IllustratedIcon size={38} source={illustratedIcons.photoReview} />
            </View>
            <View style={styles.pendingNoticeCopy}>
              <Text style={styles.pendingNoticeTitle}>
                새 사진 {photosUnderReview}장을 확인하고 있어요
              </Text>
              <Text style={styles.pendingNoticeText}>
                기존 승인 사진과 프로필 정보는 그대로 공개되고, 새 사진만 승인 전까지 제한돼요.
              </Text>
            </View>
          </View>
        ) : null}

        {rejectedPhotos.length > 0 ? (
          <View style={styles.reviewNotice}>
            <IllustratedIcon size={34} source={illustratedIcons.photoRejected} />
            <View style={styles.reviewNoticeCopy}>
              <Text style={styles.reviewNoticeTitle}>반려된 사진이 있어요</Text>
              <Text style={styles.reviewNoticeText}>
                {rejectedPhotos[0]?.reviewNote ?? '사진 기준을 확인한 뒤 해당 사진을 교체해주세요.'}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.statusStrip}>
          <StatusCell
            illustration={illustratedIcons.discoveryVisible}
            label="발견 노출"
            tone={isDiscoverable ? 'green' : 'neutral'}
            value={isDiscoverable ? '켜짐' : '꺼짐'}
          />
          <View style={styles.statusDivider} />
          <StatusCell
            illustration={illustratedIcons.photoReview}
            label="사진 상태"
            tone={
              photosUnderReview > 0
                ? 'amber'
                : rejectedPhotos.length > 0
                  ? 'neutral'
                  : reviewStatus === 'approved'
                    ? 'green'
                    : 'neutral'
            }
            value={
              photosUnderReview > 0
                ? `${photosUnderReview}장 확인 중`
                : rejectedPhotos.length > 0
                  ? `${rejectedPhotos.length}장 반려`
                  : shortReviewLabel(reviewStatus)
            }
          />
          <View style={styles.statusDivider} />
          <StatusCell
            illustration={getPassIllustration(tier)}
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
                    : completion.missing.length
                      ? `${completion.missing.length}개 항목만 채우면 완성돼요`
                      : '미입력 프로필 항목이 있어요'}
                </Text>
              </View>
              <Text style={styles.attentionValue}>{profile.profile_completeness}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${profile.profile_completeness}%` }]} />
            </View>
            {completion.missing.length ? (
              <View style={styles.missingList}>
                {completion.missing.map((item) => (
                  <Pressable
                    accessibilityHint="프로필 수정 화면의 해당 항목으로 이동합니다"
                    accessibilityLabel={`${item.label} 입력하기`}
                    accessibilityRole="button"
                    key={item.key}
                    onPress={() => router.push(`/profile-edit?section=${item.section}`)}
                    style={({ pressed }) => [styles.missingChip, pressed && pressFeedback.control]}
                  >
                    <Ionicons color={palette.pink} name="add-circle" size={15} />
                    <Text style={styles.missingLabel}>{item.label}</Text>
                    <Text style={styles.missingPoints}>+{item.points}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {!photos.length ? (
              <Pressable
                accessibilityLabel="사진 추가하기"
                accessibilityRole="button"
                accessibilityState={{ busy: photoRepairing, disabled: photoRepairing }}
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

        <View>
          <View style={styles.managementHeading}>
            <Text style={styles.groupTitle}>관리</Text>
            <Text style={styles.groupHint}>프로필, 탐색 조건과 이용권을 설정해요</Text>
          </View>
          <View style={styles.quickGrid}>
            <QuickAction
              detail="사진 · 소개 · 관심사"
              illustration={illustratedIcons.profileEdit}
              label="프로필 수정"
              onPress={() => router.push('/profile-edit')}
            />
            <QuickAction
              detail="연령 · 국가 · 거리"
              illustration={illustratedIcons.discoverySettings}
              label="탐색 설정"
              onPress={() => router.push('/settings')}
            />
            <QuickAction
              detail="픽 · 매치 · 방문자"
              illustration={illustratedIcons.connections}
              label="연결 관리"
              onPress={() => router.push('/(tabs)/matches')}
            />
            {MONETIZATION_ENABLED ? (
              <QuickAction
                detail={tierLabel}
                illustration={getPassIllustration(tier)}
                label="이용권"
                onPress={() => router.push('/(tabs)/shop')}
              />
            ) : null}
          </View>
        </View>

        <View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile-preview')}
            style={({ pressed }) => [styles.detailsToggle, pressed && styles.pressed]}
          >
            <View style={styles.detailsToggleIcon}>
              <IllustratedIcon size={30} source={illustratedIcons.discoveryVisible} />
            </View>
            <View style={styles.detailsToggleCopy}>
              <Text style={styles.detailsTitle}>공개 프로필 전체 보기</Text>
              <Text style={styles.detailsHint}>상대방에게 보이는 실제 순서로 확인해요</Text>
            </View>
            <Ionicons color={palette.inkMuted} name="chevron-forward" size={19} />
          </Pressable>
          <Pressable
            accessibilityLabel="계정 및 개인정보 설정"
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.settingsAction, pressed && styles.pressed]}
          >
            <View style={styles.settingsIcon}>
              <IllustratedIcon size={46} source={illustratedIcons.settings} />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={styles.settingsTitle}>계정 및 개인정보 설정</Text>
              <Text style={styles.settingsText}>알림, 안전 및 계정 관리</Text>
            </View>
            <Ionicons color={palette.inkMuted} name="chevron-forward" size={19} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatusCell({
  illustration,
  label,
  tone = 'neutral',
  value,
}: {
  illustration: ImageSource;
  label: string;
  tone?: 'amber' | 'gold' | 'green' | 'neutral';
  value: string;
}) {
  const color =
    tone === 'gold'
      ? '#9A7000'
      : tone === 'green'
        ? '#16895A'
        : tone === 'amber'
          ? '#A36B00'
          : palette.ink;
  return (
    <View style={styles.statusCell}>
      <IllustratedIcon size={28} source={illustration} />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.statusValue, { color }]}>
        {value}
      </Text>
    </View>
  );
}

function QuickAction({
  detail,
  illustration,
  label,
  onPress,
}: {
  detail: string;
  illustration: ImageSource;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={styles.quickIcon}>
        <IllustratedIcon size={52} source={illustration} />
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

/** 실제 Me 화면과 같은 골격(헤더 → 미리보기 카드 → 섹션)으로 그려 로딩 후 위치가 유지된다. */
function MeSkeleton() {
  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <AppTabHeader actionIcon={illustratedIcons.settings} eyebrow="내 프로필" />
      <View
        accessibilityLabel="프로필을 불러오는 중"
        accessibilityRole="progressbar"
        style={styles.content}
      >
        <SkeletonLine height={11} width={92} />
        <SkeletonLine height={24} style={{ marginTop: 8 }} width="58%" />
        <SkeletonLine height={12} style={{ marginTop: 8 }} width="72%" />
        <Skeleton style={styles.skeletonPreview} />
        <ListRowsSkeleton count={3} height={68} />
      </View>
    </Screen>
  );
}

function shortReviewLabel(status: ReviewStatus) {
  if (status === 'approved') return '승인 완료';
  if (status === 'rejected') return '수정 필요';
  if (status === 'pending') return '심사 중';
  return '작성 중';
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  content: { paddingBottom: 34, paddingHorizontal: 16 },
  skeletonPreview: { borderRadius: 26, height: 294, marginBottom: 18, marginTop: 14 },
  profileHeroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileHeroHeading: { flex: 1, minWidth: 0, paddingRight: 12 },
  profileHeroEyebrow: {
    color: palette.pink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  profileHeroTitle: { ...typography.title, color: palette.ink, marginTop: 3 },
  profileHeroAccount: { color: palette.inkMuted, fontSize: 12, marginTop: 4 },
  profileEditAction: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  profileEditActionText: { color: palette.white, fontSize: 11, fontWeight: '900' },
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
  reviewNoticeText: { color: palette.ink, fontSize: 12, lineHeight: 18, marginTop: 3 },
  pendingNotice: {
    alignItems: 'flex-start',
    backgroundColor: palette.white,
    borderColor: '#E8D9A9',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    marginTop: 10,
    padding: 14,
  },
  pendingNoticeIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF3C9',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pendingNoticeCopy: { flex: 1 },
  pendingNoticeTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  pendingNoticeText: { color: palette.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  statusStrip: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: 10,
    minHeight: 68,
    paddingHorizontal: 7,
  },
  statusCell: { alignItems: 'center', flex: 1, minWidth: 0 },
  statusDivider: { backgroundColor: '#E5E5E9', height: 31, width: StyleSheet.hairlineWidth },
  statusLabel: { color: palette.inkMuted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  statusValue: { fontSize: 11, fontWeight: '900', marginTop: 1, maxWidth: '92%' },
  attentionCard: {
    backgroundColor: palette.white,
    borderColor: '#E5E5E9',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    padding: 16,
  },
  attentionTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  attentionCopy: { flex: 1, paddingRight: 10 },
  attentionEyebrow: { color: palette.pink, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  attentionTitle: { color: palette.ink, fontSize: 13, fontWeight: '900', marginTop: 5 },
  attentionValue: { color: palette.pink, fontSize: 23, fontWeight: '900' },
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
  attentionActionText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  missingList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  missingChip: {
    alignItems: 'center',
    backgroundColor: '#FFF1F5',
    borderColor: '#FFD3E0',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 11,
  },
  missingLabel: { ...typography.caption, color: palette.ink, fontWeight: '800' },
  missingPoints: { ...typography.overline, color: palette.pink, letterSpacing: 0.3 },
  progressTrack: {
    backgroundColor: '#E8E8EC',
    borderRadius: 3,
    height: 5,
    marginTop: 15,
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: palette.pink, borderRadius: 3, height: '100%' },
  groupTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  groupHint: { color: palette.inkMuted, fontSize: 12, marginTop: 3 },
  managementHeading: { marginTop: 20, paddingHorizontal: 2 },
  quickGrid: {
    backgroundColor: '#DCDCE1',
    borderRadius: 22,
    gap: StyleSheet.hairlineWidth,
    marginTop: 10,
    overflow: 'hidden',
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: palette.white,
    flexDirection: 'row',
    minHeight: 78,
    paddingHorizontal: 12,
    width: '100%',
  },
  quickIcon: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  quickCopy: { flex: 1, marginLeft: 9, minWidth: 0 },
  quickLabel: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  quickDetail: { color: palette.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  profilePreview: {
    backgroundColor: '#D8D8DE',
    borderRadius: 26,
    height: 294,
    marginTop: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  profilePreviewGold: { borderColor: '#DCAF2D', borderWidth: 2 },
  previewPressed: { opacity: 0.92 },
  previewImage: { height: '100%', width: '100%' },
  previewPlaceholder: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  previewPlaceholderIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.22)',
    borderRadius: 22,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  previewPlaceholderTitle: { color: palette.white, fontSize: 13, fontWeight: '900', marginTop: 11 },
  previewPlaceholderText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
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
  previewReviewText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  previewModeBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,19,0.46)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    right: 13,
    top: 13,
  },
  previewModeText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  previewCopy: { bottom: 18, left: 18, position: 'absolute', right: 18 },
  previewNameRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  previewName: { ...typography.title, color: palette.white },
  previewFlag: { borderRadius: 4, height: 15, width: 22 },
  previewDiamond: { marginLeft: 3 },
  previewBio: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    maxWidth: '90%',
  },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  previewTag: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    color: palette.white,
    fontSize: 11,
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
    marginTop: 12,
    minHeight: 72,
    paddingHorizontal: 14,
  },
  detailsToggleIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  detailsToggleCopy: { flex: 1, marginLeft: 11 },
  detailsTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  detailsHint: { color: palette.inkMuted, fontSize: 11, marginTop: 3 },
  pressed: { opacity: 0.68 },
  photoRepairError: { color: palette.danger, fontSize: 10, lineHeight: 15 },
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
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  settingsCopy: { flex: 1 },
  settingsTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  settingsText: { color: palette.inkMuted, fontSize: 11, marginTop: 3 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE5EE',
    borderRadius: 28,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyTitle: { ...typography.heading, color: palette.ink, marginTop: 15 },
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
});
