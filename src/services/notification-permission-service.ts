export type AppPermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export const notificationPermissionService = {
  async getStatus(): Promise<AppPermissionState> {
    if (!('Notification' in globalThis)) return 'unavailable';
    return normalizeStatus(globalThis.Notification.permission);
  },

  async request(_userId?: string): Promise<AppPermissionState> {
    if (!('Notification' in globalThis)) return 'unavailable';
    return normalizeStatus(await globalThis.Notification.requestPermission());
  },
};

function normalizeStatus(status: string): AppPermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}
