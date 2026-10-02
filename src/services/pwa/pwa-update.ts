export interface PwaUpdateState {
  supported: boolean;
  registered: boolean;
  updateAvailable: boolean;
}

export interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
}

export interface RegistrationLike {
  installing: WorkerLike | null;
  waiting: WorkerLike | null;
  update(): Promise<void>;
  addEventListener(type: 'updatefound', listener: () => void): void;
}

export interface ServiceWorkerContainerLike {
  controller: unknown | null;
  register(url: string): Promise<RegistrationLike>;
  addEventListener(
    type: 'controllerchange',
    listener: () => void,
    options?: { once?: boolean },
  ): void;
}

export type PwaUpdateListener = (state: PwaUpdateState) => void;

export class PwaUpdateService {
  private registration: RegistrationLike | null = null;
  private state: PwaUpdateState;
  private readonly listeners = new Set<PwaUpdateListener>();

  constructor(
    private readonly container: ServiceWorkerContainerLike | null,
    private readonly workerUrl = '/sw.js',
  ) {
    this.state = {
      supported: container !== null,
      registered: false,
      updateAvailable: false,
    };
  }

  getState(): PwaUpdateState {
    return { ...this.state };
  }

  subscribe(listener: PwaUpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<PwaUpdateState> {
    if (!this.container) return this.getState();

    this.registration = await this.container.register(this.workerUrl);
    this.setState({
      registered: true,
      updateAvailable: this.registration.waiting !== null,
    });

    this.registration.addEventListener('updatefound', () => {
      const installing = this.registration?.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        if (
          installing.state === 'installed' &&
          this.container?.controller &&
          this.registration?.waiting
        ) {
          this.setState({ updateAvailable: true });
        }
      });
    });

    return this.getState();
  }

  async checkForUpdate(): Promise<void> {
    await this.registration?.update();
  }

  async activateWaitingUpdate(): Promise<boolean> {
    const waiting = this.registration?.waiting;
    if (!waiting || !this.container) return false;

    const changed = new Promise<void>((resolve) => {
      this.container?.addEventListener('controllerchange', resolve, {
        once: true,
      });
    });

    waiting.postMessage({ type: 'SKIP_WAITING' });
    await changed;
    this.setState({ updateAvailable: false });
    return true;
  }

  private setState(patch: Partial<Pick<PwaUpdateState, 'registered' | 'updateAvailable'>>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.getState());
  }
}

export function createBrowserPwaUpdateService(enabled: boolean): PwaUpdateService {
  if (!enabled || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return new PwaUpdateService(null);
  }

  return new PwaUpdateService(navigator.serviceWorker as unknown as ServiceWorkerContainerLike);
}
