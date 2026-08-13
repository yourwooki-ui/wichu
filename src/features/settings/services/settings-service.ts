import { getSupabaseClient } from '@/lib/supabase';
import type { TablesUpdate } from '@/types/database';

export const settingsService = {
  async getMySettings(userId: string) {
    const { data, error } = await getSupabaseClient()
      .from('user_settings')
      .select('discovery_enabled, push_matches, push_messages, locale')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateMySettings(userId: string, values: TablesUpdate<'user_settings'>) {
    const { data, error } = await getSupabaseClient()
      .from('user_settings')
      .update(values)
      .eq('user_id', userId)
      .select('discovery_enabled, push_matches, push_messages, locale')
      .single();
    if (error) throw error;
    return data;
  },
};
