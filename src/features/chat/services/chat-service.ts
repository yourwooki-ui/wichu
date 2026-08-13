import type { RealtimeChannel } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type ChatMessage = Tables<'messages'>;

export const chatService = {
  async listMessages(matchId: string) {
    const { data, error } = await getSupabaseClient()
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at');
    if (error) throw error;
    return data;
  },
  async sendMessage(matchId: string, senderId: string, content: string, originalLanguage = 'ko') {
    const { data, error } = await getSupabaseClient()
      .from('messages')
      .insert({
        match_id: matchId,
        sender_id: senderId,
        content,
        original_language: originalLanguage,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  subscribe(matchId: string, onInsert: (message: ChatMessage) => void): RealtimeChannel {
    return getSupabaseClient()
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => onInsert(payload.new as ChatMessage),
      )
      .subscribe();
  },
  unsubscribe(channel: RealtimeChannel) {
    return getSupabaseClient().removeChannel(channel);
  },
};
