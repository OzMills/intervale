import { createIntervaleDatabase, type IntervaleDatabase } from '../persistence/database';
import {
  createBrowserStateInvalidationBus,
  type StateInvalidationBus,
} from '../services/concurrency/invalidation-bus';
import {
  createBrowserWriteCoordinator,
  type WriteCoordinator,
} from '../services/concurrency/write-coordinator';
import {
  createBrowserNotificationService,
  type NotificationService,
} from '../services/notifications/notification-service';
import { createBrowserPwaUpdateService, type PwaUpdateService } from '../services/pwa/pwa-update';
import {
  createBrowserPersistentStorageService,
  type PersistentStorageService,
} from '../services/storage/persistent-storage';
import { BrowserTimeSource, type TimeSource } from '../services/time/time-source';

class AdjustableBrowserTimeSource implements TimeSource {
  private offsetMs = 0;
  private readonly base = new BrowserTimeSource();

  nowWallClockMs(): number {
    return this.base.nowWallClockMs() + this.offsetMs;
  }

  nowMonotonicMs(): number {
    return this.base.nowMonotonicMs() + this.offsetMs;
  }

  advanceMinutes(minutes: number): void {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new RangeError('Developer time advance must be positive');
    }

    this.offsetMs += minutes * 60 * 1000;
  }
}

export interface AppRuntime {
  db: IntervaleDatabase;
  timeSource: TimeSource;
  writeCoordinator: WriteCoordinator;
  invalidationBus: StateInvalidationBus;
  pwaUpdates: PwaUpdateService;
  persistentStorage: PersistentStorageService;
  notifications: NotificationService;
  createId(prefix: string): string;
  developerAdvanceMinutes: ((minutes: number) => void) | null;
}

let singleton: AppRuntime | null = null;

function randomToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const wall = Date.now().toString(36);
  const monotonic =
    typeof performance === 'undefined' ? '0' : Math.floor(performance.now() * 1000).toString(36);

  return wall + '-' + monotonic;
}

export function getAppRuntime(): AppRuntime {
  if (singleton) return singleton;

  const timeSource = import.meta.env.DEV
    ? new AdjustableBrowserTimeSource()
    : new BrowserTimeSource();
  const sourceId = 'tab:' + randomToken();

  singleton = {
    db: createIntervaleDatabase(),
    timeSource,
    writeCoordinator: createBrowserWriteCoordinator(),
    invalidationBus: createBrowserStateInvalidationBus(sourceId),
    pwaUpdates: createBrowserPwaUpdateService(
      import.meta.env.PROD,
      import.meta.env.BASE_URL + 'sw.js',
    ),
    persistentStorage: createBrowserPersistentStorageService(),
    notifications: createBrowserNotificationService(),
    createId(prefix: string) {
      return prefix + ':' + randomToken();
    },
    developerAdvanceMinutes:
      timeSource instanceof AdjustableBrowserTimeSource
        ? (minutes: number) => timeSource.advanceMinutes(minutes)
        : null,
  };

  return singleton;
}
