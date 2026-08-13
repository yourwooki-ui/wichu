import { DISCOVER_PREPARE_COUNT } from '@/features/discover/constants';
import { getSupabaseClient } from '@/lib/supabase';
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
};

const PHOTO_BUCKET = 'profile-photos';
const SIGNED_PHOTO_TTL_SECONDS = 60 * 60;

type CandidateRow = {
  id: string;
  display_name: string;
  birth_date: string;
  gender: string;
  country_code: string;
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

export type DiscoveryPreferences = DiscoveryFilters;

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
  return __DEV__ && DEVELOPMENT_SAMPLE_PROFILE_IDS.includes(profileId);
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

  const devLevels = __DEV__ ? DEV_LANGUAGE_LEVEL_BY_PROFILE_ID[candidate.id] : undefined;
  return candidate.languages.map((code, index) => ({
    code,
    level: devLevels?.[code] ?? (index === 0 ? 'native' : 'intermediate'),
    isNative: index === 0,
  }));
}

async function hydrateCandidates(candidates: CandidateRow[], locale: string): Promise<Profile[]> {
  const supabase = getSupabaseClient();
  const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  const photoPaths = [...new Set(candidates.flatMap((candidate) => candidate.photo_paths))];
  const signedUrlsByPath = new Map<string, string>();

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
      __DEV__ && locale.toLowerCase().startsWith('ko')
        ? DEV_KO_PROFILE_COPY[candidate.id]
        : undefined;

    return [
      {
        id: candidate.id,
        name: candidate.display_name,
        birthDate: candidate.birth_date,
        gender: candidate.gender,
        countryCode: candidate.country_code,
        countryLabel: regionNames.of(candidate.country_code) ?? candidate.country_code,
        languages: candidate.languages,
        languageDetails: getLanguageDetails(candidate),
        distanceKm:
          candidate.distance_km ?? (__DEV__ ? DEV_DISTANCE_BY_PROFILE_ID[candidate.id] : undefined),
        isGoldPass:
          candidate.is_gold_pass === true ||
          (__DEV__ && DEVELOPMENT_GOLD_PROFILE_IDS.has(candidate.id)),
        bio: localizedDevCopy?.bio ?? candidate.bio,
        interests: localizedDevCopy?.interests ?? candidate.interests,
        photos,
        lastActiveAt: candidate.last_active_at,
        isNew: Date.now() - new Date(candidate.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000,
      },
    ];
  });
}

export const discoveryService = {
  async getPreferences(userId: string): Promise<DiscoveryPreferences> {
    const supabase = getSupabaseClient();
    const [profileResult, settingsResult] = await Promise.all([
      supabase.from('profiles').select('interested_in').eq('id', userId).single(),
      supabase
        .from('user_settings')
        .select('min_age, max_age, max_distance_km, country_codes')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (settingsResult.error) throw settingsResult.error;

    return {
      minAge: settingsResult.data?.min_age ?? 18,
      maxAge: settingsResult.data?.max_age ?? 29,
      maxDistanceKm: settingsResult.data?.max_distance_km ?? 0,
      genders: profileResult.data.interested_in,
      countryCodes: settingsResult.data?.country_codes ?? [],
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
      p_limit: DISCOVER_PREPARE_COUNT,
      p_offset: offset,
    });

    if (error) throw error;
    return hydrateCandidates((data ?? []) as CandidateRow[], locale);
  },
  async updatePreferences(userId: string, filters: DiscoveryFilters) {
    const supabase = getSupabaseClient();
    const [profileResult, settingsResult] = await Promise.all([
      supabase.from('profiles').update({ interested_in: filters.genders }).eq('id', userId),
      supabase.from('user_settings').upsert({
        user_id: userId,
        min_age: filters.minAge,
        max_age: filters.maxAge,
        max_distance_km: filters.maxDistanceKm,
        country_codes: filters.countryCodes ?? [],
      }),
    ]);

    const error = profileResult.error ?? settingsResult.error;
    if (error) throw error;
    return filters;
  },
  async getDevelopmentSampleCandidates(
    filters: DiscoveryFilters,
    locale: string,
  ): Promise<Profile[]> {
    const supabase = getSupabaseClient();
    const [profilesResult, photosResult, profileInterestsResult, interestsResult] =
      await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, display_name, birth_date, gender, country_code, languages, bio, created_at, last_active_at',
          )
          .in('id', DEVELOPMENT_SAMPLE_PROFILE_IDS),
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

    return hydrateCandidates(
      candidateRows.filter(
        (candidate) =>
          filters.maxDistanceKm === 0 ||
          (candidate.distance_km != null && candidate.distance_km <= filters.maxDistanceKm),
      ),
      locale,
    );
  },
  async swipe(userId: string, targetId: string, action: SwipeAction) {
    if (isDevelopmentSampleProfile(targetId)) return { matchId: null };

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('swipes').insert({ target_id: targetId, action });
    if (error) throw error;

    if (action === 'pass') return { matchId: null };

    const [userA, userB] = [userId, targetId].sort();
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id')
      .eq('user_a', userA)
      .eq('user_b', userB)
      .eq('status', 'active')
      .maybeSingle();
    if (matchError) throw matchError;
    return { matchId: match?.id ?? null };
  },
  async undoSwipe(userId: string, targetId: string) {
    if (isDevelopmentSampleProfile(targetId)) return;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('swipes')
      .delete()
      .eq('swiper_id', userId)
      .eq('target_id', targetId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('The swipe is no longer available to undo.');
  },
};
