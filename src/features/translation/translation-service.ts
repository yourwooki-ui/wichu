import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';

import { getTranslationLanguage } from './translation-language';

export type TranslationResult = {
  translatedText: string;
  sourceLanguage: string | null;
  targetLanguage: string;
  cached: boolean;
};

export type TranslationErrorCode =
  | 'AUTH'
  | 'EMPTY_RESPONSE'
  | 'LIMIT'
  | 'NETWORK'
  | 'PROVIDER'
  | 'UNAVAILABLE'
  | 'UNKNOWN'
  | 'UNSUPPORTED';

type FunctionErrorBody = {
  code?: unknown;
  error?: unknown;
  message?: unknown;
};

async function invokeTranslation(
  functionName: 'translate-message' | 'translate-profile-bio',
  body: Record<string, string>,
  appLanguage: string,
) {
  const targetLanguage = getTranslationLanguage(appLanguage);
  if (!targetLanguage) throw new UnsupportedTranslationLanguageError(appLanguage);

  const supabase = getSupabaseClient();
  const invoke = (authorization?: string) =>
    supabase.functions.invoke<TranslationResult>(functionName, {
      body: { ...body, targetLanguage },
      headers: authorization ? { Authorization: authorization } : undefined,
      timeout: 15_000,
    });

  let { data, error } = await invoke();
  if (error) {
    const translationError = await normalizeTranslationError(error);
    if (translationError.code !== 'AUTH') throw translationError;

    // A suspended app can retain an expired access token until the next auth
    // lifecycle tick. Refresh once and retry with the new token explicitly.
    try {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token;
      if (refreshError || !accessToken) throw translationError;
      ({ data, error } = await invoke(`Bearer ${accessToken}`));
    } catch {
      throw translationError;
    }
  }

  if (error) throw await normalizeTranslationError(error);
  if (!data?.translatedText?.trim()) {
    throw new TranslationServiceError('EMPTY_RESPONSE', 'Translation response is empty.');
  }
  return data;
}

export async function normalizeTranslationError(error: unknown): Promise<TranslationServiceError> {
  if (error instanceof TranslationServiceError) return error;

  const candidate = error as {
    context?: unknown;
    message?: unknown;
    name?: unknown;
  };
  const name = typeof candidate?.name === 'string' ? candidate.name : '';
  if (error instanceof FunctionsFetchError || name === 'FunctionsFetchError') {
    return new TranslationServiceError('NETWORK', 'Translation request could not be sent.');
  }
  if (error instanceof FunctionsRelayError || name === 'FunctionsRelayError') {
    return new TranslationServiceError('UNAVAILABLE', 'Translation service is unavailable.');
  }

  if (error instanceof FunctionsHttpError || name === 'FunctionsHttpError') {
    const response = candidate.context as Response | undefined;
    const status = typeof response?.status === 'number' ? response.status : undefined;
    const body = await readFunctionErrorBody(response);
    const detail = [stringValue(body.code), stringValue(body.error), stringValue(body.message)]
      .join(' ')
      .trim()
      .toLowerCase();

    if (status === 401) return new TranslationServiceError('AUTH', 'Session expired.', status);
    if (status === 429 || detail.includes('daily limit')) {
      return new TranslationServiceError('LIMIT', 'Translation limit reached.', status);
    }
    if (status === 422 || detail.includes('unsupported')) {
      return new TranslationServiceError(
        'UNSUPPORTED',
        'Translation language is unsupported.',
        status,
      );
    }
    if (status === 502 || status === 503 || detail.includes('provider')) {
      return new TranslationServiceError('PROVIDER', 'Translation provider failed.', status);
    }
    return new TranslationServiceError('UNAVAILABLE', 'Translation is unavailable.', status);
  }

  return new TranslationServiceError(
    'UNKNOWN',
    typeof candidate?.message === 'string' ? candidate.message : 'Translation failed.',
  );
}

async function readFunctionErrorBody(response?: Response): Promise<FunctionErrorBody> {
  if (!response || typeof response.clone !== 'function') return {};
  try {
    return (await response.clone().json()) as FunctionErrorBody;
  } catch {
    return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export const translationService = {
  translateMessage(messageId: string, appLanguage: string) {
    return invokeTranslation('translate-message', { messageId }, appLanguage);
  },
  translateProfileBio(profileId: string, appLanguage: string) {
    return invokeTranslation('translate-profile-bio', { profileId }, appLanguage);
  },
};

export class UnsupportedTranslationLanguageError extends Error {
  constructor(public readonly appLanguage: string) {
    super(`Translation is not available for ${appLanguage}.`);
  }
}

export class TranslationServiceError extends Error {
  constructor(
    public readonly code: TranslationErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'TranslationServiceError';
  }
}
