import {
  coordinateSessionResolution,
  type DurableCommandOptions,
} from '../concurrency/command-options';
import type { JsonObject, JsonValue } from '../../domain/json';
import type { SessionRecord } from '../../domain/session/types';
import type { IntervaleDatabase } from '../../persistence/database';
import {
  PersistenceContractError,
} from '../../persistence/errors';
import type {
  EventLogRecord,
  ReportRecord,
} from '../../persistence/records';
import { simulateActivity } from '../../sim';
import type {
  SimulationInput,
  SimulationResult,
} from '../../sim/contracts';
import { validateFakeSimulationResult } from '../../sim/validate-result';
import { stableResolutionHash } from '../../services/stable-hash';
import type { TimeSource } from '../../services/time/time-source';
import { bumpStateRevision } from '../session/meta';
import { applyFakeSimulationResult } from './apply-fake-result';
import {
  ResolutionIntegrityError,
  ResolutionStateError,
} from './errors';

export type ResolutionFaultStage =
  | 'after-simulation'
  | 'after-game-state'
  | 'after-report'
  | 'before-session-resolved';

export type ResolutionFaultInjector = (
  stage: ResolutionFaultStage,
) => void;

export interface ResolveMeasureOptions
  extends DurableCommandOptions {
  faultInjector?: ResolutionFaultInjector;
}

export interface ResolutionOutcome {
  sessionId: string;
  reportId: string;
  resultHash: string;
  alreadyResolved: boolean;
}

function requireCreditedSeconds(
  session: SessionRecord,
): number {
  const creditedSeconds =
    session.creditedSecondsAtStop;

  if (
    creditedSeconds === null ||
    !Number.isFinite(creditedSeconds) ||
    creditedSeconds < 0 ||
    creditedSeconds > session.intendedDurationSeconds
  ) {
    throw new ResolutionIntegrityError(
      'Session has invalid credited duration',
    );
  }

  // The Technical Spike simulation uses whole credited seconds
  // as its explicit canonical input.
  return Math.floor(creditedSeconds);
}

function resolutionInput(
  session: SessionRecord,
  gameState: JsonObject,
  creditedSeconds: number,
): SimulationInput {
  return {
    simulationVersion: session.simulationVersion,
    activityType: session.activityType,
    creditedSeconds,
    playerSnapshot: gameState,
    activityParameters:
      session.activityParameters,
    loadoutSnapshot: session.loadoutSnapshot,
    consumableSnapshot:
      session.consumableSnapshot,
    contentVersion: session.contentVersion,
    rootSeed: session.rootSeed,
  };
}

function resultHash(
  sessionId: string,
  input: SimulationInput,
  result: SimulationResult,
): string {
  return stableResolutionHash({
    sessionId,
    input: input as unknown as JsonValue,
    result: result as unknown as JsonValue,
  });
}

async function loadExistingResolution(
  db: IntervaleDatabase,
  session: SessionRecord,
): Promise<ResolutionOutcome> {
  if (!session.reportId || !session.resultHash) {
    throw new ResolutionIntegrityError(
      'Resolved session is missing report/result hash',
    );
  }

  const report = await db.reports.get(
    session.reportId,
  );
  if (!report) {
    throw new ResolutionIntegrityError(
      'Resolved session references a missing report',
    );
  }

  return {
    sessionId: session.id,
    reportId: report.id,
    resultHash: session.resultHash,
    alreadyResolved: true,
  };
}

function createReport(
  session: SessionRecord,
  creditedSeconds: number,
  result: SimulationResult,
  hash: string,
  resolvedAt: string,
): ReportRecord {
  return {
    id: `report:${session.id}`,
    sessionId: session.id,
    activityType: session.activityType,
    creditedSeconds,
    createdAt: resolvedAt,
    headlineKey: 'report.test.headline',
    summary: {
      rewardBundle:
        result.rewardBundle as unknown as JsonValue,
      progressDeltas:
        result.progressDeltas as unknown as JsonValue,
      eventIds: result.events.map(
        (event) => event.eventId,
      ),
      resultHash: hash,
    },
    reportInputs: result.reportInputs,
  };
}

function createEventRecords(
  sessionId: string,
  reportId: string,
  result: SimulationResult,
): EventLogRecord[] {
  return result.events.map((event) => ({
    sessionId,
    reportId,
    eventType: event.eventId,
    payload: {
      familyId: event.familyId,
      sequence: event.sequence,
      ...event.payload,
    },
  }));
}

export async function resolveMeasure(
  db: IntervaleDatabase,
  timeSource: TimeSource,
  sessionId: string,
  options: ResolveMeasureOptions = {},
): Promise<ResolutionOutcome> {
  return coordinateSessionResolution(
    options,
    () =>
      db.transaction(
        'rw',
        [
          db.meta,
          db.gameState,
          db.sessions,
          db.reports,
          db.eventLog,
        ],
        async () => {
          const session =
            await db.sessions.get(sessionId);
          if (!session) {
            throw new ResolutionStateError(
              `Unknown session ${sessionId}`,
            );
          }

          if (session.state === 'resolved') {
            return {
              value:
                await loadExistingResolution(
                  db,
                  session,
                ),
              stateRevision: null,
            };
          }

          if (
            session.state !== 'readyToResolve'
          ) {
            throw new ResolutionStateError(
              `Session ${sessionId} is ${session.state}, not readyToResolve`,
            );
          }

          const gameState =
            await db.gameState.get('game');
          if (!gameState) {
            throw new PersistenceContractError(
              'Missing game-state record',
            );
          }

          const creditedSeconds =
            requireCreditedSeconds(session);
          const input = resolutionInput(
            session,
            gameState.data,
            creditedSeconds,
          );

          const resolving: SessionRecord = {
            ...session,
            state: 'resolving',
          };
          await db.sessions.put(resolving);

          const simulationResult =
            simulateActivity(input);
          validateFakeSimulationResult(
            simulationResult,
          );
          options.faultInjector?.(
            'after-simulation',
          );

          const hash = resultHash(
            session.id,
            input,
            simulationResult,
          );
          const resolvedAt = new Date(
            timeSource.nowWallClockMs(),
          ).toISOString();

          await db.gameState.put({
            id: 'game',
            data: applyFakeSimulationResult(
              gameState.data,
              simulationResult,
            ),
          });
          options.faultInjector?.(
            'after-game-state',
          );

          const report = createReport(
            session,
            creditedSeconds,
            simulationResult,
            hash,
            resolvedAt,
          );
          await db.reports.add(report);

          const eventRecords =
            createEventRecords(
              session.id,
              report.id,
              simulationResult,
            );
          if (eventRecords.length > 0) {
            await db.eventLog.bulkAdd(
              eventRecords,
            );
          }
          options.faultInjector?.(
            'after-report',
          );

          options.faultInjector?.(
            'before-session-resolved',
          );

          const resolved: SessionRecord = {
            ...resolving,
            state: 'resolved',
            resolvedAt,
            resultHash: hash,
            reportId: report.id,
          };
          await db.sessions.put(resolved);

          const stateRevision =
            await bumpStateRevision(
              db,
              timeSource.nowWallClockMs(),
              options.expectedStateRevision,
            );

          return {
            value: {
              sessionId: session.id,
              reportId: report.id,
              resultHash: hash,
              alreadyResolved: false,
            },
            stateRevision,
          };
        },
      ),
  );
}
