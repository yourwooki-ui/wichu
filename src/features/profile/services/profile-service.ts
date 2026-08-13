import { getSupabaseClient } from '@/lib/supabase';
import type { SpokenLanguage } from '@/features/profile/types/language';
import type { ProfileTag } from '@/features/profile/types/profile-tag';
import { TablesInsert, TablesUpdate } from '@/types/database';

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
    const [profileResult, interestSelectionResult, languageResult, tagResult, settingsResult] =
      await Promise.all([
        supabase.from('profiles').select('*, profile_photos(*)').eq('id', userId).single(),
        supabase.from('profile_interests').select('interest_id').eq('profile_id', userId),
        supabase.from('profile_languages').select('*').eq('profile_id', userId),
        supabase.from('profile_tags').select('*').eq('profile_id', userId),
        supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      ]);

    const firstError = [
      profileResult.error,
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

    return {
      profile: profileResult.data,
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
