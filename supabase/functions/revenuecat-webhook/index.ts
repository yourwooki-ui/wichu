import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  product_id?: string;
  new_product_id?: string | null;
  store?: string;
  environment?: string;
  event_timestamp_ms?: number;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
};

type RevenueCatPayload = { api_version?: string; event?: RevenueCatEvent };

const PRODUCT_IDS = new Set(['wichu_ad_free', 'wichu_gold_monthly']);
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const legacySecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secretDictionary = Deno.env.get('SUPABASE_SECRET_KEYS');
  const secret = secretDictionary
    ? (JSON.parse(secretDictionary) as Record<string, string>).default
    : legacySecret;
  if (!url || !secret) throw new Error('Supabase server credentials are unavailable');
  return createClient(url, secret, { auth: { persistSession: false } });
}

async function equalSecret(received: string | null, expected: string) {
  if (!received) return false;
  const encoder = new TextEncoder();
  const [receivedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(receivedHash);
  const right = new Uint8Array(expectedHash);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function toPlatform(store: string | undefined) {
  if (store === 'PLAY_STORE') return 'android';
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'ios';
  return null;
}

function toDate(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function statusFor(event: RevenueCatEvent) {
  if (event.type === 'EXPIRATION') return 'expired';
  if (event.type === 'SUBSCRIPTION_PAUSED') return 'active';
  if (event.type === 'CANCELLATION') return 'active';
  return event.type && ACTIVE_EVENTS.has(event.type) ? 'active' : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expectedAuth || !(await equalSecret(req.headers.get('authorization'), expectedAuth))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > 128 * 1024) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  const payload = (await req.json().catch(() => null)) as RevenueCatPayload | null;
  const event = payload?.event;
  if (!event?.id || event.type === 'TEST') return Response.json({ skipped: true });
  if (event.environment === 'SANDBOX' && Deno.env.get('REVENUECAT_ALLOW_SANDBOX') !== 'true') {
    return Response.json({ skipped: true, reason: 'sandbox-disabled' });
  }

  const userId = event.app_user_id;
  const productId =
    event.new_product_id && PRODUCT_IDS.has(event.new_product_id)
      ? event.new_product_id
      : event.product_id;
  const platform = toPlatform(event.store);
  const status = statusFor(event);
  if (!userId || !UUID_PATTERN.test(userId) || !productId || !PRODUCT_IDS.has(productId)) {
    return Response.json({ skipped: true, reason: 'unmapped-customer-or-product' });
  }
  if (!platform || !status || !event.event_timestamp_ms) {
    return Response.json({ skipped: true, reason: 'unsupported-event' });
  }

  const periodEnd = toDate(
    event.type === 'BILLING_ISSUE'
      ? (event.grace_period_expiration_at_ms ?? event.expiration_at_ms)
      : event.expiration_at_ms,
  );
  const reference = event.original_transaction_id ?? event.transaction_id ?? event.id;
  const { data, error } = await getAdminClient().rpc('process_revenuecat_subscription_event', {
    p_current_period_end: periodEnd,
    p_event_id: event.id,
    p_event_type: event.type,
    p_occurred_at: new Date(event.event_timestamp_ms).toISOString(),
    p_platform: platform,
    p_product_id: productId,
    p_provider_reference: reference,
    p_status: status,
    p_user_id: userId,
  });
  if (error) {
    return Response.json({ error: 'Event processing failed' }, { status: 500 });
  }
  return Response.json({ ok: true, applied: data });
});
