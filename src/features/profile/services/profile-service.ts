import { getSupabaseClient } from '@/lib/supabase';
import type { SpokenLanguage } from '@/features/profile/types/language';
import type { ProfileTag } from '@/features/profile/types/profile-tag';
import type { ProfileDetails } from '@/features/profile/types/profile-details';
import { Json, TablesInsert, TablesUpdate } from '@/types/database';

function isMissingProfileDetails(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
    (error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.message?.includes('profile_details')),
  );
}

export const profileService = {
  getInterests() {
    return getSupabaseClient().from('interests').select('id, slug, label').order('label');
  },
  getMyProfile(userId: string) {
    return getSupabaseClient()
      .from('profiles')
      .select('*, profile_photos(*)')
      .eq('id', userId)
      .single();
  },
  async getMyOperationalProfile(userId: string) {
    const supabase = getSupabaseClient();
    const [
      profileResult,
      detailResult,
      interestSelectionResult,
      languageResult,
      tagResult,
      settingsResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*, profile_photos(*)').eq('id', userId).single(),
      supabase.from('profile_details').select('*').eq('profile_id', userId).maybeSingle(),
      supabase.from('profile_interests').select('interest_id').eq('profile_id', userId),
      supabase.from('profile_languages').select('*').eq('profile_id', userId),
      supabase.from('profile_tags').select('*').eq('profile_id', userId),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    const firstError = [
      profileResult.error,
      isMissingProfileDetails(detailResult.error) ? null : detailResult.error,
      interestSelectionResult.error,
      languageResult.error,
      tagResult.error,
      settingsResult.error,
    ].find(Boolean);
    if (firstError) throw firstError;
    if (!profileResult.data) throw new Error('Profile not found');

    const interestIds = (interestSelectionResult.data ?? []).map(
      (selection) => selection.interest_id,
    );
    const interestResult = interestIds.length
      ? await supabase.from('interests').select('*').in('id', interestIds).order('label')
      : { data: [], error: null };
    if (interestResult.error) throw interestResult.error;

    const signedPhotos = await Promise.all(
      [...(profileResult.data.profile_photos ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(async (photo) => {
          const { data } = await supabase.storage
            .from('profile-photos')
            .createSignedUrl(photo.storage_path, 3600);
          return { ...photo, signed_url: data?.signedUrl ?? '' };
        }),
    );

    return {
      profile: { ...profileResult.data, profile_photos: signedPhotos },
      details: detailResult.data ?? null,
      interests: interestResult.data,
      languages: languageResult.data ?? [],
      tags: tagResult.data ?? [],
      settings: settingsResult.data,
    };
  },
  getMyProfileCompletion(userId: string) {
    return getSupabaseClient()
      .from('profiles')
      .select('profile_completed, review_status, review_note')
      .eq('id', userId)
      .maybeSingle();
  },
  submitForReview() {
    return getSupabaseClient().rpc('submit_profile_for_review');
  },
  saveForReview(values: {
    displayName: string;
    birthDate: string;
    gender: string;
    interestedIn: string[];
    countryCode: string;
    nativeLanguage: string;
    languages: string[];
    bio: string;
    minAge: number;
    maxAge: number;
    locale: string;
    interestIds: string[];
    spokenLanguages: SpokenLanguage[];
    tags: ProfileTag[];
    photoPaths: string[];
  }) {
    return getSupabaseClient().rpc('save_my_profile_for_review', {
      p_display_name: values.displayName,
      p_birth_date: values.birthDate,
      p_gender: values.gender,
      p_interested_in: values.interestedIn,
      p_country_code: values.countryCode,
      p_native_language: values.nativeLanguage,
      p_languages: values.languages,
      p_bio: values.bio,
      p_min_age: values.minAge,
      p_max_age: values.maxAge,
      p_locale: values.locale,
      p_interest_ids: values.interestIds,
      p_spoken_languages: values.spokenLanguages as unknown as Json,
      p_tags: values.tags as unknown as Json,
      p_photo_paths: values.photoPaths,
    });
  },
  deleteMyProfile(userId: string) {
    return getSupabaseClient().from('profiles').delete().eq('id', userId);
  },
  createMyProfile(values: TablesInsert<'profiles'>) {
    return getSupabaseClient().from('profiles').insert(values).select().single();
  },
  updateMyProfile(userId: string, values: TablesUpdate<'profiles'>) {
    return getSupabaseClient().from('profiles').update(values).eq('id', userId).select().single();
  },
  upsertMySettings(values: TablesInsert<'user_settings'>) {
    return getSupabaseClient().from('user_settings').upsert(values, { onConflict: 'user_id' });
  },
  upsertMyDetails(profileId: string, values: ProfileDetails) {
    return getSupabaseClient()
      .from('profile_details')
      .upsert(
        {
          profile_id: profileId,
          occupation: values.occupation.trim() || null,
          education_level: values.educationLevel,
          height_cm: values.heightCm,
          personality_type: values.personalityType,
          drinking: values.drinking,
          smoking: values.smoking,
          exercise: values.exercise,
          pets: values.pets,
        },
        { onConflict: 'profile_id' },
      )
      .select()
      .single();
  },
  async replaceMyInterests(profileId: string, interestIds: string[]) {
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase
      .from('profile_interests')
      .delete()
      .eq('profile_id', profileId);
    if (deleteError) throw deleteError;

    if (interestIds.length === 0) return;
    const { error: insertError } = await supabase
      .from('profile_interests')
      .insert(
        interestIds.map((interestId) => ({ profile_id: profileId, interest_id: interestId })),
      );
    if (insertError) throw insertError;
  },
  async replaceMyLanguages(profileId: string, spokenLanguages: SpokenLanguage[]) {
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase
      .from('profile_languages')
      .delete()
      .eq('profile_id', profileId);
    if (deleteError) throw deleteError;

    if (spokenLanguages.length === 0) return;
    const { error: insertError } = await supabase.from('profile_languages').insert(
      spokenLanguages.map((language) => ({
        profile_id: profileId,
        language_code: language.code,
        proficiency: language.level,
      })),
    );
    if (insertError) throw insertError;
  },
  async replaceMyTags(profileId: string, tags: ProfileTag[]) {
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase
      .from('profile_tags')
      .delete()
      .eq('profile_id', profileId);
    if (deleteError) throw deleteError;

    if (tags.length === 0) return;
    const { error: insertError } = await supabase.from('profile_tags').insert(
      tags.map((tag) => ({
        profile_id: profileId,
        category: tag.category,
        value: tag.value,
      })),
    );
    if (insertError) throw insertError;
  },
};
