import { getSupabaseClient } from '@/lib/supabase';

export type DiscoveryFilters = {
  minAge: number;
  maxAge: number;
  genders: string[];
  countryCodes?: string[];
};

const CANDIDATE_BATCH_SIZE = 20;

export const discoveryService = {
  async getCandidates(filters: DiscoveryFilters, offset = 0) {
    return getSupabaseClient().rpc('get_discovery_candidates', {
      p_min_age: filters.minAge,
      p_max_age: filters.maxAge,
      p_genders: filters.genders,
      p_country_codes: filters.countryCodes?.length ? filters.countryCodes : null,
      p_limit: CANDIDATE_BATCH_SIZE,
      p_offset: offset,
    });
  },
  swipe(targetId: string, action: 'like' | 'pass') {
    return getSupabaseClient().from('swipes').insert({ target_id: targetId, action });
  },
};
