export type Gender = 'woman' | 'man' | 'nonbinary' | 'other';

export type ProfileLanguageLevel = 'native' | 'beginner' | 'intermediate' | 'advanced' | 'fluent';

export type ProfilePhotoReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type ProfileLanguage = {
  code: string;
  level: ProfileLanguageLevel;
  isNative: boolean;
};

export type PublicProfileDetails = {
  occupation?: string;
  educationLevel?: string;
  heightCm?: number;
  personalityType?: string;
  drinking?: string;
  smoking?: string;
  exercise?: string;
  pets?: string;
};

export type ProfilePromptKey =
  | 'learning_now'
  | 'ideal_weekend'
  | 'language_exchange'
  | 'looking_for'
  | 'small_joy'
  | 'first_date';

export type ProfilePrompt = {
  promptKey: ProfilePromptKey;
  answer: string;
  position: number;
};

export type RecommendationReason =
  'shared_goals' | 'shared_interests' | 'language_match' | 'recently_active';

export type Profile = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  countryCode: string;
  countryLabel: string;
  languages: string[];
  languageDetails?: ProfileLanguage[];
  distanceKm?: number;
  bio: string;
  interests: string[];
  connectionGoals?: string[];
  photos: string[];
  photoReviewStatuses?: ProfilePhotoReviewStatus[];
  lastActiveAt: string | null;
  isPhotoReviewed?: boolean;
  isNew?: boolean;
  isGoldPass?: boolean;
  details?: PublicProfileDetails;
  prompts?: ProfilePrompt[];
  recommendationReasons?: RecommendationReason[];
};

export type SwipeAction = 'like' | 'pass';
