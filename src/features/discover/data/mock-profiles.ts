import { Profile } from '@/types/profile';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function activeAgo(milliseconds: number) {
  return new Date(Date.now() - milliseconds).toISOString();
}

export const mockProfiles: Profile[] = [
  {
    id: 'mock-lina',
    name: 'Lina',
    birthDate: '2002-04-18',
    gender: 'woman',
    countryCode: 'DE',
    countryLabel: '독일',
    languages: ['독일어', '영어'],
    languageDetails: [
      { code: 'de', level: 'native', isNative: true },
      { code: 'en', level: 'advanced', isNative: false },
    ],
    distanceKm: 18,
    bio: '디자인을 공부하고 있어요. 늦은 밤 미술관과 짧은 여행을 좋아해요.',
    interests: ['디자인', '인디 음악', '여행'],
    photos: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85',
    ],
    lastActiveAt: activeAgo(2 * MINUTE_MS),
    isVerified: true,
    isGoldPass: true,
  },
  {
    id: 'mock-noah',
    name: 'Noah',
    birthDate: '2000-09-07',
    gender: 'man',
    countryCode: 'CA',
    countryLabel: '캐나다',
    languages: ['영어', '한국어'],
    languageDetails: [
      { code: 'en', level: 'native', isNative: true },
      { code: 'ko', level: 'intermediate', isNative: false },
    ],
    distanceKm: 7,
    bio: '주말에는 클라이밍, 평일에는 작은 카페를 찾아다녀요.',
    interests: ['클라이밍', '커피', '영화'],
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=85',
    ],
    lastActiveAt: activeAgo(18 * MINUTE_MS),
    isNew: true,
  },
  {
    id: 'mock-mia',
    name: 'Mia',
    birthDate: '2003-02-14',
    gender: 'woman',
    countryCode: 'AU',
    countryLabel: '호주',
    languages: ['영어', '일본어'],
    languageDetails: [
      { code: 'en', level: 'native', isNative: true },
      { code: 'ja', level: 'advanced', isNative: false },
    ],
    distanceKm: 24,
    bio: '새로운 시선과 즉흥적인 플레이리스트, 편한 대화를 좋아해요.',
    interests: ['사진', 'R&B', '맛집'],
    photos: [
      'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=85',
    ],
    lastActiveAt: activeAgo(3 * HOUR_MS),
    isVerified: true,
    isGoldPass: true,
  },
  {
    id: 'mock-jun',
    name: 'Jun',
    birthDate: '1999-11-22',
    gender: 'man',
    countryCode: 'JP',
    countryLabel: '일본',
    languages: ['일본어', '영어'],
    languageDetails: [
      { code: 'ja', level: 'native', isNative: true },
      { code: 'en', level: 'fluent', isNative: false },
    ],
    distanceKm: 12,
    bio: '프로덕트 디자이너예요. 책과 러닝 코스 추천을 교환해요.',
    interests: ['책', '건축', '러닝'],
    photos: [
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=85',
    ],
    lastActiveAt: activeAgo(2 * DAY_MS),
  },
  {
    id: 'mock-sofia',
    name: 'Sofia',
    birthDate: '2001-06-09',
    gender: 'woman',
    countryCode: 'ES',
    countryLabel: '스페인',
    languages: ['스페인어', '영어'],
    languageDetails: [
      { code: 'es', level: 'native', isNative: true },
      { code: 'en', level: 'intermediate', isNative: false },
    ],
    distanceKm: 31,
    bio: '해변 산책과 도예, 조금 긴 음성 메시지를 좋아해요.',
    interests: ['도예', '댄스', '바다'],
    photos: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=1200&q=85',
    ],
    lastActiveAt: activeAgo(6 * DAY_MS),
    isNew: true,
  },
];
