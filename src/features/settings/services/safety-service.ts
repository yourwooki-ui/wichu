import { getSupabaseClient } from '@/lib/supabase';

export const safetyService = {
  block(userId: string) {
    return getSupabaseClient().from('blocks').insert({ blocked_id: userId });
  },
  report(userId: string, reason: string, details?: string) {
    return getSupabaseClient().from('reports').insert({ reported_id: userId, reason, details });
  },
};
