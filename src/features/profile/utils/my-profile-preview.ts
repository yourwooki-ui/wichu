import type { MyOperationalProfile } from '../services/profile-service';
import { getRegionDisplayName } from '../../../lib/display-names';
import type { Gender, Profile, ProfileLanguageLevel } from '../../../types/profile';
import { getProfileAge } from './profile-display';

/** 마이 화면의 운영 프로필을 공개 미리보기 모델로 변환한다. */
export function toMyPreviewProfile(operational: MyOperationalProfile, locale: string): Profile {
  const { details, interests, languages, profile, tags } = operational;
  const nativeLanguage = profile.native_language;
  const languageDetails = [
    ...(nativeLanguage ? [{ code: nativeLanguage, level: 'native' as const, isNative: true }] : []),
    ...languages
      .filter((language) => language.language_code !== nativeLanguage)
      .map((language) => ({
        code: language.language_code,
        level: language.proficiency as ProfileLanguageLevel,
        isNative: false,
      })),
  ];
  const approvedPhotos = profile.profile_photos.filter(
    (photo) => photo.review_status === 'approved' && photo.signed_url,
  );
  const previewPhotos = approvedPhotos.length
    ? approvedPhotos
    : profile.profile_photos.filter((photo) => photo.signed_url);

  return {
    id: profile.id,
    name: profile.display_name,
    age: getProfileAge(profile.birth_date),
    gender: profile.gender as Gender,
    countryCode: profile.country_code,
    countryLabel: getRegionDisplayName(locale, profile.country_code),
    languages: profile.languages ?? [],
    languageDetails,
    bio: profile.bio ?? '',
    interests: interests.map((interest) => interest.label),
    connectionGoals: tags
      .filter((tag) => tag.category === 'connection_goal')
      .map((tag) => tag.value),
    photos: previewPhotos.map((photo) => photo.signed_url),
    lastActiveAt: profile.last_active_at,
    isPhotoReviewed: approvedPhotos.length > 0,
    isNew: Date.now() - new Date(profile.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000,
    details: details
      ? {
          occupation: details.occupation ?? undefined,
          educationLevel: details.education_level ?? undefined,
          heightCm: details.height_cm ?? undefined,
          personalityType: details.personality_type ?? undefined,
          drinking: details.drinking ?? undefined,
          smoking: details.smoking ?? undefined,
          exercise: details.exercise ?? undefined,
          pets: details.pets ?? undefined,
        }
      : undefined,
  };
}
