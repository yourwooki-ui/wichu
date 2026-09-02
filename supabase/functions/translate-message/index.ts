import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'npm:@supabase/server@^1';

import {
  isTranslationTargetSupported,
  normalizeTranslationLanguage,
  translateWithProvider,
  TranslationProviderError,
} from '../_shared/translation-provider.ts';

type TranslatePayload = {
  messageId?: string;
  targetLanguage?: string;
};

type TranslationClaim = {
  content: string;
  source_language: string;
  target_language: string;
  cached_translation: string | null;
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const payload = (await req.json().catch(() => null)) as TranslatePayload | null;
    const messageId = payload?.messageId?.trim();
    const targetLanguage = normalizeTranslationLanguage(payload?.targetLanguage);
    if (!messageId || !targetLanguage || !isTranslationTargetSupported(targetLanguage)) {
      return Response.json({ error: 'Unsupported translation request' }, { status: 422 });
    }

    const { data, error } = await ctx.supabase
      .rpc('claim_my_message_translation', {
        p_message_id: messageId,
        p_target_language: targetLanguage,
      })
      .single();
    if (error) return Response.json({ error: safeDatabaseError(error.code) }, { status: 403 });

    const claim = data as TranslationClaim;
    if (claim.cached_translation) {
      return Response.json({
        translatedText: claim.cached_translation,
        sourceLanguage: claim.source_language || null,
        targetLanguage,
        cached: true,
      });
    }

    let providerResult;
    try {
      providerResult = await translateWithProvider({
        sourceLanguage: claim.source_language,
        targetLanguage,
        text: claim.content,
      });
    } catch (error) {
      await ctx.supabaseAdmin.rpc('fail_message_translation', {
        p_message_id: messageId,
        p_target_language: targetLanguage,
      });
      return providerErrorResponse(error);
    }

    const { data: storedTranslation, error: storeError } = await ctx.supabaseAdmin.rpc(
      'complete_message_translation',
      {
        p_message_id: messageId,
        p_target_language: targetLanguage,
        p_translated_text: providerResult.translatedText,
      },
    );
    if (storeError) {
      await ctx.supabaseAdmin.rpc('fail_message_translation', {
        p_message_id: messageId,
        p_target_language: targetLanguage,
      });
      return Response.json({ error: 'Translation could not be saved' }, { status: 500 });
    }

    return Response.json({
      translatedText: storedTranslation,
      sourceLanguage: providerResult.detectedSourceLanguage || claim.source_language || null,
      targetLanguage,
      cached: false,
    });
  }),
};

function safeDatabaseError(code?: string) {
  if (code === 'P0001') return 'Translation is unavailable or the daily limit was reached';
  return 'Message is unavailable';
}

function providerErrorResponse(error: unknown) {
  if (error instanceof TranslationProviderError && error.code === 'NOT_CONFIGURED') {
    return Response.json(
      { error: 'Translation provider is not configured', code: 'TRANSLATION_NOT_CONFIGURED' },
      { status: 503 },
    );
  }
  if (error instanceof TranslationProviderError && error.code === 'UNSUPPORTED_TARGET') {
    return Response.json({ error: 'Unsupported translation request' }, { status: 422 });
  }
  return Response.json({ error: 'Translation provider failed' }, { status: 502 });
}
