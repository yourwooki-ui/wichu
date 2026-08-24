/**
 * 프로필 완성도 항목.
 *
 * ⚠️ 배점과 조건은 DB 트리거(`profiles` before insert/update)의 산식을 그대로 옮긴 것이다.
 * 서버가 계산한 `profile_completeness`와 같은 값이 나와야 하므로,
 * migration에서 산식이 바뀌면 이 파일도 함께 고쳐야 한다.
 *
 * 서버는 점수만 내려주고 "무엇이 비었는지"는 알려주지 않는다.
 * 사용자에게 남은 항목을 짚어주려면 클라이언트에서 같은 규칙으로 다시 판정해야 한다.
 */

/** 프로필 수정 화면에서 해당 항목을 고칠 수 있는 탭. */
export type ProfileEditSection = 'basic' | 'preferences' | 'about' | 'photos';

export type ProfileCompletionItem = {
  done: boolean;
  key: string;
  label: string;
  points: number;
  section: ProfileEditSection;
};

type CompletionInput = {
  bio?: string | null;
  birth_date?: string | null;
  country_code?: string | null;
  display_name?: string | null;
  gender?: string | null;
  interested_in?: readonly string[] | null;
  languages?: readonly string[] | null;
};

const MIN_BIO_LENGTH = 20;
const MIN_NAME_LENGTH = 2;

export function getProfileCompletion(profile: CompletionInput) {
  const items: ProfileCompletionItem[] = [
    {
      key: 'display_name',
      label: '이름',
      points: 20,
      section: 'basic',
      done: (profile.display_name ?? '').trim().length >= MIN_NAME_LENGTH,
    },
    {
      key: 'birth_date',
      label: '생년월일',
      points: 15,
      section: 'basic',
      done: Boolean(profile.birth_date),
    },
    {
      key: 'gender',
      label: '성별',
      points: 15,
      section: 'basic',
      done: Boolean(profile.gender),
    },
    {
      key: 'interested_in',
      label: '만나고 싶은 상대',
      points: 15,
      section: 'preferences',
      done: (profile.interested_in ?? []).length > 0,
    },
    {
      key: 'bio',
      label: '소개글',
      points: 15,
      section: 'about',
      done: (profile.bio ?? '').trim().length >= MIN_BIO_LENGTH,
    },
    {
      key: 'country_code',
      label: '국적',
      points: 10,
      section: 'basic',
      done: Boolean(profile.country_code),
    },
    {
      key: 'languages',
      label: '사용 언어',
      points: 10,
      section: 'about',
      done: (profile.languages ?? []).length > 0,
    },
  ];

  const missing = items.filter((item) => !item.done);

  return {
    items,
    missing,
    /** 남은 항목을 모두 채웠을 때 오르는 점수. */
    remainingPoints: missing.reduce((total, item) => total + item.points, 0),
    score: items.reduce((total, item) => (item.done ? total + item.points : total), 0),
  };
}
