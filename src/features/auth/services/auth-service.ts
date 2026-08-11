import { getSupabaseClient } from '@/lib/supabase';

export const authService = {
  signInWithEmail(email: string, password: string) {
    return getSupabaseClient().auth.signInWithPassword({ email, password });
  },
  signUpWithEmail(email: string, password: string) {
    return getSupabaseClient().auth.signUp({ email, password });
  },
  signOut() {
    return getSupabaseClient().auth.signOut();
  },
};
