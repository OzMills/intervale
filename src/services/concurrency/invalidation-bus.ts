export const STATE_INVALIDATION_CHANNEL_NAME = 'intervale:state';

export interface StateVersionChangedMessage {
  type: 'state-version-changed';
  stateRevision: number;
  sourceId: string;
}

export type StateInvalidationListener = (
  message: StateVersionChangedMessage,
) => void;

interface MessageEventLike {
  data: unknown;
}

export interface BroadcastChannelLike {
  onmessage: ((event: MessageEventLike) => void) | null;
  postMessage(message: unknown): void;
  close(): void;
}

export interface StateInvalidationBus {
  readonly capability: 'broadcast-channel' | 'none';
  publishRevision(stateRevision: number): void;
  subscribe(listener: StateInvalidationListener): () => void;
  close(): void;
}

export class NoopStateInvalidationBus implements StateInvalidationBus {
  readonly capability = 'none' as const;

  publishRevision(stateRevision: number): void {
    void stateRevision;
  }

  subscribe(listener: StateInvalidationListener): () => void {
    void listener;
    return () => {};
  }

  close(): void {}
}

export class BroadcastChannelStateInvalidationBus
  implements StateInvalidationBus
{
  readonly capability = 'broadcast-channel' as const;
  private readonly listeners = new Set<StateInvalidationListener>();

  constructor(
    private readonly sourceId: string,
    private readonly channel: BroadcastChannelLike,
  ) {
    this.channel.onmessage = (event) => {
      const message = parseStateVersionChangedMessage(event.data);
      if (!message || message.sourceId === this.sourceId) return;

      for (const listener of this.listeners) listener(message);
    };
  }

  publishRevision(stateRevision: number): void {
    if (!Number.isInteger(stateRevision) || stateRevision < 0) {
      throw new RangeError('stateRevision must be a nonnegative integer');
    }

    const message: StateVersionChangedMessage = {
      type: 'state-version-changed',
      stateRevision,
      sourceId: this.sourceId,
    };
    this.channel.postMessage(message);
  }

  subscribe(listener: StateInvalidationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.listeners.clear();
    this.channel.close();
  }
}

export function createBrowserStateInvalidationBus(
  sourceId: string,
): StateInvalidationBus {
  if (typeof BroadcastChannel === 'undefined') {
    return new NoopStateInvalidationBus();
  }

  const channel = new BroadcastChannel(
    STATE_INVALIDATION_CHANNEL_NAME,
  ) as unknown as BroadcastChannelLike;

  return new BroadcastChannelStateInvalidationBus(sourceId, channel);
}

function parseStateVersionChangedMessage(
  value: unknown,
): StateVersionChangedMessage | null {
  if (value === null || typeof value !== 'object') return null;

  const candidate = value as Partial<StateVersionChangedMessage>;
  if (
    candidate.type !== 'state-version-changed' ||
    typeof candidate.sourceId !== 'string' ||
    !Number.isInteger(candidate.stateRevision) ||
    (candidate.stateRevision ?? -1) < 0
  ) {
    return null;
  }

  return candidate as StateVersionChangedMessage;
}
