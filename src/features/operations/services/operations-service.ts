import type { Database } from '@/types/database';
import { getSupabaseClient } from '@/lib/supabase';

type ReviewDecision = Extract<
  Database['public']['Enums']['profile_review_status'],
  'approved' | 'rejected'
>;

export const operationsService = {
  async getProfileReviews() {
    const { data, error } = await getSupabaseClient().rpc('get_pending_profile_reviews', {
      p_limit: 30,
      p_offset: 0,
    });
    if (error) throw error;
    return data;
  },
  async reviewProfile(profileId: string, decision: ReviewDecision, note?: string) {
    const { data, error } = await getSupabaseClient().rpc('review_profile_submission', {
      profile_id: profileId,
      decision,
      note: note || null,
    });
    if (error) throw error;
    return data;
  },
  async getPendingReports() {
    const { data, error } = await getSupabaseClient().rpc('get_pending_reports', {
      p_limit: 30,
      p_before: null,
    });
    if (error) throw error;
    return data.map((item) => {
      const legacy = item as typeof item & { reason?: string };
      return {
        ...item,
        reasons: item.reasons?.length ? item.reasons : legacy.reason ? [legacy.reason] : ['other'],
        report_context: item.report_context ?? ('profile' as const),
        source_match_id: item.source_match_id ?? null,
      };
    });
  },
  async resolveReport(
    reportId: string,
    resolution: 'reviewed' | 'closed',
    options?: { action?: 'none' | 'profile_hidden'; note?: string },
  ) {
    const { data, error } = await getSupabaseClient().rpc('resolve_report_v2', {
      p_action: options?.action ?? 'none',
      p_note: options?.note ?? null,
      p_report_id: reportId,
      p_resolution: resolution,
    });
    if (error) throw error;
    return data;
  },
  async getAdminTeam() {
    const { data, error } = await getSupabaseClient().rpc('get_admin_team');
    if (error) throw error;
    return data;
  },
  async setOperatorAccess(email: string, active: boolean) {
    const { data, error } = await getSupabaseClient().rpc('set_operator_access', {
      p_active: active,
      p_email: email.trim(),
    });
    if (error) throw error;
    return data;
  },
  async getModerationActivity() {
    const { data, error } = await getSupabaseClient().rpc('get_moderation_activity', {
      p_limit: 30,
    });
    if (error) throw error;
    return data;
  },
};
