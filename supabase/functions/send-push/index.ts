import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';

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

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    const payload = (await req.json()) as WebhookPayload;
    const notification = payload.record;
    if (!notification?.id || payload.table !== 'notification_outbox') {
      return Response.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    const { data: claimed, error: claimError } = await ctx.supabaseAdmin
      .from('notification_outbox')
      .update({ status: 'processing', attempts: 1, last_error: null })
      .eq('id', notification.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return Response.json({ skipped: true });

    const { data: devices, error: deviceError } = await ctx.supabaseAdmin
      .from('push_devices')
      .select('expo_push_token')
      .eq('user_id', notification.user_id)
      .eq('enabled', true);
    if (deviceError) throw deviceError;

    if (!devices?.length) {
      await ctx.supabaseAdmin
        .from('notification_outbox')
        .update({ status: 'skipped', last_error: 'No active push device' })
        .eq('id', notification.id);
      return Response.json({ skipped: true });
    }

    const messages = devices.map(({ expo_push_token }) => ({
      to: expo_push_token,
      sound: 'default',
      channelId: 'wichu-default',
      title: notification.title,
      body: notification.body,
      data: { url: notification.route, kind: notification.kind },
    }));

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    const result = await response.json();
    const failed =
      !response.ok ||
      result?.data?.some?.((ticket: { status: string }) => ticket.status === 'error');

    await ctx.supabaseAdmin
      .from('notification_outbox')
      .update(
        failed
          ? { status: 'failed', last_error: JSON.stringify(result).slice(0, 1000) }
          : { status: 'sent', sent_at: new Date().toISOString(), last_error: null },
      )
      .eq('id', notification.id);

    return Response.json({ delivered: !failed, result }, { status: failed ? 502 : 200 });
  }),
};
