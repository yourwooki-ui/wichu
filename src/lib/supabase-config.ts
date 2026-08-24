type SupabaseConfiguration = {
  url: string;
  publishableKey: string;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function decodeBase64Url(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  let buffer = 0;
  let bits = 0;
  let output = '';

  for (const character of normalized) {
    if (character === '=') break;
    const index = alphabet.indexOf(character);
    if (index < 0) return null;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

function getLegacyJwtRole(key: string) {
  const parts = key.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const payload = decodeBase64Url(parts[1]);
    if (!payload) return null;
    const claims = JSON.parse(payload) as { role?: unknown };
    return typeof claims.role === 'string' ? claims.role : null;
  } catch {
    return null;
  }
}

export function validateSupabaseConfiguration(
  rawUrl: string | undefined,
  rawPublishableKey: string | undefined,
): SupabaseConfiguration {
  const url = rawUrl?.trim();
  const publishableKey = rawPublishableKey?.trim();
  if (!url || !publishableKey) {
    throw new Error('Supabase 환경변수가 없습니다. .env.example을 참고해 .env.local을 설정하세요.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL 형식이 올바르지 않습니다.');
  }

  const isLocal = LOCAL_HOSTS.has(parsedUrl.hostname);
  if (parsedUrl.protocol !== 'https:' && !(isLocal && parsedUrl.protocol === 'http:')) {
    throw new Error('Supabase URL은 HTTPS여야 합니다. HTTP는 로컬 개발 주소만 허용됩니다.');
  }

  if (
    publishableKey.startsWith('sb_secret_') ||
    publishableKey.toLowerCase().includes('service_role') ||
    getLegacyJwtRole(publishableKey) === 'service_role'
  ) {
    throw new Error(
      '서버 전용 Supabase secret/service_role 키를 EXPO_PUBLIC 환경변수에 넣을 수 없습니다.',
    );
  }

  return { url: parsedUrl.toString().replace(/\/$/, ''), publishableKey };
}
