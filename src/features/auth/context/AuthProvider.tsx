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
import { reportOperationalError } from '@/services/operational-error-service';
import type { Database } from '@/types/database';

type ProfileReviewStatus = Database['public']['Enums']['profile_review_status'];
type AdminRole = 'master' | 'operator';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  profileCompleted: boolean;
  profileApproved: boolean;
  profileReviewStatus: ProfileReviewStatus | null;
  profileReviewNote: string | null;
  profileLoadError: boolean;
  adminRole: AdminRole | null;
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

    let supabase: ReturnType<typeof getSupabaseClient>;
    try {
      supabase = getSupabaseClient();
    } catch (error) {
      reportOperationalError('auth_client_init', error, '/');
      const settleTimer = setTimeout(() => {
        setSession(null);
        setIsSessionLoading(false);
      }, 0);
      return () => clearTimeout(settleTimer);
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setIsSessionLoading(false));

    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setIsSessionLoading(false);
        if (!nextSession) queryClient.clear();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (error) {
      reportOperationalError('auth_state_listener', error, '/');
    }

    return () => {
      try {
        unsubscribe?.();
      } catch {
        // 인증 리스너 정리 실패가 앱 종료 경로를 방해하지 않게 한다.
      }
    };
  }, [queryClient]);

  const {
    data: profile,
    error: profileError,
    isError: isProfileError,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['auth', 'profile-completion', userId],
    enabled: Boolean(userId),
    retry: 1,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_my_private_profile').maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: adminAccess, isLoading: isAdminLoading } = useQuery({
    queryKey: ['auth', 'admin-access', userId],
    enabled: Boolean(userId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_my_admin_access');
      if (error) throw error;
      return data[0] ?? null;
    },
  });

  const refreshProfile = useCallback(async () => {
    await refetchProfile();
  }, [refetchProfile]);

  useEffect(() => {
    if (profileError) reportOperationalError('auth_profile_query', profileError, '/');
  }, [profileError]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading: isSessionLoading || (Boolean(session) && (isProfileLoading || isAdminLoading)),
      adminRole: adminAccess?.active ? adminAccess.role : null,
      profileCompleted: profile?.profile_completed ?? false,
      profileApproved: Boolean(profile?.profile_completed) && profile?.review_status === 'approved',
      profileReviewStatus: profile?.review_status ?? null,
      profileReviewNote: profile?.review_note ?? null,
      profileLoadError: Boolean(session) && isProfileError,
      refreshProfile,
    }),
    [
      isProfileLoading,
      isAdminLoading,
      isSessionLoading,
      isProfileError,
      adminAccess?.active,
      adminAccess?.role,
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
