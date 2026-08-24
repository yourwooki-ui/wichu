import { describe, expect, it } from 'vitest';

import { getProfileCompletion } from './profile-completion';

const complete = {
  bio: '여행과 사진을 좋아하는 사람이에요. 편하게 인사해요.',
  birth_date: '2000-01-01',
  country_code: 'KR',
  display_name: '지호',
  gender: 'female',
  interested_in: ['male'],
  languages: ['ko'],
};

describe('profile completion', () => {
  it('DB 산식과 같은 만점을 낸다', () => {
    const result = getProfileCompletion(complete);
    expect(result.score).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it('짧은 소개글은 미완료로 본다 (DB는 20자 이상을 요구)', () => {
    const result = getProfileCompletion({ ...complete, bio: '안녕하세요' });
    expect(result.score).toBe(85);
    expect(result.missing.map((item) => item.key)).toEqual(['bio']);
    expect(result.remainingPoints).toBe(15);
  });

  it('빈 배열 항목을 미완료로 본다', () => {
    const result = getProfileCompletion({ ...complete, interested_in: [], languages: [] });
    expect(result.score).toBe(75);
    expect(result.missing.map((item) => item.key)).toEqual(['interested_in', 'languages']);
  });

  it('한 글자 이름은 미완료로 본다', () => {
    expect(getProfileCompletion({ ...complete, display_name: '지' }).score).toBe(80);
  });

  it('빠진 항목을 고칠 수 있는 편집 탭을 알려준다', () => {
    const result = getProfileCompletion({ ...complete, bio: '', interested_in: [] });
    expect(result.missing.map((item) => item.section)).toEqual(['preferences', 'about']);
  });
});
