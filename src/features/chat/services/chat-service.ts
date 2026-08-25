import type { RealtimeChannel } from '@supabase/supabase-js';

import { chatMediaService } from '@/features/chat/services/chat-media-service';
import {
  type ChatImageAttachment,
  parseChatAttachments,
} from '@/features/chat/types/chat-attachment';
import { getSupabaseClient } from '@/lib/supabase';
import type { Json, Tables } from '@/types/database';

type ChatMessageRow = Tables<'messages'>;
export type ChatMessage = Omit<ChatMessageRow, 'attachments'> & {
  attachments: ChatImageAttachment[];
};

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

    const messages = await hydrateMessages(data ?? []);
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
    return hydrateMessage(data);
  },
  async sendImageMessage(
    matchId: string,
    clientId: string,
    content: string,
    attachments: ChatImageAttachment[],
    originalLanguage = '',
  ) {
    const { data, error } = await getSupabaseClient().rpc('send_my_image_message', {
      p_match_id: matchId,
      p_client_id: clientId,
      p_content: content,
      p_original_language: originalLanguage,
      p_attachments: attachments.map(({ path, mimeType, width, height }) => ({
        path,
        mimeType,
        width,
        height,
      })) satisfies Json,
    });
    if (error) throw error;
    return hydrateMessage(data);
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
        (payload) => {
          void hydrateMessage(payload.new as ChatMessageRow).then(onInsert);
        },
      )
      .subscribe();
  },
  unsubscribe(channel: RealtimeChannel) {
    return getSupabaseClient().removeChannel(channel);
  },
};

async function hydrateMessages(rows: ChatMessageRow[]): Promise<ChatMessage[]> {
  const parsed = rows.map((row) => parseChatAttachments(row.attachments));
  const hydrated = await chatMediaService
    .hydrateAttachments(parsed.flat())
    .catch(() => parsed.flat());
  const byPath = new Map(hydrated.map((attachment) => [attachment.path, attachment]));
  return rows.map((row, index) => ({
    ...row,
    attachments: (parsed[index] ?? []).map(
      (attachment) => byPath.get(attachment.path) ?? attachment,
    ),
  }));
}

async function hydrateMessage(row: ChatMessageRow): Promise<ChatMessage> {
  const [message] = await hydrateMessages([row]);
  return message!;
}
