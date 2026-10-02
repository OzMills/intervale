import { describe, expect, it } from 'vitest';
import { evaluateSessionTiming } from '../../src/domain/session/timing';
import type { SessionRecord } from '../../src/domain/session/types';

function runningSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'session',
    state: 'running',
    intendedDurationSeconds: 1500,
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
    completedRunningSegments: [],
    currentRunningStartedAtWallClockMs: 1_000_000,
    creditedSecondsAtStop: null,
    clockAnomalies: [],
    resolvedAt: null,
    resultHash: null,
    reportId: null,
    ...overrides,
  };
}

describe('session timing', () => {
  it('calculates running credit from wall-clock time and caps at intended duration', () => {
    expect(evaluateSessionTiming(runningSession(), 1_600_000).creditedSeconds).toBe(600);
    expect(evaluateSessionTiming(runningSession(), 10_000_000).creditedSeconds).toBe(1500);
  });

  it('never creates negative credit after a backwards wall-clock jump', () => {
    const session = runningSession({
      completedRunningSegments: [
        {
          startedAtWallClockMs: 100_000,
          endedAtWallClockMs: 700_000,
          creditedSeconds: 600,
        },
      ],
      currentRunningStartedAtWallClockMs: 1_000_000,
    });

    const result = evaluateSessionTiming(session, 900_000);

    expect(result.creditedSeconds).toBe(600);
    expect(result.observations.map((item) => item.kind)).toContain('backwards-wall-clock');
  });

  it('marks structurally ambiguous timing state for recovery', () => {
    const result = evaluateSessionTiming(
      runningSession({ currentRunningStartedAtWallClockMs: null }),
      1_100_000,
    );

    expect(result.requiresRecovery).toBe(true);
    expect(result.observations[0]?.kind).toBe('invalid-timing-state');
  });

  it('records a diagnostic observation for an implausibly large forward jump', () => {
    const result = evaluateSessionTiming(runningSession(), 1_000_000 + 25 * 60 * 60 * 1000);

    expect(result.creditedSeconds).toBe(1500);
    expect(result.observations.map((item) => item.kind)).toContain('large-forward-wall-clock');
  });
});
