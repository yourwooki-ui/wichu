import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';

type OutboxPayload = { userId?: string };

const PHOTO_BUCKET = 'profile-photos';
const MAX_STORAGE_OBJECTS = 1000;

export default {
  fetch: withSupabase({ auth: ['user', 'secret'] }, async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as OutboxPayload;
    const userId = ctx.authMode === 'user' ? ctx.userClaims?.sub : body.userId;
    if (!userId) return Response.json({ error: 'User ID is required' }, { status: 400 });

    const { data: claimed, error: claimError } =
      ctx.authMode === 'user'
        ? await ctx.supabase.rpc('claim_my_account_deletion')
        : await ctx.supabaseAdmin.rpc('claim_account_deletion_as_worker', {
            p_user_id: userId,
          });
    if (claimError) throw claimError;
    if (!claimed) {
      return Response.json({ error: 'Deletion request is already processing' }, { status: 409 });
    }

    try {
      if (ctx.authMode === 'user') {
        const authorization = req.headers.get('Authorization');
        const accessToken = authorization?.replace(/^Bearer\s+/i, '');
        if (!accessToken) throw new Error('Authenticated deletion requires an access token');
        const { error: signOutError } = await ctx.supabaseAdmin.auth.admin.signOut(
          accessToken,
          'global',
        );
        if (signOutError) throw signOutError;
      }

      const { data: files, error: listError } = await ctx.supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .list(userId, { limit: MAX_STORAGE_OBJECTS });
      if (listError) throw listError;
      const paths = (files ?? []).filter((file) => file.id).map((file) => `${userId}/${file.name}`);
      if (paths.length >= MAX_STORAGE_OBJECTS) {
        throw new Error('Profile photo cleanup exceeded the supported object limit');
      }
      if (paths.length) {
        const { error: removeError } = await ctx.supabaseAdmin.storage
          .from(PHOTO_BUCKET)
          .remove(paths);
        if (removeError) throw removeError;
      }

      const { error: countError } = await ctx.supabaseAdmin
        .from('account_deletion_requests')
        .update({ storage_object_count: paths.length })
        .eq('user_id', userId)
        .eq('status', 'processing');
      if (countError) throw countError;

      const { error: deleteError } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;
      return Response.json({ deleted: true, removedStorageObjects: paths.length });
    } catch (error) {
      const { data: userLookup } = await ctx.supabaseAdmin.auth.admin.getUserById(userId);
      if (userLookup.user) {
        await ctx.supabaseAdmin.rpc('fail_account_deletion_as_worker', {
          p_user_id: userId,
          p_error: String(error),
        });
      }
      throw error;
    }
  }),
};
