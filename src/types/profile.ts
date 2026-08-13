export type Gender = 'woman' | 'man' | 'nonbinary' | 'other';

export type ProfileLanguageLevel = 'native' | 'beginner' | 'intermediate' | 'advanced' | 'fluent';

export type ProfileLanguage = {
  code: string;
  level: ProfileLanguageLevel;
  isNative: boolean;
};

export type Profile = {
  id: string;
  name: string;
  birthDate: string;
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
  isVerified?: boolean;
  isNew?: boolean;
  isGoldPass?: boolean;
};

export type SwipeAction = 'like' | 'pass';
