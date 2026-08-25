import { DISCOVER_PREPARE_COUNT } from '@/features/discover/constants';
import { reviewSamplesEnabled } from '@/constants/feature-flags';
import { getSupabaseClient } from '@/lib/supabase';
import { getRegionDisplayName } from '@/lib/display-names';
import type {
  Gender,
  Profile,
  ProfileLanguage,
  ProfileLanguageLevel,
  SwipeAction,
} from '@/types/profile';

export type DiscoveryFilters = {
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  genders: string[];
  countryCodes?: string[];
  excludeSameCountry: boolean;
  connectionGoals: string[];
};

const PHOTO_BUCKET = 'profile-photos';
const SIGNED_PHOTO_TTL_SECONDS = 60 * 60;

function isMissingProfileDetails(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
    (error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.message?.includes('profile_details')),
  );
}

type CandidateRow = {
  id: string;
  display_name: string;
  age: number;
  gender: string;
  country_code: string;
  native_language?: string | null;
  languages: string[];
  language_details?:
    | {
        code: string;
        level: string;
        is_native: boolean;
      }[]
    | null;
  bio: string;
  created_at: string;
  last_active_at: string | null;
  distance_km?: number | null;
  is_gold_pass?: boolean | null;
  photo_paths: string[];
  interests: string[];
};

export type DiscoveryPreferences = DiscoveryFilters & {
  viewerCountryCode?: string;
};

function isGender(value: string): value is Gender {
  return ['woman', 'man', 'nonbinary', 'other'].includes(value);
}

function isLanguageLevel(value: string): value is ProfileLanguageLevel {
  return ['native', 'beginner', 'intermediate', 'advanced', 'fluent'].includes(value);
}

const DEV_DISTANCE_BY_PROFILE_ID: Record<string, number> = {
  '10000000-0000-4000-8000-000000000001': 1154,
  '10000000-0000-4000-8000-000000000002': 8971,
  '10000000-0000-4000-8000-000000000003': 12041,
  '10000000-0000-4000-8000-000000000004': 8166,
  '10000000-0000-4000-8000-000000000005': 8138,
};

const DEVELOPMENT_SAMPLE_PROFILE_IDS = Object.freeze(Object.keys(DEV_DISTANCE_BY_PROFILE_ID));
const DEVELOPMENT_GOLD_PROFILE_IDS = new Set([
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
]);

const DEV_KO_PROFILE_COPY: Record<string, { bio: string; interests: string[] }> = {
  '10000000-0000-4000-8000-000000000001': {
    bio: '작은 카페와 필름 사진, 라이브 음악을 좋아해요.',
    interests: ['사진', '카페', '음악'],
  },
  '10000000-0000-4000-8000-000000000002': {
    bio: '전시를 보고 강변을 걷는 시간을 좋아해요.',
    interests: ['영화', '여행', '패션'],
  },
  '10000000-0000-4000-8000-000000000003': {
    bio: '선셋 러닝과 댄스 플레이리스트, 새로운 만남을 좋아해요.',
    interests: ['음악', '운동', '맛집'],
  },
  '10000000-0000-4000-8000-000000000004': {
    bio: '물가 산책과 하이킹, 아늑한 카페와 즉흥적인 약속을 좋아해요.',
    interests: ['여행', '영화', '카페'],
  },
  '10000000-0000-4000-8000-000000000005': {
    bio: '베를린에서 디자인과 작은 공연, 긴 대화를 즐겨요.',
    interests: ['음악', '사진', '카페'],
  },
};

function isDevelopmentSampleProfile(profileId: string) {
  return reviewSamplesEnabled && DEVELOPMENT_SAMPLE_PROFILE_IDS.includes(profileId);
}

function isMissingSameCountryPreference(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    ['42703', 'PGRST204'].includes(error.code ?? '') &&
    (error.message ?? '').includes('exclude_same_country')
  );
}

function isMissingConnectionGoalsPreference(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    ['42703', 'PGRST204'].includes(error.code ?? '') &&
    (error.message ?? '').includes('connection_goals')
  );
}

const DEV_LANGUAGE_LEVEL_BY_PROFILE_ID: Record<string, Record<string, ProfileLanguageLevel>> = {
  '10000000-0000-4000-8000-000000000001': { ja: 'native', en: 'advanced' },
  '10000000-0000-4000-8000-000000000002': { fr: 'native', en: 'fluent' },
  '10000000-0000-4000-8000-000000000003': { pt: 'native', en: 'advanced' },
  '10000000-0000-4000-8000-000000000004': { en: 'native', fr: 'intermediate' },
  '10000000-0000-4000-8000-000000000005': { de: 'native', en: 'fluent' },
};

function getLanguageDetails(candidate: CandidateRow): ProfileLanguage[] {
  const returnedDetails = candidate.language_details?.flatMap((language) =>
    isLanguageLevel(language.level)
      ? [{ code: language.code, level: language.level, isNative: language.is_native }]
      : [],
  );
  if (returnedDetails?.length) return returnedDetails;

  const devLevels = reviewSamplesEnabled
    ? DEV_LANGUAGE_LEVEL_BY_PROFILE_ID[candidate.id]
    : undefined;
  return candidate.languages.map((code, index) => ({
    code,
    level: devLevels?.[code] ?? (index === 0 ? 'native' : 'intermediate'),
    isNative: index === 0,
  }));
}

async function hydrateCandidates(candidates: CandidateRow[], locale: string): Promise<Profile[]> {
  const supabase = getSupabaseClient();
  const photoPaths = [...new Set(candidates.flatMap((candidate) => candidate.photo_paths))];
  const signedUrlsByPath = new Map<string, string>();
  const candidateIds = candidates.map((candidate) => candidate.id);
  const { data: goalRows, error: goalError } = candidateIds.length
    ? await supabase
        .from('profile_tags')
        .select('profile_id, value')
        .eq('category', 'connection_goal')
        .in('profile_id', candidateIds)
    : { data: [], error: null };
  // Connection goals improve ranking, but must never make the core profile fail to load.
  // Older deployments can legitimately lack the optional tag read permission.
  const availableGoalRows = goalError ? [] : (goalRows ?? []);
  const goalsByProfile = new Map<string, string[]>();
  for (const row of availableGoalRows) {
    goalsByProfile.set(row.profile_id, [...(goalsByProfile.get(row.profile_id) ?? []), row.value]);
  }

  if (photoPaths.length > 0) {
    const { data: signedPhotos, error: signedPhotoError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(photoPaths, SIGNED_PHOTO_TTL_SECONDS);
    if (signedPhotoError) throw signedPhotoError;
    signedPhotos.forEach((photo) => {
      if (photo.path && photo.signedUrl) signedUrlsByPath.set(photo.path, photo.signedUrl);
    });
  }

  return candidates.flatMap((candidate) => {
    const photos = candidate.photo_paths.flatMap((path) => {
      const signedUrl = signedUrlsByPath.get(path);
      return signedUrl ? [signedUrl] : [];
    });
    if (photos.length === 0 || !isGender(candidate.gender)) return [];
    const localizedDevCopy =
      reviewSamplesEnabled && locale.toLowerCase().startsWith('ko')
        ? DEV_KO_PROFILE_COPY[candidate.id]
        : undefined;

    return [
      {
        id: candidate.id,
        name: candidate.display_name,
        age: candidate.age,
        gender: candidate.gender,
        countryCode: candidate.country_code,
        countryLabel: getRegionDisplayName(locale, candidate.country_code),
        languages: candidate.languages,
        languageDetails: getLanguageDetails(candidate),
        distanceKm:
          candidate.distance_km ??
          (reviewSamplesEnabled ? DEV_DISTANCE_BY_PROFILE_ID[candidate.id] : undefined),
        isGoldPass:
          candidate.is_gold_pass === true ||
          (reviewSamplesEnabled && DEVELOPMENT_GOLD_PROFILE_IDS.has(candidate.id)),
        bio: localizedDevCopy?.bio ?? candidate.bio,
        interests: localizedDevCopy?.interests ?? candidate.interests,
        connectionGoals: goalsByProfile.get(candidate.id) ?? [],
        photos,
        lastActiveAt: candidate.last_active_at,
        isPhotoReviewed: true,
        isNew: Date.now() - new Date(candidate.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000,
      },
    ];
  });
}

export const discoveryService = {
  async getProfileById(profileId: string, locale: string): Promise<Profile | null> {
    const supabase = getSupabaseClient();
    const [profileResult, detailResult, photosResult, profileInterestsResult, languageResult] =
      await Promise.all([
        supabase.rpc('get_visible_profiles', { p_profile_ids: [profileId] }).maybeSingle(),
        supabase.from('profile_details').select('*').eq('profile_id', profileId).maybeSingle(),
        supabase
          .from('profile_photos')
          .select('storage_path, position')
          .eq('profile_id', profileId)
          .order('position'),
        supabase.from('profile_interests').select('interest_id').eq('profile_id', profileId),
        supabase
          .from('profile_languages')
          .select('language_code, proficiency')
          .eq('profile_id', profileId),
      ]);

    const firstError = [
      profileResult.error,
      isMissingProfileDetails(detailResult.error) ? null : detailResult.error,
      photosResult.error,
      profileInterestsResult.error,
      languageResult.error,
    ].find(Boolean);
    if (firstError) throw firstError;
    if (!profileResult.data) return null;
    const profile = profileResult.data;

    const interestIds = (profileInterestsResult.data ?? []).map((row) => row.interest_id);
    const interestResult = interestIds.length
      ? await supabase.from('interests').select('label').in('id', interestIds).order('label')
      : { data: [], error: null };
    if (interestResult.error) throw interestResult.error;

    const spokenLanguages = [
      profile.native_language
        ? { code: profile.native_language, level: 'native', is_native: true }
        : null,
      ...(languageResult.data ?? [])
        .filter((language) => language.language_code !== profile.native_language)
        .map((language) => ({
          code: language.language_code,
          level: language.proficiency,
          is_native: false,
        })),
    ].filter((language): language is NonNullable<typeof language> => Boolean(language));
    const candidate: CandidateRow = {
      ...profile,
      language_details: spokenLanguages,
      languages: [
        profile.native_language,
        ...profile.languages.filter((language) => language !== profile.native_language),
      ].filter((language): language is string => Boolean(language)),
      photo_paths: (photosResult.data ?? []).map((photo) => photo.storage_path),
      interests: (interestResult.data ?? []).map((interest) => interest.label),
    };
    const hydrated = (await hydrateCandidates([candidate], locale))[0] ?? null;
    if (!hydrated || !detailResult.data) return hydrated;

    return {
      ...hydrated,
      details: {
        occupation: detailResult.data.occupation ?? undefined,
        educationLevel: detailResult.data.education_level ?? undefined,
        heightCm: detailResult.data.height_cm ?? undefined,
        personalityType: detailResult.data.personality_type ?? undefined,
        drinking: detailResult.data.drinking ?? undefined,
        smoking: detailResult.data.smoking ?? undefined,
        exercise: detailResult.data.exercise ?? undefined,
        pets: detailResult.data.pets ?? undefined,
      },
    };
  },
  async getPreferences(userId: string): Promise<DiscoveryPreferences> {
    const supabase = getSupabaseClient();
    const [profileResult, settingsWithExclusionResult] = await Promise.all([
      supabase.from('profiles').select('interested_in, country_code').eq('id', userId).single(),
      supabase
        .from('user_settings')
        .select(
          'min_age, max_age, max_distance_km, country_codes, exclude_same_country, connection_goals',
        )
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    let settingsData = settingsWithExclusionResult.data;
    let settingsError = settingsWithExclusionResult.error;
    if (isMissingConnectionGoalsPreference(settingsWithExclusionResult.error)) {
      const fallbackResult = await supabase
        .from('user_settings')
        .select('min_age, max_age, max_distance_km, country_codes, exclude_same_country')
        .eq('user_id', userId)
        .maybeSingle();
      settingsData = fallbackResult.data
        ? { ...fallbackResult.data, connection_goals: [] as string[] }
        : fallbackResult.data;
      settingsError = fallbackResult.error;
    }
    if (isMissingSameCountryPreference(settingsError)) {
      const fallbackResult = await supabase
        .from('user_settings')
        .select('min_age, max_age, max_distance_km, country_codes')
        .eq('user_id', userId)
        .maybeSingle();
      settingsData = fallbackResult.data
        ? {
            ...fallbackResult.data,
            exclude_same_country: false,
            connection_goals: [] as string[],
          }
        : fallbackResult.data;
      settingsError = fallbackResult.error;
    }

    if (profileResult.error) throw profileResult.error;
    if (settingsError) throw settingsError;

    return {
      minAge: settingsData?.min_age ?? 18,
      maxAge: settingsData?.max_age ?? 29,
      maxDistanceKm: settingsData?.max_distance_km ?? 0,
      genders: profileResult.data.interested_in,
      countryCodes: settingsData?.country_codes ?? [],
      excludeSameCountry: settingsData?.exclude_same_country ?? false,
      connectionGoals: settingsData?.connection_goals ?? [],
      viewerCountryCode: profileResult.data.country_code,
    };
  },
  async getCandidates(filters: DiscoveryFilters, locale: string, offset = 0): Promise<Profile[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_discovery_candidates', {
      p_min_age: filters.minAge,
      p_max_age: filters.maxAge,
      p_max_distance_km: filters.maxDistanceKm,
      p_genders: filters.genders,
      p_country_codes: filters.countryCodes?.length ? filters.countryCodes : null,
      p_limit: DISCOVER_PREPARE_COUNT * 3,
      p_offset: offset,
    });

    if (error) throw error;
    const hydrated = await hydrateCandidates((data ?? []) as CandidateRow[], locale);
    const preferredGoals = new Set(filters.connectionGoals);
    return hydrated
      .map((profile, index) => ({
        index,
        profile,
        score: (profile.connectionGoals ?? []).filter((goal) => preferredGoals.has(goal)).length,
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, DISCOVER_PREPARE_COUNT)
      .map(({ profile }) => profile);
  },
  async updatePreferences(
    userId: string,
    filters: DiscoveryFilters,
  ): Promise<DiscoveryPreferences> {
    const supabase = getSupabaseClient();
    const [profileResult, settingsWithExclusionResult] = await Promise.all([
      supabase
        .from('profiles')
        .update({ interested_in: filters.genders })
        .eq('id', userId)
        .select('country_code')
        .single(),
      supabase.from('user_settings').upsert({
        user_id: userId,
        min_age: filters.minAge,
        max_age: filters.maxAge,
        max_distance_km: filters.maxDistanceKm,
        country_codes: filters.countryCodes ?? [],
        exclude_same_country: filters.excludeSameCountry,
        connection_goals: filters.connectionGoals,
      }),
    ]);

    let settingsError = settingsWithExclusionResult.error;
    if (isMissingConnectionGoalsPreference(settingsWithExclusionResult.error)) {
      const fallbackResult = await supabase.from('user_settings').upsert({
        user_id: userId,
        min_age: filters.minAge,
        max_age: filters.maxAge,
        max_distance_km: filters.maxDistanceKm,
        country_codes: filters.countryCodes ?? [],
        exclude_same_country: filters.excludeSameCountry,
      });
      settingsError = fallbackResult.error;
    }
    if (isMissingSameCountryPreference(settingsError)) {
      const fallbackResult = await supabase.from('user_settings').upsert({
        user_id: userId,
        min_age: filters.minAge,
        max_age: filters.maxAge,
        max_distance_km: filters.maxDistanceKm,
        country_codes: filters.countryCodes ?? [],
      });
      settingsError = fallbackResult.error;
    }

    const error = profileResult.error ?? settingsError;
    if (error) throw error;
    if (!profileResult.data) throw new Error('Profile country is unavailable.');
    return { ...filters, viewerCountryCode: profileResult.data.country_code };
  },
  async getDevelopmentSampleCandidates(
    _filters: DiscoveryPreferences,
    locale: string,
  ): Promise<Profile[]> {
    const supabase = getSupabaseClient();
    const [profilesResult, photosResult, profileInterestsResult, interestsResult] =
      await Promise.all([
        supabase.rpc('get_visible_profiles', {
          p_profile_ids: [...DEVELOPMENT_SAMPLE_PROFILE_IDS],
        }),
        supabase
          .from('profile_photos')
          .select('profile_id, storage_path, position')
          .in('profile_id', DEVELOPMENT_SAMPLE_PROFILE_IDS),
        supabase
          .from('profile_interests')
          .select('profile_id, interest_id')
          .in('profile_id', DEVELOPMENT_SAMPLE_PROFILE_IDS),
        supabase.from('interests').select('id, label'),
      ]);

    const error =
      profilesResult.error ??
      photosResult.error ??
      profileInterestsResult.error ??
      interestsResult.error;
    if (error) throw error;

    const interestLabelById = new Map(
      (interestsResult.data ?? []).map((interest) => [interest.id, interest.label]),
    );
    const profilesById = new Map(
      (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
    );
    const candidateRows = DEVELOPMENT_SAMPLE_PROFILE_IDS.flatMap((profileId) => {
      const profile = profilesById.get(profileId);
      if (!profile) return [];

      const photoPaths = (photosResult.data ?? [])
        .filter((photo) => photo.profile_id === profileId)
        .sort((a, b) => a.position - b.position)
        .map((photo) => photo.storage_path);
      const interests = (profileInterestsResult.data ?? []).flatMap((interest) => {
        if (interest.profile_id !== profileId) return [];
        const label = interestLabelById.get(interest.interest_id);
        return label ? [label] : [];
      });

      return [
        {
          ...profile,
          language_details: null,
          distance_km: DEV_DISTANCE_BY_PROFILE_ID[profileId],
          photo_paths: photoPaths,
          interests,
        } satisfies CandidateRow,
      ];
    });

    // Review samples are a deterministic QA deck. They intentionally bypass
    // live discovery filters so a narrow saved distance/country setting cannot
    // leave the review build empty.
    return hydrateCandidates(candidateRows, locale);
  },
  async swipe(_userId: string, targetId: string, action: SwipeAction, introMessage?: string) {
    if (isDevelopmentSampleProfile(targetId)) return { matchId: null };

    const supabase = getSupabaseClient();
    const withMessageResult = await supabase
      .rpc('record_my_swipe', {
        p_target_id: targetId,
        p_action: action,
        p_intro_message: introMessage ?? null,
      })
      .single();
    if (!withMessageResult.error) return { matchId: withMessageResult.data.match_id };

    const missingNewSignature = ['PGRST202', '42883'].includes(withMessageResult.error.code ?? '');
    if (!missingNewSignature || introMessage) throw withMessageResult.error;

    const legacyResult = await supabase
      .rpc('record_my_swipe', { p_target_id: targetId, p_action: action })
      .single();
    if (legacyResult.error) throw legacyResult.error;
    return { matchId: legacyResult.data.match_id };
  },
  async undoSwipe(_userId: string, targetId: string) {
    if (isDevelopmentSampleProfile(targetId)) {
      return { creditsRemaining: 0, unlimited: reviewSamplesEnabled };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('undo_my_swipe', { p_target_id: targetId }).single();

    if (error) throw error;
    if (!data.undone) throw new Error('The swipe is no longer available to undo.');
    return { creditsRemaining: data.credits_remaining, unlimited: data.unlimited };
  },
  async getUndoEntitlement() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_my_undo_entitlement').single();
    if (error) throw error;
    return { credits: data.credits, unlimited: data.unlimited };
  },
};
