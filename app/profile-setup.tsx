import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { ConsentRow } from '@/components/ConsentRow';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { palette, radius } from '@/constants/theme';
import { isAdult, isValidBirthDate } from '@/features/auth/utils/age';
import { formatBirthDateInput } from '@/features/auth/utils/format-birth-date';
import { AgeRangeField } from '@/features/profile/components/AgeRangeField';
import { CountryPickerField } from '@/features/profile/components/CountryPickerField';
import { LanguagePreferencesField } from '@/features/profile/components/LanguagePreferencesField';
import { ProfileAdditionalInfoFields } from '@/features/profile/components/ProfileAdditionalInfoFields';
import { ProfilePhotoPicker } from '@/features/profile/components/ProfilePhotoPicker';
import { ProfileReviewState } from '@/features/profile/components/ProfileReviewState';
import { ProfileTagPicker } from '@/features/profile/components/ProfileTagPicker';
import { EMPTY_PROFILE_TAG_SELECTIONS } from '@/features/profile/constants/profile-tags';
import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { profileService } from '@/features/profile/services/profile-service';
import type { ProfilePhotoDraft } from '@/features/profile/types/profile-photo';
import {
  EMPTY_PROFILE_DETAILS,
  type ProfileDetails,
} from '@/features/profile/types/profile-details';
import type { SpokenLanguage } from '@/features/profile/types/language';
import type { ProfileTagSelections } from '@/features/profile/types/profile-tag';
import { useAuthSession } from '@/hooks/use-auth-session';

const TOTAL_STEPS = 4;
const GENDER_VALUES = ['woman', 'man', 'nonbinary', 'other'] as const;

type Gender = (typeof GENDER_VALUES)[number];
type SetupStep = 0 | 1 | 2 | 3 | 4;
type FormSection = 'basic' | 'additional' | 'preferences' | 'about' | 'photos';

function getFormSection(step: SetupStep, editMode: boolean): FormSection {
  if (editMode) {
    if (step === 0) return 'basic';
    if (step === 1) return 'additional';
    if (step === 2) return 'preferences';
    if (step === 3) return 'about';
    return 'photos';
  }

  if (step === 0) return 'basic';
  if (step === 1) return 'preferences';
  if (step === 2) return 'about';
  return 'photos';
}

const EDIT_SECTIONS: {
  key: SetupStep;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}[] = [
  {
    key: 0,
    label: '기본',
    icon: 'person-outline',
    title: '기본 정보',
    body: '이름, 생년월일, 성별, 국적과 프로필 기본정보를 관리해요.',
  },
  {
    key: 1,
    label: '추가',
    icon: 'id-card-outline',
    title: '추가 정보',
    body: '성격과 라이프스타일 중 원하는 항목만 공개해요.',
  },
  {
    key: 2,
    label: '취향',
    icon: 'options-outline',
    title: '탐색 취향',
    body: '만나고 싶은 사람과 관심사를 설정해요.',
  },
  {
    key: 3,
    label: '소개',
    icon: 'chatbubbles-outline',
    title: '소개와 언어',
    body: '나를 설명하는 키워드와 대화 언어를 관리해요.',
  },
  {
    key: 4,
    label: '사진',
    icon: 'images-outline',
    title: '프로필 사진',
    body: '대표 사진과 공개 사진의 순서를 관리해요.',
  },
];

const ONBOARDING_SECTIONS: readonly {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { icon: 'person-outline', label: '기본 정보' },
  { icon: 'options-outline', label: '만남 취향' },
  { icon: 'chatbubbles-outline', label: '소개와 언어' },
  { icon: 'images-outline', label: '프로필 사진' },
];

type ProfileFormMode = 'onboarding' | 'edit';

function ProfileFormScreen({ mode }: { mode: ProfileFormMode }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const requestedEditMode = mode === 'edit';
  const { session, refreshProfile, profileReviewStatus, profileReviewNote } = useAuthSession();
  const scrollRef = useRef<ScrollView>(null);
  const suggestedBirthDate = session?.user.user_metadata.birth_date;
  const [step, setStep] = useState<SetupStep>(0);
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState(
    typeof suggestedBirthDate === 'string' && isValidBirthDate(suggestedBirthDate)
      ? suggestedBirthDate
      : '',
  );
  const [gender, setGender] = useState<Gender | null>(null);
  const [interestedIn, setInterestedIn] = useState<Gender[]>([]);
  const [countryCode, setCountryCode] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [spokenLanguages, setSpokenLanguages] = useState<SpokenLanguage[]>([]);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(29);
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);
  const [profileTags, setProfileTags] = useState<ProfileTagSelections>(
    EMPTY_PROFILE_TAG_SELECTIONS,
  );
  const [profileDetails, setProfileDetails] = useState<ProfileDetails>(EMPTY_PROFILE_DETAILS);
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState<ProfilePhotoDraft[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profileHydrated, setProfileHydrated] = useState(false);

  const {
    data: interestOptions = [],
    isLoading: interestsLoading,
    error: interestsError,
  } = useQuery({
    queryKey: ['profile-setup', 'interests'],
    enabled: Boolean(session),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await profileService.getInterests();
      if (error) throw error;
      return data;
    },
  });
  const existingProfileQuery = useQuery({
    queryKey: ['profile-setup', 'existing', session?.user.id],
    enabled: Boolean(session),
    staleTime: 15_000,
    queryFn: () => profileService.getMyOperationalProfile(session!.user.id),
  });
  const isEditingProfile = requestedEditMode && Boolean(existingProfileQuery.data?.profile);
  const activeEditSection = EDIT_SECTIONS[step];
  const activeSection = getFormSection(step, requestedEditMode);

  useEffect(() => {
    const existing = existingProfileQuery.data;
    if (!existing || profileHydrated) return;
    queueMicrotask(() => {
      const { details, profile, interests, languages, settings, tags } = existing;
      setDisplayName(profile.display_name);
      setBirthDate(profile.birth_date);
      setGender(profile.gender as Gender);
      setInterestedIn(profile.interested_in as Gender[]);
      setCountryCode(profile.country_code);
      setNativeLanguage(profile.native_language ?? '');
      setSpokenLanguages(
        languages.map((language) => ({
          code: language.language_code,
          level: language.proficiency as SpokenLanguage['level'],
        })),
      );
      setMinAge(settings?.min_age ?? 18);
      setMaxAge(settings?.max_age ?? 29);
      setSelectedInterestIds(interests.map((interest) => interest.id));
      setProfileTags(
        tags.reduce<ProfileTagSelections>(
          (selection, tag) => ({
            ...selection,
            [tag.category]: [...selection[tag.category as keyof ProfileTagSelections], tag.value],
          }),
          { connection_goal: [], vibe: [], daily_rhythm: [], communication_style: [] },
        ),
      );
      setProfileDetails({
        occupation: details?.occupation ?? '',
        educationLevel: (details?.education_level as ProfileDetails['educationLevel']) ?? null,
        heightCm: details?.height_cm ?? null,
        personalityType: details?.personality_type ?? null,
        drinking: (details?.drinking as ProfileDetails['drinking']) ?? null,
        smoking: (details?.smoking as ProfileDetails['smoking']) ?? null,
        exercise: (details?.exercise as ProfileDetails['exercise']) ?? null,
        pets: (details?.pets as ProfileDetails['pets']) ?? null,
      });
      setBio(profile.bio);
      setPhotos(
        profile.profile_photos.map((photo) => ({
          assetId: photo.id,
          draftId: `stored:${photo.id}`,
          fileName: photo.storage_path.split('/').pop() ?? photo.id,
          fileSize: 0,
          height: 1200,
          mimeType: 'image/jpeg',
          storagePath: photo.storage_path,
          reviewStatus: photo.review_status ?? profile.review_status,
          type: 'image',
          uri: photo.signed_url,
          width: 960,
        })),
      );
      setConsented(true);
      setProfileHydrated(true);
    });
  }, [existingProfileQuery.data, profileHydrated]);

  const languageList = [nativeLanguage, ...spokenLanguages.map((language) => language.code)].filter(
    Boolean,
  );

  const genderOptions = GENDER_VALUES.map((value) => ({
    value,
    label: t(`profileSetup.gender.${value}`),
  }));
  const interestSelections = interestOptions.map((interest) => ({
    value: interest.id,
    label: t(`profileSetup.interests.${interest.slug}`, { defaultValue: interest.label }),
  }));

  function toggleValue(value: string, current: string[], update: (next: string[]) => void) {
    update(
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function goToStep(nextStep: SetupStep) {
    setStep(nextStep);
    setMessage(null);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === 'web') window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  function getStepError(targetStep: SetupStep) {
    const targetSection = getFormSection(targetStep, requestedEditMode);

    if (targetSection === 'basic') {
      if (displayName.trim().length < 2) return t('profileSetup.errors.displayName');
      if (!isAdult(birthDate)) return t('profileSetup.errors.birthDate');
      if (!gender) return t('profileSetup.errors.gender');
      if (!countryCode) return t('profileSetup.errors.country');
      if (
        profileDetails.heightCm !== null &&
        (profileDetails.heightCm < 120 || profileDetails.heightCm > 220)
      ) {
        return '키는 120~220cm 사이로 입력해주세요.';
      }
    }

    if (targetSection === 'preferences') {
      if (interestedIn.length === 0) return t('profileSetup.errors.interestedIn');
      if (minAge < 18 || maxAge > 90 || minAge > maxAge) return t('profileSetup.errors.ageRange');
      if (interestsError) return t('profileSetup.errors.interestsLoad');
      if (selectedInterestIds.length < 3) return t('profileSetup.errors.interests');
    }

    if (targetSection === 'about') {
      if (profileTags.connection_goal.length === 0) return t('profileSetup.errors.connectionGoal');
      if (profileTags.vibe.length === 0) return t('profileSetup.errors.vibe');
      if (!nativeLanguage) return t('profileSetup.errors.nativeLanguage');
    }

    if (targetSection === 'photos') {
      if (photos.length === 0) return t('profileSetup.errors.photos');
      if (!requestedEditMode && !consented) return t('profileSetup.errors.consent');
    }

    return null;
  }

  function continueSetup() {
    const error = getStepError(step);
    if (error) return setMessage(error);
    goToStep((step + 1) as SetupStep);
  }

  async function saveProfile() {
    if (!session) return;

    const stepsToValidate: SetupStep[] = requestedEditMode ? [0, 1, 2, 3, 4] : [0, 1, 2, 3];
    for (const targetStep of stepsToValidate) {
      const error = getStepError(targetStep);
      if (error) {
        goToStep(targetStep);
        setMessage(error);
        return;
      }
    }

    setLoading(true);
    setMessage(null);
    let saveStage: 'profile' | 'details' | 'photos' | 'review' = 'profile';
    let uploadedPaths: string[] = [];
    try {
      if (requestedEditMode) {
        saveStage = 'details';
        const { error: detailError } = await profileService.upsertMyDetails(
          session.user.id,
          profileDetails,
        );
        if (detailError) throw detailError;
      }

      saveStage = 'photos';
      const stagedPhotos = await profilePhotoService.stageNewPhotos(
        session.user.id,
        photos,
        (completed, total) => {
          setUploadProgress({ completed, total });
        },
      );
      uploadedPaths = stagedPhotos.uploadedPaths;

      saveStage = 'review';
      const tags = Object.entries(profileTags).flatMap(([category, values]) =>
        values.map((value) => ({ category: category as keyof ProfileTagSelections, value })),
      );
      const { data: obsoletePaths, error } = await profileService.saveForReview({
        displayName: displayName.trim(),
        birthDate,
        gender: gender!,
        interestedIn,
        countryCode: countryCode.toUpperCase(),
        nativeLanguage,
        languages: languageList,
        bio: bio.trim(),
        minAge,
        maxAge,
        locale: i18n.resolvedLanguage ?? i18n.language ?? 'ko',
        interestIds: selectedInterestIds,
        spokenLanguages,
        tags,
        photoPaths: stagedPhotos.orderedPaths,
      });
      if (error) throw error;
      if (obsoletePaths?.length) {
        await profilePhotoService.removeStorageFiles(obsoletePaths);
      }

      uploadedPaths = [];
      await refreshProfile().catch(() => undefined);
      router.replace('/(tabs)/me');
    } catch (error) {
      if (uploadedPaths.length > 0) {
        await profilePhotoService.removeStorageFiles(uploadedPaths);
      }
      setMessage(getProfileSaveError(error, saveStage));
    } finally {
      setUploadProgress(null);
      setLoading(false);
    }
  }

  function getProfileSaveError(error: unknown, stage: 'profile' | 'details' | 'photos' | 'review') {
    const serverError = error as { code?: string; message?: string } | null;
    const code = serverError?.code ?? '';
    const detail = serverError?.message ?? '';

    if (code === '42P01' || code === 'PGRST205' || detail.includes('schema cache')) {
      return t('profileSetup.errors.serverUpdate');
    }
    if (detail.includes('main profile photo')) return t('profileSetup.errors.mainPhoto');
    if (detail.includes('required profile fields')) return t('profileSetup.errors.requiredFields');
    return t(`profileSetup.errors.saveStages.${stage}`);
  }

  if (requestedEditMode && existingProfileQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.editState}>
          <ActivityIndicator color={palette.pink} size="small" />
          <Text style={styles.editStateTitle}>프로필을 불러오는 중이에요</Text>
          <Text style={styles.editStateBody}>저장된 정보를 안전하게 준비하고 있어요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (requestedEditMode && existingProfileQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.editState}>
          <View style={styles.editStateIcon}>
            <Ionicons color={palette.pink} name="cloud-offline-outline" size={26} />
          </View>
          <Text style={styles.editStateTitle}>프로필을 불러오지 못했어요</Text>
          <Text style={styles.editStateBody}>
            잠시 후 다시 시도하거나 마이페이지로 돌아가 주세요.
          </Text>
          <View style={styles.editStateActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(tabs)/me')}
              style={styles.editStateSecondaryButton}
            >
              <Text style={styles.editStateSecondaryLabel}>돌아가기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => existingProfileQuery.refetch()}
              style={styles.editStatePrimaryButton}
            >
              <Text style={styles.editStatePrimaryLabel}>다시 시도</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (profileReviewStatus === 'pending' && !requestedEditMode) {
    return (
      <ProfileReviewState
        status="pending"
        onBrowse={() => router.replace('/(tabs)/discover')}
        onRefresh={refreshProfile}
        onEdit={() => router.push('/profile-edit')}
      />
    );
  }

  if (profileReviewStatus === 'rejected' && !requestedEditMode) {
    return (
      <ProfileReviewState
        status="rejected"
        note={profileReviewNote}
        onBrowse={() => router.replace('/(tabs)/discover')}
        onEdit={() => router.push('/profile-edit')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.header}>
            {isEditingProfile ? (
              <>
                <View style={styles.editHeaderTopRow}>
                  <Pressable
                    accessibilityLabel="프로필 수정 뒤로가기"
                    accessibilityRole="button"
                    onPress={() => router.replace('/(tabs)/me')}
                    style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                  >
                    <Ionicons color={palette.ink} name="chevron-back" size={22} />
                  </Pressable>
                  <Text style={styles.editTitle}>프로필 편집</Text>
                  <Pressable
                    accessibilityLabel="내 공개 프로필 미리보기"
                    accessibilityRole="button"
                    onPress={() => router.push('/profile-preview')}
                    style={({ pressed }) => [styles.previewButton, pressed && styles.pressed]}
                  >
                    <Ionicons color={palette.ink} name="eye-outline" size={20} />
                  </Pressable>
                </View>
                <View accessibilityRole="tablist" style={styles.editTabs}>
                  {EDIT_SECTIONS.map((section) => {
                    const selected = section.key === step;
                    return (
                      <Pressable
                        key={section.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        onPress={() => goToStep(section.key)}
                        style={({ pressed }) => [
                          styles.editTab,
                          selected && styles.editTabSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[styles.editTabLabel, selected && styles.editTabLabelSelected]}
                        >
                          {section.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.editSectionHeading}>
                  <Text style={styles.editSectionEyebrow}>
                    {String(step + 1).padStart(2, '0')} /{' '}
                    {String(EDIT_SECTIONS.length).padStart(2, '0')}
                  </Text>
                  <Text style={styles.editSectionTitle}>{activeEditSection.title}</Text>
                  <Text style={styles.editSectionBody}>{activeEditSection.body}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.headerTopRow}>
                  <BrandWordmark color={palette.ink} size={24} />
                  <Text style={styles.stepCounter}>
                    <Text style={styles.stepCounterCurrent}>
                      {String(step + 1).padStart(2, '0')}
                    </Text>
                    {'  /  '}
                    {String(TOTAL_STEPS).padStart(2, '0')}
                  </Text>
                </View>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: step + 1 }}
                  style={styles.progressTrack}
                >
                  <View
                    style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]}
                  />
                </View>
                <View style={styles.onboardingStepBadge}>
                  <Ionicons color={palette.pink} name={ONBOARDING_SECTIONS[step].icon} size={14} />
                  <Text style={styles.onboardingStepText}>{ONBOARDING_SECTIONS[step].label}</Text>
                </View>
                <Text style={styles.title}>{t(`profileSetup.steps.${step}.title`)}</Text>
                <Text style={styles.subtitle}>{t(`profileSetup.steps.${step}.body`)}</Text>
              </>
            )}
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {activeSection === 'basic' ? (
              <View style={styles.form}>
                <FormField
                  label={t('profileSetup.displayName')}
                  value={displayName}
                  onChangeText={setDisplayName}
                  maxLength={50}
                  placeholder={t('profileSetup.displayNamePlaceholder')}
                  autoComplete="name"
                />
                <FormField
                  label={t('profileSetup.birthDate')}
                  value={birthDate}
                  onChangeText={(value) => setBirthDate(formatBirthDateInput(value))}
                  maxLength={10}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  placeholder="YYYY-MM-DD"
                  hint={t('profileSetup.birthDateHint')}
                />
                <SelectionGroup
                  label={t('profileSetup.genderLabel')}
                  options={genderOptions}
                  selected={gender ? [gender] : []}
                  onPress={(value) => setGender(value as Gender)}
                />
                <CountryPickerField value={countryCode} onSelect={setCountryCode} />
                {requestedEditMode ? (
                  <ProfileAdditionalInfoFields
                    section="basic"
                    value={profileDetails}
                    onChange={setProfileDetails}
                  />
                ) : null}
              </View>
            ) : null}

            {activeSection === 'additional' ? (
              <ProfileAdditionalInfoFields
                section="additional"
                value={profileDetails}
                onChange={setProfileDetails}
              />
            ) : null}

            {activeSection === 'preferences' ? (
              <View style={styles.form}>
                <SelectionGroup
                  label={t('profileSetup.showMe')}
                  hint={t('profileSetup.showMeHint')}
                  options={genderOptions}
                  selected={interestedIn}
                  multiple
                  onPress={(value) =>
                    toggleValue(value, interestedIn, (next) => setInterestedIn(next as Gender[]))
                  }
                />
                <AgeRangeField
                  minAge={minAge}
                  maxAge={maxAge}
                  onChangeMin={setMinAge}
                  onChangeMax={setMaxAge}
                />
                <SelectionGroup
                  label={t('profileSetup.interestsLabel')}
                  hint={t('profileSetup.interestsHint')}
                  options={interestSelections}
                  selected={selectedInterestIds}
                  multiple
                  loading={interestsLoading}
                  loadingLabel={t('profileSetup.interestsLoading')}
                  onPress={(value) =>
                    toggleValue(value, selectedInterestIds, setSelectedInterestIds)
                  }
                />
              </View>
            ) : null}

            {activeSection === 'about' ? (
              <View style={styles.form}>
                <ProfileTagPicker value={profileTags} onChange={setProfileTags} />
                <LanguagePreferencesField
                  nativeLanguage={nativeLanguage}
                  spokenLanguages={spokenLanguages}
                  onChangeNative={setNativeLanguage}
                  onChangeSpoken={setSpokenLanguages}
                />
                <FormField
                  label={t('profileSetup.bio')}
                  value={bio}
                  onChangeText={setBio}
                  placeholder={t('profileSetup.bioPlaceholder')}
                  multiline
                  maxLength={500}
                  hint={t('profileSetup.bioCount', { count: bio.length })}
                  style={styles.bioInput}
                  textAlignVertical="top"
                />
              </View>
            ) : null}

            {activeSection === 'photos' ? (
              <View style={styles.form}>
                <ProfilePhotoPicker
                  disabled={loading}
                  photos={photos}
                  uploadProgress={uploadProgress}
                  onChange={setPhotos}
                  onError={(value) => setMessage(value || null)}
                />
                {!requestedEditMode ? (
                  <View style={styles.consentBlock}>
                    <ConsentRow
                      checked={consented}
                      onPress={() => setConsented((value) => !value)}
                      label={t('profileSetup.consent')}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {message ? (
              <View style={styles.messageRow}>
                <Ionicons name="information-circle" size={17} color="#FF769F" />
                <Text style={styles.message}>{message}</Text>
              </View>
            ) : null}
            {isEditingProfile ? (
              <PrimaryButton label="변경사항 저장" loading={loading} onPress={saveProfile} />
            ) : (
              <View style={styles.actions}>
                {step > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={loading}
                    onPress={() => goToStep((step - 1) as SetupStep)}
                    style={({ pressed }) => [
                      styles.backButton,
                      pressed && styles.pressed,
                      loading && styles.disabled,
                    ]}
                  >
                    <Ionicons name="arrow-back" size={19} color={palette.ink} />
                    <Text style={styles.backLabel}>{t('profileSetup.back')}</Text>
                  </Pressable>
                ) : null}
                <View style={styles.primaryAction}>
                  <PrimaryButton
                    label={step === 3 ? t('profileSetup.complete') : t('profileSetup.continue')}
                    loading={loading}
                    disabled={interestsLoading && step === 1}
                    onPress={step === 3 ? saveProfile : continueSetup}
                  />
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

export default function ProfileSetupRoute() {
  return <ProfileFormScreen mode="onboarding" />;
}

export function ProfileEditScreen() {
  return <ProfileFormScreen mode="edit" />;
}

type SelectionOption = { value: string; label: string };

type SelectionGroupProps = {
  label: string;
  hint?: string;
  options: SelectionOption[];
  selected: string[];
  multiple?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  onPress: (value: string) => void;
};

function SelectionGroup({
  label,
  hint,
  options,
  selected,
  multiple,
  loading,
  loadingLabel,
  onPress,
}: SelectionGroupProps) {
  return (
    <View style={styles.choiceSection}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {loading ? <Text style={styles.loadingLabel}>{loadingLabel}</Text> : null}
      {!loading ? (
        <View style={styles.choices} accessibilityRole={multiple ? undefined : 'radiogroup'}>
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <Pressable
                key={option.value}
                accessibilityRole={multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: isSelected }}
                onPress={() => onPress(option.value)}
                style={({ pressed }) => [
                  styles.choice,
                  isSelected && styles.choiceSelected,
                  pressed && styles.pressed,
                ]}
              >
                {isSelected ? <Ionicons name="checkmark" size={14} color={palette.pink} /> : null}
                <Text style={[styles.choiceLabel, isSelected && styles.choiceLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F6F8',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    maxHeight: Platform.select({ web: 900 }),
    backgroundColor: '#F6F6F8',
  },
  flex: { flex: 1 },
  editState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
    paddingHorizontal: 28,
  },
  editStateIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE8EF',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    marginBottom: 16,
    width: 50,
  },
  editStateTitle: { color: palette.ink, fontSize: 17, fontWeight: '900', marginTop: 14 },
  editStateBody: {
    color: palette.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
  },
  editStateActions: { flexDirection: 'row', gap: 8, marginTop: 20 },
  editStateSecondaryButton: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  editStatePrimaryButton: {
    backgroundColor: palette.ink,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  editStateSecondaryLabel: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  editStatePrimaryLabel: { color: palette.white, fontSize: 12, fontWeight: '900' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editHeaderTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  editTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  previewButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  editTabs: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 2,
    marginTop: 18,
    padding: 4,
  },
  editTab: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  editTabSelected: {
    backgroundColor: '#FFF0F5',
  },
  editTabLabel: { color: palette.inkMuted, fontSize: 12, fontWeight: '800' },
  editTabLabelSelected: { color: palette.pink, fontWeight: '900' },
  editSectionHeading: { marginTop: 22 },
  editSectionEyebrow: {
    color: palette.pink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 5,
  },
  editSectionTitle: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  editSectionBody: { color: palette.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  stepCounter: { color: palette.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  stepCounterCurrent: { color: palette.pink, fontSize: 13 },
  progressTrack: {
    height: 3,
    marginTop: 20,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#DFDFE4',
  },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: palette.pink },
  onboardingStepBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0F5',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  onboardingStepText: { color: palette.pink, fontSize: 10, fontWeight: '900' },
  title: {
    marginTop: 14,
    color: palette.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  subtitle: { marginTop: 6, color: palette.inkMuted, fontSize: 13, lineHeight: 19 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  form: { gap: 22 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  hint: { marginTop: -2, color: palette.inkMuted, fontSize: 11, lineHeight: 16 },
  loadingLabel: { color: palette.inkMuted, fontSize: 12 },
  choiceSection: { gap: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
  choiceSelected: { borderColor: palette.pink, backgroundColor: 'rgba(255,45,111,0.08)' },
  choiceLabel: { color: palette.inkMuted, fontSize: 12, fontWeight: '800' },
  choiceLabelSelected: { color: palette.pink },
  bioInput: { minHeight: 104, paddingTop: 14 },
  consentBlock: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  footer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    backgroundColor: palette.white,
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  message: { flex: 1, color: palette.pink, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryAction: { flex: 1 },
  backButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  backLabel: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.64 },
  disabled: { opacity: 0.42 },
});
