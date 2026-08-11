import { getSupabaseClient } from '@/lib/supabase';

export const chatService = {
  listMessages(matchId: string) {
    return getSupabaseClient()
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at');
  },
  sendMessage(matchId: string, senderId: string, content: string, originalLanguage?: string) {
    return getSupabaseClient()
      .from('messages')
      .insert({
        match_id: matchId,
        sender_id: senderId,
        content,
        original_language: originalLanguage,
      })
      .select()
      .single();
  },
  subscribe(matchId: string, onInsert: (message: unknown) => void) {
    return getSupabaseClient()
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => onInsert(payload.new),
      )
      .subscribe();
  },
};
