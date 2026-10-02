export const GAME_WRITE_LOCK_NAME = 'intervale:game-write';
export const SESSION_RESOLUTION_LOCK_NAME = 'intervale:session-resolution';

export type ConcurrencyCapability = 'web-locks' | 'transaction-fallback';

export interface WriteCoordinator {
  readonly capability: ConcurrencyCapability;
  withGameWrite<T>(task: () => Promise<T>): Promise<T>;
  withSessionResolution<T>(task: () => Promise<T>): Promise<T>;
}

export type ExclusiveLockRequester = <T>(
  name: string,
  task: () => Promise<T>,
) => Promise<T>;

export class TransactionFallbackWriteCoordinator implements WriteCoordinator {
  readonly capability = 'transaction-fallback' as const;

  withGameWrite<T>(task: () => Promise<T>): Promise<T> {
    return task();
  }

  withSessionResolution<T>(task: () => Promise<T>): Promise<T> {
    return task();
  }
}

export class WebLocksWriteCoordinator implements WriteCoordinator {
  readonly capability = 'web-locks' as const;

  constructor(private readonly requestExclusiveLock: ExclusiveLockRequester) {}

  withGameWrite<T>(task: () => Promise<T>): Promise<T> {
    return this.requestExclusiveLock(GAME_WRITE_LOCK_NAME, task);
  }

  withSessionResolution<T>(task: () => Promise<T>): Promise<T> {
    return this.requestExclusiveLock(SESSION_RESOLUTION_LOCK_NAME, task);
  }
}

export const transactionFallbackWriteCoordinator =
  new TransactionFallbackWriteCoordinator();

export function createBrowserWriteCoordinator(): WriteCoordinator {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return transactionFallbackWriteCoordinator;
  }

  return new WebLocksWriteCoordinator(<T>(name: string, task: () => Promise<T>) =>
    navigator.locks.request(name, { mode: 'exclusive' }, async () => task()),
  );
}
