export type ConnectionProfile = {
  id: string;
  name: string;
  age: number;
  countryCode: string;
  distanceKm: number;
  photo: string;
  matchedAt: string;
  isOnline: boolean;
  isNew: boolean;
  lastActiveAt?: string | null;
  isGoldPass?: boolean;
  introMessage?: string | null;
};

export type ConversationPreview = {
  matchId: string;
  profile: ConnectionProfile;
  message: string;
  time: string;
  unreadCount: number;
  isTyping?: boolean;
  isTranslated?: boolean;
  isYourTurn?: boolean;
};
