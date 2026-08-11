export interface NotificationsService {
  register(): Promise<string | null>;
  unregister(): Promise<void>;
}

export const noopNotificationsService: NotificationsService = {
  register: async () => null,
  unregister: async () => undefined,
};
