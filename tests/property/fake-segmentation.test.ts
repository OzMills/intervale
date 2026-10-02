import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { JsonObject } from '../../src/domain/json';
import { simulateActivity } from '../../src/sim';

function run(
  creditedSeconds: number,
  playerSnapshot: JsonObject,
  rootSeed: string,
) {
  return simulateActivity({
    simulationVersion: 1,
    activityType: 'activity.test',
    creditedSeconds,
    playerSnapshot,
    activityParameters: {},
    loadoutSnapshot: {},
    consumableSnapshot: {},
    contentVersion: 'technical-spike-1',
    rootSeed,
  });
}

describe('fake simulation segmentation', () => {
  it('session partitions preserve canonical fake power exactly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1800 }), {
          minLength: 1,
          maxLength: 12,
        }),
        (segments) => {
          const totalSeconds = segments.reduce(
            (sum, value) => sum + value,
            0,
          );

          const single = run(
            totalSeconds,
            {},
            'single-seed',
          );

          let snapshot: JsonObject = {};
          let progress = 0;
          let coins = 0;
          let events = 0;

          segments.forEach((seconds, index) => {
            const result = run(
              seconds,
              snapshot,
              `segment-${index}`,
            );
            progress +=
              result.progressDeltas.testProgress ?? 0;
            coins += result.rewardBundle.testCoins ?? 0;
            events += result.events.length;
            snapshot = {
              fakeActivityState:
                result.stateDeltas.fakeActivityState!,
            };
          });

          expect(progress).toBe(
            single.progressDeltas.testProgress,
          );
          expect(coins).toBe(
            single.rewardBundle.testCoins,
          );
          expect(events).toBe(single.events.length);
          expect(snapshot.fakeActivityState).toEqual(
            single.stateDeltas.fakeActivityState,
          );
        },
      ),
    );
  });
});
