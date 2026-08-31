import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n, { initializeAppLanguage } from '@/i18n';
import { getSupabaseClient } from '@/lib/supabase';

export const notificationsService = {
  async prepare() {
    if (Platform.OS !== 'android') return;
    await initializeAppLanguage();
    await Notifications.setNotificationChannelAsync('wichu-default', {
      name: i18n.t('notifications.channelName'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#FF2D6F',
    });
  },
  async register(_userId: string): Promise<string | null> {
    if (!Device.isDevice) return null;

    await this.prepare();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('EAS project ID is missing');

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await getSupabaseClient().rpc('register_my_push_device', {
      p_expo_push_token: token,
      p_platform: Platform.OS,
      p_device_name: Device.deviceName ?? null,
    });
    if (error) throw error;
    return token;
  },
  async unregister(_userId: string) {
    const { error } = await getSupabaseClient().rpc('unregister_my_push_devices');
    if (error) throw error;
  },
};
