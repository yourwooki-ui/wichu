/**
 * Temporary review mode for product QA.
 *
 * Expo inlines EXPO_PUBLIC values into the client bundle, so this flag must
 * never be used for authorization or data security decisions.
 */
export const reviewSamplesEnabled =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_REVIEW_SAMPLES === 'true';
