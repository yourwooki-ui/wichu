import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { getSupabaseClient } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type MatchConnection = {
  matchId: string;
  matchedAt: string;
  unreadCount: number;
  lastMessage: Pick<Tables<'messages'>, 'content' | 'created_at' | 'sender_id'> | null;
  profile: Pick<Tables<'profiles'>, 'id' | 'display_name' | 'country_code' | 'last_active_at'> & {
    age: number;
    photo: string | null;
  };
};

export type MatchRoomConnection = {
  matchId: string;
  matchedAt: string;
  profile: Pick<Tables<'profiles'>, 'id' | 'display_name' | 'country_code' | 'last_active_at'> & {
    photo: string | null;
  };
};

export type IncomingLike = {
  profileId: string;
  displayName: string;
  age: number;
  countryCode: string;
  lastActiveAt: string | null;
  distanceKm: number | null;
  isGoldPass: boolean;
  introMessage: string | null;
  likedAt: string;
  expiresAt: string;
  photo: string;
};

export const matchesService = {
  async listIncomingLikes(): Promise<IncomingLike[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_my_incoming_likes', { p_limit: 50 });
    if (error) throw error;

    const photoPaths = [
      ...new Set((data ?? []).flatMap((like) => (like.photo_path ? [like.photo_path] : []))),
    ];
    const { data: signedPhotoRows, error: signedPhotoError } =
      await profilePhotoService.createSignedPhotoUrls(photoPaths, 3600);
    if (signedPhotoError) throw signedPhotoError;
    const signedPhotos = new Map(
      signedPhotoRows.flatMap((photo) =>
        photo.path && photo.signedUrl ? [[photo.path, photo.signedUrl] as const] : [],
      ),
    );

    return (data ?? []).flatMap((like) => {
      const photo = like.photo_path ? signedPhotos.get(like.photo_path) : undefined;
      if (!photo) return [];
      return [
        {
          profileId: like.profile_id,
          displayName: like.display_name,
          age: like.age,
          countryCode: like.country_code,
          lastActiveAt: like.last_active_at,
          distanceKm: like.distance_km,
          isGoldPass: like.is_gold_pass,
          introMessage: like.intro_message,
          likedAt: like.liked_at,
          expiresAt: like.expires_at,
          photo,
        },
      ];
    });
  },
  async endMatch(matchId: string) {
    const { data, error } = await getSupabaseClient().rpc('end_my_match', {
      p_match_id: matchId,
    });
    if (error) throw error;
    return data;
  },
  async getConnection(matchId: string): Promise<MatchRoomConnection | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .rpc('get_my_match_connection', { p_match_id: matchId })
      .maybeSingle();
    if (error) {
      // 앱과 DB가 순차 배포되는 짧은 구간에는 기존 read model로 안전하게 폴백한다.
      if (['42883', 'PGRST202'].includes(error.code)) {
        const fallback = (await matchesService.listConnections()).find(
          (connection) => connection.matchId === matchId,
        );
        return fallback ? toMatchRoomConnection(fallback) : null;
      }
      throw error;
    }
    if (!data) return null;

    let photo: string | null = null;
    if (data.photo_path) {
      const { data: signedPhotoRows, error: signedPhotoError } =
        await profilePhotoService.createSignedPhotoUrls([data.photo_path], 3600);
      if (signedPhotoError) throw signedPhotoError;
      photo = signedPhotoRows.find((row) => row.path === data.photo_path)?.signedUrl ?? null;
    }

    return {
      matchId: data.match_id,
      matchedAt: data.matched_at,
      profile: {
        id: data.profile_id,
        display_name: data.display_name,
        country_code: data.country_code,
        last_active_at: data.last_active_at,
        photo,
      },
    };
  },
  async listConnections(_userId?: string): Promise<MatchConnection[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_my_match_connections', { p_limit: 100 });
    if (error) throw error;
    if (!data?.length) return [];

    const photoPaths = [
      ...new Set(data.flatMap((row) => (row.photo_path ? [row.photo_path] : []))),
    ];
    const { data: signedPhotoRows, error: signedPhotoError } =
      await profilePhotoService.createSignedPhotoUrls(photoPaths, 3600);
    if (signedPhotoError) throw signedPhotoError;
    const signedPhotos = new Map(
      signedPhotoRows.flatMap((photo) =>
        photo.path && photo.signedUrl ? [[photo.path, photo.signedUrl] as const] : [],
      ),
    );

    return data.map((row) => ({
      matchId: row.match_id,
      matchedAt: row.matched_at,
      unreadCount: Number(row.unread_count),
      lastMessage:
        row.last_message_content && row.last_message_created_at && row.last_message_sender_id
          ? {
              content: row.last_message_content,
              created_at: row.last_message_created_at,
              sender_id: row.last_message_sender_id,
            }
          : null,
      profile: {
        id: row.profile_id,
        display_name: row.display_name,
        age: row.age,
        country_code: row.country_code,
        last_active_at: row.last_active_at,
        photo: row.photo_path ? (signedPhotos.get(row.photo_path) ?? null) : null,
      },
    }));
  },
};

function toMatchRoomConnection(connection: MatchConnection): MatchRoomConnection {
  return {
    matchId: connection.matchId,
    matchedAt: connection.matchedAt,
    profile: {
      id: connection.profile.id,
      display_name: connection.profile.display_name,
      country_code: connection.profile.country_code,
      last_active_at: connection.profile.last_active_at,
      photo: connection.profile.photo,
    },
  };
}
