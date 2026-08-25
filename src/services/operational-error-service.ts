import { productAnalyticsService } from '@/services/product-analytics-service';

type ErrorLike = { code?: unknown; message?: unknown; name?: unknown };

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

export function reportOperationalError(surface: string, error: unknown, route?: string) {
  const candidate = (error ?? {}) as ErrorLike;
  productAnalyticsService.track(
    'app_error',
    {
      error_code: getOperationalErrorCode(error),
      error_name:
        typeof candidate.name === 'string' ? candidate.name.slice(0, 40) : 'OperationalError',
      surface: surface.slice(0, 40),
    },
    route,
  );
}
