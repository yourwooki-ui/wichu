import { getSupabaseClient } from '@/lib/supabase';

const PHOTO_BUCKET = 'profile-photos';

export const profileVisitService = {
  async recordVisit(profileId: string, visitorId: string) {
    if (profileId === visitorId || profileId.startsWith('mock-')) return;
    const { error } = await getSupabaseClient().rpc('record_profile_visit', {
      p_profile_id: profileId,
    });
    if (error) throw error;
  },
  async getMyVisitors() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_my_profile_visitors', { p_limit: 50 });
    if (error) throw error;

    const photoPaths = (data ?? []).flatMap((visitor) =>
      visitor.photo_path ? [visitor.photo_path] : [],
    );
    const signedPhotoByPath = new Map<string, string>();
    if (photoPaths.length) {
      const { data: photos, error: photoError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(photoPaths, 3600);
      if (photoError) throw photoError;
      photos.forEach((photo) => {
        if (photo.path && photo.signedUrl) signedPhotoByPath.set(photo.path, photo.signedUrl);
      });
    }

    return (data ?? []).flatMap((visitor) => {
      const photo = visitor.photo_path ? signedPhotoByPath.get(visitor.photo_path) : undefined;
      if (!photo) return [];
      return [{ ...visitor, photo }];
    });
  },
};
