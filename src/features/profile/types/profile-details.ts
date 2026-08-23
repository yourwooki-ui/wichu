export type EducationLevel = 'high_school' | 'vocational' | 'college' | 'graduate' | 'other';
export type DrinkingHabit = 'never' | 'sometimes' | 'socially' | 'often';
export type SmokingHabit = 'never' | 'sometimes' | 'regularly' | 'quitting';
export type ExerciseHabit = 'rarely' | 'sometimes' | 'often' | 'daily';
export type PetType = 'none' | 'dog' | 'cat' | 'both' | 'other';

export type ProfileDetails = {
  occupation: string;
  educationLevel: EducationLevel | null;
  heightCm: number | null;
  personalityType: string | null;
  drinking: DrinkingHabit | null;
  smoking: SmokingHabit | null;
  exercise: ExerciseHabit | null;
  pets: PetType | null;
};

export const EMPTY_PROFILE_DETAILS: ProfileDetails = {
  occupation: '',
  educationLevel: null,
  heightCm: null,
  personalityType: null,
  drinking: null,
  smoking: null,
  exercise: null,
  pets: null,
};
