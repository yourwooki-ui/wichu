import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeTranslationError, translationService } from './translation-service';

const { getSupabaseClient, invoke, refreshSession } = vi.hoisted(() => {
  const invokeMock = vi.fn();
  const refreshSessionMock = vi.fn();
  return {
    getSupabaseClient: vi.fn(() => ({
      auth: { refreshSession: refreshSessionMock },
      functions: { invoke: invokeMock },
    })),
    invoke: invokeMock,
    refreshSession: refreshSessionMock,
  };
});

vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

describe('normalizeTranslationError', () => {
  beforeEach(() => {
    invoke.mockReset();
    refreshSession.mockReset();
  });

  it('recognizes an expired session rejected by the Edge Function gateway', async () => {
    const error = new FunctionsHttpError(
      Response.json({ message: 'Invalid JWT' }, { status: 401 }),
    );

    await expect(normalizeTranslationError(error)).resolves.toMatchObject({
      code: 'AUTH',
      status: 401,
    });
  });

  it('refreshes an expired session once and retries with the new access token', async () => {
    invoke
      .mockResolvedValueOnce({
        data: null,
        error: new FunctionsHttpError(Response.json({}, { status: 401 })),
      })
      .mockResolvedValueOnce({
        data: {
          cached: false,
          sourceLanguage: 'en',
          targetLanguage: 'ko',
          translatedText: '안녕하세요',
        },
        error: null,
      });
    refreshSession.mockResolvedValue({
      data: { session: { access_token: 'fresh-access-token' } },
      error: null,
    });

    await expect(translationService.translateMessage('message-id', 'ko')).resolves.toMatchObject({
      translatedText: '안녕하세요',
    });
    expect(refreshSession).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      'translate-message',
      expect.objectContaining({
        headers: { Authorization: 'Bearer fresh-access-token' },
        timeout: 15_000,
      }),
    );
  });

  it('keeps a daily translation limit distinct from an authentication failure', async () => {
    const error = new FunctionsHttpError(
      Response.json(
        { error: 'Translation is unavailable or the daily limit was reached' },
        { status: 403 },
      ),
    );

    await expect(normalizeTranslationError(error)).resolves.toMatchObject({
      code: 'LIMIT',
      status: 403,
    });
  });

  it('classifies provider and network failures for operational diagnostics', async () => {
    await expect(
      normalizeTranslationError(
        new FunctionsHttpError(Response.json({ error: 'Provider failed' }, { status: 502 })),
      ),
    ).resolves.toMatchObject({ code: 'PROVIDER' });
    await expect(
      normalizeTranslationError(new FunctionsFetchError(new Error('offline'))),
    ).resolves.toMatchObject({ code: 'NETWORK' });
    await expect(normalizeTranslationError(new FunctionsRelayError({}))).resolves.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });
});
