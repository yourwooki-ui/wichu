export type Gender = 'woman' | 'man' | 'nonbinary' | 'other';

export type Profile = {
  id: string;
  name: string;
  birthYear: number;
  gender: Gender;
  countryCode: string;
  countryLabel: string;
  city: string;
  languages: string[];
  bio: string;
  interests: string[];
  photos: string[];
  isVerified?: boolean;
  isNew?: boolean;
};

export type SwipeAction = 'like' | 'pass';
