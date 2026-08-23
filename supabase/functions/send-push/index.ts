import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@^2';

type OutboxRecord = {
  id: string;
  user_id: string;
  kind: 'match' | 'message';
  title: string;
  body: string;
  route: string;
};

type WebhookPayload = {
  type: 'INSERT';
  table: 'notification_outbox';
  schema: 'public';
  record: OutboxRecord;
};

type ReconcilePayload = { action: 'reconcile-receipts' };

type PushDevice = {
  id: string;
  expo_push_token: string;
};

type ExpoTicket = {
  status?: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
};

type ExpoReceipt = {
  status?: 'ok' | 'error';
  details?: { error?: string };
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const RECEIPT_BATCH_SIZE = 1000;
const DEVICE_LIMIT_PER_USER = 10;
const RECEIPT_READY_MINUTES = 15;
const RECEIPT_EXPIRY_HOURS = 24;

export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    const payload = (await req.json().catch(() => null)) as
      WebhookPayload | ReconcilePayload | null;

    if (payload?.action === 'reconcile-receipts') {
      return Response.json(await reconcileReceipts(ctx.supabaseAdmin));
    }

    if (!payload || !('record' in payload) || payload.table !== 'notification_outbox') {
      return Response.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }
    const notification = payload.record;

    // Receipt checks are also run opportunistically so delivery cleanup still
    // progresses before a dedicated production Cron schedule is enabled.
    const receiptReconciliation = await reconcileReceipts(ctx.supabaseAdmin).catch(() => ({
      checked: 0,
      updated: 0,
      disabledDevices: 0,
      expired: 0,
    }));

    const { data: claimed, error: claimError } = await ctx.supabaseAdmin.rpc(
      'claim_notification_outbox',
      { p_outbox_id: notification.id },
    );
    if (claimError) throw claimError;
    if (!claimed) return Response.json({ skipped: true, receiptReconciliation });

    try {
      const { data: existingDeliveries, error: existingDeliveryError } = await ctx.supabaseAdmin
        .from('push_delivery_receipts')
        .select('ticket_status')
        .eq('outbox_id', claimed.id);
      if (existingDeliveryError) throw existingDeliveryError;
      if (existingDeliveries?.length) {
        const accepted = existingDeliveries.filter((item) => item.ticket_status === 'ok').length;
        await updateOutbox(ctx.supabaseAdmin, claimed.id, {
          status: accepted > 0 ? 'sent' : 'failed',
          last_error: accepted > 0 ? null : 'All push tickets were previously rejected',
        });
        return Response.json({ accepted, reused: true, receiptReconciliation });
      }

      const { data: devices, error: deviceError } = await ctx.supabaseAdmin
        .from('push_devices')
        .select('id, expo_push_token')
        .eq('user_id', claimed.user_id)
        .eq('enabled', true)
        .order('last_registered_at', { ascending: false })
        .limit(DEVICE_LIMIT_PER_USER);
      if (deviceError) throw deviceError;

      if (!devices?.length) {
        await updateOutbox(ctx.supabaseAdmin, claimed.id, {
          status: 'skipped',
          last_error: 'No active push device',
        });
        return Response.json({ skipped: true, receiptReconciliation });
      }

      const messages = (devices as PushDevice[]).map(({ expo_push_token }) => ({
        to: expo_push_token,
        sound: 'default',
        channelId: 'wichu-default',
        title: claimed.title,
        body: claimed.body,
        data: { url: claimed.route, kind: claimed.kind },
      }));

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: expoHeaders(),
        body: JSON.stringify(messages),
      });
      const result = (await response.json().catch(() => ({}))) as { data?: ExpoTicket[] };
      if (!response.ok || !Array.isArray(result.data)) {
        throw new Error(`Expo push request failed (${response.status})`);
      }

      const deliveries = (devices as PushDevice[]).map((device, index) => {
        const ticket = result.data?.[index];
        const accepted = ticket?.status === 'ok' && Boolean(ticket.id);
        return {
          outbox_id: claimed.id,
          push_device_id: device.id,
          expo_ticket_id: accepted ? ticket?.id : null,
          ticket_status: accepted ? 'ok' : 'error',
          delivery_status: accepted ? 'pending' : 'failed',
          error_code: accepted ? null : safeErrorCode(ticket?.details?.error ?? 'MissingTicket'),
          checked_at: accepted ? null : new Date().toISOString(),
        };
      });

      const { error: deliveryError } = await ctx.supabaseAdmin
        .from('push_delivery_receipts')
        .upsert(deliveries, { onConflict: 'outbox_id,push_device_id' });
      if (deliveryError) throw deliveryError;

      const rejectedDeviceIds = deliveries
        .filter((delivery) => delivery.error_code === 'DeviceNotRegistered')
        .map((delivery) => delivery.push_device_id);
      if (rejectedDeviceIds.length) {
        const { error: disableError } = await ctx.supabaseAdmin
          .from('push_devices')
          .update({ enabled: false })
          .in('id', rejectedDeviceIds);
        if (disableError) throw disableError;
      }

      const accepted = deliveries.filter((delivery) => delivery.ticket_status === 'ok').length;
      const rejected = deliveries.length - accepted;
      await updateOutbox(ctx.supabaseAdmin, claimed.id, {
        status: accepted > 0 ? 'sent' : 'failed',
        sent_at: accepted > 0 ? new Date().toISOString() : null,
        last_error:
          rejected > 0 ? `${rejected} of ${deliveries.length} push tickets rejected` : null,
      });

      return Response.json(
        { accepted, rejected, receiptReconciliation },
        { status: accepted > 0 ? 200 : 502 },
      );
    } catch (error) {
      await updateOutbox(ctx.supabaseAdmin, claimed.id, {
        status: 'failed',
        last_error: safeErrorMessage(error),
      });
      return Response.json(
        { error: 'Push delivery failed', receiptReconciliation },
        { status: 502 },
      );
    }
  }),
};

async function reconcileReceipts(admin: SupabaseClient) {
  const now = Date.now();
  const readyBefore = new Date(now - RECEIPT_READY_MINUTES * 60_000).toISOString();
  const expiredBefore = new Date(now - RECEIPT_EXPIRY_HOURS * 60 * 60_000).toISOString();

  const { data: expired, error: expiryError } = await admin
    .from('push_delivery_receipts')
    .update({ delivery_status: 'expired', checked_at: new Date(now).toISOString() })
    .eq('delivery_status', 'pending')
    .lt('created_at', expiredBefore)
    .select('id');
  if (expiryError) throw expiryError;

  const { data: pending, error: pendingError } = await admin
    .from('push_delivery_receipts')
    .select('expo_ticket_id')
    .eq('delivery_status', 'pending')
    .not('expo_ticket_id', 'is', null)
    .lte('created_at', readyBefore)
    .gt('created_at', expiredBefore)
    .order('created_at', { ascending: true })
    .limit(RECEIPT_BATCH_SIZE);
  if (pendingError) throw pendingError;

  const ids = (pending ?? [])
    .map((row) => row.expo_ticket_id)
    .filter((id): id is string => Boolean(id));
  if (!ids.length) {
    return { checked: 0, updated: 0, disabledDevices: 0, expired: expired?.length ?? 0 };
  }

  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify({ ids }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    data?: Record<string, ExpoReceipt>;
  };
  if (!response.ok || !result.data) {
    throw new Error(`Expo receipt request failed (${response.status})`);
  }

  const receiptResults = Object.entries(result.data)
    .filter(([, receipt]) => receipt.status === 'ok' || receipt.status === 'error')
    .map(([ticketId, receipt]) => ({
      ticket_id: ticketId,
      status: receipt.status,
      error_code: receipt.status === 'error' ? safeErrorCode(receipt.details?.error) : null,
    }));

  if (!receiptResults.length) {
    return { checked: ids.length, updated: 0, disabledDevices: 0, expired: expired?.length ?? 0 };
  }

  const { data: completed, error: completionError } = await admin.rpc('complete_push_receipts', {
    p_results: receiptResults,
  });
  if (completionError) throw completionError;

  return {
    checked: ids.length,
    updated: Number(completed?.updated ?? 0),
    disabledDevices: Number(completed?.disabled_devices ?? 0),
    expired: expired?.length ?? 0,
  };
}

async function updateOutbox(admin: SupabaseClient, id: string, values: Record<string, unknown>) {
  const { error } = await admin.from('notification_outbox').update(values).eq('id', id);
  if (error) throw error;
}

function expoHeaders() {
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  return {
    'Content-Type': 'application/json',
    ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
  };
}

function safeErrorCode(value?: string) {
  const normalized = value?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  return normalized || 'UnknownError';
}

function safeErrorMessage(error: unknown) {
  return String(error instanceof Error ? error.message : error).slice(0, 300);
}
