import { describe, expect, it } from 'vitest';
import {
  BroadcastChannelStateInvalidationBus,
  NoopStateInvalidationBus,
  type BroadcastChannelLike,
} from '../../src/services/concurrency/invalidation-bus';
import {
  GAME_WRITE_LOCK_NAME,
  SESSION_RESOLUTION_LOCK_NAME,
  WebLocksWriteCoordinator,
} from '../../src/services/concurrency/write-coordinator';

class FakeBroadcastChannel implements BroadcastChannelLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  readonly sent: unknown[] = [];
  closed = false;

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  emit(message: unknown): void {
    this.onmessage?.({ data: message });
  }

  close(): void {
    this.closed = true;
  }
}

describe('concurrency services', () => {
  it('uses the stable short lock names', async () => {
    const requested: string[] = [];
    const coordinator = new WebLocksWriteCoordinator(
      async <T>(name: string, task: () => Promise<T>) => {
        requested.push(name);
        return task();
      },
    );

    await coordinator.withGameWrite(async () => 'game');
    await coordinator.withSessionResolution(async () => 'resolution');

    expect(requested).toEqual([
      GAME_WRITE_LOCK_NAME,
      SESSION_RESOLUTION_LOCK_NAME,
    ]);
  });

  it('publishes revision hints and ignores same-source messages', () => {
    const channel = new FakeBroadcastChannel();
    const bus = new BroadcastChannelStateInvalidationBus(
      'tab-a',
      channel,
    );
    const received: number[] = [];

    bus.subscribe((message) => received.push(message.stateRevision));
    bus.publishRevision(4);

    expect(channel.sent).toEqual([
      {
        type: 'state-version-changed',
        stateRevision: 4,
        sourceId: 'tab-a',
      },
    ]);

    channel.emit({
      type: 'state-version-changed',
      stateRevision: 5,
      sourceId: 'tab-a',
    });
    channel.emit({
      type: 'state-version-changed',
      stateRevision: 6,
      sourceId: 'tab-b',
    });

    expect(received).toEqual([6]);

    bus.close();
    expect(channel.closed).toBe(true);
  });

  it('supports a complete loss of BroadcastChannel without affecting commands', () => {
    const bus = new NoopStateInvalidationBus();

    expect(() => bus.publishRevision(99)).not.toThrow();
    expect(bus.capability).toBe('none');
  });
});
