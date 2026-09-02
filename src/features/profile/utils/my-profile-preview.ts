import type { MyOperationalProfile } from '../services/profile-service';
import { getRegionDisplayName } from '../../../lib/display-names';
import type { Gender, Profile, ProfileLanguageLevel } from '../../../types/profile';
import { getProfileAge } from './profile-display';

/** 마이 화면의 운영 프로필을 공개 미리보기 모델로 변환한다. */
export function toMyPreviewProfile(operational: MyOperationalProfile, locale: string): Profile {
  const { details, interests, languages, profile, tags } = operational;
  const safeLanguages = Array.isArray(languages) ? languages : [];
  const safeInterests = Array.isArray(interests) ? interests : [];
  const safeTags = Array.isArray(tags) ? tags : [];
  const safePhotos = Array.isArray(profile.profile_photos) ? profile.profile_photos : [];
  const nativeLanguage = profile.native_language ?? null;
  const languageDetails = [
    ...(nativeLanguage ? [{ code: nativeLanguage, level: 'native' as const, isNative: true }] : []),
    ...safeLanguages
      .filter((language) => language.language_code !== nativeLanguage)
      .map((language) => ({
        code: language.language_code,
        level: language.proficiency as ProfileLanguageLevel,
        isNative: false,
      })),
  ];
  // 내 미리보기에서는 승인 사진만 남기지 않는다. 심사 중 사진도 제자리에서
  // 흐림/상태 표시를 해야 사진 추가 후 갤러리 순서와 기존 콘텐츠가 사라지지 않는다.
  const previewPhotos = safePhotos.filter((photo) => photo.signed_url);
  const primaryPhotoApproved = previewPhotos[0]?.review_status === 'approved';

  return {
    id: profile.id,
    name: profile.display_name,
    age: getProfileAge(profile.birth_date),
    gender: profile.gender as Gender,
    countryCode: profile.country_code ?? '',
    countryLabel: getRegionDisplayName(locale, profile.country_code),
    languages: Array.isArray(profile.languages) ? profile.languages : [],
    languageDetails,
    bio: profile.bio ?? '',
    interests: safeInterests.map((interest) => interest.label).filter(Boolean),
    connectionGoals: safeTags
      .filter((tag) => tag.category === 'connection_goal')
      .map((tag) => tag.value),
    photos: previewPhotos.map((photo) => photo.signed_url),
    photoReviewStatuses: previewPhotos.map((photo) => photo.review_status),
    lastActiveAt: profile.last_active_at,
    isPhotoReviewed: primaryPhotoApproved,
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
