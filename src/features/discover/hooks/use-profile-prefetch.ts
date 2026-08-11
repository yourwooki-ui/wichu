import { Image } from 'expo-image';
import { useEffect } from 'react';

import { Profile } from '@/types/profile';

const PREFETCH_PROFILE_COUNT = 3;

export function useProfilePrefetch(profiles: Profile[]) {
  useEffect(() => {
    const urls = profiles
      .slice(0, PREFETCH_PROFILE_COUNT)
      .flatMap((profile) => profile.photos.slice(0, 2));

    if (urls.length > 0) {
      void Image.prefetch(urls, 'memory-disk');
    }
  }, [profiles]);
}
