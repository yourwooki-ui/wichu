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
    return data;
  },
  async resolveReport(reportId: string, resolution: 'reviewed' | 'closed') {
    const { data, error } = await getSupabaseClient().rpc('resolve_report', {
      p_report_id: reportId,
      p_resolution: resolution,
    });
    if (error) throw error;
    return data;
  },
};
