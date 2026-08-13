import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';

type OutboxPayload = { userId?: string };

export default {
  fetch: withSupabase({ auth: ['user', 'secret'] }, async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as OutboxPayload;
    const userId = ctx.authMode === 'user' ? ctx.userClaims?.sub : body.userId;
    if (!userId) return Response.json({ error: 'User ID is required' }, { status: 400 });

    const { data: deletionRequest, error: requestError } = await ctx.supabaseAdmin
      .from('account_deletion_requests')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!deletionRequest || !['pending', 'failed'].includes(deletionRequest.status)) {
      return Response.json({ error: 'Deletion request not found' }, { status: 409 });
    }

    await ctx.supabaseAdmin
      .from('account_deletion_requests')
      .update({ status: 'processing', last_error: null })
      .eq('user_id', userId);

    try {
      const { data: files, error: listError } = await ctx.supabaseAdmin.storage
        .from('profile-photos')
        .list(userId, { limit: 100 });
      if (listError) throw listError;
      const paths = (files ?? []).filter((file) => file.id).map((file) => `${userId}/${file.name}`);
      if (paths.length) {
        const { error: removeError } = await ctx.supabaseAdmin.storage
          .from('profile-photos')
          .remove(paths);
        if (removeError) throw removeError;
      }

      const { error: deleteError } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;
      return Response.json({ deleted: true });
    } catch (error) {
      const { data: userLookup } = await ctx.supabaseAdmin.auth.admin.getUserById(userId);
      if (userLookup.user) {
        await ctx.supabaseAdmin
          .from('account_deletion_requests')
          .update({ status: 'failed', last_error: String(error).slice(0, 1000) })
          .eq('user_id', userId);
      }
      throw error;
    }
  }),
};
