export type TranslationProviderResult = {
  detectedSourceLanguage: string | null;
  translatedText: string;
};

type DeepLResponse = {
  translations?: Array<{
    detected_source_language?: string;
    text?: string;
  }>;
};

const DEEPL_TARGET_LANGUAGE: Record<string, string> = {
  en: 'EN-US',
  es: 'ES',
  fr: 'FR',
  id: 'ID',
  ja: 'JA',
  ko: 'KO',
  pt: 'PT-BR',
  vi: 'VI',
  // WICHU only exposes Traditional Chinese (Taiwan), never Simplified Chinese.
  zh: 'ZH-HANT',
};

const DEEPL_SOURCE_LANGUAGES = new Set(['en', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'vi', 'zh']);

export function normalizeTranslationLanguage(value?: string) {
  const normalized = value?.trim().toLowerCase().replaceAll('_', '-') ?? '';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('pt')) return 'pt';
  return normalized.split('-')[0] ?? '';
}

export function isTranslationTargetSupported(language: string) {
  return Boolean(DEEPL_TARGET_LANGUAGE[normalizeTranslationLanguage(language)]);
}

export async function translateWithProvider({
  sourceLanguage,
  targetLanguage,
  text,
}: {
  sourceLanguage?: string | null;
  targetLanguage: string;
  text: string;
}): Promise<TranslationProviderResult> {
  const normalizedTarget = normalizeTranslationLanguage(targetLanguage);
  const providerTarget = DEEPL_TARGET_LANGUAGE[normalizedTarget];
  if (!providerTarget) throw new TranslationProviderError('UNSUPPORTED_TARGET');

  const apiKey = Deno.env.get('DEEPL_API_KEY');
  if (!apiKey) throw new TranslationProviderError('NOT_CONFIGURED');

  const body: Record<string, unknown> = {
    text: [text],
    target_lang: providerTarget,
  };
  const normalizedSource = normalizeTranslationLanguage(sourceLanguage ?? '');
  if (normalizedSource && DEEPL_SOURCE_LANGUAGES.has(normalizedSource)) {
    body.source_lang = normalizedSource.toUpperCase();
  }

  const endpoint = normalizeEndpoint(Deno.env.get('DEEPL_API_URL'));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as DeepLResponse;
  const translatedText = result.translations?.[0]?.text?.trim();
  if (!response.ok || !translatedText) throw new TranslationProviderError('PROVIDER_FAILED');

  return {
    detectedSourceLanguage:
      normalizeTranslationLanguage(result.translations?.[0]?.detected_source_language) || null,
    translatedText,
  };
}

export class TranslationProviderError extends Error {
  constructor(public readonly code: 'NOT_CONFIGURED' | 'PROVIDER_FAILED' | 'UNSUPPORTED_TARGET') {
    super(code);
  }
}

function normalizeEndpoint(value?: string) {
  return (value?.trim() || 'https://api-free.deepl.com/v2/translate').replace(/\/$/, '');
}
