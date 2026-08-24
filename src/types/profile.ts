export type Gender = 'woman' | 'man' | 'nonbinary' | 'other';

export type ProfileLanguageLevel = 'native' | 'beginner' | 'intermediate' | 'advanced' | 'fluent';

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
  photos: string[];
  lastActiveAt: string | null;
  isPhotoReviewed?: boolean;
  isNew?: boolean;
  isGoldPass?: boolean;
  details?: PublicProfileDetails;
};

export type SwipeAction = 'like' | 'pass';
