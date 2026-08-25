import { randomUUID } from 'expo-crypto';

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

const sessionId = randomUUID();
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
  },
};
