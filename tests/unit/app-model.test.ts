import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../src/domain/session/types';
import {
  focusPresentationState,
  formatClock,
  remainingWholeSeconds,
} from '../../src/app/model';

function session(state: SessionRecord['state']): SessionRecord {
  return {
    id: 'session',
    state,
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
    currentRunningStartedAtWallClockMs:
      state === 'running' ? 1_000_000 : null,
    creditedSecondsAtStop:
      state === 'readyToResolve' || state === 'resolved' ? 1500 : null,
    clockAnomalies: [],
    resolvedAt:
      state === 'resolved' ? '2026-10-02T12:25:00.000Z' : null,
    resultHash: state === 'resolved' ? 'hash' : null,
    reportId: state === 'resolved' ? 'report:session' : null,
  };
}

describe('Technical Spike app model', () => {
  it('maps canonical session states to presentation states without screen-history inference', () => {
    expect(focusPresentationState(null)).toBe('ready');
    expect(focusPresentationState(session('running'))).toBe('running');
    expect(focusPresentationState(session('paused'))).toBe('paused');
    expect(focusPresentationState(session('readyToResolve'))).toBe(
      'pending-resolution',
    );
    expect(focusPresentationState(session('recoveryRequired'))).toBe(
      'recovery',
    );
    expect(focusPresentationState(session('resolved'))).toBe('ready');
  });

  it('derives display time from canonical timing rather than callback counts', () => {
    const running = session('running');

    expect(remainingWholeSeconds(running, 1_600_000)).toBe(900);
    expect(remainingWholeSeconds(running, 10_000_000)).toBe(0);
  });

  it('formats minute and hour clocks predictably', () => {
    expect(formatClock(90)).toBe('01:30');
    expect(formatClock(3601)).toBe('1:00:01');
    expect(formatClock(-1)).toBe('00:00');
  });
});
