import { afterEach, describe, expect, it } from 'vitest';
import { StaleStateRevisionError } from '../../src/application/concurrency/errors';
import { pauseMeasure } from '../../src/application/session/session-commands';
import { startMeasure } from '../../src/application/session/start-measure';
import { createIntervaleDatabase } from '../../src/persistence/database';
import { initializeDatabase } from '../../src/persistence/initialize';
import type { StateInvalidationBus } from '../../src/services/concurrency/invalidation-bus';
import {
  TransactionFallbackWriteCoordinator,
  type WriteCoordinator,
} from '../../src/services/concurrency/write-coordinator';
import { VirtualTimeSource } from '../../src/services/time/time-source';

const databases: ReturnType<typeof createIntervaleDatabase>[] = [];

function database(name: string) {
  const db = createIntervaleDatabase(name);
  databases.push(db);
  return db;
}

afterEach(async () => {
  const opened = databases.splice(0);
  const names = [...new Set(opened.map((db) => db.name))];

  for (const db of opened) db.close();

  await Promise.all(
    names.map(async (name) => {
      await indexedDB.deleteDatabase(name);
    }),
  );
});

class RecordingBus implements StateInvalidationBus {
  readonly capability = 'none' as const;
  readonly revisions: number[] = [];

  publishRevision(stateRevision: number): void {
    this.revisions.push(stateRevision);
  }

  subscribe(): () => void {
    return () => {};
  }

  close(): void {}
}

describe('durable concurrency behaviour', () => {
  it('allows exactly one canonical session when two tabs race to Start without Web Locks', async () => {
    const time = new VirtualTimeSource(1_000_000, 0);
    const dbA = database('start-race');
    const dbB = database('start-race');

    await initializeDatabase(dbA, {
      installationId: 'installation',
      nowIso: new Date(time.nowWallClockMs()).toISOString(),
    });

    const fallback = new TransactionFallbackWriteCoordinator();

    const results = await Promise.allSettled([
      startMeasure(
        dbA,
        time,
        {
          id: 'session-a',
          durationMinutes: 25,
          activityType: 'activity.test',
          rootSeed: 'seed-a',
          simulationVersion: 1,
        },
        { writeCoordinator: fallback },
      ),
      startMeasure(
        dbB,
        time,
        {
          id: 'session-b',
          durationMinutes: 25,
          activityType: 'activity.test',
          rootSeed: 'seed-b',
          simulationVersion: 1,
        },
        { writeCoordinator: fallback },
      ),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await dbA.sessions.count()).toBe(1);
  });

  it('rejects a stale state-dependent command and rolls back its mutation', async () => {
    const time = new VirtualTimeSource(1_000_000, 0);
    const db = database('stale-revision');

    await initializeDatabase(db, {
      installationId: 'installation',
      nowIso: new Date(time.nowWallClockMs()).toISOString(),
    });

    await startMeasure(
      db,
      time,
      {
        id: 'session',
        durationMinutes: 25,
        activityType: 'activity.test',
        rootSeed: 'seed',
        simulationVersion: 1,
      },
      { expectedStateRevision: 0 },
    );

    time.advanceWallClockMs(5 * 60 * 1000);

    await expect(
      pauseMeasure(db, time, 'session', {
        expectedStateRevision: 0,
      }),
    ).rejects.toBeInstanceOf(StaleStateRevisionError);

    expect((await db.sessions.get('session'))?.state).toBe('running');
    expect((await db.sessions.get('session'))?.completedRunningSegments).toEqual([]);
    expect((await db.meta.get('meta'))?.stateRevision).toBe(1);
  });

  it('publishes the committed revision only after a successful durable mutation', async () => {
    const time = new VirtualTimeSource(1_000_000, 0);
    const db = database('revision-broadcast');
    const bus = new RecordingBus();

    await initializeDatabase(db, {
      installationId: 'installation',
      nowIso: new Date(time.nowWallClockMs()).toISOString(),
    });

    await startMeasure(
      db,
      time,
      {
        id: 'session',
        durationMinutes: 25,
        activityType: 'activity.test',
        rootSeed: 'seed',
        simulationVersion: 1,
      },
      { invalidationBus: bus },
    );

    expect(bus.revisions).toEqual([1]);
  });

  it('uses a supplied Web-Lock coordinator around the complete durable command', async () => {
    const time = new VirtualTimeSource(1_000_000, 0);
    const db = database('lock-command');

    await initializeDatabase(db, {
      installationId: 'installation',
      nowIso: new Date(time.nowWallClockMs()).toISOString(),
    });

    const trace: string[] = [];
    const coordinator: WriteCoordinator = {
      capability: 'web-locks',
      async withGameWrite<T>(task: () => Promise<T>): Promise<T> {
        trace.push('lock');
        const result = await task();
        trace.push('unlock');
        return result;
      },
      withSessionResolution<T>(task: () => Promise<T>): Promise<T> {
        return task();
      },
    };

    await startMeasure(
      db,
      time,
      {
        id: 'session',
        durationMinutes: 25,
        activityType: 'activity.test',
        rootSeed: 'seed',
        simulationVersion: 1,
      },
      { writeCoordinator: coordinator },
    );

    expect(trace).toEqual(['lock', 'unlock']);
    expect(await db.sessions.count()).toBe(1);
  });
});
