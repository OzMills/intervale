import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { completedCreditedSeconds } from '../../src/domain/session/timing';
import type { SessionRecord } from '../../src/domain/session/types';

function sessionFromDurations(seconds: number[]): SessionRecord {
  let cursor = 1_000_000;
  const segments = seconds.map((duration) => {
    const startedAtWallClockMs = cursor;
    const endedAtWallClockMs = cursor + duration * 1000;
    cursor = endedAtWallClockMs + 60_000;
    return { startedAtWallClockMs, endedAtWallClockMs, creditedSeconds: duration };
  });

  return {
    id: 'generated',
    state: 'paused',
    intendedDurationSeconds: 10_800,
    activityType: 'activity.test',
    activitySnapshot: {},
    activityParameters: {},
    loadoutSnapshot: {},
    consumableSnapshot: {},
    taskLabel: null,
    rootSeed: 'seed',
    simulationVersion: 1,
    contentVersion: 'technical-spike-1',
    schemaVersionAtStart: 1,
    createdAt: '2026-10-02T12:00:00.000Z',
    createdAtWallClockMs: 1_000_000,
    startedAtWallClockMs: 1_000_000,
    completedRunningSegments: segments,
    currentRunningStartedAtWallClockMs: null,
    creditedSecondsAtStop: null,
    clockAnomalies: [],
    resolvedAt: null,
    resultHash: null,
    reportId: null,
  };
}

describe('session segmentation properties', () => {
  it('sums eligible running segments independently of paused wall-clock gaps', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 600 }), { minLength: 1, maxLength: 12 }),
        (durations) => {
          const total = durations.reduce((sum, value) => sum + value, 0);
          const session = sessionFromDurations(durations);

          expect(completedCreditedSeconds(session)).toBe(total);
        },
      ),
    );
  });
});
