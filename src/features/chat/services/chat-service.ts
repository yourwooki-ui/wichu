import type { RealtimeChannel } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type ChatMessage = Tables<'messages'>;

export const MESSAGE_PAGE_SIZE = 50;

export type ChatMessagePage = {
  messages: ChatMessage[];
  nextCursor: string | null;
};

type ListMessagesOptions = {
  before?: string | null;
  limit?: number;
};

export const chatService = {
  async listMessages(
    matchId: string,
    { before, limit = MESSAGE_PAGE_SIZE }: ListMessagesOptions = {},
  ): Promise<ChatMessagePage> {
    let query = getSupabaseClient()
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) throw error;

    const messages = data ?? [];
    const oldestMessage = messages[messages.length - 1];

    return {
      messages: [...messages].reverse(),
      nextCursor: messages.length === limit ? (oldestMessage?.created_at ?? null) : null,
    };
  },
  async sendMessage(matchId: string, clientId: string, content: string, originalLanguage = '') {
    const { data, error } = await getSupabaseClient().rpc('send_my_message', {
      p_match_id: matchId,
      p_client_id: clientId,
      p_content: content,
      p_original_language: originalLanguage,
    });
    if (error) throw error;
    return data;
  },
  async markRead(matchId: string) {
    const { data, error } = await getSupabaseClient().rpc('mark_match_read', {
      p_match_id: matchId,
    });
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
