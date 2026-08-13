import { Redirect } from 'expo-router';

import { useAuthSession } from '@/hooks/use-auth-session';

export default function IndexRoute() {
  const { session, profileApproved } = useAuthSession();

  if (!session) return <Redirect href="/login" />;
  if (!profileApproved) return <Redirect href="/profile-setup" />;
  return <Redirect href="/(tabs)/discover" />;
}
