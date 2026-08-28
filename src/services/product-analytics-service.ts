import { getSupabaseClient } from '@/lib/supabase';

export type ProductEventName =
  | 'app_opened'
  | 'app_error'
  | 'profile_completed'
  | 'discover_viewed'
  | 'discover_empty'
  | 'discovery_filters_saved'
  | 'swipe_recorded'
  | 'match_created'
  | 'chat_opened'
  | 'message_sent'
  | 'message_safety_warning'
  | 'profile_reported'
  | 'profile_blocked'
  | 'date_plan_shared'
  | 'purchase_viewed';

type SafeEventValue = boolean | number | string;
type ProductEventProperties = Record<string, SafeEventValue | null | undefined>;

// 분석용 상관관계 ID에는 암호학적 UUID가 필요하지 않다. 네이티브 Crypto 모듈을
// 앱 모듈 평가 시점에 호출하지 않아, 관측 기능이 실행 자체를 막을 수 없게 한다.
const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const SAFE_KEY = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_STRING_LENGTH = 80;

function sanitizeProperties(properties: ProductEventProperties = {}) {
  const safeProperties: Record<string, SafeEventValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!SAFE_KEY.test(key) || value == null) continue;
    safeProperties[key] =
      typeof value === 'string' ? value.trim().slice(0, MAX_STRING_LENGTH) : value;
  }
  return safeProperties;
}

export const productAnalyticsService = {
  track(eventName: ProductEventName, properties?: ProductEventProperties, route?: string) {
    const safeRoute = route?.trim().slice(0, 120) || null;
    try {
      void getSupabaseClient()
        .from('product_events')
        .insert({
          event_name: eventName,
          properties: sanitizeProperties(properties),
          route: safeRoute,
          session_id: sessionId,
        })
        .then(
          () => undefined,
          () => undefined,
        );
    } catch {
      // 관측 기능은 앱의 핵심 흐름을 중단시키면 안 된다.
    }
  },
};
