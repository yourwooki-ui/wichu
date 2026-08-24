import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

type AdMobKey = { keyId: number; base64: string };
type AdMobKeys = { keys?: AdMobKey[] };

const KEY_SERVER_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REWARD_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
let cachedKeys: { expiresAt: number; keys: AdMobKey[] } | null = null;

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

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function readDerLength(bytes: Uint8Array, offset: number) {
  const first = bytes[offset];
  if (first < 0x80) return { length: first, next: offset + 1 };
  const byteCount = first & 0x7f;
  if (byteCount < 1 || byteCount > 2) throw new Error('Unsupported DER length');
  let length = 0;
  for (let index = 0; index < byteCount; index += 1) {
    length = (length << 8) | bytes[offset + 1 + index];
  }
  return { length, next: offset + 1 + byteCount };
}

function derEcdsaToRaw(signature: Uint8Array, componentSize = 32) {
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new Error('Invalid DER sequence');
  const sequence = readDerLength(signature, offset);
  offset = sequence.next;
  if (signature[offset++] !== 0x02) throw new Error('Invalid DER r component');
  const rLength = readDerLength(signature, offset);
  offset = rLength.next;
  const r = signature.slice(offset, offset + rLength.length);
  offset += rLength.length;
  if (signature[offset++] !== 0x02) throw new Error('Invalid DER s component');
  const sLength = readDerLength(signature, offset);
  offset = sLength.next;
  const s = signature.slice(offset, offset + sLength.length);

  const output = new Uint8Array(componentSize * 2);
  const normalizedR = r[0] === 0 ? r.slice(1) : r;
  const normalizedS = s[0] === 0 ? s.slice(1) : s;
  if (normalizedR.length > componentSize || normalizedS.length > componentSize) {
    throw new Error('Invalid ECDSA component size');
  }
  output.set(normalizedR, componentSize - normalizedR.length);
  output.set(normalizedS, componentSize * 2 - normalizedS.length);
  return output;
}

async function getVerificationKey(keyId: number) {
  if (!cachedKeys || cachedKeys.expiresAt <= Date.now()) {
    const response = await fetch(KEY_SERVER_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('Unable to fetch AdMob verification keys');
    const payload = (await response.json()) as AdMobKeys;
    if (!payload.keys?.length) throw new Error('AdMob verification keys are empty');
    cachedKeys = { expiresAt: Date.now() + 23 * 60 * 60 * 1000, keys: payload.keys };
  }
  const matching = cachedKeys.keys.find((key) => key.keyId === keyId);
  if (!matching) throw new Error('Unknown AdMob verification key');
  return crypto.subtle.importKey(
    'spki',
    decodeBase64(matching.base64),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

async function verifyCallback(url: URL) {
  const rawQuery = url.search.slice(1);
  const signatureMarker = '&signature=';
  const signatureOffset = rawQuery.indexOf(signatureMarker);
  const keyMarker = '&key_id=';
  const keyOffset = rawQuery.indexOf(keyMarker, signatureOffset + signatureMarker.length);
  if (signatureOffset < 1 || keyOffset < 1) return false;

  const signedContent = rawQuery.slice(0, signatureOffset);
  const signatureValue = rawQuery.slice(signatureOffset + signatureMarker.length, keyOffset);
  const keyIdValue = rawQuery.slice(keyOffset + keyMarker.length);
  if (!/^\d+$/.test(keyIdValue)) return false;

  const key = await getVerificationKey(Number(keyIdValue));
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    derEcdsaToRaw(decodeBase64(signatureValue)),
    new TextEncoder().encode(signedContent),
  );
}

function normalizeTimestamp(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed > 100_000_000_000_000 ? Math.floor(parsed / 1000) : parsed;
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const url = new URL(req.url);
  const validSignature = await verifyCallback(url).catch(() => false);
  if (!validSignature) return Response.json({ error: 'Invalid signature' }, { status: 401 });

  const userId = url.searchParams.get('user_id');
  const transactionId = url.searchParams.get('transaction_id');
  const placement = url.searchParams.get('custom_data');
  const adUnit = url.searchParams.get('ad_unit');
  const timestamp = normalizeTimestamp(url.searchParams.get('timestamp'));
  const allowedAdUnits = new Set(
    (Deno.env.get('ADMOB_REWARDED_UNDO_AD_UNIT_IDS') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const now = Date.now();
  if (
    !userId ||
    !UUID_PATTERN.test(userId) ||
    !transactionId ||
    transactionId.length < 8 ||
    transactionId.length > 160 ||
    placement !== 'discover_undo' ||
    !adUnit ||
    !allowedAdUnits.has(adUnit) ||
    !timestamp ||
    timestamp < now - MAX_REWARD_AGE_MS ||
    timestamp > now + MAX_FUTURE_SKEW_MS
  ) {
    return Response.json({ error: 'Invalid reward parameters' }, { status: 400 });
  }

  const { data, error } = await getAdminClient().rpc('grant_rewarded_undo_credit', {
    p_provider_event_id: `admob:${transactionId}`,
    p_user_id: userId,
  });
  if (error) return Response.json({ error: 'Reward processing failed' }, { status: 500 });
  return Response.json({ ok: true, credits: data });
});
