import { getSupabaseClient } from '@/lib/supabase';
import type { SpokenLanguage } from '@/features/profile/types/language';
import type { ProfileTag } from '@/features/profile/types/profile-tag';
import type { ProfileDetails } from '@/features/profile/types/profile-details';
import { toMyPreviewProfile } from '@/features/profile/utils/my-profile-preview';
import { Json, TablesInsert } from '@/types/database';
import type { Profile, ProfilePrompt } from '@/types/profile';

import { profilePhotoService } from './profile-photo-service';
import { reconcileEditableProfilePhotos } from './profile-photo-reconciliation';

function isMissingProfileDetails(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
    (error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.message?.includes('profile_details')),
  );
}

function isMissingProfilePrompts(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
    (error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.message?.includes('profile_prompts')),
  );
}

export const profileService = {
  getInterests() {
    return getSupabaseClient().from('interests').select('id, slug, label').order('label');
  },
  async getMyProfile(userId: string) {
    const supabase = getSupabaseClient();
    const [profileResult, photosResult] = await Promise.all([
      supabase.rpc('get_my_private_profile').single(),
      supabase.from('profile_photos').select('*').eq('profile_id', userId).order('position'),
    ]);
    const error = profileResult.error ?? photosResult.error;
    return {
      data: profileResult.data
        ? { ...profileResult.data, profile_photos: photosResult.data ?? [] }
        : null,
      error,
    };
  },
  async getMyOperationalProfile(userId: string) {
    const supabase = getSupabaseClient();
    const [
      profileResult,
      detailResult,
      interestSelectionResult,
      languageResult,
      tagResult,
      promptResult,
      settingsResult,
    ] = await Promise.all([
      supabase.rpc('get_my_private_profile').single(),
      supabase.from('profile_details').select('*').eq('profile_id', userId).maybeSingle(),
      supabase.from('profile_interests').select('interest_id').eq('profile_id', userId),
      supabase.from('profile_languages').select('*').eq('profile_id', userId),
      supabase.from('profile_tags').select('*').eq('profile_id', userId),
      supabase.from('profile_prompts').select('*').eq('profile_id', userId).order('position'),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    const firstError = [
      profileResult.error,
      isMissingProfileDetails(detailResult.error) ? null : detailResult.error,
      interestSelectionResult.error,
      languageResult.error,
      tagResult.error,
      isMissingProfilePrompts(promptResult.error) ? null : promptResult.error,
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

    const { data: profilePhotos, error: profilePhotosError } = await supabase
      .from('profile_photos')
      .select('*')
      .eq('profile_id', userId)
      .order('position');
    if (profilePhotosError) throw profilePhotosError;

    const orderedPhotos = [...(profilePhotos ?? [])].sort(
      (left, right) => left.position - right.position,
    );
    const { data: signedPhotoResults, error: signedPhotosError } =
      await profilePhotoService.createSignedPhotoUrls(
        orderedPhotos.map((photo) => photo.storage_path),
        3600,
      );
    if (signedPhotosError) throw signedPhotosError;

    const signedUrlsByPath = new Map(
      (signedPhotoResults ?? []).flatMap((result) =>
        result.path && result.signedUrl ? [[result.path, result.signedUrl] as const] : [],
      ),
    );
    const signedPhotos = orderedPhotos.flatMap((photo) => {
      const signedUrl = signedUrlsByPath.get(photo.storage_path);
      return signedUrl ? [{ ...photo, signed_url: signedUrl }] : [];
    });

    return {
      profile: { ...profileResult.data, profile_photos: signedPhotos },
      details: detailResult.data ?? null,
      interests: interestResult.data,
      languages: languageResult.data ?? [],
      tags: tagResult.data ?? [],
      prompts: promptResult.data ?? [],
      settings: settingsResult.data,
    };
  },
  async getMyEditableProfile(userId: string) {
    const operational = await profileService.getMyOperationalProfile(userId);
    let storedPaths: string[];
    try {
      storedPaths = await profilePhotoService.listMyStoredPhotos(userId);
    } catch {
      // Storage-folder reconciliation repairs legacy partial saves, but it is
      // not required to edit the authoritative database photos. A transient
      // Storage list failure must never blank the entire editor.
      return operational;
    }
    const databasePhotos = operational.profile.profile_photos;
    const databasePaths = new Set(databasePhotos.map((photo) => photo.storage_path));
    const missingPaths = storedPaths.filter((path) => !databasePaths.has(path));

    if (missingPaths.length === 0) return operational;

    const { data: signedResults, error: signedError } =
      await profilePhotoService.createSignedPhotoUrls(missingPaths, 3600);
    if (signedError) return operational;

    const recoveredStoragePhotos = (signedResults ?? []).flatMap((result) =>
      result.path && result.signedUrl
        ? [{ signedUrl: result.signedUrl, storagePath: result.path }]
        : [],
    );
    if (recoveredStoragePhotos.length === 0) return operational;

    return {
      ...operational,
      profile: {
        ...operational.profile,
        profile_photos: reconcileEditableProfilePhotos(
          databasePhotos,
          recoveredStoragePhotos,
          userId,
          operational.profile.review_status,
        ),
      },
    };
  },
  async getMyPreviewProfile(userId: string, locale: string): Promise<Profile> {
    const operational = await profileService.getMyOperationalProfile(userId);
    return toMyPreviewProfile(operational, locale);
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
    profileDetails?: ProfileDetails | null;
  }) {
    return getSupabaseClient().rpc('save_my_profile_bundle_for_review', {
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
      p_profile_details: values.profileDetails
        ? ({
            occupation: values.profileDetails.occupation.trim(),
            educationLevel: values.profileDetails.educationLevel,
            heightCm: values.profileDetails.heightCm,
            personalityType: values.profileDetails.personalityType,
            drinking: values.profileDetails.drinking,
            smoking: values.profileDetails.smoking,
            exercise: values.profileDetails.exercise,
            pets: values.profileDetails.pets,
          } as Json)
        : null,
    });
  },
  deleteMyProfile(userId: string) {
    return getSupabaseClient().from('profiles').delete().eq('id', userId);
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
  async replaceMyPrompts(prompts: ProfilePrompt[]) {
    const { data, error } = await getSupabaseClient().rpc('replace_my_profile_prompts', {
      p_prompts: prompts.map((prompt, position) => ({
        prompt_key: prompt.promptKey,
        answer: prompt.answer.trim(),
        position,
      })),
    });
    if (error) {
      // During a rolling deployment the profile itself remains usable; the editor
      // can safely retry once the new RPC reaches the database.
      throw error;
    }
    return data;
  },
};

export type MyOperationalProfile = Awaited<
  ReturnType<(typeof profileService)['getMyOperationalProfile']>
>;
