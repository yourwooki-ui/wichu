import { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { usePresenceHeartbeat } from '@/hooks/use-presence-heartbeat';
import type { Database } from '@/types/database';

type ProfileReviewStatus = Database['public']['Enums']['profile_review_status'];

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  profileCompleted: boolean;
  profileApproved: boolean;
  profileReviewStatus: ProfileReviewStatus | null;
  profileReviewNote: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(isSupabaseConfigured);
  const userId = session?.user.id;

  usePresenceHeartbeat(userId);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();

    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setIsSessionLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsSessionLoading(false);
      if (!nextSession) queryClient.clear();
    });

    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const {
    data: profile,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['auth', 'profile-completion', userId],
    enabled: Boolean(userId),
    retry: 1,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('profiles')
        .select('profile_completed, review_status, review_note')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const refreshProfile = useCallback(async () => {
    await refetchProfile();
  }, [refetchProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading: isSessionLoading || (Boolean(session) && isProfileLoading),
      profileCompleted: profile?.profile_completed ?? false,
      profileApproved: Boolean(profile?.profile_completed) && profile?.review_status === 'approved',
      profileReviewStatus: profile?.review_status ?? null,
      profileReviewNote: profile?.review_note ?? null,
      refreshProfile,
    }),
    [
      isProfileLoading,
      isSessionLoading,
      profile?.profile_completed,
      profile?.review_note,
      profile?.review_status,
      refreshProfile,
      session,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
