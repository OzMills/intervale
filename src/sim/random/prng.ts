export const SIMULATION_PRNG_VERSION = 1;

export const INITIAL_RANDOM_STREAMS = [
  'combat',
  'ordinaryLoot',
  'events',
  'rareRewards',
  'farmingYield',
  'socialOutcome',
  'reportFlavour',
] as const;

export type RandomStreamName = (typeof INITIAL_RANDOM_STREAMS)[number];

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function deriveSubstreamSeed(
  rootSeed: string,
  simulationVersion: number,
  streamName: string,
): number {
  if (!Number.isInteger(simulationVersion) || simulationVersion <= 0) {
    throw new RangeError('simulationVersion must be a positive integer');
  }

  return fnv1a32(
    `${SIMULATION_PRNG_VERSION}|${simulationVersion}|${streamName}|${rootSeed}`,
  );
}

export class XorShift32 {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }

  nextUint32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive integer');
    }

    return this.nextUint32() % maxExclusive;
  }
}

export function createRandomStream(
  rootSeed: string,
  simulationVersion: number,
  streamName: RandomStreamName,
): XorShift32 {
  return new XorShift32(
    deriveSubstreamSeed(rootSeed, simulationVersion, streamName),
  );
}
