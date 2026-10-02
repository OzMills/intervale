import { afterEach, describe, expect, it } from 'vitest';
import {
  endMeasureEarly,
  pauseMeasure,
  recoverUnresolvedMeasure,
  resumeMeasure,
} from '../../src/application/session/session-commands';
import { ActiveSessionExistsError } from '../../src/application/session/errors';
import { startMeasure } from '../../src/application/session/start-measure';
import { createIntervaleDatabase } from '../../src/persistence/database';
import { initializeDatabase } from '../../src/persistence/initialize';
import { VirtualTimeSource } from '../../src/services/time/time-source';

const databases: ReturnType<typeof createIntervaleDatabase>[] = [];

function database(name: string) {
  const db = createIntervaleDatabase(name);
  databases.push(db);
  return db;
}

async function setup(name: string, time: VirtualTimeSource) {
  const db = database(name);
  await initializeDatabase(db, {
    installationId: `${name}-installation`,
    nowIso: new Date(time.nowWallClockMs()).toISOString(),
  });
  return db;
}

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (db) => {
      const name = db.name;
      db.close();
      await indexedDB.deleteDatabase(name);
    }),
  );
});

describe('Measure session commands', () => {
  it('persists a running session and rejects a second unresolved Measure', async () => {
    const time = new VirtualTimeSource(1_000_000, 0);
    const db = await setup('start-command', time);

    const session = await startMeasure(db, time, {
      id: 'session-1',
      durationMinutes: 25,
      activityType: 'activity.test',
      rootSeed: 'seed-1',
      simulationVersion: 1,
    });

    expect(session.state).toBe('running');
    expect(session.currentRunningStartedAtWallClockMs).toBe(1_000_000);
    expect((await db.meta.get('meta'))?.stateRevision).toBe(1);

    await expect(
      startMeasure(db, time, {
        id: 'session-2',
        durationMinutes: 25,
        activityType: 'activity.test',
        rootSeed: 'seed-2',
        simulationVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ActiveSessionExistsError);
  });

  it('pause commits running credit and closed paused time earns nothing', async () => {
    const time = new VirtualTimeSource(1_000_000, 0);
    const db = await setup('pause-command', time);
    await startMeasure(db, time, {
      id: 'session',
      durationMinutes: 25,
      activityType: 'activity.test',
      rootSeed: 'seed',
      simulationVersion: 1,
    });

    time.advanceBothMs(10 * 60 * 1000);
    const paused = await pauseMeasure(db, time, 'session');

    expect(paused.state).toBe('paused');
    expect(paused.completedRunningSegments).toHaveLength(1);
    expect(paused.completedRunningSegments[0]?.creditedSeconds).toBe(600);

    time.advanceWallClockMs(100 * 60 * 1000);
    const recovered = await recoverUnresolvedMeasure(db, time);

    expect(recovered?.state).toBe('paused');
    expect(recovered?.completedRunningSegments[0]?.creditedSeconds).toBe(600);
  });

  it('resume starts a new segment and early end preserves proportional credit', async () => {
    const time = new VirtualTimeSource(1_000_000, 0);
    const db = await setup('resume-command', time);
    await startMeasure(db, time, {
      id: 'session',
      durationMinutes: 25,
      activityType: 'activity.test',
      rootSeed: 'seed',
      simulationVersion: 1,
    });

    time.advanceBothMs(10 * 60 * 1000);
    await pauseMeasure(db, time, 'session');

    time.advanceWallClockMs(60 * 60 * 1000);
    await resumeMeasure(db, time, 'session');

    time.advanceBothMs(5 * 60 * 1000);
    const ended = await endMeasureEarly(db, time, 'session');

    expect(ended.state).toBe('readyToResolve');
    expect(ended.creditedSecondsAtStop).toBe(900);
    expect(ended.completedRunningSegments.map((segment) => segment.creditedSeconds)).toEqual([
      600, 300,
    ]);
  });

  it('reconstructs a closed running Measure from wall clock after monotonic reset', async () => {
    const time = new VirtualTimeSource(1_000_000, 50_000);
    const db = await setup('reload-command', time);
    await startMeasure(db, time, {
      id: 'session',
      durationMinutes: 25,
      activityType: 'activity.test',
      rootSeed: 'seed',
      simulationVersion: 1,
    });

    time.advanceWallClockMs(10 * 60 * 1000);
    time.resetMonotonicClock();

    db.close();
    const reopened = createIntervaleDatabase('reload-command');
    databases.push(reopened);

    const recovered = await recoverUnresolvedMeasure(reopened, time);

    expect(recovered?.state).toBe('running');
    expect(recovered?.currentRunningStartedAtWallClockMs).toBe(1_000_000);
  });

  it('promotes a Measure to readyToResolve after natural completion and caps credit', async () => {
    const time = new VirtualTimeSource(1_000_000, 0);
    const db = await setup('completion-command', time);
    await startMeasure(db, time, {
      id: 'session',
      durationMinutes: 25,
      activityType: 'activity.test',
      rootSeed: 'seed',
      simulationVersion: 1,
    });

    time.advanceWallClockMs(8 * 60 * 60 * 1000);
    const recovered = await recoverUnresolvedMeasure(db, time);

    expect(recovered?.state).toBe('readyToResolve');
    expect(recovered?.creditedSecondsAtStop).toBe(1500);
    expect(recovered?.completedRunningSegments[0]?.creditedSeconds).toBe(1500);
  });

  it('preserves committed credit through a backwards wall-clock jump', async () => {
    const time = new VirtualTimeSource(1_000_000, 0);
    const db = await setup('backward-command', time);
    await startMeasure(db, time, {
      id: 'session',
      durationMinutes: 25,
      activityType: 'activity.test',
      rootSeed: 'seed',
      simulationVersion: 1,
    });

    time.advanceWallClockMs(10 * 60 * 1000);
    await pauseMeasure(db, time, 'session');
    await resumeMeasure(db, time, 'session');

    time.advanceWallClockMs(-5 * 60 * 1000);
    const ended = await endMeasureEarly(db, time, 'session');

    expect(ended.creditedSecondsAtStop).toBe(600);
    expect(ended.clockAnomalies.map((item) => item.kind)).toContain('backwards-wall-clock');
  });
});
