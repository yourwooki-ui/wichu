import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { notificationsService } from '@/services/notifications-service';

export type AppPermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export const notificationPermissionService = {
  async getStatus(): Promise<AppPermissionState> {
    const permission = await Notifications.getPermissionsAsync();
    return normalizeStatus(permission.status);
  },

  async request(userId?: string): Promise<AppPermissionState> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('wichu-default', {
        name: 'WICHU 알림',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 120, 180],
        lightColor: '#FF2D6F',
      });
    }
    const permission = await Notifications.requestPermissionsAsync();
    const status = normalizeStatus(permission.status);
    if (status === 'granted' && userId) await notificationsService.register(userId);
    return status;
  },
};

function normalizeStatus(status: string): AppPermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}
