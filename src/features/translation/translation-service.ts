import { getSupabaseClient } from '@/lib/supabase';

import { getTranslationLanguage } from './translation-language';

export type TranslationResult = {
  translatedText: string;
  sourceLanguage: string | null;
  targetLanguage: string;
  cached: boolean;
};

async function invokeTranslation(
  functionName: 'translate-message' | 'translate-profile-bio',
  body: Record<string, string>,
  appLanguage: string,
) {
  const targetLanguage = getTranslationLanguage(appLanguage);
  if (!targetLanguage) throw new UnsupportedTranslationLanguageError(appLanguage);

  const { data, error } = await getSupabaseClient().functions.invoke<TranslationResult>(
    functionName,
    { body: { ...body, targetLanguage } },
  );
  if (error) throw error;
  if (!data?.translatedText) throw new Error('Translation response is empty.');
  return data;
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
