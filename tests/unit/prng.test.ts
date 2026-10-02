import { describe, expect, it } from 'vitest';
import {
  INITIAL_RANDOM_STREAMS,
  createRandomStream,
  deriveSubstreamSeed,
} from '../../src/sim/random/prng';

describe('versioned PRNG streams', () => {
  it('replays the same sequence for the same root seed/version/stream', () => {
    const first = createRandomStream('seed', 1, 'events');
    const second = createRandomStream('seed', 1, 'events');

    const a = Array.from({ length: 20 }, () =>
      first.nextUint32(),
    );
    const b = Array.from({ length: 20 }, () =>
      second.nextUint32(),
    );

    expect(a).toEqual(b);
  });

  it('derives distinct named substream seeds', () => {
    const seeds = INITIAL_RANDOM_STREAMS.map((stream) =>
      deriveSubstreamSeed('seed', 1, stream),
    );

    expect(new Set(seeds).size).toBe(
      INITIAL_RANDOM_STREAMS.length,
    );
  });

  it('extra report draws do not consume the event stream', () => {
    const eventsA = createRandomStream('seed', 1, 'events');
    const eventsB = createRandomStream('seed', 1, 'events');
    const report = createRandomStream(
      'seed',
      1,
      'reportFlavour',
    );

    for (let index = 0; index < 100; index += 1) {
      report.nextUint32();
    }

    expect(
      Array.from({ length: 10 }, () => eventsA.nextUint32()),
    ).toEqual(
      Array.from({ length: 10 }, () => eventsB.nextUint32()),
    );
  });
});
