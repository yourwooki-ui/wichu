import { Redirect } from 'expo-router';

import { useAuthSession } from '@/hooks/use-auth-session';

export default function IndexRoute() {
  const { session, profileCompleted } = useAuthSession();

  if (!session) return <Redirect href="/login" />;
  if (!profileCompleted) return <Redirect href="/profile-setup" />;
  return <Redirect href="/(tabs)/discover" />;
}
