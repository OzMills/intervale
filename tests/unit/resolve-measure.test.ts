import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  resolveMeasure,
  type ResolutionFaultStage,
} from '../../src/application/resolution/resolve-measure';
import { refreshMeasureState } from '../../src/application/session/session-commands';
import { startMeasure } from '../../src/application/session/start-measure';
import { createIntervaleDatabase } from '../../src/persistence/database';
import { initializeDatabase } from '../../src/persistence/initialize';
import { TransactionFallbackWriteCoordinator } from '../../src/services/concurrency/write-coordinator';
import { VirtualTimeSource } from '../../src/services/time/time-source';

const databases: ReturnType<
  typeof createIntervaleDatabase
>[] = [];

function database(name: string) {
  const db = createIntervaleDatabase(name);
  databases.push(db);
  return db;
}

afterEach(async () => {
  const opened = databases.splice(0);
  const names = [
    ...new Set(opened.map((db) => db.name)),
  ];

  for (const db of opened) db.close();
  await Promise.all(
    names.map((name) =>
      indexedDB.deleteDatabase(name),
    ),
  );
});

async function readySession(
  db: ReturnType<typeof createIntervaleDatabase>,
  time: VirtualTimeSource,
  id = 'session',
): Promise<void> {
  await initializeDatabase(db, {
    installationId: 'installation',
    nowIso: new Date(
      time.nowWallClockMs(),
    ).toISOString(),
  });

  await startMeasure(db, time, {
    id,
    durationMinutes: 25,
    activityType: 'activity.test',
    rootSeed: 'seed',
    simulationVersion: 1,
  });

  time.advanceWallClockMs(
    25 * 60 * 1000,
  );
  await refreshMeasureState(db, time, id);
}

describe('exactly-once Measure resolution', () => {
  it('commits fake rewards, report, events and resolved marker in one transaction', async () => {
    const time = new VirtualTimeSource(
      1_000_000,
      0,
    );
    const db = database('resolve-once');
    await readySession(db, time);

    const revisionBefore =
      (await db.meta.get('meta'))
        ?.stateRevision;

    const outcome = await resolveMeasure(
      db,
      time,
      'session',
    );

    expect(outcome.alreadyResolved).toBe(
      false,
    );
    expect(
      (await db.gameState.get('game'))?.data,
    ).toMatchObject({
      testProgress: 100,
      testCoins: 10,
      fakeActivityState: {
        eventBudgetMilli: 800,
      },
    });
    expect(await db.reports.count()).toBe(1);
    expect(
      (await db.sessions.get('session'))
        ?.state,
    ).toBe('resolved');
    expect(
      (await db.sessions.get('session'))
        ?.resultHash,
    ).toBe(outcome.resultHash);
    expect(
      (await db.meta.get('meta'))
        ?.stateRevision,
    ).toBe((revisionBefore ?? 0) + 1);
  });

  it('repeated resolution returns the committed result without awarding again', async () => {
    const time = new VirtualTimeSource(
      1_000_000,
      0,
    );
    const db = database('resolve-repeat');
    await readySession(db, time);

    const first = await resolveMeasure(
      db,
      time,
      'session',
    );
    const revision =
      (await db.meta.get('meta'))
        ?.stateRevision;

    const second = await resolveMeasure(
      db,
      time,
      'session',
    );

    expect(second).toEqual({
      ...first,
      alreadyResolved: true,
    });
    expect(
      (await db.gameState.get('game'))
        ?.data.testCoins,
    ).toBe(10);
    expect(await db.reports.count()).toBe(1);
    expect(
      (await db.meta.get('meta'))
        ?.stateRevision,
    ).toBe(revision);
  });

  it('two connections racing without Web Locks still commit one reward/report', async () => {
    const time = new VirtualTimeSource(
      1_000_000,
      0,
    );
    const dbA = database('resolve-race');
    const dbB = database('resolve-race');
    await readySession(dbA, time);

    const fallback =
      new TransactionFallbackWriteCoordinator();

    const outcomes = await Promise.all([
      resolveMeasure(
        dbA,
        time,
        'session',
        {
          writeCoordinator: fallback,
        },
      ),
      resolveMeasure(
        dbB,
        time,
        'session',
        {
          writeCoordinator: fallback,
        },
      ),
    ]);

    expect(
      outcomes.filter(
        (outcome) =>
          !outcome.alreadyResolved,
      ),
    ).toHaveLength(1);
    expect(
      outcomes.filter(
        (outcome) =>
          outcome.alreadyResolved,
      ),
    ).toHaveLength(1);
    expect(
      (await dbA.gameState.get('game'))
        ?.data.testCoins,
    ).toBe(10);
    expect(await dbA.reports.count()).toBe(1);
  });

  it.each([
    'after-simulation',
    'after-game-state',
    'after-report',
    'before-session-resolved',
  ] as ResolutionFaultStage[])(
    'rolls back every durable write when failure occurs at %s',
    async (faultStage) => {
      const time = new VirtualTimeSource(
        1_000_000,
        0,
      );
      const db = database(
        `fault-${faultStage}`,
      );
      await readySession(db, time);

      const revisionBefore =
        (await db.meta.get('meta'))
          ?.stateRevision;

      await expect(
        resolveMeasure(
          db,
          time,
          'session',
          {
            faultInjector(stage) {
              if (stage === faultStage) {
                throw new Error(
                  `Injected ${stage}`,
                );
              }
            },
          },
        ),
      ).rejects.toThrow(
        `Injected ${faultStage}`,
      );

      expect(
        (await db.gameState.get('game'))
          ?.data,
      ).toEqual({});
      expect(await db.reports.count()).toBe(
        0,
      );
      expect(await db.eventLog.count()).toBe(
        0,
      );
      expect(
        (await db.sessions.get('session'))
          ?.state,
      ).toBe('readyToResolve');
      expect(
        (await db.meta.get('meta'))
          ?.stateRevision,
      ).toBe(revisionBefore);
    },
  );
});
