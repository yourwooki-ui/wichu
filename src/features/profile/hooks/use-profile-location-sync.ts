import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import {
  profileLocationService,
  type ProfileLocationStatus,
} from '@/features/profile/services/profile-location-service';
import { useAuthSession } from '@/hooks/use-auth-session';

const RETRY_AFTER_MS = 6 * 60 * 60 * 1000;
let lastSyncSnapshot: {
  userId: string;
  syncedAt: number;
  updatedAt: string;
  accuracyMeters: number | null;
} | null = null;

export function useProfileLocationSync() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const cached = lastSyncSnapshot?.userId === userId ? lastSyncSnapshot : null;
  const [status, setStatus] = useState<ProfileLocationStatus>(cached ? 'ready' : 'checking');
  const [updatedAt, setUpdatedAt] = useState<string | null>(cached?.updatedAt ?? null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(
    cached?.accuracyMeters ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(
    async (requestPermission: boolean) => {
      if (!userId) return false;
      setStatus('syncing');
      setError(null);
      try {
        const result = await profileLocationService.syncCurrentLocation({ requestPermission });
        setStatus(result.status);
        if (result.status !== 'ready') return false;
        setUpdatedAt(result.updatedAt ?? new Date().toISOString());
        setAccuracyMeters(result.accuracyMeters ?? null);
        lastSyncSnapshot = {
          userId,
          syncedAt: Date.now(),
          updatedAt: result.updatedAt ?? new Date().toISOString(),
          accuracyMeters: result.accuracyMeters ?? null,
        };
        await queryClient.invalidateQueries({ queryKey: ['discover', 'candidates', userId] });
        return true;
      } catch (caught) {
        if (__DEV__) console.warn('Could not update profile location', caught);
        setStatus('error');
        setError('현재 위치를 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
        return false;
      }
    },
    [queryClient, userId],
  );

  useEffect(() => {
    if (!userId) return;
    if (
      lastSyncSnapshot?.userId === userId &&
      Date.now() - lastSyncSnapshot.syncedAt < RETRY_AFTER_MS
    )
      return;
    void Promise.resolve().then(() => sync(false));
  }, [sync, userId]);

  return {
    accuracyMeters,
    error,
    status,
    updatedAt,
    requestLocation: () => sync(true),
    openDeviceSettings: () => Linking.openSettings(),
  };
}
