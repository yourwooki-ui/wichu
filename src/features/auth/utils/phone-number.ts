import type { AppLanguage } from '@/i18n';

const DEFAULT_CALLING_CODES: Record<AppLanguage, string> = {
  en: '+1',
  es: '+34',
  fa: '+98',
  fr: '+33',
  id: '+62',
  ja: '+81',
  ko: '+82',
  'pt-BR': '+55',
  vi: '+84',
  'zh-TW': '+886',
};

export function getDefaultCallingCode(language: AppLanguage) {
  return DEFAULT_CALLING_CODES[language];
}

/**
 * 사용자가 입력한 국가번호와 국내 번호를 Supabase Auth가 요구하는 E.164 형태로 바꾼다.
 * 국내 전화번호의 관용적인 맨 앞 0은 국가번호와 결합할 때 제거한다.
 */
export function normalizePhoneNumber(callingCode: string, nationalNumber: string) {
  const callingCodeDigits = callingCode.replaceAll(/\D/g, '');
  const enteredNationalDigits = nationalNumber.replaceAll(/\D/g, '');
  // 이탈리아·산마리노는 국제 형식에서도 지리적 선행 0을 유지한다.
  const nationalDigits = ['39', '378'].includes(callingCodeDigits)
    ? enteredNationalDigits
    : enteredNationalDigits.replace(/^0/, '');
  const allDigits = `${callingCodeDigits}${nationalDigits}`;

  if (
    callingCodeDigits.length < 1 ||
    callingCodeDigits.length > 3 ||
    nationalDigits.length < 4 ||
    allDigits.length < 8 ||
    allDigits.length > 15
  ) {
    return null;
  }

  return `+${allDigits}`;
}
