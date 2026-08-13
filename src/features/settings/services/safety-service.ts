import { getSupabaseClient } from '@/lib/supabase';

export const safetyService = {
  async block(userId: string) {
    const result = await getSupabaseClient().from('blocks').insert({ blocked_id: userId });
    return result.error?.code === '23505' ? { ...result, error: null } : result;
  },
  async report(userId: string, reason: string, details?: string) {
    const result = await getSupabaseClient()
      .from('reports')
      .insert({ reported_id: userId, reason, details });
    return result.error?.code === '23505' ? { ...result, error: null } : result;
  },
};
