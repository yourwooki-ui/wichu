/**
 * Temporary review mode for product QA.
 *
 * Expo inlines EXPO_PUBLIC values into the client bundle, so this flag must
 * never be used for authorization or data security decisions.
 */
export const reviewSamplesEnabled =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_REVIEW_SAMPLES === 'true';

/**
 * 실제 SMS 공급자가 연결되기 전에는 사용자에게 실패하는 로그인 수단을 노출하지 않는다.
 * 이 값은 UI rollout 용도이며 서버의 Auth 설정이 실제 보안 경계다.
 */
export const phoneAuthEnabled = process.env.EXPO_PUBLIC_PHONE_AUTH_ENABLED === 'true';
