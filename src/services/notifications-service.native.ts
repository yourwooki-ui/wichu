import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase';

export const notificationsService = {
  async register(userId: string): Promise<string | null> {
    if (!Device.isDevice) return null;

    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('EAS project ID is missing');

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await getSupabaseClient()
      .from('push_devices')
      .upsert(
        {
          user_id: userId,
          expo_push_token: token,
          platform: Platform.OS as 'ios' | 'android',
          device_name: Device.deviceName ?? null,
          enabled: true,
          last_registered_at: new Date().toISOString(),
        },
        { onConflict: 'expo_push_token' },
      );
    if (error) throw error;
    return token;
  },
  async unregister(userId: string) {
    const { error } = await getSupabaseClient().from('push_devices').delete().eq('user_id', userId);
    if (error) throw error;
  },
};
