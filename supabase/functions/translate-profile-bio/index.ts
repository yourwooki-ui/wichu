import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'npm:@supabase/server@^1';

import {
  isTranslationTargetSupported,
  normalizeTranslationLanguage,
  translateWithProvider,
  TranslationProviderError,
} from '../_shared/translation-provider.ts';

type TranslateProfilePayload = {
  profileId?: string;
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

    const payload = (await req.json().catch(() => null)) as TranslateProfilePayload | null;
    const profileId = payload?.profileId?.trim();
    const targetLanguage = normalizeTranslationLanguage(payload?.targetLanguage);
    if (!profileId || !targetLanguage || !isTranslationTargetSupported(targetLanguage)) {
      return Response.json({ error: 'Unsupported translation request' }, { status: 422 });
    }

    const { data, error } = await ctx.supabase
      .rpc('claim_my_profile_bio_translation', {
        p_profile_id: profileId,
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

    try {
      const providerResult = await translateWithProvider({
        // A member may write their bio in a language other than their native
        // language, so profile text must use provider auto-detection.
        sourceLanguage: null,
        targetLanguage,
        text: claim.content,
      });
      const { data: storedTranslation, error: storeError } = await ctx.supabaseAdmin.rpc(
        'complete_profile_bio_translation',
        {
          p_profile_id: profileId,
          p_target_language: targetLanguage,
          p_source_bio: claim.content,
          p_translated_text: providerResult.translatedText,
        },
      );
      if (storeError || !storedTranslation) throw new Error('Translation could not be saved');

      return Response.json({
        translatedText: storedTranslation,
        sourceLanguage: providerResult.detectedSourceLanguage || claim.source_language || null,
        targetLanguage,
        cached: false,
      });
    } catch (error) {
      await ctx.supabaseAdmin.rpc('fail_profile_bio_translation', {
        p_profile_id: profileId,
        p_target_language: targetLanguage,
      });
      return providerErrorResponse(error);
    }
  }),
};

function safeDatabaseError(code?: string) {
  if (code === 'P0001') return 'Translation is unavailable or the daily limit was reached';
  return 'Profile is unavailable';
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
