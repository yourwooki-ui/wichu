import { getTranslationLanguage } from '@/features/translation/translation-language';

export {
  translationService,
  type TranslationResult,
} from '@/features/translation/translation-service';

export function normalizeLanguage(value: string) {
  return getTranslationLanguage(value) ?? value.trim().toLowerCase().split('-')[0] ?? '';
}
