import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { getSupabaseClient } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type MatchConnection = {
  matchId: string;
  matchedAt: string;
  lastMessage: Pick<Tables<'messages'>, 'content' | 'created_at' | 'sender_id'> | null;
  profile: Pick<
    Tables<'profiles'>,
    'id' | 'display_name' | 'birth_date' | 'country_code' | 'last_active_at'
  > & {
    photo: string | null;
  };
};

export const matchesService = {
  async endMatch(matchId: string) {
    const { data, error } = await getSupabaseClient().rpc('end_my_match', {
      p_match_id: matchId,
    });
    if (error) throw error;
    return data;
  },
  async listConnections(userId: string): Promise<MatchConnection[]> {
    const supabase = getSupabaseClient();
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, user_a, user_b, matched_at')
      .eq('status', 'active')
      .order('matched_at', { ascending: false });
    if (matchesError) throw matchesError;
    if (!matches?.length) return [];

    const profileIds = matches.map((match) =>
      match.user_a === userId ? match.user_b : match.user_a,
    );
    const [
      { data: profiles, error: profilesError },
      { data: photos, error: photosError },
      { data: messages, error: messagesError },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, birth_date, country_code, last_active_at')
        .in('id', profileIds),
      supabase
        .from('profile_photos')
        .select('profile_id, storage_path, position')
        .in('profile_id', profileIds)
        .order('position'),
      supabase
        .from('messages')
        .select('match_id, sender_id, content, created_at')
        .in(
          'match_id',
          matches.map((match) => match.id),
        )
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    if (profilesError) throw profilesError;
    if (photosError) throw photosError;
    if (messagesError) throw messagesError;

    const firstPhotoByProfile = new Map<string, string>();
    for (const photo of photos ?? []) {
      if (!firstPhotoByProfile.has(photo.profile_id)) {
        firstPhotoByProfile.set(photo.profile_id, photo.storage_path);
      }
    }

    const signedPhotos = new Map<string, string>();
    await Promise.all(
      [...firstPhotoByProfile].map(async ([profileId, path]) => {
        const { data } = await profilePhotoService.createSignedPhotoUrl(path, 3600);
        if (data?.signedUrl) signedPhotos.set(profileId, data.signedUrl);
      }),
    );

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const lastMessageByMatch = new Map<string, (typeof messages)[number]>();
    for (const message of messages ?? []) {
      if (!lastMessageByMatch.has(message.match_id)) {
        lastMessageByMatch.set(message.match_id, message);
      }
    }
    return matches.flatMap((match) => {
      const profileId = match.user_a === userId ? match.user_b : match.user_a;
      const profile = profileById.get(profileId);
      if (!profile) return [];
      return [
        {
          matchId: match.id,
          matchedAt: match.matched_at,
          lastMessage: lastMessageByMatch.get(match.id) ?? null,
          profile: { ...profile, photo: signedPhotos.get(profileId) ?? null },
        },
      ];
    });
  },
};
