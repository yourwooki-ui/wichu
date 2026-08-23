import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'npm:@supabase/server@^1';

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

type DeepLResponse = {
  translations?: Array<{
    detected_source_language?: string;
    text?: string;
  }>;
};

const DEEPL_TARGET_LANGUAGE: Record<string, string> = {
  ar: 'AR',
  bg: 'BG',
  cs: 'CS',
  da: 'DA',
  de: 'DE',
  el: 'EL',
  en: 'EN-US',
  es: 'ES',
  et: 'ET',
  fi: 'FI',
  fr: 'FR',
  he: 'HE',
  hu: 'HU',
  id: 'ID',
  it: 'IT',
  ja: 'JA',
  ko: 'KO',
  lt: 'LT',
  lv: 'LV',
  nb: 'NB',
  nl: 'NL',
  pl: 'PL',
  pt: 'PT-BR',
  ro: 'RO',
  ru: 'RU',
  sk: 'SK',
  sl: 'SL',
  sv: 'SV',
  tr: 'TR',
  uk: 'UK',
  vi: 'VI',
  zh: 'ZH-HANS',
};

const DEEPL_SOURCE_LANGUAGES = new Set([
  'ar',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'fi',
  'fr',
  'he',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'lt',
  'lv',
  'nb',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'tr',
  'uk',
  'vi',
  'zh',
]);

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const payload = (await req.json().catch(() => null)) as TranslatePayload | null;
    const messageId = payload?.messageId?.trim();
    const targetLanguage = normalizeLanguage(payload?.targetLanguage);
    if (!messageId || !targetLanguage || !DEEPL_TARGET_LANGUAGE[targetLanguage]) {
      return Response.json({ error: 'Unsupported translation request' }, { status: 422 });
    }

    const apiKey = Deno.env.get('DEEPL_API_KEY');
    if (!apiKey) {
      return Response.json(
        { error: 'Translation provider is not configured', code: 'TRANSLATION_NOT_CONFIGURED' },
        { status: 503 },
      );
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

    const endpoint = normalizeEndpoint(Deno.env.get('DEEPL_API_URL'));
    const body: Record<string, unknown> = {
      text: [claim.content],
      target_lang: DEEPL_TARGET_LANGUAGE[targetLanguage],
    };
    if (claim.source_language && DEEPL_SOURCE_LANGUAGES.has(claim.source_language)) {
      body.source_lang = claim.source_language.toUpperCase();
    }

    const providerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const providerResult = (await providerResponse.json().catch(() => ({}))) as DeepLResponse;
    const translatedText = providerResult.translations?.[0]?.text?.trim();
    if (!providerResponse.ok || !translatedText) {
      await ctx.supabaseAdmin.rpc('fail_message_translation', {
        p_message_id: messageId,
        p_target_language: targetLanguage,
      });
      return Response.json({ error: 'Translation provider failed' }, { status: 502 });
    }

    const { data: storedTranslation, error: storeError } = await ctx.supabaseAdmin.rpc(
      'complete_message_translation',
      {
        p_message_id: messageId,
        p_target_language: targetLanguage,
        p_translated_text: translatedText,
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
      sourceLanguage:
        normalizeLanguage(providerResult.translations?.[0]?.detected_source_language) ||
        claim.source_language ||
        null,
      targetLanguage,
      cached: false,
    });
  }),
};

function normalizeLanguage(value?: string) {
  return value?.trim().toLowerCase().split('-')[0] ?? '';
}

function normalizeEndpoint(value?: string) {
  const endpoint = value?.trim() || 'https://api-free.deepl.com/v2/translate';
  return endpoint.replace(/\/$/, '');
}

function safeDatabaseError(code?: string) {
  if (code === 'P0001') return 'Translation is unavailable or the daily limit was reached';
  return 'Message is unavailable';
}
