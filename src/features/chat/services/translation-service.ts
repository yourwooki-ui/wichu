import { getSupabaseClient } from '@/lib/supabase';

export type TranslationResult = {
  translatedText: string;
  sourceLanguage: string | null;
  targetLanguage: string;
  cached: boolean;
};

export const translationService = {
  async translateMessage(messageId: string, targetLanguage: string): Promise<TranslationResult> {
    const { data, error } = await getSupabaseClient().functions.invoke<TranslationResult>(
      'translate-message',
      {
        body: { messageId, targetLanguage: normalizeLanguage(targetLanguage) },
      },
    );
    if (error) throw error;
    if (!data?.translatedText) throw new Error('Translation response is empty.');
    return data;
  },
};

export function normalizeLanguage(value: string) {
  return value.trim().toLowerCase().split('-')[0];
}
