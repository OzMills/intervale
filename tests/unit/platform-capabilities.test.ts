import { describe, expect, it } from 'vitest';
import {
  NotificationService,
  type NotificationApiLike,
} from '../../src/services/notifications/notification-service';
import { PersistentStorageService } from '../../src/services/storage/persistent-storage';

describe('platform capability adapters', () => {
  it('degrades persistent storage cleanly when unsupported', async () => {
    const service = new PersistentStorageService(null);

    await expect(service.inspect()).resolves.toEqual({
      supported: false,
      persisted: null,
    });
    await expect(service.requestPersistence()).resolves.toEqual({
      supported: false,
      persisted: null,
    });
  });

  it('reports and requests persistent storage without claiming permanence', async () => {
    const service = new PersistentStorageService({
      persisted: async () => false,
      persist: async () => true,
    });

    await expect(service.inspect()).resolves.toEqual({
      supported: true,
      persisted: false,
    });
    await expect(service.requestPersistence()).resolves.toEqual({
      supported: true,
      persisted: true,
    });
  });

  it('never claims a closed-app scheduled notification on the web adapter', async () => {
    const created: string[] = [];
    const api: NotificationApiLike = {
      permission: 'granted',
      requestPermission: async () => 'granted',
      create(title) {
        created.push(title);
        return { close() {} };
      },
    };
    const service = new NotificationService(api);

    expect(service.supportsClosedAppScheduledAlert()).toBe(false);
    expect(service.showImmediateCompletionAlert()).toBe(true);
    expect(created).toEqual(['Measure complete']);
  });
});
