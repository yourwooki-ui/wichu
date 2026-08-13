import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { ProfilePhotoPicker } from '@/features/profile/components/ProfilePhotoPicker';
import { ProfileReviewState } from '@/features/profile/components/ProfileReviewState';
import { ProfileTagPicker } from '@/features/profile/components/ProfileTagPicker';
import { EMPTY_PROFILE_TAG_SELECTIONS } from '@/features/profile/constants/profile-tags';
import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { profileService } from '@/features/profile/services/profile-service';
import type { ProfilePhotoDraft } from '@/features/profile/types/profile-photo';
import type { SpokenLanguage } from '@/features/profile/types/language';
import type { ProfileTagSelections } from '@/features/profile/types/profile-tag';
import { useAuthSession } from '@/hooks/use-auth-session';

const TOTAL_STEPS = 4;
const GENDER_VALUES = ['woman', 'man', 'nonbinary', 'other'] as const;

type Gender = (typeof GENDER_VALUES)[number];
type SetupStep = 0 | 1 | 2 | 3;

export default function ProfileSetupRoute() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
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
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState<ProfilePhotoDraft[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingRejected, setEditingRejected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    if (targetStep === 0) {
      if (displayName.trim().length < 2) return t('profileSetup.errors.displayName');
      if (!isAdult(birthDate)) return t('profileSetup.errors.birthDate');
      if (!gender) return t('profileSetup.errors.gender');
      if (!countryCode) return t('profileSetup.errors.country');
    }

    if (targetStep === 1) {
      if (interestedIn.length === 0) return t('profileSetup.errors.interestedIn');
      if (minAge < 18 || maxAge > 90 || minAge > maxAge) return t('profileSetup.errors.ageRange');
      if (interestsError) return t('profileSetup.errors.interestsLoad');
      if (selectedInterestIds.length < 3) return t('profileSetup.errors.interests');
    }

    if (targetStep === 2) {
      if (profileTags.connection_goal.length === 0) return t('profileSetup.errors.connectionGoal');
      if (profileTags.vibe.length === 0) return t('profileSetup.errors.vibe');
      if (!nativeLanguage) return t('profileSetup.errors.nativeLanguage');
    }

    if (targetStep === 3) {
      if (photos.length === 0) return t('profileSetup.errors.photos');
      if (!consented) return t('profileSetup.errors.consent');
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

    for (const targetStep of [0, 1, 2, 3] as SetupStep[]) {
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
    let hadExistingProfile = false;
    try {
      const { data, error: existingProfileError } = await profileService.getMyProfileCompletion(
        session.user.id,
      );
      if (existingProfileError) throw existingProfileError;
      hadExistingProfile = Boolean(data);

      const acceptedAt = new Date().toISOString();
      const profileValues = {
        id: session.user.id,
        display_name: displayName.trim(),
        birth_date: birthDate,
        gender: gender!,
        interested_in: interestedIn,
        country_code: countryCode.toUpperCase(),
        native_language: nativeLanguage,
        languages: languageList,
        bio: bio.trim(),
        terms_accepted_at: acceptedAt,
        privacy_accepted_at: acceptedAt,
        last_active_at: acceptedAt,
      };
      const { id: profileId, ...profileUpdates } = profileValues;
      const { error } = hadExistingProfile
        ? await profileService.updateMyProfile(profileId, profileUpdates)
        : await profileService.createMyProfile(profileValues);
      if (error) throw error;

      saveStage = 'details';
      await Promise.all([
        profileService.replaceMyInterests(session.user.id, selectedInterestIds),
        profileService.replaceMyTags(
          session.user.id,
          Object.entries(profileTags).flatMap(([category, values]) =>
            values.map((value) => ({
              category: category as keyof ProfileTagSelections,
              value,
            })),
          ),
        ),
        profileService.replaceMyLanguages(session.user.id, spokenLanguages),
        profileService.upsertMySettings({
          user_id: session.user.id,
          min_age: minAge,
          max_age: maxAge,
          locale: i18n.resolvedLanguage ?? i18n.language ?? 'en',
        }),
      ]);

      saveStage = 'photos';
      uploadedPaths = await profilePhotoService.uploadPhotos(
        session.user.id,
        photos,
        (completed, total) => {
          setUploadProgress({ completed, total });
        },
      );

      saveStage = 'review';
      const { error: reviewError } = await profileService.submitForReview();
      if (reviewError) throw reviewError;

      uploadedPaths = [];
      await refreshProfile().catch(() => undefined);
    } catch (error) {
      if (uploadedPaths.length > 0) {
        await profilePhotoService.removeUploadedPhotos(session.user.id, uploadedPaths);
      }
      if (!hadExistingProfile) await profileService.deleteMyProfile(session.user.id);
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

  if (profileReviewStatus === 'pending') {
    return (
      <ProfileReviewState
        status="pending"
        onBrowse={() => router.replace('/(tabs)/discover')}
        onRefresh={refreshProfile}
      />
    );
  }

  if (profileReviewStatus === 'rejected' && !editingRejected) {
    return (
      <ProfileReviewState
        status="rejected"
        note={profileReviewNote}
        onBrowse={() => router.replace('/(tabs)/discover')}
        onEdit={() => setEditingRejected(true)}
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
            <View style={styles.headerTopRow}>
              <BrandWordmark color={palette.ink} size={24} />
              <Text style={styles.stepCounter}>
                {step + 1} / {TOTAL_STEPS}
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
            <Text style={styles.title}>{t(`profileSetup.steps.${step}.title`)}</Text>
            <Text style={styles.subtitle}>{t(`profileSetup.steps.${step}.body`)}</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 0 ? (
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
              </View>
            ) : null}

            {step === 1 ? (
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

            {step === 2 ? (
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

            {step === 3 ? (
              <View style={styles.form}>
                <ProfilePhotoPicker
                  disabled={loading}
                  photos={photos}
                  uploadProgress={uploadProgress}
                  onChange={setPhotos}
                  onError={(value) => setMessage(value || null)}
                />
                <View style={styles.consentBlock}>
                  <ConsentRow
                    checked={consented}
                    onPress={() => setConsented((value) => !value)}
                    label={t('profileSetup.consent')}
                  />
                </View>
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
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
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
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepCounter: { color: palette.inkMuted, fontSize: 12, fontWeight: '900' },
  progressTrack: {
    height: 3,
    marginTop: 20,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#DFDFE4',
  },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: palette.pink },
  title: {
    marginTop: 22,
    color: palette.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  subtitle: { marginTop: 6, color: palette.inkMuted, fontSize: 13, lineHeight: 19 },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
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
    backgroundColor: '#F6F6F8',
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
