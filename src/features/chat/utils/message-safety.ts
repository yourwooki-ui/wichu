export type MessageSafetyWarning = 'contact' | 'link' | 'money' | null;

const CONTACT_PATTERN =
  /(?:\+?\d[\d\s().-]{7,}\d)|(?:[\w.+-]+@[\w-]+(?:\.[\w-]+)+)|(?:kakao\s*talk|카카오톡|telegram|텔레그램|whats\s*app|line\s*id|라인\s*아이디)/i;
const LINK_PATTERN = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|me|kr)\b/i;
const MONEY_PATTERN =
  /(?:송금|입금|계좌|투자|수익|코인|가상화폐|비트코인|gift\s*card|wire\s*transfer|bank\s*account|crypto|bitcoin|investment|send\s+money)/i;

export function assessMessageSafety(message: string): MessageSafetyWarning {
  const normalized = message.trim();
  if (!normalized) return null;
  if (MONEY_PATTERN.test(normalized)) return 'money';
  if (CONTACT_PATTERN.test(normalized)) return 'contact';
  if (LINK_PATTERN.test(normalized)) return 'link';
  return null;
}
