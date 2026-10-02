import type { DurableCommandOptions } from '../concurrency/command-options';
import { coordinateGameWrite } from '../concurrency/command-options';
import type { JsonObject } from '../../domain/json';
import { measureDurationSeconds } from '../../domain/session/duration';
import type { SessionRecord } from '../../domain/session/types';
import type { IntervaleDatabase } from '../../persistence/database';
import { SAVE_SCHEMA_VERSION, TECHNICAL_SPIKE_CONTENT_VERSION } from '../../persistence/versions';
import type { TimeSource } from '../../services/time/time-source';
import { ActiveSessionExistsError } from './errors';
import { bumpStateRevision } from './meta';

export interface StartMeasureInput {
  id: string;
  durationMinutes: number;
  activityType: string;
  activitySnapshot?: JsonObject;
  activityParameters?: JsonObject;
  loadoutSnapshot?: JsonObject;
  consumableSnapshot?: JsonObject;
  taskLabel?: string | null;
  rootSeed: string;
  simulationVersion: number;
  contentVersion?: string;
}

export async function startMeasure(
  db: IntervaleDatabase,
  timeSource: TimeSource,
  input: StartMeasureInput,
  options: DurableCommandOptions = {},
): Promise<SessionRecord> {
  const intendedDurationSeconds = measureDurationSeconds(input.durationMinutes);
  const nowWallClockMs = timeSource.nowWallClockMs();

  return coordinateGameWrite(options, () =>
    db.transaction('rw', [db.meta, db.sessions], async () => {
      const unresolved = await db.sessions
        .filter((session) => session.state !== 'resolved')
        .first();

      if (unresolved) {
        throw new ActiveSessionExistsError(
          'Another Measure already requires completion or resolution',
        );
      }

      const session: SessionRecord = {
        id: input.id,
        state: 'running',
        intendedDurationSeconds,
        activityType: input.activityType,
        activitySnapshot: input.activitySnapshot ?? {},
        activityParameters: input.activityParameters ?? {},
        loadoutSnapshot: input.loadoutSnapshot ?? {},
        consumableSnapshot: input.consumableSnapshot ?? {},
        taskLabel: input.taskLabel ?? null,
        rootSeed: input.rootSeed,
        simulationVersion: input.simulationVersion,
        contentVersion: input.contentVersion ?? TECHNICAL_SPIKE_CONTENT_VERSION,
        schemaVersionAtStart: SAVE_SCHEMA_VERSION,
        createdAt: new Date(nowWallClockMs).toISOString(),
        createdAtWallClockMs: nowWallClockMs,
        startedAtWallClockMs: nowWallClockMs,
        completedRunningSegments: [],
        currentRunningStartedAtWallClockMs: nowWallClockMs,
        creditedSecondsAtStop: null,
        clockAnomalies: [],
        resolvedAt: null,
        resultHash: null,
        reportId: null,
      };

      await db.sessions.add(session);
      const stateRevision = await bumpStateRevision(
        db,
        nowWallClockMs,
        options.expectedStateRevision,
      );

      return { value: session, stateRevision };
    }),
  );
}
