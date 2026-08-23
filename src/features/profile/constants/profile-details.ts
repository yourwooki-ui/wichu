export const EDUCATION_OPTIONS = [
  { value: 'high_school', label: '고등학교' },
  { value: 'vocational', label: '전문대·직업교육' },
  { value: 'college', label: '대학교' },
  { value: 'graduate', label: '대학원' },
  { value: 'other', label: '기타' },
] as const;

export const DRINKING_OPTIONS = [
  { value: 'never', label: '마시지 않음' },
  { value: 'sometimes', label: '가끔' },
  { value: 'socially', label: '분위기에 따라' },
  { value: 'often', label: '자주' },
] as const;

export const SMOKING_OPTIONS = [
  { value: 'never', label: '비흡연' },
  { value: 'sometimes', label: '가끔' },
  { value: 'regularly', label: '흡연' },
  { value: 'quitting', label: '금연 중' },
] as const;

export const EXERCISE_OPTIONS = [
  { value: 'rarely', label: '거의 안 함' },
  { value: 'sometimes', label: '가끔' },
  { value: 'often', label: '주 2~4회' },
  { value: 'daily', label: '거의 매일' },
] as const;

export const PET_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'dog', label: '강아지' },
  { value: 'cat', label: '고양이' },
  { value: 'both', label: '강아지·고양이' },
  { value: 'other', label: '기타' },
] as const;

export const PERSONALITY_OPTIONS = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
] as const;
