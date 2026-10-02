import { describe, expect, it } from 'vitest';
import {
  PwaUpdateService,
  type RegistrationLike,
  type ServiceWorkerContainerLike,
  type WorkerLike,
} from '../../src/services/pwa/pwa-update';

class FakeWorker implements WorkerLike {
  state = 'installing';
  messages: unknown[] = [];
  private listener: (() => void) | null = null;

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listener = listener;
  }

  setState(state: string): void {
    this.state = state;
    this.listener?.();
  }
}

class FakeRegistration implements RegistrationLike {
  installing: WorkerLike | null = null;
  waiting: WorkerLike | null = null;
  private updateFound: (() => void) | null = null;

  async update(): Promise<void> {}

  addEventListener(_type: 'updatefound', listener: () => void): void {
    this.updateFound = listener;
  }

  emitUpdateFound(): void {
    this.updateFound?.();
  }
}

class FakeContainer implements ServiceWorkerContainerLike {
  controller: unknown | null = {};
  private controllerChange: (() => void) | null = null;

  constructor(readonly registration: FakeRegistration) {}

  async register(_url: string): Promise<RegistrationLike> {
    return this.registration;
  }

  addEventListener(
    _type: 'controllerchange',
    listener: () => void,
    _options?: { once?: boolean },
  ): void {
    this.controllerChange = listener;
  }

  emitControllerChange(): void {
    this.controllerChange?.();
  }
}

describe('PWA update service', () => {
  it('surfaces a waiting update without activating it', async () => {
    const registration = new FakeRegistration();
    registration.waiting = new FakeWorker();
    const service = new PwaUpdateService(new FakeContainer(registration));

    await service.start();

    expect(service.getState()).toMatchObject({
      supported: true,
      registered: true,
      updateAvailable: true,
    });
    expect((registration.waiting as FakeWorker).messages).toEqual([]);
  });

  it('activates only after an explicit request', async () => {
    const registration = new FakeRegistration();
    const waiting = new FakeWorker();
    registration.waiting = waiting;
    const container = new FakeContainer(registration);
    const service = new PwaUpdateService(container);
    await service.start();

    const activation = service.activateWaitingUpdate();
    expect(waiting.messages).toEqual([{ type: 'SKIP_WAITING' }]);

    container.emitControllerChange();

    await expect(activation).resolves.toBe(true);
    expect(service.getState().updateAvailable).toBe(false);
  });
});
