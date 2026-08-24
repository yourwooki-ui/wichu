const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidBirthDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isAdult(value: string, today = new Date()) {
  if (!isValidBirthDate(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const cutoff = new Date(
    Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()),
  );
  return new Date(Date.UTC(year, month - 1, day)) <= cutoff;
}

/**
 * 완성된 생년월일의 만 나이. 형식이 아직 불완전하면 `null`.
 *
 * 가입 화면에서 제출 전에 만 나이를 즉시 보여주기 위해 쓴다.
 * 18+ 판정 자체는 항상 `isAdult`가 담당한다.
 */
export function getAge(value: string, today = new Date()): number | null {
  if (!isValidBirthDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  let age = today.getUTCFullYear() - year;
  const hadBirthday =
    today.getUTCMonth() + 1 > month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day);
  if (!hadBirthday) age -= 1;
  return age;
}
