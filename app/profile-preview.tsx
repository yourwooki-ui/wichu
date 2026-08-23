import { ProfileDetailScreen } from '@/features/profile/screens/ProfileDetailScreen';
import { useAuthSession } from '@/hooks/use-auth-session';

export default function ProfilePreviewRoute() {
  const { session } = useAuthSession();

  if (!session?.user.id) return null;

  return <ProfileDetailScreen mode="preview" profileId={session.user.id} />;
}
