import {
  closeCurrentRunningSegment,
  completedCreditedSeconds,
  evaluateSessionTiming,
  mergeClockAnomalies,
} from '../../domain/session/timing';
import type { SessionRecord } from '../../domain/session/types';
import type { IntervaleDatabase } from '../../persistence/database';
import type { TimeSource } from '../../services/time/time-source';
import { SessionNotFoundError, SessionStateError } from './errors';
import { bumpStateRevision } from './meta';

function requireSessionState(
  session: SessionRecord,
  expected: readonly SessionRecord['state'][],
): void {
  if (!expected.includes(session.state)) {
    throw new SessionStateError(
      `Session ${session.id} is ${session.state}; expected ${expected.join(' or ')}`,
    );
  }
}

async function requireSession(
  db: IntervaleDatabase,
  sessionId: string,
): Promise<SessionRecord> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new SessionNotFoundError(`Unknown session ${sessionId}`);
  return session;
}

function appendClosedSegment(
  session: SessionRecord,
  segment: ReturnType<typeof closeCurrentRunningSegment>['segment'],
): SessionRecord['completedRunningSegments'] {
  return segment
    ? [...session.completedRunningSegments, segment]
    : [...session.completedRunningSegments];
}

export async function pauseMeasure(
  db: IntervaleDatabase,
  timeSource: TimeSource,
  sessionId: string,
): Promise<SessionRecord> {
  const now = timeSource.nowWallClockMs();

  return db.transaction('rw', [db.meta, db.sessions], async () => {
    const session = await requireSession(db, sessionId);
    requireSessionState(session, ['running']);

    const evaluation = evaluateSessionTiming(session, now);
    if (evaluation.requiresRecovery) {
      const recovery: SessionRecord = {
        ...session,
        state: 'recoveryRequired',
        currentRunningStartedAtWallClockMs: null,
        clockAnomalies: mergeClockAnomalies(session, evaluation.observations),
      };
      await db.sessions.put(recovery);
      await bumpStateRevision(db, now);
      return recovery;
    }

    const closed = closeCurrentRunningSegment(session, now);
    const completedRunningSegments = appendClosedSegment(session, closed.segment);
    const clockAnomalies = mergeClockAnomalies(session, closed.anomalies);

    const next: SessionRecord = evaluation.naturallyComplete
      ? {
          ...session,
          state: 'readyToResolve',
          completedRunningSegments,
          currentRunningStartedAtWallClockMs: null,
          creditedSecondsAtStop: session.intendedDurationSeconds,
          clockAnomalies,
        }
      : {
          ...session,
          state: 'paused',
          completedRunningSegments,
          currentRunningStartedAtWallClockMs: null,
          clockAnomalies,
        };

    await db.sessions.put(next);
    await bumpStateRevision(db, now);
    return next;
  });
}

export async function resumeMeasure(
  db: IntervaleDatabase,
  timeSource: TimeSource,
  sessionId: string,
): Promise<SessionRecord> {
  const now = timeSource.nowWallClockMs();

  return db.transaction('rw', [db.meta, db.sessions], async () => {
    const session = await requireSession(db, sessionId);
    requireSessionState(session, ['paused']);

    const next: SessionRecord = {
      ...session,
      state: 'running',
      currentRunningStartedAtWallClockMs: now,
    };

    await db.sessions.put(next);
    await bumpStateRevision(db, now);
    return next;
  });
}

export async function endMeasureEarly(
  db: IntervaleDatabase,
  timeSource: TimeSource,
  sessionId: string,
): Promise<SessionRecord> {
  const now = timeSource.nowWallClockMs();

  return db.transaction('rw', [db.meta, db.sessions], async () => {
    const session = await requireSession(db, sessionId);
    requireSessionState(session, ['running', 'paused']);

    if (session.state === 'paused') {
      const creditedSeconds = Math.min(
        session.intendedDurationSeconds,
        completedCreditedSeconds(session),
      );
      const next: SessionRecord = {
        ...session,
        state: 'readyToResolve',
        creditedSecondsAtStop: creditedSeconds,
      };
      await db.sessions.put(next);
      await bumpStateRevision(db, now);
      return next;
    }

    const evaluation = evaluateSessionTiming(session, now);
    if (evaluation.requiresRecovery) {
      const recovery: SessionRecord = {
        ...session,
        state: 'recoveryRequired',
        currentRunningStartedAtWallClockMs: null,
        clockAnomalies: mergeClockAnomalies(session, evaluation.observations),
      };
      await db.sessions.put(recovery);
      await bumpStateRevision(db, now);
      return recovery;
    }

    const closed = closeCurrentRunningSegment(session, now);
    const next: SessionRecord = {
      ...session,
      state: 'readyToResolve',
      completedRunningSegments: appendClosedSegment(session, closed.segment),
      currentRunningStartedAtWallClockMs: null,
      creditedSecondsAtStop: closed.creditedSeconds,
      clockAnomalies: mergeClockAnomalies(session, closed.anomalies),
    };

    await db.sessions.put(next);
    await bumpStateRevision(db, now);
    return next;
  });
}

export async function refreshMeasureState(
  db: IntervaleDatabase,
  timeSource: TimeSource,
  sessionId: string,
): Promise<SessionRecord> {
  const now = timeSource.nowWallClockMs();

  return db.transaction('rw', [db.meta, db.sessions], async () => {
    const session = await requireSession(db, sessionId);
    if (session.state !== 'running') return session;

    const evaluation = evaluateSessionTiming(session, now);
    const clockAnomalies = mergeClockAnomalies(session, evaluation.observations);

    if (evaluation.requiresRecovery) {
      const recovery: SessionRecord = {
        ...session,
        state: 'recoveryRequired',
        currentRunningStartedAtWallClockMs: null,
        clockAnomalies,
      };
      await db.sessions.put(recovery);
      await bumpStateRevision(db, now);
      return recovery;
    }

    if (!evaluation.naturallyComplete) {
      if (clockAnomalies.length !== session.clockAnomalies.length) {
        const observed: SessionRecord = { ...session, clockAnomalies };
        await db.sessions.put(observed);
        await bumpStateRevision(db, now);
        return observed;
      }
      return session;
    }

    const closed = closeCurrentRunningSegment(session, now);
    const ready: SessionRecord = {
      ...session,
      state: 'readyToResolve',
      completedRunningSegments: appendClosedSegment(session, closed.segment),
      currentRunningStartedAtWallClockMs: null,
      creditedSecondsAtStop: session.intendedDurationSeconds,
      clockAnomalies: mergeClockAnomalies(session, closed.anomalies),
    };

    await db.sessions.put(ready);
    await bumpStateRevision(db, now);
    return ready;
  });
}

export async function recoverUnresolvedMeasure(
  db: IntervaleDatabase,
  timeSource: TimeSource,
): Promise<SessionRecord | undefined> {
  const unresolved = await db.sessions.filter((session) => session.state !== 'resolved').toArray();
  if (unresolved.length === 0) return undefined;
  if (unresolved.length > 1) {
    throw new SessionStateError('Multiple unresolved Measures exist');
  }

  const session = unresolved[0];
  if (!session) return undefined;

  if (session.state === 'running') {
    return refreshMeasureState(db, timeSource, session.id);
  }

  return session;
}
