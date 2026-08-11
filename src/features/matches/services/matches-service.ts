import { getSupabaseClient } from '@/lib/supabase';

export const matchesService = {
  list() {
    return getSupabaseClient()
      .from('matches')
      .select('*')
      .eq('status', 'active')
      .order('matched_at', { ascending: false });
  },
};
