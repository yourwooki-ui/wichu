import type {
  ProfileTagCategory,
  ProfileTagSelections,
} from '@/features/profile/types/profile-tag';

export type ProfileTagCategoryDefinition = {
  category: ProfileTagCategory;
  values: readonly string[];
  maxSelections: number;
};

export const PROFILE_TAG_CATEGORIES: readonly ProfileTagCategoryDefinition[] = [
  {
    category: 'connection_goal',
    values: ['dating', 'friends', 'language_exchange', 'travel_buddy'],
    maxSelections: 2,
  },
  {
    category: 'vibe',
    values: [
      'calm',
      'playful',
      'curious',
      'active',
      'creative',
      'spontaneous',
      'warm',
      'independent',
    ],
    maxSelections: 3,
  },
  {
    category: 'daily_rhythm',
    values: ['early_bird', 'night_owl', 'flexible'],
    maxSelections: 1,
  },
  {
    category: 'communication_style',
    values: ['talkative', 'listener', 'balanced'],
    maxSelections: 1,
  },
] as const;

export const EMPTY_PROFILE_TAG_SELECTIONS: ProfileTagSelections = {
  connection_goal: [],
  vibe: [],
  daily_rhythm: [],
  communication_style: [],
};
