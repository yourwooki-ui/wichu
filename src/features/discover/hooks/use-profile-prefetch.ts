import { Image } from 'expo-image';
import { useEffect } from 'react';

import { DISCOVER_PREPARE_COUNT } from '@/features/discover/constants';
import { Profile } from '@/types/profile';

export function useProfilePrefetch(profiles: Profile[]) {
  useEffect(() => {
    const urls = profiles
      .slice(0, DISCOVER_PREPARE_COUNT)
      .flatMap((profile) => profile.photos.slice(0, 2));

    if (urls.length > 0) {
      void Image.prefetch(urls, 'memory-disk').catch(() => undefined);
    }
  }, [profiles]);
}
