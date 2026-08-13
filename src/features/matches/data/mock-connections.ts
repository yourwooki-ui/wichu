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
  isGoldPass?: boolean;
};

export type ConversationPreview = {
  matchId: string;
  profile: ConnectionProfile;
  message: string;
  time: string;
  unreadCount: number;
  isTyping?: boolean;
  isTranslated?: boolean;
};

export const mockConnections: ConnectionProfile[] = [
  {
    id: 'mock-lina',
    name: 'Lina',
    age: 24,
    countryCode: 'DE',
    distanceKm: 18,
    photo:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=88',
    matchedAt: '방금',
    isOnline: true,
    isNew: true,
    isGoldPass: true,
  },
  {
    id: 'mock-mia',
    name: 'Mia',
    age: 23,
    countryCode: 'AU',
    distanceKm: 24,
    photo:
      'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=600&q=88',
    matchedAt: '12분 전',
    isOnline: true,
    isNew: true,
  },
  {
    id: 'mock-sofia',
    name: 'Sofia',
    age: 25,
    countryCode: 'ES',
    distanceKm: 31,
    photo:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=88',
    matchedAt: '어제',
    isOnline: false,
    isNew: false,
    isGoldPass: true,
  },
  {
    id: 'mock-yuna',
    name: 'Yuna',
    age: 22,
    countryCode: 'JP',
    distanceKm: 12,
    photo:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=88',
    matchedAt: '3일 전',
    isOnline: true,
    isNew: false,
  },
  {
    id: 'mock-clara',
    name: 'Clara',
    age: 24,
    countryCode: 'FR',
    distanceKm: 27,
    photo:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=88',
    matchedAt: '5일 전',
    isOnline: false,
    isNew: false,
  },
];

export const mockConversations: ConversationPreview[] = [
  {
    matchId: 'mock-match-lina',
    profile: mockConnections[0],
    message: 'I made a tiny weekend list for you ✦',
    time: '방금',
    unreadCount: 2,
    isTyping: true,
  },
  {
    matchId: 'mock-match-mia',
    profile: mockConnections[1],
    message: 'That playlist was actually so good!',
    time: '8분',
    unreadCount: 1,
    isTranslated: true,
  },
  {
    matchId: 'mock-match-sofia',
    profile: mockConnections[2],
    message: 'You: I would love to see your ceramics.',
    time: '1시간',
    unreadCount: 0,
  },
  {
    matchId: 'mock-match-yuna',
    profile: mockConnections[3],
    message: 'Let’s trade favorite cafés ☕',
    time: '화요일',
    unreadCount: 0,
    isTranslated: true,
  },
  {
    matchId: 'mock-match-clara',
    profile: mockConnections[4],
    message: 'You: Have a good flight!',
    time: '일요일',
    unreadCount: 0,
  },
];

export function getMockConversation(matchId: string) {
  return mockConversations.find((conversation) => conversation.matchId === matchId);
}
