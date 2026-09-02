import { productAnalyticsService } from './product-analytics-service';

import { createErrorFingerprint, getOperationalErrorCode } from './operational-error-policy';

type ErrorLike = { code?: unknown; message?: unknown; name?: unknown; stack?: unknown };

type RuntimeContext = {
  app_version?: string;
  build_number?: string;
  device_os?: string;
  device_type?: string;
  locale?: string;
};

let runtimeContextPromise: Promise<RuntimeContext> | null = null;

async function collectRuntimeContext(): Promise<RuntimeContext> {
  if (runtimeContextPromise) return runtimeContextPromise;
  const contextPromise: Promise<RuntimeContext> = Promise.allSettled([
    import('expo-constants'),
    import('expo-device'),
    import('expo-localization'),
  ])
    .then(([constantsResult, deviceResult, localizationResult]) => {
      const constants =
        constantsResult.status === 'fulfilled' ? constantsResult.value.default : null;
      const device = deviceResult.status === 'fulfilled' ? deviceResult.value : null;
      const localization =
        localizationResult.status === 'fulfilled' ? localizationResult.value : null;
      let locale: string | undefined;
      try {
        locale = localization?.getLocales()[0]?.languageTag;
      } catch {
        locale = undefined;
      }
      return {
        app_version: constants?.expoConfig?.version,
        build_number:
          constants?.expoConfig?.android?.versionCode?.toString() ??
          constants?.expoConfig?.ios?.buildNumber,
        device_os: device?.osName ?? undefined,
        device_type: device?.deviceType?.toString(),
        locale,
      };
    })
    .catch(() => ({}));
  runtimeContextPromise = contextPromise;
  return contextPromise;
}

export function reportOperationalError(surface: string, error: unknown, route?: string) {
  const candidate = (error ?? {}) as ErrorLike;
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  const stack = typeof candidate.stack === 'string' ? candidate.stack : '';
  void collectRuntimeContext().then((runtime) => {
    productAnalyticsService.track(
      'app_error',
      {
        ...runtime,
        error_code: getOperationalErrorCode(error),
        error_name:
          typeof candidate.name === 'string' ? candidate.name.slice(0, 40) : 'OperationalError',
        error_fingerprint: createErrorFingerprint(`${message}\n${stack}`),
        surface: surface.slice(0, 40),
      },
      route,
    );
  });
}
