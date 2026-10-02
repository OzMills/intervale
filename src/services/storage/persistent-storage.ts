export interface PersistentStorageState {
  supported: boolean;
  persisted: boolean | null;
}

export interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

export class PersistentStorageService {
  constructor(private readonly storage: StorageManagerLike | null) {}

  async inspect(): Promise<PersistentStorageState> {
    if (!this.storage?.persisted) {
      return { supported: false, persisted: null };
    }

    return {
      supported: true,
      persisted: await this.storage.persisted(),
    };
  }

  async requestPersistence(): Promise<PersistentStorageState> {
    if (!this.storage?.persist) {
      return { supported: false, persisted: null };
    }

    return {
      supported: true,
      persisted: await this.storage.persist(),
    };
  }
}

export function createBrowserPersistentStorageService(): PersistentStorageService {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return new PersistentStorageService(null);
  }

  return new PersistentStorageService(navigator.storage);
}
