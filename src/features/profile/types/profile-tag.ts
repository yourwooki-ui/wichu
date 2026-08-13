export type ProfileTagCategory =
  'connection_goal' | 'vibe' | 'daily_rhythm' | 'communication_style';

export type ProfileTag = {
  category: ProfileTagCategory;
  value: string;
};

export type ProfileTagSelections = Record<ProfileTagCategory, string[]>;
