import { getSupabaseClient } from '@/lib/supabase';

export const profileService = {
  getMyProfile(userId: string) {
    return getSupabaseClient()
      .from('profiles')
      .select('*, profile_photos(*), profile_interests(*)')
      .eq('id', userId)
      .single();
  },
  updateMyProfile(userId: string, values: Record<string, unknown>) {
    return getSupabaseClient().from('profiles').update(values).eq('id', userId).select().single();
  },
};
