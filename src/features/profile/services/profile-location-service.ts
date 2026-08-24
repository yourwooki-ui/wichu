import * as Location from 'expo-location';

import { getSupabaseClient } from '@/lib/supabase';

const LAST_KNOWN_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const LAST_KNOWN_REQUIRED_ACCURACY_METERS = 5_000;
const CURRENT_POSITION_TIMEOUT_MS = 12_000;

export type ProfileLocationStatus =
  | 'checking'
  | 'syncing'
  | 'ready'
  | 'permission_required'
  | 'permission_denied'
  | 'services_disabled'
  | 'error';

export type ProfileLocationSyncResult = {
  status: Exclude<ProfileLocationStatus, 'checking' | 'syncing' | 'error'>;
  accuracyMeters?: number;
  updatedAt?: string;
};

export const profileLocationService = {
  async syncCurrentLocation({
    requestPermission = false,
  }: { requestPermission?: boolean } = {}): Promise<ProfileLocationSyncResult> {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) return { status: 'services_disabled' };

    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && requestPermission && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) {
      return { status: permission.canAskAgain ? 'permission_required' : 'permission_denied' };
    }

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_METERS,
    });
    const current = lastKnown ?? (await getCurrentPosition());

    const { data: updatedAt, error } = await getSupabaseClient().rpc('update_my_location', {
      p_latitude: current.coords.latitude,
      p_longitude: current.coords.longitude,
    });
    if (error) throw error;
    return {
      status: 'ready',
      accuracyMeters: current.coords.accuracy ?? undefined,
      updatedAt: updatedAt ?? new Date().toISOString(),
    };
  },
};

async function getCurrentPosition() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Location request timed out')),
          CURRENT_POSITION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
