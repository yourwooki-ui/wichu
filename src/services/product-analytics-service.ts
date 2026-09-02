import { getSupabaseClient } from '@/lib/supabase';
import { createAnalyticsSessionId } from '@/services/product-analytics-session';

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
  | 'purchase_viewed'
  | 'purchase_started'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'purchase_completed'
  | 'purchase_restored';

type SafeEventValue = boolean | number | string;
type ProductEventProperties = Record<string, SafeEventValue | null | undefined>;

// DB 컬럼은 UUID를 요구하지만 분석 상관관계 ID에는 암호학적 난수가 필요하지 않다.
// 순수 JS로 형식만 맞춰 네이티브 Crypto를 앱 모듈 평가 시점에 호출하지 않는다.
let sessionId: string | null = null;
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
          session_id: (sessionId ??= createAnalyticsSessionId()),
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
