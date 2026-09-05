type ErrorLike = { code?: unknown; message?: unknown; name?: unknown; stack?: unknown };

export function createOperationalErrorGate(limit = 24) {
  const reported = new Set<string>();
  return (key: string) => {
    if (reported.has(key) || reported.size >= limit) return false;
    reported.add(key);
    return true;
  };
}

export function createErrorFingerprint(value: unknown) {
  const input = String(value ?? '')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':uuid')
    .replace(/\b\d{4,}\b/g, ':number')
    .slice(0, 800);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getOperationalErrorCode(error: unknown) {
  const candidate = (error ?? {}) as ErrorLike;
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : '';
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';

  if (message.includes('displaynames') || message.includes('intl.locale')) return 'intl_runtime';
  if (['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)) {
    return 'schema_mismatch';
  }
  if (['42501', 'PGRST301', 'PGRST302'].includes(code)) return 'access_denied';
  if (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed')
  ) {
    return 'network';
  }
  if (candidate.name === 'TypeError') return 'type_error';
  return code ? `backend_${code.toLowerCase().slice(0, 24)}` : 'unknown';
}
