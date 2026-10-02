export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported';

export interface NotificationCapabilities {
  immediateCompletionAlert: boolean;
  permissionRequest: boolean;
  closedAppScheduledAlert: false;
}

interface NotificationInstanceLike {
  close(): void;
}

export interface NotificationApiLike {
  permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  create(title: string, options?: NotificationOptions): NotificationInstanceLike;
}

export class NotificationService {
  constructor(private readonly api: NotificationApiLike | null) {}

  getCapabilities(): NotificationCapabilities {
    return {
      immediateCompletionAlert: this.api !== null,
      permissionRequest: this.api !== null,
      closedAppScheduledAlert: false,
    };
  }

  getPermissionState(): NotificationPermissionState {
    if (!this.api) return 'unsupported';
    return this.api.permission === 'default' ? 'prompt' : this.api.permission;
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.api) return 'unsupported';
    const permission = await this.api.requestPermission();
    return permission === 'default' ? 'prompt' : permission;
  }

  showImmediateCompletionAlert(): boolean {
    if (!this.api || this.api.permission !== 'granted') return false;

    this.api.create('Measure complete', {
      body: 'Your Measure is ready to resolve when you return.',
      tag: 'intervale-measure-complete',
      silent: true,
    });
    return true;
  }

  supportsClosedAppScheduledAlert(): false {
    return false;
  }
}

export function createBrowserNotificationService(): NotificationService {
  if (typeof Notification === 'undefined') {
    return new NotificationService(null);
  }

  const api: NotificationApiLike = {
    get permission() {
      return Notification.permission;
    },
    requestPermission: () => Notification.requestPermission(),
    create: (title, options) => new Notification(title, options),
  };

  return new NotificationService(api);
}
