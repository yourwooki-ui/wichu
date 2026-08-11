import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { mockProfiles } from '@/features/discover/data/mock-profiles';

export default function ProfileDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = mockProfiles.find((item) => item.id === id);

  return (
    <PlaceholderScreen
      icon="person-circle-outline"
      title={profile?.name ?? 'Profile'}
      description={profile?.bio ?? 'Profile details will be shown here.'}
    />
  );
}
