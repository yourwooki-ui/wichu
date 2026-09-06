import type { ProfilePromptKey } from '@/types/profile';

export const PROFILE_PROMPT_KEYS: readonly ProfilePromptKey[] = [
  'learning_now',
  'ideal_weekend',
  'language_exchange',
  'looking_for',
  'small_joy',
  'first_date',
] as const;

export const MAX_PROFILE_PROMPTS = 3;
export const MAX_PROFILE_PROMPT_ANSWER_LENGTH = 240;
