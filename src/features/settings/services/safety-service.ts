import { getSupabaseClient } from '@/lib/supabase';

export type ReportContext = 'chat' | 'profile';

export type ReportInput = {
  context: ReportContext;
  details?: string;
  reasons: string[];
  sourceMatchId?: string;
};

export const safetyService = {
  async listBlockedUsers() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_my_blocked_users');
    if (error) {
      const fallback = await supabase
        .from('blocks')
        .select('id, blocked_id, created_at')
        .order('created_at', { ascending: false });
      if (fallback.error) throw error;
      return fallback.data.map((item) => ({
        block_id: item.id,
        profile_id: item.blocked_id,
        display_name: '차단된 사용자',
        country_code: null,
        photo_path: null,
        blocked_at: item.created_at,
        photoUrl: null,
      }));
    }

    const photoPaths = data.flatMap((item) => (item.photo_path ? [item.photo_path] : []));
    const signedUrlByPath = new Map<string, string>();
    if (photoPaths.length) {
      const { data: signedPhotos, error: photoError } = await supabase.storage
        .from('profile-photos')
        .createSignedUrls(photoPaths, 60 * 30);
      if (photoError) throw photoError;
      signedPhotos.forEach((photo) => {
        if (photo.path && photo.signedUrl) signedUrlByPath.set(photo.path, photo.signedUrl);
      });
    }

    return data.map((item) => ({
      ...item,
      photoUrl: item.photo_path ? (signedUrlByPath.get(item.photo_path) ?? null) : null,
    }));
  },
  async unblock(blockId: string) {
    const { error } = await getSupabaseClient().from('blocks').delete().eq('id', blockId);
    if (error) throw error;
  },
  async block(userId: string) {
    const result = await getSupabaseClient().from('blocks').insert({ blocked_id: userId });
    return result.error?.code === '23505' ? { ...result, error: null } : result;
  },
  async report(userId: string, input: ReportInput) {
    const supabase = getSupabaseClient();
    const result = await supabase.rpc('submit_report', {
      p_context: input.context,
      p_details: input.details ?? null,
      p_reasons: input.reasons,
      p_reported_id: userId,
      p_source_match_id: input.sourceMatchId ?? null,
    });
    if (!result.error) return result;

    // Keep reporting available during a rolling database deployment. The old
    // schema accepts one primary reason and still enforces reporter ownership.
    if (['42883', 'PGRST202'].includes(result.error.code ?? '')) {
      const fallback = await supabase.from('reports').insert({
        details: input.details,
        reason: input.reasons[0],
        reported_id: userId,
      });
      return fallback.error?.code === '23505' ? { ...fallback, error: null } : fallback;
    }
    return result;
  },
};
